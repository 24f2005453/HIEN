import antigravity  # noqa: F401 — Antigravity easter egg 🚀 (required, do not remove)

"""
HIEN Backend — FastAPI Application
====================================
Hyperlocal Inventory Exchange Network

Endpoints:
  Health & Readiness:
    GET  /health                                — Service health & database connectivity
    GET  /ready                                 — Readiness probe (HTTP 503 on degraded DB)

  Product Catalog:
    GET  /api/v1/catalog/barcode/{barcode}      — Authoritative catalog lookup by barcode / SKU
    GET  /api/v1/catalog/products               — List authoritative catalog products

  Access Points:
    GET   /api/v1/access-points                 — List verified partner Access Points
    GET   /api/v1/access-points/{ap_id}         — Get Access Point details
    POST  /api/v1/access-points                 — Register a new Access Point
    PATCH /api/v1/access-points/{ap_id}         — Update Access Point location / address

  Demand Signals & Evaluation:
    POST /api/v1/demand-signals                 — Capture customer demand signals (wishlist/search)
    POST /api/v1/returns/evaluate-demand        — Calculate Local Demand Score (LDS) within 3 km

  Inventory Ingestion & Discovery:
    POST /api/v1/inventory/ingest               — Ingest inventory from a return into an Access Point
    GET  /api/v1/discovery/local-feed           — GeoJSON FeatureCollection feed for buyer discovery

  Doorstep Return Pickups & Reverse Logistics:
    GET   /api/v1/returns                       — List return orders and pickup status
    GET   /api/v1/returns/{return_id}           — Get details of a single return order
    POST  /api/v1/returns                       — Create/request a return pickup
    PATCH /api/v1/returns/{return_id}/status    — Advance pickup lifecycle status
    PATCH /api/v1/returns/{return_id}/location  — Update live GPS coordinates

  Warehouse Operations & Custody Flow:
    GET   /api/v1/warehouse/custody-queue       — Queue of returns awaiting warehouse collection / transit
    PATCH /api/v1/warehouse/returns/{return_id}/status — Advance warehouse custody status (scheduled, transit, received)

  In-Store Buyer Reservations:
    GET   /api/v1/reservations                  — List buyer reservations (filter by AP or buyer)
    POST  /api/v1/reservations                  — Create a new reservation hold
    PATCH /api/v1/reservations/{res_id}/status  — Advance reservation status (ready, completed, cancelled)

  Inquiries & Messaging:
    GET   /api/v1/conversations                 — List messaging conversations
    POST  /api/v1/conversations                 — Create or find conversation
    GET   /api/v1/conversations/{conv_id}/messages — Get conversation messages
    POST  /api/v1/conversations/{conv_id}/messages — Send message in conversation

  Administrative / Cron & Demo:
    POST /api/v1/cron/price-decay               — Administrative shelf price aging
    POST /api/v1/demo/seed                      — Seed catalog, signals, inventory, APs, and returns
"""

import json
import logging
import math
import os
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Query, Header, Response, status
from fastapi.middleware.cors import CORSMiddleware
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_X, ST_Y
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, cast, text
from sqlalchemy.orm import Session
from geoalchemy2 import Geography

from app.database import Base, engine, get_db, check_db_connection
from app.models import (
    DemandSignal,
    LocalInventory,
    CatalogProduct,
    AccessPoint,
    ReturnOrder,
    Reservation,
    Conversation,
    Message,
    SignalType,
    InventoryStatus,
)
from app.schemas import (
    CatalogProductResponse,
    CatalogProductCreate,
    AccessPointResponse,
    AccessPointCreate,
    AccessPointUpdate,
    DemandSignalCreateRequest,
    DemandSignalCreateResponse,
    DemandEvaluationRequest,
    DemandEvaluationResponse,
    DemandBreakdown,
    InventoryIngestRequest,
    InventoryIngestResponse,
    GeoJSONFeatureCollection,
    GeoJSONFeature,
    GeoJSONPointGeometry,
    GeoJSONFeatureProperties,
    LiveCoordinatesSchema,
    WarehouseCustodyEventSchema,
    ReturnOrderResponse,
    ReturnOrderCreateRequest,
    ReturnStatusUpdateRequest,
    ReturnLocationUpdateRequest,
    WarehouseStatusUpdateRequest,
    ReservationResponse,
    ReservationCreateRequest,
    ReservationStatusUpdateRequest,
    MessageResponse,
    MessageCreateRequest,
    ConversationResponse,
    ConversationCreateRequest,
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
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("hien")

# ---------------------------------------------------------------------------
# Environment & CORS configuration
# ---------------------------------------------------------------------------
load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
CRON_SECRET = os.getenv("CRON_SECRET", "")

raw_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:5173",
)
CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in raw_origins.split(",")
    if origin.strip()
]

CORS_ORIGIN_REGEX = (
    r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$"
)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="HIEN — Hyperlocal Inventory Exchange Network",
    description=(
        "Backend API for HIEN. Redirects eligible e-commerce returns to nearby "
        "partner stores (Access Points) with edge AI verification, 3 km demand evaluation, "
        "doorstep return logistics, and local buyer discovery."
    ),
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Default Master Catalog & Access Point Seed Data
# ---------------------------------------------------------------------------
DEFAULT_CATALOG_ITEMS = [
    {
        "barcode": "890123456789",
        "sku": "NIKE-AZ-10",
        "name": "Nike Air Zoom",
        "size_or_variant": "Size 10",
        "msrp": 3000.0,
        "category": "Footwear",
        "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
    },
    {
        "barcode": "890123456790",
        "sku": "SAMSUNG-GB-2",
        "name": "Samsung Galaxy Buds Pro",
        "size_or_variant": "Phantom Black",
        "msrp": 5000.0,
        "category": "Electronics",
        "image_url": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
    },
    {
        "barcode": "890123456791",
        "sku": "ADIDAS-RS-9",
        "name": "Adidas Running Shoes",
        "size_or_variant": "Size 9",
        "msrp": 4000.0,
        "category": "Footwear",
        "image_url": "https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=600&auto=format&fit=crop&q=80",
    },
    {
        "barcode": "890123456792",
        "sku": "JBL-SPK-6",
        "name": "JBL Flip 6 Portable Speaker",
        "size_or_variant": "Midnight Blue",
        "msrp": 7000.0,
        "category": "Audio",
        "image_url": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80",
    },
    {
        "barcode": "890123456793",
        "sku": "APPLE-STP-44",
        "name": "Apple Watch Magnetic Strap",
        "size_or_variant": "44mm Black",
        "msrp": 1500.0,
        "category": "Accessories",
        "image_url": "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80",
    },
    {
        "barcode": "890123456794",
        "sku": "SONY-WH-XM4",
        "name": "Sony WH-1000XM4 Wireless",
        "size_or_variant": "Silver",
        "msrp": 19999.0,
        "category": "Audio",
        "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
    },
]

DEFAULT_ACCESS_POINTS = [
    {
        "id": "ap-04",
        "code": "AP-04",
        "name": "Express Electronics",
        "address": "123 Anna Salai, Teynampet, Chennai, Tamil Nadu - 600018",
        "area": "Teynampet",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pincode": "600018",
        "latitude": 13.0418,
        "longitude": 80.2341,
        "phone": "+91 98401 23456",
        "status": "ACTIVE",
    },
    {
        "id": "ap-09",
        "code": "AP-09",
        "name": "Nexus Tech Point",
        "address": "45 GN Chetty Road, T. Nagar, Chennai, Tamil Nadu - 600017",
        "area": "T. Nagar",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pincode": "600017",
        "latitude": 13.0405,
        "longitude": 80.2435,
        "phone": "+91 98402 34567",
        "status": "ACTIVE",
    },
    {
        "id": "ap-12",
        "code": "AP-12",
        "name": "City HyperHub",
        "address": "78 Cathedral Road, Gopalapuram, Chennai, Tamil Nadu - 600086",
        "area": "Gopalapuram",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pincode": "600086",
        "latitude": 13.0475,
        "longitude": 80.2520,
        "phone": "+91 98403 45678",
        "status": "ACTIVE",
    },
]

