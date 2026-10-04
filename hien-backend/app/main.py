import antigravity  # noqa: F401 — Antigravity easter egg 🚀 (required, do not remove)

"""
HIEN Backend — FastAPI Application
====================================
Hyperlocal Inventory Exchange Network

Endpoints:
  GET  /health                          — Service health check
  POST /api/v1/returns/evaluate-demand  — Calculate Local Demand Score (LDS)
  POST /api/v1/inventory/ingest         — Ingest inventory from a return
  GET  /api/v1/discovery/local-feed     — GeoJSON feed for Mapbox
  POST /api/v1/cron/price-decay         — Simulate price aging
  POST /api/v1/demo/seed                — Seed demo data (dev only)
"""

import logging
import math
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_X, ST_Y
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, cast
from sqlalchemy.orm import Session
from geoalchemy2 import Geography

from app.database import Base, engine, get_db, check_db_connection
from app.models import DemandSignal, LocalInventory, SignalType, InventoryStatus
from app.schemas import (
    DemandEvaluationRequest,
    DemandEvaluationResponse,
    DemandBreakdown,
    InventoryIngestRequest,
    InventoryIngestResponse,
    GeoJSONFeatureCollection,
    GeoJSONFeature,
    GeoJSONPointGeometry,
    GeoJSONFeatureProperties,
    PriceDecayResponse,
    DemoSeedResponse,
    HealthResponse,
)
from app.services.demand import calculate_lds, get_category_velocity, route_decision

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("hien")

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
load_dotenv()

CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="HIEN — Hyperlocal Inventory Exchange Network",
    description=(
        "Backend API for HIEN. Redirects eligible e-commerce returns to nearby "
        "partner stores (Access Points) instead of centralised warehouses."
    ),
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS — allow the React/Vite frontend
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Create tables on startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    """Create all tables if they don't exist yet."""
    logger.info("Creating database tables (if not present)…")
    Base.metadata.create_all(bind=engine)
    logger.info("HIEN backend started. CORS origins: %s", CORS_ORIGINS)


# ===================================================================
# HEALTH CHECK
# ===================================================================

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Service health check",
)
def health_check() -> HealthResponse:
    db_ok = check_db_connection()
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        service="HIEN Backend",
        database="connected" if db_ok else "unreachable",
    )


# ===================================================================
# A — DEMAND EVALUATION
# ===================================================================

@app.post(
    "/api/v1/returns/evaluate-demand",
    response_model=DemandEvaluationResponse,
    tags=["Returns"],
    summary="Evaluate local demand for a returned product",
    description=(
        "Searches demand signals within 3 km of the Access Point, computes the "
        "Local Demand Score (LDS), and returns a routing decision."
    ),
)
def evaluate_demand(
    body: DemandEvaluationRequest,
    db: Session = Depends(get_db),
) -> DemandEvaluationResponse:

    # Build the Access Point as a PostGIS geography point
    # WKT: POINT(longitude latitude)
    ap_point = WKTElement(
        f"POINT({body.access_point_lon} {body.access_point_lat})",
        srid=4326,
    )

    search_radius_m = 3000  # 3 km

    # ----- Count demand signals by type within the radius -----
    # Cast geometry → geography so ST_DWithin uses metres, not degrees.
    wishlist_count: int = (
        db.query(func.count(DemandSignal.id))
        .filter(
            DemandSignal.category == body.category,
            DemandSignal.signal_type == SignalType.wishlist,
            ST_DWithin(
                cast(DemandSignal.geom, Geography),
                cast(ap_point, Geography),
                search_radius_m,
            ),
        )
        .scalar()
    ) or 0

    search_count: int = (
        db.query(func.count(DemandSignal.id))
        .filter(
            DemandSignal.category == body.category,
            DemandSignal.signal_type == SignalType.search,
            ST_DWithin(
                cast(DemandSignal.geom, Geography),
                cast(ap_point, Geography),
                search_radius_m,
            ),
        )
        .scalar()
    ) or 0

    # ----- Category velocity (mock ML) -----
    cat_velocity = get_category_velocity(body.category)

    # ----- Existing inventory with same SKU near this Access Point -----
    existing_inventory: int = (
        db.query(func.count(LocalInventory.id))
        .filter(
            LocalInventory.sku == body.sku,
            LocalInventory.status == InventoryStatus.LOCAL_LIVE,
            ST_DWithin(
                cast(LocalInventory.geom, Geography),
                cast(ap_point, Geography),
                search_radius_m,
            ),
        )
        .scalar()
    ) or 0

    # ----- Calculate LDS -----
    lds_score = calculate_lds(
        wishlist_count=wishlist_count,
        search_count=search_count,
        category_velocity=cat_velocity,
        existing_inventory=existing_inventory,
    )

    routing = route_decision(lds_score)

    logger.info(
        "LDS=%.2f → %s | category=%s sku=%s | W=%d S=%d V=%.2f I=%d",
        lds_score, routing, body.category, body.sku,
        wishlist_count, search_count, cat_velocity, existing_inventory,
    )

    return DemandEvaluationResponse(
        routing=routing,
        lds_score=lds_score,
        breakdown=DemandBreakdown(
            wishlist_count=wishlist_count,
            search_count=search_count,
            category_velocity=cat_velocity,
            existing_inventory=existing_inventory,
        ),
    )