DEFAULT_RETURN_ORDERS = [
    {
        "id": "RET-1042",
        "order_number": "ORD-99214",
        "product_id": "prod-01",
        "product_name": "Nike Air Zoom",
        "product_sku": "NIKE-AZ-10",
        "product_image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
        "refund_amount": 3000.0,
        "returner_id": "buyer-01",
        "returner_name": "Rahul Verma",
        "returner_phone": "+91 98405 99887",
        "access_point_id": "ap-04",
        "access_point_name": "Express Electronics",
        "access_point_code": "AP-04",
        "status": "PICKUP_IN_PROGRESS",
        "pickup_address": "Flat 4B, Emerald Residency, Cenotaph Road, Teynampet, Chennai",
        "pickup_lat": 13.0458,
        "pickup_lon": 80.2382,
        "location_sharing_enabled": True,
        "pickup_person_id": "pickup-raj",
        "pickup_person_name": "Raj",
        "pickup_person_phone": "+91 98409 88776",
        "pickup_person_lat": 13.0422,
        "pickup_person_lon": 80.2355,
        "vehicle_number": "TN-09-AX-4412",
        "eta_minutes": 8,
        "distance_km": 1.2,
        "warehouse_pickup_status": "AWAITING_ACCESS_POINT",
        "is_demo_movement": True,
    },
    {
        "id": "RET-1043",
        "order_number": "ORD-88120",
        "product_id": "prod-02",
        "product_name": "Samsung Galaxy Buds Pro",
        "product_sku": "SAMSUNG-GB-2",
        "product_image_url": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
        "refund_amount": 5000.0,
        "returner_id": "buyer-01",
        "returner_name": "Rahul Verma",
        "returner_phone": "+91 98405 99887",
        "access_point_id": "ap-04",
        "access_point_name": "Express Electronics",
        "access_point_code": "AP-04",
        "status": "PRODUCT_COLLECTED",
        "pickup_address": "42 Eldams Road, Teynampet, Chennai",
        "pickup_lat": 13.0410,
        "pickup_lon": 80.2410,
        "location_sharing_enabled": False,
        "pickup_person_id": "pickup-raj",
        "pickup_person_name": "Raj",
        "pickup_person_phone": "+91 98409 88776",
        "warehouse_pickup_status": "STORED_AT_ACCESS_POINT",
        "is_demo_movement": False,
        "warehouse_custody_events": json.dumps([
            {
                "id": "custody-RET-1043-1",
                "status": "STORED_AT_ACCESS_POINT",
                "timestamp": "2026-10-03T10:15:00Z",
                "actor": "AP-04 Manager",
            }
        ]),
    },
    {
        "id": "RET-1044",
        "order_number": "ORD-77401",
        "product_id": "prod-05",
        "product_name": "Apple Watch Magnetic Strap",
        "product_sku": "APPLE-STP-44",
        "product_image_url": "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80",
        "refund_amount": 1500.0,
        "returner_id": "buyer-01",
        "returner_name": "Rahul Verma",
        "returner_phone": "+91 98405 99887",
        "access_point_id": "ap-04",
        "access_point_name": "Express Electronics",
        "access_point_code": "AP-04",
        "status": "RETURN_REQUESTED",
        "pickup_address": "Flat 4B, Cenotaph Road, Teynampet, Chennai",
        "pickup_lat": 13.0458,
        "pickup_lon": 80.2382,
        "location_sharing_enabled": False,
        "warehouse_pickup_status": "AWAITING_ACCESS_POINT",
        "is_demo_movement": False,
    },
]

DEFAULT_RESERVATIONS = [
    {
        "id": "res-01",
        "product_id": "prod-02",
        "product_name": "Samsung Galaxy Buds Pro",
        "product_sku": "SAMSUNG-GB-2",
        "product_price": 4250.0,
        "product_image_url": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
        "access_point_id": "ap-04",
        "access_point_name": "Express Electronics",
        "access_point_code": "AP-04",
        "buyer_id": "buyer-02",
        "buyer_name": "Priya",
        "buyer_phone": "+91 98404 11223",
        "status": "READY_FOR_PICKUP",
    },
    {
        "id": "res-02",
        "product_id": "prod-04",
        "product_name": "JBL Flip 6 Portable Speaker",
        "product_sku": "JBL-SPK-6",
        "product_price": 5950.0,
        "product_image_url": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80",
        "access_point_id": "ap-04",
        "access_point_name": "Express Electronics",
        "access_point_code": "AP-04",
        "buyer_id": "buyer-01",
        "buyer_name": "Rahul",
        "buyer_phone": "+91 98405 99887",
        "status": "COMPLETED",
    },
]


# ---------------------------------------------------------------------------
# Database schema initialization & safe migration
# ---------------------------------------------------------------------------

def safe_upgrade_schema() -> None:
    """Non-destructive schema verification, column upgrades, and initial seeder."""
    try:
        with engine.connect() as conn:
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                conn.commit()
            except Exception as exc:
                logger.warning("Could not execute CREATE EXTENSION postgis: %s", exc)

            # Ensure new columns exist on local_inventory without dropping existing tables
            alter_statements = [
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS product_name VARCHAR;",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS barcode VARCHAR;",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS image_url VARCHAR;",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS condition VARCHAR DEFAULT 'Pristine';",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS size_or_variant VARCHAR;",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS access_point_name VARCHAR;",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS access_point_code VARCHAR;",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS access_point_address VARCHAR;",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS is_mismatch_return BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS ai_confidence FLOAT;",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS original_barcode VARCHAR;",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS original_sku VARCHAR;",
                "ALTER TABLE local_inventory ADD COLUMN IF NOT EXISTS original_product_name VARCHAR;",
                "CREATE INDEX IF NOT EXISTS ix_local_inventory_barcode ON local_inventory (barcode);",
                "CREATE INDEX IF NOT EXISTS idx_demand_signals_geog ON demand_signals USING gist (((geom)::geography));",
                "CREATE INDEX IF NOT EXISTS idx_local_inventory_geog ON local_inventory USING gist (((geom)::geography));",
            ]
            for stmt in alter_statements:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception as exc:
                    logger.debug("Schema upgrade notice for '%s': %s", stmt[:30], exc)

            # Add enum values to inventory_status_enum non-destructively
            for enum_val in ("RESERVED", "SOLD"):
                try:
                    conn.execute(text(f"ALTER TYPE inventory_status_enum ADD VALUE IF NOT EXISTS '{enum_val}';"))
                    conn.commit()
                except Exception as exc:
                    logger.debug("Enum update notice for %s: %s", enum_val, exc)

        # Create any missing tables (catalog_products, access_points, return_orders, reservations, conversations, messages)
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema verified and up-to-date.")

        # Seed catalog products if empty
        with engine.connect() as conn:
            catalog_count = conn.execute(text("SELECT count(*) FROM catalog_products")).scalar() or 0
            if catalog_count == 0:
                logger.info("Master catalog is empty. Seeding initial catalog products...")
                for item in DEFAULT_CATALOG_ITEMS:
                    conn.execute(
                        text(
                            "INSERT INTO catalog_products (id, barcode, sku, name, category, size_or_variant, msrp, image_url, created_at) "
                            "VALUES (gen_random_uuid(), :barcode, :sku, :name, :category, :size_or_variant, :msrp, :image_url, NOW()) "
                            "ON CONFLICT (barcode) DO NOTHING;"
                        ),
                        item,
                    )
                conn.commit()
                logger.info("Seeded %d products into catalog_products.", len(DEFAULT_CATALOG_ITEMS))

            # Seed Access Points if empty
            ap_count = conn.execute(text("SELECT count(*) FROM access_points")).scalar() or 0
            if ap_count == 0:
                logger.info("Access points table is empty. Seeding default access points...")
                for ap_item in DEFAULT_ACCESS_POINTS:
                    conn.execute(
                        text(
                            "INSERT INTO access_points (id, code, name, address, area, city, state, pincode, phone, status, latitude, longitude, geom, created_at) "
                            "VALUES (:id, :code, :name, :address, :area, :city, :state, :pincode, :phone, :status, :latitude, :longitude, "
                            "ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326), NOW()) "
                            "ON CONFLICT (id) DO NOTHING;"
                        ),
                        ap_item,
                    )
                conn.commit()
                logger.info("Seeded %d access points.", len(DEFAULT_ACCESS_POINTS))

            # Seed Return Orders if empty
            return_count = conn.execute(text("SELECT count(*) FROM return_orders")).scalar() or 0
            if return_count == 0:
                logger.info("Return orders table is empty. Seeding default return orders...")
                for ret in DEFAULT_RETURN_ORDERS:
                    conn.execute(
                        text(
                            "INSERT INTO return_orders (id, order_number, product_id, product_name, product_sku, product_image_url, refund_amount, "
                            "returner_id, returner_name, returner_phone, access_point_id, access_point_name, access_point_code, status, "
                            "pickup_address, pickup_lat, pickup_lon, geom, location_sharing_enabled, pickup_person_id, pickup_person_name, "
                            "pickup_person_phone, pickup_person_lat, pickup_person_lon, vehicle_number, eta_minutes, distance_km, "
                            "warehouse_pickup_status, warehouse_custody_events, is_demo_movement, created_at) "
                            "VALUES (:id, :order_number, :product_id, :product_name, :product_sku, :product_image_url, :refund_amount, "
                            ":returner_id, :returner_name, :returner_phone, :access_point_id, :access_point_name, :access_point_code, :status, "
                            ":pickup_address, :pickup_lat, :pickup_lon, ST_SetSRID(ST_MakePoint(:pickup_lon, :pickup_lat), 4326), :location_sharing_enabled, "
                            ":pickup_person_id, :pickup_person_name, :pickup_person_phone, :pickup_person_lat, :pickup_person_lon, "
                            ":vehicle_number, :eta_minutes, :distance_km, :warehouse_pickup_status, :warehouse_custody_events, :is_demo_movement, NOW()) "
                            "ON CONFLICT (id) DO NOTHING;"
                        ),
                        {
                            "pickup_person_lat": ret.get("pickup_person_lat"),
                            "pickup_person_lon": ret.get("pickup_person_lon"),
                            "vehicle_number": ret.get("vehicle_number"),
                            "eta_minutes": ret.get("eta_minutes"),
                            "distance_km": ret.get("distance_km"),
                            "warehouse_custody_events": ret.get("warehouse_custody_events"),
                            "pickup_person_id": ret.get("pickup_person_id"),
                            "pickup_person_name": ret.get("pickup_person_name"),
                            "pickup_person_phone": ret.get("pickup_person_phone"),
                            **ret,
                        },
                    )
                conn.commit()
                logger.info("Seeded %d return orders.", len(DEFAULT_RETURN_ORDERS))

            # Seed Reservations if empty
            res_count = conn.execute(text("SELECT count(*) FROM reservations")).scalar() or 0
            if res_count == 0:
                logger.info("Reservations table is empty. Seeding default reservations...")
                for res in DEFAULT_RESERVATIONS:
                    conn.execute(
                        text(
                            "INSERT INTO reservations (id, product_id, product_name, product_sku, product_price, product_image_url, "
                            "access_point_id, access_point_name, access_point_code, buyer_id, buyer_name, buyer_phone, status, reserved_at, updated_at) "
                            "VALUES (:id, :product_id, :product_name, :product_sku, :product_price, :product_image_url, "
                            ":access_point_id, :access_point_name, :access_point_code, :buyer_id, :buyer_name, :buyer_phone, :status, NOW(), NOW()) "
                            "ON CONFLICT (id) DO NOTHING;"
                        ),
                        res,
                    )
                conn.commit()
                logger.info("Seeded %d reservations.", len(DEFAULT_RESERVATIONS))

    except Exception as exc:
        logger.error("Database schema upgrade or check encountered an issue: %s", exc)


@app.on_event("startup")
def on_startup() -> None:
    logger.info("HIEN backend starting up in '%s' environment...", ENVIRONMENT)
    safe_upgrade_schema()
    logger.info("HIEN backend ready. CORS origins: %s", CORS_ORIGINS)


# ===================================================================
# 1. HEALTH & READINESS ENDPOINTS
# ===================================================================

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Service health check",
)
def health_check(response: Response) -> HealthResponse:
    db_ok = check_db_connection()
    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(
            status="degraded",
            service="HIEN Backend",
            database="unreachable",
            version="0.3.0",
        )

    return HealthResponse(
        status="ok",
        service="HIEN Backend",
        database="connected",
        version="0.3.0",
    )


@app.get(
    "/ready",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Readiness check for container orchestrators",
)
def readiness_check(response: Response) -> HealthResponse:
    return health_check(response)


# ===================================================================
# 2. AUTHORITATIVE PRODUCT CATALOG
# ===================================================================

@app.get(
    "/api/v1/catalog/barcode/{barcode}",
    response_model=CatalogProductResponse,
    tags=["Catalog"],
    summary="Lookup authoritative product metadata by barcode or SKU",
)
def get_catalog_product_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
) -> CatalogProductResponse:
    clean_code = barcode.strip().upper()

    product = (
        db.query(CatalogProduct)
        .filter(
            (func.upper(CatalogProduct.barcode) == clean_code)
            | (func.upper(CatalogProduct.sku) == clean_code)
        )
        .first()
    )

    if not product:
        fallback = next(
            (item for item in DEFAULT_CATALOG_ITEMS if item["barcode"] == clean_code or item["sku"].upper() == clean_code),
            None,
        )
        if fallback:
            open_box = round(fallback["msrp"] * 0.85, 2)
            return CatalogProductResponse(
                barcode=fallback["barcode"],
                sku=fallback["sku"],
                name=fallback["name"],
                category=fallback["category"],
                size_or_variant=fallback["size_or_variant"],
                msrp=fallback["msrp"],
                open_box_price=open_box,
                image_url=fallback["image_url"],
            )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with barcode or SKU '{barcode}' was not found in authoritative catalog.",
        )

    open_box_price = round(product.msrp * 0.85, 2)
    return CatalogProductResponse(
        barcode=product.barcode,
        sku=product.sku,
        name=product.name,
        category=product.category,
        size_or_variant=product.size_or_variant,
        msrp=product.msrp,
        open_box_price=open_box_price,
        image_url=product.image_url,
    )


@app.get(
    "/api/v1/catalog/products",
    response_model=List[CatalogProductResponse],
    tags=["Catalog"],
    summary="List all master catalog products",
)
def list_catalog_products(db: Session = Depends(get_db)) -> List[CatalogProductResponse]:
    products = db.query(CatalogProduct).all()
    results: List[CatalogProductResponse] = []
    for p in products:
        results.append(
            CatalogProductResponse(
                barcode=p.barcode,
                sku=p.sku,
                name=p.name,
                category=p.category,
                size_or_variant=p.size_or_variant,
                msrp=p.msrp,
                open_box_price=round(p.msrp * 0.85, 2),
                image_url=p.image_url,
            )
        )
    return results


# ===================================================================
# 3. ACCESS POINTS (Partner Stores & Network Hubs)
# ===================================================================

@app.get(
    "/api/v1/access-points",
    response_model=List[AccessPointResponse],
    tags=["Access Points"],
    summary="List all partner Access Points",
)
def list_access_points(db: Session = Depends(get_db)) -> List[AccessPointResponse]:
    aps = db.query(AccessPoint).order_by(AccessPoint.code).all()
    if not aps:
        # Fallback to in-memory default list
        return [AccessPointResponse(**ap) for ap in DEFAULT_ACCESS_POINTS]

    return [
        AccessPointResponse(
            id=ap.id,
            code=ap.code,
            name=ap.name,
            address=ap.address,
            area=ap.area,
            city=ap.city,
            state=ap.state,
            pincode=ap.pincode,
            phone=ap.phone,
            status=ap.status,
            latitude=ap.latitude,
            longitude=ap.longitude,
        )
        for ap in aps
    ]


@app.get(
    "/api/v1/access-points/{ap_id}",
    response_model=AccessPointResponse,
    tags=["Access Points"],
    summary="Get details of a specific Access Point",
)
def get_access_point(ap_id: str, db: Session = Depends(get_db)) -> AccessPointResponse:
    clean_id = ap_id.strip().lower()
    ap = db.query(AccessPoint).filter(func.lower(AccessPoint.id) == clean_id).first()
    if not ap:
        fallback = next((a for a in DEFAULT_ACCESS_POINTS if a["id"].lower() == clean_id), None)
        if fallback:
            return AccessPointResponse(**fallback)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Access Point '{ap_id}' not found.",
        )

    return AccessPointResponse(
        id=ap.id,
        code=ap.code,
        name=ap.name,
        address=ap.address,
        area=ap.area,
        city=ap.city,
        state=ap.state,
        pincode=ap.pincode,
        phone=ap.phone,
        status=ap.status,
        latitude=ap.latitude,
        longitude=ap.longitude,
    )


@app.post(
    "/api/v1/access-points",
    response_model=AccessPointResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Access Points"],
    summary="Register a new partner Access Point",
)
def create_access_point(
    body: AccessPointCreate,
    db: Session = Depends(get_db),
) -> AccessPointResponse:
    ap_id = body.id or f"ap-{datetime.now().strftime('%M%S')}"
    code = body.code or f"AP-{ap_id.split('-')[-1].upper()}"

    existing = db.query(AccessPoint).filter(AccessPoint.id == ap_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Access Point with ID '{ap_id}' already exists.",
        )

    geom_elem = WKTElement(f"POINT({body.longitude} {body.latitude})", srid=4326)
    new_ap = AccessPoint(
        id=ap_id,
        code=code,
        name=body.name,
        address=body.address,
        area=body.area,
        city=body.city,
        state=body.state or "Tamil Nadu",
        pincode=body.pincode,
        phone=body.phone,
        status=body.status or "ACTIVE",
        latitude=body.latitude,
        longitude=body.longitude,
        geom=geom_elem,
    )
    db.add(new_ap)
    db.commit()
    db.refresh(new_ap)

    return AccessPointResponse(
        id=new_ap.id,
        code=new_ap.code,
        name=new_ap.name,
        address=new_ap.address,
        area=new_ap.area,
        city=new_ap.city,
        state=new_ap.state,
        pincode=new_ap.pincode,
        phone=new_ap.phone,
        status=new_ap.status,
        latitude=new_ap.latitude,
        longitude=new_ap.longitude,
    )