# ===================================================================
# B — INVENTORY INGESTION
# ===================================================================

@app.post(
    "/api/v1/inventory/ingest",
    response_model=InventoryIngestResponse,
    tags=["Inventory"],
    summary="Ingest a returned product into inventory",
    description=(
        "Creates an inventory record at the Access Point. "
        "LOCAL_LIVE items get an initial 15 % discount; "
        "CENTRAL_ROUTING items are priced at 0 and excluded from the buyer feed."
    ),
)
def ingest_inventory(
    body: InventoryIngestRequest,
    db: Session = Depends(get_db),
) -> InventoryIngestResponse:

    # Determine status and initial price
    if body.routing_decision == "LOCAL_LIVE":
        status = InventoryStatus.LOCAL_LIVE
        current_price = round(body.msrp * 0.85, 2)  # 15 % initial discount
    else:
        status = InventoryStatus.CENTRAL_ROUTING
        current_price = 0.0

    item = LocalInventory(
        access_point_id=body.access_point_id,
        sku=body.sku,
        category=body.category,
        geom=WKTElement(f"POINT({body.lon} {body.lat})", srid=4326),
        status=status,
        msrp=body.msrp,
        current_price=current_price,
        days_on_shelf=0,
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    logger.info(
        "Ingested %s → %s | price=%.2f | AP=%s",
        item.sku, item.status.value, item.current_price, item.access_point_id,
    )

    return InventoryIngestResponse(
        success=True,
        inventory_id=str(item.id),
        status=item.status.value,
        sku=item.sku,
        msrp=item.msrp,
        current_price=item.current_price,
    )


# ===================================================================
# C — LOCAL DISCOVERY FEED  (GeoJSON)
# ===================================================================

@app.get(
    "/api/v1/discovery/local-feed",
    response_model=GeoJSONFeatureCollection,
    tags=["Discovery"],
    summary="GeoJSON feed of nearby local inventory",
    description=(
        "Returns LOCAL_LIVE products within the specified radius as a GeoJSON "
        "FeatureCollection, ready for Mapbox GL JS."
    ),
)
def local_feed(
    buyer_lat: float = Query(..., ge=-90, le=90, description="Buyer latitude"),
    buyer_lon: float = Query(..., ge=-180, le=180, description="Buyer longitude"),
    radius_meters: float = Query(3000, gt=0, description="Search radius in metres"),
    db: Session = Depends(get_db),
) -> GeoJSONFeatureCollection:

    buyer_point = WKTElement(
        f"POINT({buyer_lon} {buyer_lat})",
        srid=4326,
    )

    # Query LOCAL_LIVE items within the radius, include distance
    rows = (
        db.query(
            LocalInventory,
            ST_Distance(
                cast(LocalInventory.geom, Geography),
                cast(buyer_point, Geography),
            ).label("distance_m"),
            ST_X(LocalInventory.geom).label("lon"),
            ST_Y(LocalInventory.geom).label("lat"),
        )
        .filter(
            LocalInventory.status == InventoryStatus.LOCAL_LIVE,
            ST_DWithin(
                cast(LocalInventory.geom, Geography),
                cast(buyer_point, Geography),
                radius_meters,
            ),
        )
        .order_by("distance_m")
        .all()
    )

    features: list[GeoJSONFeature] = []
    for item, distance_m, lon, lat in rows:
        discount_pct = round((1 - item.current_price / item.msrp) * 100, 1) if item.msrp else 0

        features.append(
            GeoJSONFeature(
                geometry=GeoJSONPointGeometry(
                    coordinates=[lon, lat],  # GeoJSON = [lon, lat]
                ),
                properties=GeoJSONFeatureProperties(
                    id=str(item.id),
                    sku=item.sku,
                    category=item.category,
                    msrp=item.msrp,
                    current_price=item.current_price,
                    discount_percent=discount_pct,
                    access_point_id=item.access_point_id,
                    distance_meters=round(distance_m, 1) if distance_m else None,
                ),
            )
        )

    return GeoJSONFeatureCollection(features=features)


# ===================================================================
# D — PRICE DECAY SIMULATION
# ===================================================================

@app.post(
    "/api/v1/cron/price-decay",
    response_model=PriceDecayResponse,
    tags=["Pricing"],
    summary="Simulate price decay for shelf-aging products",
    description=(
        "For every LOCAL_LIVE item, increments days_on_shelf by 1, recalculates "
        "the price from MSRP (idempotent formula), and routes items ≥ 14 days "
        "to CENTRAL_ROUTING."
    ),
)
def price_decay(db: Session = Depends(get_db)) -> PriceDecayResponse:
    """
    Price-decay formula (applied idempotently from MSRP):
        decay_periods = floor(days_on_shelf / 2)
        new_price     = msrp × 0.85 × (0.99 ^ decay_periods)

    Safety: the price is always recalculated from MSRP + days_on_shelf,
    so calling this endpoint multiple times at the same shelf-day is safe.

    14-day rule: items with days_on_shelf >= 14 are routed to CENTRAL_ROUTING.
    """

    items = (
        db.query(LocalInventory)
        .filter(LocalInventory.status == InventoryStatus.LOCAL_LIVE)
        .all()
    )

    updated = 0
    routed_to_central = 0

    for item in items:
        # Advance the shelf clock by 1 day
        item.days_on_shelf += 1

        # 14-day expiry check
        if item.days_on_shelf >= 14:
            item.status = InventoryStatus.CENTRAL_ROUTING
            item.current_price = 0.0
            routed_to_central += 1
            updated += 1
            continue

        # Idempotent price calculation from MSRP + current days_on_shelf
        decay_periods = math.floor(item.days_on_shelf / 2)
        new_price = item.msrp * 0.85 * (0.99 ** decay_periods)
        item.current_price = round(new_price, 2)
        updated += 1

    db.commit()

    logger.info(
        "Price decay complete: %d updated, %d routed to central",
        updated, routed_to_central,
    )

    return PriceDecayResponse(
        success=True,
        updated_items=updated,
        routed_to_central=routed_to_central,
    )


# ===================================================================
# DEMO SEED  (development only)
# ===================================================================

@app.post(
    "/api/v1/demo/seed",
    response_model=DemoSeedResponse,
    tags=["Demo"],
    summary="Seed the database with demo data (dev only)",
    description=(
        "Creates sample demand signals and inventory items around Chennai, India "
        "for hackathon demonstrations. Safe to call multiple times."
    ),
)
def seed_demo_data(db: Session = Depends(get_db)) -> DemoSeedResponse:
    """
    ⚠️  DEVELOPMENT ONLY — do not use in production.
    Creates realistic demo data centred on Chennai (13.08°N, 80.27°E).
    """

    # --- Demand Signals ---
    signals = [
        # Inside 3 km of AP-001 (13.0827, 80.2707)
        {"type": SignalType.wishlist, "cat": "jackets",     "lat": 13.0850, "lon": 80.2720},
        {"type": SignalType.search,  "cat": "jackets",     "lat": 13.0810, "lon": 80.2690},
        {"type": SignalType.wishlist, "cat": "shoes",       "lat": 13.0835, "lon": 80.2715},
        {"type": SignalType.search,  "cat": "shoes",       "lat": 13.0840, "lon": 80.2700},
        {"type": SignalType.wishlist, "cat": "electronics", "lat": 13.0820, "lon": 80.2730},
        {"type": SignalType.search,  "cat": "electronics", "lat": 13.0815, "lon": 80.2695},
        {"type": SignalType.wishlist, "cat": "bags",        "lat": 13.0830, "lon": 80.2710},
        # Outside 3 km (far away)
        {"type": SignalType.wishlist, "cat": "jackets",     "lat": 13.1200, "lon": 80.3100},
        {"type": SignalType.search,  "cat": "shoes",       "lat": 12.9700, "lon": 80.2000},
    ]

    demand_count = 0
    for s in signals:
        db.add(DemandSignal(
            signal_type=s["type"],
            category=s["cat"],
            geom=WKTElement(f"POINT({s['lon']} {s['lat']})", srid=4326),
        ))
        demand_count += 1

    # --- Inventory Items ---
    inventory_items = [
        {
            "sku": "SHOE-001", "cat": "shoes", "msrp": 3500,
            "lat": 13.0827, "lon": 80.2707, "ap": "AP-001",
            "status": InventoryStatus.LOCAL_LIVE, "price": 2975, "days": 2,
        },
        {
            "sku": "ELEC-001", "cat": "electronics", "msrp": 15000,
            "lat": 13.0827, "lon": 80.2707, "ap": "AP-001",
            "status": InventoryStatus.LOCAL_LIVE, "price": 12750, "days": 0,
        },
        {
            "sku": "BAG-001", "cat": "bags", "msrp": 2200,
            "lat": 13.0900, "lon": 80.2750, "ap": "AP-002",
            "status": InventoryStatus.LOCAL_LIVE, "price": 1870, "days": 4,
        },
        {
            "sku": "JACKET-002", "cat": "jackets", "msrp": 5000,
            "lat": 13.0600, "lon": 80.2500, "ap": "AP-003",
            "status": InventoryStatus.CENTRAL_ROUTING, "price": 0, "days": 0,
        },
        # Item far from AP-001 (outside 3 km)
        {
            "sku": "SHOE-002", "cat": "shoes", "msrp": 4000,
            "lat": 13.1500, "lon": 80.3200, "ap": "AP-004",
            "status": InventoryStatus.LOCAL_LIVE, "price": 3400, "days": 6,
        },
    ]

    inv_count = 0
    for i in inventory_items:
        db.add(LocalInventory(
            access_point_id=i["ap"],
            sku=i["sku"],
            category=i["cat"],
            geom=WKTElement(f"POINT({i['lon']} {i['lat']})", srid=4326),
            status=i["status"],
            msrp=i["msrp"],
            current_price=i["price"],
            days_on_shelf=i["days"],
        ))
        inv_count += 1

    db.commit()

    logger.info("Demo seed: %d signals, %d inventory items created", demand_count, inv_count)

    return DemoSeedResponse(
        success=True,
        demand_signals_created=demand_count,
        inventory_items_created=inv_count,
    )