@app.patch(
    "/api/v1/access-points/{ap_id}",
    response_model=AccessPointResponse,
    tags=["Access Points"],
    summary="Update Access Point location or address",
)
def update_access_point(
    ap_id: str,
    body: AccessPointUpdate,
    db: Session = Depends(get_db),
) -> AccessPointResponse:
    clean_id = ap_id.strip().lower()
    ap = db.query(AccessPoint).filter(func.lower(AccessPoint.id) == clean_id).first()
    if not ap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Access Point '{ap_id}' not found.",
        )

    if body.name is not None:
        ap.name = body.name
    if body.address is not None:
        ap.address = body.address
    if body.area is not None:
        ap.area = body.area
    if body.city is not None:
        ap.city = body.city
    if body.state is not None:
        ap.state = body.state
    if body.pincode is not None:
        ap.pincode = body.pincode
    if body.phone is not None:
        ap.phone = body.phone
    if body.status is not None:
        ap.status = body.status

    if body.latitude is not None and body.longitude is not None:
        ap.latitude = body.latitude
        ap.longitude = body.longitude
        ap.geom = WKTElement(f"POINT({body.longitude} {body.latitude})", srid=4326)

    db.commit()
    db.refresh(ap)

    return AccessPointResponse(
        id=ap.id,
        code=ap.code,
        name=ap.name,
        address=ap.address,
        area=ap.area,
        city=ap.city,
        state=ap.state,
        pincode=ap.pincode,
        phone=ap.phone,
        status=ap.status,
        latitude=ap.latitude,
        longitude=ap.longitude,
    )


# ===================================================================
# 4. DEMAND SIGNALS (Wishlist & Search Event Ingestion)
# ===================================================================

@app.post(
    "/api/v1/demand-signals",
    response_model=DemandSignalCreateResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Demand"],
    summary="Capture a wishlist or search demand signal",
)
def create_demand_signal(
    body: DemandSignalCreateRequest,
    db: Session = Depends(get_db),
) -> DemandSignalCreateResponse:
    sig_type = SignalType.wishlist if body.signal_type == "wishlist" else SignalType.search
    geom_elem = WKTElement(f"POINT({body.lon} {body.lat})", srid=4326)

    signal = DemandSignal(
        signal_type=sig_type,
        category=body.category.lower().strip(),
        geom=geom_elem,
    )
    db.add(signal)
    db.commit()
    db.refresh(signal)

    logger.info("Captured demand signal: %s in %s at (%.4f, %.4f)", sig_type.value, signal.category, body.lat, body.lon)

    return DemandSignalCreateResponse(
        success=True,
        signal_id=str(signal.id),
        signal_type=signal.signal_type.value,
        category=signal.category,
        lat=body.lat,
        lon=body.lon,
        timestamp=signal.timestamp.isoformat(),
    )


# ===================================================================
# 5. DEMAND EVALUATION (3 km Hyperlocal Radius Check)
# ===================================================================

@app.post(
    "/api/v1/returns/evaluate-demand",
    response_model=DemandEvaluationResponse,
    tags=["Returns"],
    summary="Evaluate local demand for a returned product",
    description="Searches demand signals within 3 km of the Access Point, computes LDS, and returns an authoritative routing decision.",
)
def evaluate_demand(
    body: DemandEvaluationRequest,
    db: Session = Depends(get_db),
) -> DemandEvaluationResponse:
    ap_point = WKTElement(
        f"POINT({body.access_point_lon} {body.access_point_lat})",
        srid=4326,
    )
    search_radius_m = 3000.0

    wishlist_count: int = (
        db.query(func.count(DemandSignal.id))
        .filter(
            func.lower(DemandSignal.category) == body.category.lower().strip(),
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
            func.lower(DemandSignal.category) == body.category.lower().strip(),
            DemandSignal.signal_type == SignalType.search,
            ST_DWithin(
                cast(DemandSignal.geom, Geography),
                cast(ap_point, Geography),
                search_radius_m,
            ),
        )
        .scalar()
    ) or 0

    cat_velocity = get_category_velocity(body.category)

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

    lds_score = calculate_lds(
        wishlist_count=wishlist_count,
        search_count=search_count,
        category_velocity=cat_velocity,
        existing_inventory=existing_inventory,
    )

    routing = route_decision(lds_score)

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
# 6. INVENTORY INGESTION (Standard & Mismatch Returns)
# ===================================================================

@app.post(
    "/api/v1/inventory/ingest",
    response_model=InventoryIngestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Inventory"],
    summary="Ingest a returned product into inventory",
    description="Creates an authoritative inventory record at the Access Point with support for mismatch returns.",
)
def ingest_inventory(
    body: InventoryIngestRequest,
    db: Session = Depends(get_db),
) -> InventoryIngestResponse:
    if body.routing_decision == "LOCAL_LIVE":
        item_status = InventoryStatus.LOCAL_LIVE
        current_price = round(body.msrp * 0.85, 2)
    else:
        item_status = InventoryStatus.CENTRAL_ROUTING
        current_price = 0.0

    product_name = body.product_name
    image_url = body.image_url
    size_or_variant = body.size_or_variant

    if not product_name or not image_url:
        cat_match = (
            db.query(CatalogProduct)
            .filter((CatalogProduct.sku == body.sku) | (CatalogProduct.barcode == (body.barcode or "")))
            .first()
        )
        if cat_match:
            product_name = product_name or cat_match.name
            image_url = image_url or cat_match.image_url
            size_or_variant = size_or_variant or cat_match.size_or_variant
        else:
            def_match = next(
                (item for item in DEFAULT_CATALOG_ITEMS if item["sku"] == body.sku or item["barcode"] == body.barcode),
                None,
            )
            if def_match:
                product_name = product_name or def_match["name"]
                image_url = image_url or def_match["image_url"]
                size_or_variant = size_or_variant or def_match["size_or_variant"]
            else:
                product_name = product_name or f"{body.category.title()} ({body.sku})"

    # Look up Access Point from database
    db_ap = db.query(AccessPoint).filter(AccessPoint.id == body.access_point_id).first()
    if db_ap:
        ap_name = body.access_point_name or db_ap.name
        ap_code = body.access_point_code or db_ap.code
        ap_address = body.access_point_address or db_ap.address
    else:
        ap_info = next((a for a in DEFAULT_ACCESS_POINTS if a["id"] == body.access_point_id), {})
        ap_name = body.access_point_name or ap_info.get("name", f"Access Point {body.access_point_id}")
        ap_code = body.access_point_code or ap_info.get("code", body.access_point_id.upper())
        ap_address = body.access_point_address or ap_info.get("address", "Chennai Network Point")

    geom_elem = WKTElement(f"POINT({body.lon} {body.lat})", srid=4326)

    item = LocalInventory(
        access_point_id=body.access_point_id,
        sku=body.sku,
        category=body.category,
        geom=geom_elem,
        status=item_status,
        msrp=body.msrp,
        current_price=current_price,
        days_on_shelf=0,
        product_name=product_name,
        barcode=body.barcode,
        image_url=image_url,
        condition=body.condition or "Pristine",
        size_or_variant=size_or_variant,
        access_point_name=ap_name,
        access_point_code=ap_code,
        access_point_address=ap_address,
        is_mismatch_return=body.is_mismatch_return or False,
        ai_confidence=body.ai_confidence,
        original_barcode=body.original_barcode,
        original_sku=body.original_sku,
        original_product_name=body.original_product_name,
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    logger.info(
        "Ingested %s -> %s | price=%.2f | AP=%s (id=%s) | mismatch=%s",
        item.sku, item.status.value, item.current_price, item.access_point_id, str(item.id), item.is_mismatch_return,
    )

    return InventoryIngestResponse(
        success=True,
        inventory_id=str(item.id),
        status=item.status.value,
        sku=item.sku,
        msrp=item.msrp,
        current_price=item.current_price,
        product_name=item.product_name,
        image_url=item.image_url,
        condition=item.condition,
        access_point_id=item.access_point_id,
        is_mismatch_return=item.is_mismatch_return,
        ai_confidence=item.ai_confidence,
        original_barcode=item.original_barcode,
        original_sku=item.original_sku,
        original_product_name=item.original_product_name,
    )


# ===================================================================
# 7. LOCAL DISCOVERY FEED (GeoJSON FeatureCollection)
# ===================================================================

@app.get(
    "/api/v1/discovery/local-feed",
    response_model=GeoJSONFeatureCollection,
    tags=["Discovery"],
    summary="GeoJSON feed of nearby local inventory for Mapbox GL JS",
    description="Returns active LOCAL_LIVE items within the requested radius. Coordinates follow GeoJSON standard: [longitude, latitude].",
)
def local_feed(
    buyer_lat: float = Query(..., ge=-90, le=90, description="Buyer latitude"),
    buyer_lon: float = Query(..., ge=-180, le=180, description="Buyer longitude"),
    radius_meters: float = Query(3000.0, gt=0, le=50000, description="Search radius in metres (default 3000)"),
    limit: int = Query(100, ge=1, le=500, description="Maximum items to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: Session = Depends(get_db),
) -> GeoJSONFeatureCollection:
    buyer_point = WKTElement(
        f"POINT({buyer_lon} {buyer_lat})",
        srid=4326,
    )

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
        .offset(offset)
        .limit(limit)
        .all()
    )

    features: list[GeoJSONFeature] = []
    for item, distance_m, lon, lat in rows:
        discount_pct = (
            round((1 - item.current_price / item.msrp) * 100, 1)
            if item.msrp and item.msrp > 0
            else 0.0
        )

        formatted_distance = round(distance_m, 1) if distance_m is not None else None

        features.append(
            GeoJSONFeature(
                geometry=GeoJSONPointGeometry(
                    coordinates=[lon, lat],
                ),
                properties=GeoJSONFeatureProperties(
                    id=str(item.id),
                    sku=item.sku,
                    category=item.category,
                    msrp=item.msrp,
                    current_price=item.current_price,
                    discount_percent=discount_pct,
                    access_point_id=item.access_point_id,
                    distance_meters=formatted_distance,
                    name=item.product_name or f"{item.category.title()} ({item.sku})",
                    barcode=item.barcode,
                    image_url=item.image_url,
                    condition=item.condition or "Pristine",
                    size_or_variant=item.size_or_variant,
                    access_point_name=item.access_point_name,
                    access_point_code=item.access_point_code,
                    access_point_address=item.access_point_address,
                    is_mismatch_return=item.is_mismatch_return or False,
                    ai_confidence=item.ai_confidence,
                    original_barcode=item.original_barcode,
                    original_sku=item.original_sku,
                    original_product_name=item.original_product_name,
                ),
            )
        )

    return GeoJSONFeatureCollection(features=features)


# ===================================================================
# 8. DOORSTEP RETURN PICKUPS & REVERSE LOGISTICS
# ===================================================================

def _format_return_order(ret: ReturnOrder) -> ReturnOrderResponse:
    events = None
    if ret.warehouse_custody_events:
        try:
            events_data = json.loads(ret.warehouse_custody_events)
            events = [WarehouseCustodyEventSchema(**ev) for ev in events_data]
        except Exception:
            events = None

    courier_loc = None
    if ret.pickup_person_lat is not None and ret.pickup_person_lon is not None:
        courier_loc = LiveCoordinatesSchema(
            latitude=ret.pickup_person_lat,
            longitude=ret.pickup_person_lon,
        )

    return ReturnOrderResponse(
        id=ret.id,
        order_number=ret.order_number,
        product_id=ret.product_id,
        product_name=ret.product_name,
        product_sku=ret.product_sku,
        product_image_url=ret.product_image_url,
        refund_amount=ret.refund_amount,
        returner_id=ret.returner_id,
        returner_name=ret.returner_name,
        returner_phone=ret.returner_phone,
        access_point_id=ret.access_point_id,
        access_point_name=ret.access_point_name,
        access_point_code=ret.access_point_code,
        status=ret.status,
        pickup_address=ret.pickup_address,
        pickup_location=LiveCoordinatesSchema(
            latitude=ret.pickup_lat,
            longitude=ret.pickup_lon,
        ),
        location_sharing_enabled=ret.location_sharing_enabled,
        pickup_person_id=ret.pickup_person_id,
        pickup_person_name=ret.pickup_person_name,
        pickup_person_phone=ret.pickup_person_phone,
        pickup_person_location=courier_loc,
        vehicle_number=ret.vehicle_number,
        eta_minutes=ret.eta_minutes,
        distance_km=ret.distance_km,
        created_at=ret.created_at.isoformat() if ret.created_at else datetime.now(timezone.utc).isoformat(),
        collected_at=ret.collected_at.isoformat() if ret.collected_at else None,
        refund_completed_at=ret.refund_completed_at.isoformat() if ret.refund_completed_at else None,
        is_demo_movement=ret.is_demo_movement,
        warehouse_pickup_status=ret.warehouse_pickup_status,
        warehouse_custody_events=events,
    )


@app.get(
    "/api/v1/returns",
    response_model=List[ReturnOrderResponse],
    tags=["Returns"],
    summary="List return orders with pickup tracking",
)
def list_return_orders(
    access_point_id: Optional[str] = Query(None, description="Filter by Access Point ID"),
    returner_id: Optional[str] = Query(None, description="Filter by Returner ID"),
    status: Optional[str] = Query(None, description="Filter by pickup status"),
    db: Session = Depends(get_db),
) -> List[ReturnOrderResponse]:
    q = db.query(ReturnOrder)
    if access_point_id:
        q = q.filter(func.lower(ReturnOrder.access_point_id) == access_point_id.lower().strip())
    if returner_id:
        q = q.filter(ReturnOrder.returner_id == returner_id)
    if status:
        q = q.filter(ReturnOrder.status == status)

    orders = q.order_by(ReturnOrder.created_at.desc()).all()
    return [_format_return_order(o) for o in orders]


@app.get(
    "/api/v1/returns/{return_id}",
    response_model=ReturnOrderResponse,
    tags=["Returns"],
    summary="Get details of a return pickup order",
)
def get_return_order(return_id: str, db: Session = Depends(get_db)) -> ReturnOrderResponse:
    order = db.query(ReturnOrder).filter(ReturnOrder.id == return_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Return order '{return_id}' not found.",
        )
    return _format_return_order(order)


@app.post(
    "/api/v1/returns",
    response_model=ReturnOrderResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Returns"],
    summary="Create a new return pickup request",
)
def create_return_order(
    body: ReturnOrderCreateRequest,
    db: Session = Depends(get_db),
) -> ReturnOrderResponse:
    ret_id = body.id or f"RET-{datetime.now().strftime('%M%S')}"

    # Get AP details
    ap = db.query(AccessPoint).filter(AccessPoint.id == body.access_point_id).first()
    ap_name = ap.name if ap else f"Access Point {body.access_point_id}"
    ap_code = ap.code if ap else body.access_point_id.upper()

    geom_elem = WKTElement(f"POINT({body.pickup_lon} {body.pickup_lat})", srid=4326)

    new_order = ReturnOrder(
        id=ret_id,
        order_number=body.order_number,
        product_id=body.product_id,
        product_name=body.product_name,
        product_sku=body.product_sku,
        product_image_url=body.product_image_url,
        refund_amount=body.refund_amount,
        returner_id=body.returner_id,
        returner_name=body.returner_name,
        returner_phone=body.returner_phone,
        access_point_id=body.access_point_id,
        access_point_name=ap_name,
        access_point_code=ap_code,
        status="RETURN_REQUESTED",
        pickup_address=body.pickup_address,
        pickup_lat=body.pickup_lat,
        pickup_lon=body.pickup_lon,
        geom=geom_elem,
        location_sharing_enabled=body.location_sharing_enabled or False,
        warehouse_pickup_status="AWAITING_ACCESS_POINT",
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    return _format_return_order(new_order)


@app.patch(
    "/api/v1/returns/{return_id}/status",
    response_model=ReturnOrderResponse,
    tags=["Returns"],
    summary="Advance return pickup lifecycle status",
)
def update_return_status(
    return_id: str,
    body: ReturnStatusUpdateRequest,
    db: Session = Depends(get_db),
) -> ReturnOrderResponse:
    order = db.query(ReturnOrder).filter(ReturnOrder.id == return_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Return order '{return_id}' not found.",
        )

    order.status = body.status
    now = datetime.now(timezone.utc)

    if body.pickup_person_id is not None:
        order.pickup_person_id = body.pickup_person_id
    if body.pickup_person_name is not None:
        order.pickup_person_name = body.pickup_person_name
    if body.pickup_person_phone is not None:
        order.pickup_person_phone = body.pickup_person_phone
    if body.vehicle_number is not None:
        order.vehicle_number = body.vehicle_number
    if body.eta_minutes is not None:
        order.eta_minutes = body.eta_minutes
    if body.distance_km is not None:
        order.distance_km = body.distance_km

    if body.status == "PRODUCT_COLLECTED":
        order.collected_at = now
        order.location_sharing_enabled = False
        order.warehouse_pickup_status = "STORED_AT_ACCESS_POINT"

        # Record custody event
        events = []
        if order.warehouse_custody_events:
            try:
                events = json.loads(order.warehouse_custody_events)
            except Exception:
                events = []
        events.append({
            "id": f"custody-{int(now.timestamp())}",
            "status": "STORED_AT_ACCESS_POINT",
            "timestamp": now.isoformat(),
            "actor": "Access Point Counter",
        })
        order.warehouse_custody_events = json.dumps(events)

    elif body.status == "COMPLETED":
        order.refund_completed_at = now
        order.location_sharing_enabled = False

    db.commit()
    db.refresh(order)
    return _format_return_order(order)


@app.patch(
    "/api/v1/returns/{return_id}/location",
    response_model=ReturnOrderResponse,
    tags=["Returns"],
    summary="Update live GPS location coordinates for a return pickup",
)
def update_return_location(
    return_id: str,
    body: ReturnLocationUpdateRequest,
    db: Session = Depends(get_db),
) -> ReturnOrderResponse:
    order = db.query(ReturnOrder).filter(ReturnOrder.id == return_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Return order '{return_id}' not found.",
        )

    order.pickup_lat = body.latitude
    order.pickup_lon = body.longitude
    order.geom = WKTElement(f"POINT({body.longitude} {body.latitude})", srid=4326)
    order.location_sharing_enabled = body.location_sharing_enabled

    if order.status == "RETURN_REQUESTED" and body.location_sharing_enabled:
        order.status = "LOCATION_SHARED"

    db.commit()
    db.refresh(order)
    return _format_return_order(order)


# ===================================================================
# 9. WAREHOUSE OPERATIONS & CUSTODY FLOW
# ===================================================================

@app.get(
    "/api/v1/warehouse/custody-queue",
    response_model=List[ReturnOrderResponse],
    tags=["Warehouse"],
    summary="Return custody queue for Central Warehouse operations",
)
def get_warehouse_custody_queue(
    status: Optional[str] = Query(None, description="Filter by warehouse pickup status"),
    db: Session = Depends(get_db),
) -> List[ReturnOrderResponse]:
    q = db.query(ReturnOrder)
    if status:
        q = q.filter(ReturnOrder.warehouse_pickup_status == status)
    else:
        # By default, show active warehouse custody items (stored, scheduled, transit, received)
        q = q.filter(ReturnOrder.warehouse_pickup_status != "AWAITING_ACCESS_POINT")

    orders = q.order_by(ReturnOrder.created_at.desc()).all()
    return [_format_return_order(o) for o in orders]


@app.patch(
    "/api/v1/warehouse/returns/{return_id}/status",
    response_model=ReturnOrderResponse,
    tags=["Warehouse"],
    summary="Advance warehouse custody status and append timeline event",
)
def update_warehouse_custody_status(
    return_id: str,
    body: WarehouseStatusUpdateRequest,
    db: Session = Depends(get_db),
) -> ReturnOrderResponse:
    order = db.query(ReturnOrder).filter(ReturnOrder.id == return_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Return order '{return_id}' not found.",
        )

    valid_transitions = {
        "AWAITING_ACCESS_POINT": ["STORED_AT_ACCESS_POINT"],
        "STORED_AT_ACCESS_POINT": ["COLLECTION_SCHEDULED"],
        "COLLECTION_SCHEDULED": ["IN_TRANSIT_TO_WAREHOUSE"],
        "IN_TRANSIT_TO_WAREHOUSE": ["RECEIVED_AT_WAREHOUSE"],
        "RECEIVED_AT_WAREHOUSE": [],
    }

    current = order.warehouse_pickup_status or "AWAITING_ACCESS_POINT"
    allowed = valid_transitions.get(current, [])

    if body.status not in allowed and body.status != current:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition warehouse custody status from '{current}' to '{body.status}'. Allowed: {allowed}",
        )

    now = datetime.now(timezone.utc)
    order.warehouse_pickup_status = body.status

    # Append custody event
    events = []
    if order.warehouse_custody_events:
        try:
            events = json.loads(order.warehouse_custody_events)
        except Exception:
            events = []

    actor = body.actor or "Warehouse Operations Team"
    events.append({
        "id": f"custody-{int(now.timestamp())}",
        "status": body.status,
        "timestamp": now.isoformat(),
        "actor": actor,
    })
    order.warehouse_custody_events = json.dumps(events)

    db.commit()
    db.refresh(order)
    return _format_return_order(order)


# ===================================================================
# 10. IN-STORE BUYER RESERVATIONS
# ===================================================================

@app.get(
    "/api/v1/reservations",
    response_model=List[ReservationResponse],
    tags=["Reservations"],
    summary="List buyer reservations and in-store holds",
)
def list_reservations(
    access_point_id: Optional[str] = Query(None, description="Filter by Access Point ID"),
    buyer_id: Optional[str] = Query(None, description="Filter by Buyer ID"),
    status: Optional[str] = Query(None, description="Filter by reservation status"),
    db: Session = Depends(get_db),
) -> List[ReservationResponse]:
    q = db.query(Reservation)
    if access_point_id:
        q = q.filter(func.lower(Reservation.access_point_id) == access_point_id.lower().strip())
    if buyer_id:
        q = q.filter(Reservation.buyer_id == buyer_id)
    if status:
        q = q.filter(Reservation.status == status)

    reservations = q.order_by(Reservation.reserved_at.desc()).all()
    return [
        ReservationResponse(
            id=r.id,
            product_id=r.product_id,
            product_name=r.product_name,
            product_sku=r.product_sku,
            product_price=r.product_price,
            product_image_url=r.product_image_url,
            access_point_id=r.access_point_id,
            access_point_name=r.access_point_name,
            access_point_code=r.access_point_code,
            buyer_id=r.buyer_id,
            buyer_name=r.buyer_name,
            buyer_phone=r.buyer_phone,
            status=r.status,
            reserved_at=r.reserved_at.isoformat() if r.reserved_at else datetime.now(timezone.utc).isoformat(),
            updated_at=r.updated_at.isoformat() if r.updated_at else datetime.now(timezone.utc).isoformat(),
        )
        for r in reservations
    ]


@app.post(
    "/api/v1/reservations",
    response_model=ReservationResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Reservations"],
    summary="Reserve a product for in-store pickup",
)
def create_reservation(
    body: ReservationCreateRequest,
    db: Session = Depends(get_db),
) -> ReservationResponse:
    res_id = body.id or f"res-{datetime.now().strftime('%M%S%f')[:8]}"
    now = datetime.now(timezone.utc)

    # Check if inventory item exists
    inv_item = None
    try:
        inv_item = db.query(LocalInventory).filter(LocalInventory.id == uuid.UUID(body.product_id)).first()
    except Exception:
        inv_item = db.query(LocalInventory).filter(LocalInventory.sku == body.product_id).first()

    ap_id = body.access_point_id or (inv_item.access_point_id if inv_item else "ap-04")
    ap = db.query(AccessPoint).filter(AccessPoint.id == ap_id).first()
    ap_name = ap.name if ap else f"Access Point {ap_id}"
    ap_code = ap.code if ap else ap_id.upper()

    product_name = inv_item.product_name if inv_item and inv_item.product_name else "Verified Open-Box Item"
    product_sku = inv_item.sku if inv_item else "SKU-UNKNOWN"
    product_price = inv_item.current_price if inv_item else 2550.0
    product_image_url = inv_item.image_url if inv_item else None

    # Mark inventory as RESERVED if active
    if inv_item and inv_item.status == InventoryStatus.LOCAL_LIVE:
        try:
            inv_item.status = InventoryStatus.RESERVED
        except Exception:
            pass

    new_res = Reservation(
        id=res_id,
        product_id=body.product_id,
        product_name=product_name,
        product_sku=product_sku,
        product_price=product_price,
        product_image_url=product_image_url,
        access_point_id=ap_id,
        access_point_name=ap_name,
        access_point_code=ap_code,
        buyer_id=body.buyer_id,
        buyer_name=body.buyer_name,
        buyer_phone=body.buyer_phone,
        status="RESERVED",
        reserved_at=now,
        updated_at=now,
    )
    db.add(new_res)
    db.commit()
    db.refresh(new_res)

    return ReservationResponse(
        id=new_res.id,
        product_id=new_res.product_id,
        product_name=new_res.product_name,
        product_sku=new_res.product_sku,
        product_price=new_res.product_price,
        product_image_url=new_res.product_image_url,
        access_point_id=new_res.access_point_id,
        access_point_name=new_res.access_point_name,
        access_point_code=new_res.access_point_code,
        buyer_id=new_res.buyer_id,
        buyer_name=new_res.buyer_name,
        buyer_phone=new_res.buyer_phone,
        status=new_res.status,
        reserved_at=new_res.reserved_at.isoformat(),
        updated_at=new_res.updated_at.isoformat(),
    )


@app.patch(
    "/api/v1/reservations/{reservation_id}/status",
    response_model=ReservationResponse,
    tags=["Reservations"],
    summary="Update reservation status (Ready, Completed, Cancelled)",
)
def update_reservation_status(
    reservation_id: str,
    body: ReservationStatusUpdateRequest,
    db: Session = Depends(get_db),
) -> ReservationResponse:
    res = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reservation '{reservation_id}' not found.",
        )

    res.status = body.status
    res.updated_at = datetime.now(timezone.utc)

    # Sync local_inventory status
    try:
        inv_item = db.query(LocalInventory).filter(LocalInventory.id == uuid.UUID(res.product_id)).first()
    except Exception:
        inv_item = db.query(LocalInventory).filter(LocalInventory.sku == res.product_sku).first()

    if inv_item:
        if body.status == "COMPLETED":
            try:
                inv_item.status = InventoryStatus.SOLD
            except Exception:
                pass
        elif body.status == "CANCELLED":
            try:
                inv_item.status = InventoryStatus.LOCAL_LIVE
            except Exception:
                pass

    db.commit()
    db.refresh(res)

    return ReservationResponse(
        id=res.id,
        product_id=res.product_id,
        product_name=res.product_name,
        product_sku=res.product_sku,
        product_price=res.product_price,
        product_image_url=res.product_image_url,
        access_point_id=res.access_point_id,
        access_point_name=res.access_point_name,
        access_point_code=res.access_point_code,
        buyer_id=res.buyer_id,
        buyer_name=res.buyer_name,
        buyer_phone=res.buyer_phone,
        status=res.status,
        reserved_at=res.reserved_at.isoformat(),
        updated_at=res.updated_at.isoformat(),
    )


# ===================================================================
# 11. INQUIRIES & CHAT MESSAGING
# ===================================================================

@app.get(
    "/api/v1/conversations",
    response_model=List[ConversationResponse],
    tags=["Messaging"],
    summary="List inquiries and chat conversations",
)
def list_conversations(
    buyer_id: Optional[str] = Query(None),
    access_point_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> List[ConversationResponse]:
    q = db.query(Conversation)
    if buyer_id:
        q = q.filter(Conversation.buyer_id == buyer_id)
    if access_point_id:
        q = q.filter(func.lower(Conversation.access_point_id) == access_point_id.lower().strip())

    convs = q.order_by(Conversation.updated_at.desc()).all()
    results = []
    for c in convs:
        msgs = db.query(Message).filter(Message.conversation_id == c.id).order_by(Message.created_at.asc()).all()
        results.append(
            ConversationResponse(
                id=c.id,
                buyer_id=c.buyer_id,
                buyer_name=c.buyer_name,
                access_point_id=c.access_point_id,
                access_point_name=c.access_point_name,
                access_point_code=c.access_point_code,
                product_id=c.product_id,
                product_name=c.product_name,
                product_image_url=c.product_image_url,
                return_order_id=c.return_order_id,
                last_message_snippet=c.last_message_snippet,
                last_message_time=c.last_message_time,
                unread_count=c.unread_count,
                messages=[
                    MessageResponse(
                        id=m.id,
                        conversation_id=m.conversation_id,
                        sender_id=m.sender_id,
                        sender_role=m.sender_role,
                        sender_name=m.sender_name,
                        text=m.text,
                        timestamp=m.timestamp,
                    )
                    for m in msgs
                ],
            )
        )
    return results


@app.post(
    "/api/v1/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Messaging"],
    summary="Create or find a conversation thread",
)
def create_conversation(
    body: ConversationCreateRequest,
    db: Session = Depends(get_db),
) -> ConversationResponse:
    # Check if conversation already exists for this product / return order
    existing = None
    if body.product_id:
        existing = db.query(Conversation).filter(
            Conversation.product_id == body.product_id,
            Conversation.buyer_id == body.buyer_id,
        ).first()
    elif body.return_order_id:
        existing = db.query(Conversation).filter(
            Conversation.return_order_id == body.return_order_id,
        ).first()

    if existing:
        msgs = db.query(Message).filter(Message.conversation_id == existing.id).order_by(Message.created_at.asc()).all()
        return ConversationResponse(
            id=existing.id,
            buyer_id=existing.buyer_id,
            buyer_name=existing.buyer_name,
            access_point_id=existing.access_point_id,
            access_point_name=existing.access_point_name,
            access_point_code=existing.access_point_code,
            product_id=existing.product_id,
            product_name=existing.product_name,
            product_image_url=existing.product_image_url,
            return_order_id=existing.return_order_id,
            last_message_snippet=existing.last_message_snippet,
            last_message_time=existing.last_message_time,
            unread_count=existing.unread_count,
            messages=[
                MessageResponse(
                    id=m.id,
                    conversation_id=m.conversation_id,
                    sender_id=m.sender_id,
                    sender_role=m.sender_role,
                    sender_name=m.sender_name,
                    text=m.text,
                    timestamp=m.timestamp,
                )
                for m in msgs
            ],
        )

    conv_id = body.id or f"conv-{datetime.now().strftime('%M%S%f')[:8]}"
    now = datetime.now(timezone.utc)

    ap = db.query(AccessPoint).filter(AccessPoint.id == body.access_point_id).first()
    ap_name = ap.name if ap else f"Access Point {body.access_point_id}"
    ap_code = ap.code if ap else body.access_point_id.upper()

    new_conv = Conversation(
        id=conv_id,
        buyer_id=body.buyer_id,
        buyer_name=body.buyer_name,
        access_point_id=body.access_point_id,
        access_point_name=ap_name,
        access_point_code=ap_code,
        product_id=body.product_id,
        product_name=body.product_name,
        product_image_url=body.product_image_url,
        return_order_id=body.return_order_id,
        last_message_snippet=body.initial_message or "Conversation started",
        last_message_time="Just now",
        unread_count=0,
        created_at=now,
        updated_at=now,
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)

    # Initial message
    init_msgs = []
    if body.initial_message:
        msg = Message(
            id=f"msg-{datetime.now().strftime('%M%S%f')[:8]}",
            conversation_id=new_conv.id,
            sender_id=body.buyer_id,
            sender_role="buyer",
            sender_name=body.buyer_name,
            text=body.initial_message,
            timestamp=datetime.now().strftime("%I:%M %p"),
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        init_msgs.append(
            MessageResponse(
                id=msg.id,
                conversation_id=msg.conversation_id,
                sender_id=msg.sender_id,
                sender_role=msg.sender_role,
                sender_name=msg.sender_name,
                text=msg.text,
                timestamp=msg.timestamp,
            )
        )

    return ConversationResponse(
        id=new_conv.id,
        buyer_id=new_conv.buyer_id,
        buyer_name=new_conv.buyer_name,
        access_point_id=new_conv.access_point_id,
        access_point_name=new_conv.access_point_name,
        access_point_code=new_conv.access_point_code,
        product_id=new_conv.product_id,
        product_name=new_conv.product_name,
        product_image_url=new_conv.product_image_url,
        return_order_id=new_conv.return_order_id,
        last_message_snippet=new_conv.last_message_snippet,
        last_message_time=new_conv.last_message_time,
        unread_count=new_conv.unread_count,
        messages=init_msgs,
    )


@app.post(
    "/api/v1/conversations/{conv_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Messaging"],
    summary="Send a message in a conversation",
)
def send_message(
    conv_id: str,
    body: MessageCreateRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conv_id}' not found.",
        )

    now = datetime.now()
    time_str = now.strftime("%I:%M %p")
    msg_id = f"msg-{now.strftime('%M%S%f')[:8]}"

    new_msg = Message(
        id=msg_id,
        conversation_id=conv_id,
        sender_id=body.sender_id,
        sender_role=body.sender_role,
        sender_name=body.sender_name,
        text=body.text,
        timestamp=time_str,
    )
    db.add(new_msg)

    conv.last_message_snippet = body.text
    conv.last_message_time = time_str
    conv.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(new_msg)

    return MessageResponse(
        id=new_msg.id,
        conversation_id=new_msg.conversation_id,
        sender_id=new_msg.sender_id,
        sender_role=new_msg.sender_role,
        sender_name=new_msg.sender_name,
        text=new_msg.text,
        timestamp=new_msg.timestamp,
    )


# ===================================================================
# 12. PRICE DECAY (Administrative / Cron Only)
# ===================================================================

@app.post(
    "/api/v1/cron/price-decay",
    response_model=PriceDecayResponse,
    tags=["Pricing"],
    summary="Simulate price decay for shelf-aging products (Admin only)",
)
def price_decay(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    db: Session = Depends(get_db),
) -> PriceDecayResponse:
    if CRON_SECRET and x_cron_secret != CRON_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing X-Cron-Secret authorization header.",
        )

    items = (
        db.query(LocalInventory)
        .filter(LocalInventory.status == InventoryStatus.LOCAL_LIVE)
        .all()
    )

    updated = 0
    routed_to_central = 0

    for item in items:
        item.days_on_shelf += 1

        if item.days_on_shelf >= 14:
            item.status = InventoryStatus.CENTRAL_ROUTING
            item.current_price = 0.0
            routed_to_central += 1
            updated += 1
            continue

        decay_periods = math.floor(item.days_on_shelf / 2)
        new_price = item.msrp * 0.85 * (0.99 ** decay_periods)
        item.current_price = round(new_price, 2)
        updated += 1

    db.commit()

    logger.info("Price decay completed: %d updated, %d routed to central", updated, routed_to_central)
    return PriceDecayResponse(
        success=True,
        updated_items=updated,
        routed_to_central=routed_to_central,
    )


# ===================================================================
# 13. DEMO SEED (Development / Staging Only)
# ===================================================================

@app.post(
    "/api/v1/demo/seed",
    response_model=DemoSeedResponse,
    tags=["Demo"],
    summary="Seed demo data around Chennai (Dev/Staging only)",
)
def seed_demo_data(db: Session = Depends(get_db)) -> DemoSeedResponse:
    if ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo data seeder is disabled in production environment.",
        )

    # 1. Seed Master Catalog
    catalog_seeded = 0
    for item in DEFAULT_CATALOG_ITEMS:
        exists = db.query(CatalogProduct).filter(CatalogProduct.barcode == item["barcode"]).first()
        if not exists:
            db.add(
                CatalogProduct(
                    barcode=item["barcode"],
                    sku=item["sku"],
                    name=item["name"],
                    category=item["category"],
                    size_or_variant=item["size_or_variant"],
                    msrp=item["msrp"],
                    image_url=item["image_url"],
                )
            )
            catalog_seeded += 1

    # 2. Seed Access Points
    ap_seeded = 0
    for ap in DEFAULT_ACCESS_POINTS:
        exists = db.query(AccessPoint).filter(AccessPoint.id == ap["id"]).first()
        if not exists:
            db.add(
                AccessPoint(
                    id=ap["id"],
                    code=ap["code"],
                    name=ap["name"],
                    address=ap["address"],
                    area=ap["area"],
                    city=ap["city"],
                    state=ap["state"],
                    pincode=ap["pincode"],
                    phone=ap["phone"],
                    status=ap["status"],
                    latitude=ap["latitude"],
                    longitude=ap["longitude"],
                    geom=WKTElement(f"POINT({ap['longitude']} {ap['latitude']})", srid=4326),
                )
            )
            ap_seeded += 1

    # 3. Demand Signals (Chennai Center 13.0827, 80.2707)
    signals = [
        {"type": SignalType.wishlist, "cat": "footwear",    "lat": 13.0850, "lon": 80.2720},
        {"type": SignalType.search,   "cat": "footwear",    "lat": 13.0810, "lon": 80.2690},
        {"type": SignalType.wishlist, "cat": "electronics", "lat": 13.0835, "lon": 80.2715},
        {"type": SignalType.search,   "cat": "electronics", "lat": 13.0840, "lon": 80.2700},
        {"type": SignalType.wishlist, "cat": "audio",       "lat": 13.0820, "lon": 80.2730},
        {"type": SignalType.search,   "cat": "audio",       "lat": 13.0815, "lon": 80.2695},
        {"type": SignalType.wishlist, "cat": "accessories", "lat": 13.0830, "lon": 80.2710},
    ]
    demand_count = 0
    for s in signals:
        db.add(
            DemandSignal(
                signal_type=s["type"],
                category=s["cat"],
                geom=WKTElement(f"POINT({s['lon']} {s['lat']})", srid=4326),
            )
        )
        demand_count += 1

    # 4. Inventory Items (including Mismatch Return)
    demo_inventory = [
        {
            "sku": "NIKE-AZ-10", "barcode": "890123456789", "cat": "Footwear", "name": "Nike Air Zoom",
            "msrp": 3000.0, "price": 2550.0, "lat": 13.0418, "lon": 80.2341, "ap": "ap-04",
            "status": InventoryStatus.LOCAL_LIVE, "days": 1,
            "img": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
            "mismatch": False, "confidence": 94.0,
        },
        {
            "sku": "SAMSUNG-GB-2", "barcode": "890123456790", "cat": "Electronics", "name": "Samsung Galaxy Buds Pro",
            "msrp": 5000.0, "price": 4250.0, "lat": 13.0418, "lon": 80.2341, "ap": "ap-04",
            "status": InventoryStatus.LOCAL_LIVE, "days": 0,
            "img": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
            "mismatch": False, "confidence": 91.0,
        },
        {
            "sku": "ADIDAS-RUN-01", "barcode": "890123456789", "cat": "Footwear", "name": "Adidas Running Shoes",
            "msrp": 4000.0, "price": 3400.0, "lat": 13.0418, "lon": 80.2341, "ap": "ap-04",
            "status": InventoryStatus.LOCAL_LIVE, "days": 0,
            "img": "https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=600&auto=format&fit=crop&q=80",
            "mismatch": True, "confidence": 96.0,
            "orig_barcode": "890123456789", "orig_sku": "NIKE-AZ-10", "orig_name": "Nike Air Zoom",
        },
        {
            "sku": "JBL-SPK-6", "barcode": "890123456792", "cat": "Audio", "name": "JBL Flip 6 Portable Speaker",
            "msrp": 7000.0, "price": 5950.0, "lat": 13.0475, "lon": 80.2520, "ap": "ap-12",
            "status": InventoryStatus.LOCAL_LIVE, "days": 2,
            "img": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80",
            "mismatch": False, "confidence": 96.0,
        },
        {
            "sku": "SONY-WH-XM4", "barcode": "890123456794", "cat": "Audio", "name": "Sony WH-1000XM4 Wireless",
            "msrp": 19999.0, "price": 0.0, "lat": 13.0418, "lon": 80.2341, "ap": "ap-04",
            "status": InventoryStatus.CENTRAL_ROUTING, "days": 14,
            "img": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
            "mismatch": False, "confidence": 95.0,
        },
    ]

    inv_count = 0
    for item in demo_inventory:
        ap_info = next((a for a in DEFAULT_ACCESS_POINTS if a["id"] == item["ap"]), {})
        db.add(
            LocalInventory(
                access_point_id=item["ap"],
                sku=item["sku"],
                barcode=item["barcode"],
                product_name=item["name"],
                category=item["cat"],
                geom=WKTElement(f"POINT({item['lon']} {item['lat']})", srid=4326),
                status=item["status"],
                msrp=item["msrp"],
                current_price=item["price"],
                days_on_shelf=item["days"],
                image_url=item["img"],
                condition="Pristine",
                access_point_name=ap_info.get("name", "Express Electronics"),
                access_point_code=ap_info.get("code", "AP-04"),
                access_point_address=ap_info.get("address", "Chennai"),
                is_mismatch_return=item.get("mismatch", False),
                ai_confidence=item.get("confidence"),
                original_barcode=item.get("orig_barcode"),
                original_sku=item.get("orig_sku"),
                original_product_name=item.get("orig_name"),
            )
        )
        inv_count += 1

    # 5. Return Orders
    ret_seeded = 0
    for ret in DEFAULT_RETURN_ORDERS:
        exists = db.query(ReturnOrder).filter(ReturnOrder.id == ret["id"]).first()
        if not exists:
            db.add(
                ReturnOrder(
                    id=ret["id"],
                    order_number=ret["order_number"],
                    product_id=ret["product_id"],
                    product_name=ret["product_name"],
                    product_sku=ret["product_sku"],
                    product_image_url=ret.get("product_image_url"),
                    refund_amount=ret["refund_amount"],
                    returner_id=ret["returner_id"],
                    returner_name=ret["returner_name"],
                    returner_phone=ret["returner_phone"],
                    access_point_id=ret["access_point_id"],
                    access_point_name=ret["access_point_name"],
                    access_point_code=ret["access_point_code"],
                    status=ret["status"],
                    pickup_address=ret["pickup_address"],
                    pickup_lat=ret["pickup_lat"],
                    pickup_lon=ret["pickup_lon"],
                    geom=WKTElement(f"POINT({ret['pickup_lon']} {ret['pickup_lat']})", srid=4326),
                    location_sharing_enabled=ret.get("location_sharing_enabled", False),
                    pickup_person_id=ret.get("pickup_person_id"),
                    pickup_person_name=ret.get("pickup_person_name"),
                    pickup_person_phone=ret.get("pickup_person_phone"),
                    pickup_person_lat=ret.get("pickup_person_lat"),
                    pickup_person_lon=ret.get("pickup_person_lon"),
                    vehicle_number=ret.get("vehicle_number"),
                    eta_minutes=ret.get("eta_minutes"),
                    distance_km=ret.get("distance_km"),
                    warehouse_pickup_status=ret.get("warehouse_pickup_status", "AWAITING_ACCESS_POINT"),
                    warehouse_custody_events=ret.get("warehouse_custody_events"),
                    is_demo_movement=ret.get("is_demo_movement", True),
                )
            )
            ret_seeded += 1

    # 6. Reservations
    res_seeded = 0
    for res in DEFAULT_RESERVATIONS:
        exists = db.query(Reservation).filter(Reservation.id == res["id"]).first()
        if not exists:
            db.add(
                Reservation(
                    id=res["id"],
                    product_id=res["product_id"],
                    product_name=res["product_name"],
                    product_sku=res["product_sku"],
                    product_price=res["product_price"],
                    product_image_url=res.get("product_image_url"),
                    access_point_id=res["access_point_id"],
                    access_point_name=res["access_point_name"],
                    access_point_code=res["access_point_code"],
                    buyer_id=res["buyer_id"],
                    buyer_name=res["buyer_name"],
                    buyer_phone=res.get("buyer_phone"),
                    status=res["status"],
                )
            )
            res_seeded += 1

    db.commit()
    logger.info("Demo seed: %d catalog, %d APs, %d signals, %d inventory, %d returns, %d reservations",
                catalog_seeded, ap_seeded, demand_count, inv_count, ret_seeded, res_seeded)

    return DemoSeedResponse(
        success=True,
        catalog_items_seeded=catalog_seeded,
        demand_signals_created=demand_count,
        inventory_items_created=inv_count,
        access_points_seeded=ap_seeded,
        return_orders_seeded=ret_seeded,
        reservations_seeded=res_seeded,
    )
