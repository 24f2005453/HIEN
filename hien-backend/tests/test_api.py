"""
HIEN Backend — Automated Test Suite
====================================
Comprehensive API, contract, and spatial query tests.
Uses FastAPI TestClient to test:
  1. Health & readiness probes
  2. Authoritative catalog barcode & SKU lookup (including 404 paths)
  3. Access Points listing, retrieval, and dynamic location updates
  4. Demand signal ingestion & coordinate validation
  5. 3 km Local Demand Score (LDS) evaluation
  6. Inventory ingestion with pricing rules and mismatch return dual-identity
  7. Local discovery feed GeoJSON format, coordinate order [lon, lat], and distance calculation
  8. Return orders doorstep pickup lifecycle & live GPS tracking
  9. Warehouse custody queue and status transitions
  10. In-store buyer reservations lifecycle and inventory sync
  11. Inquiries and chat messaging
"""

import json
import pytest
from fastapi.testclient import TestClient

from app.main import app, safe_upgrade_schema


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Ensure database schema, catalog, and default data are initialized before tests run."""
    safe_upgrade_schema()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


# ===================================================================
# 1. Health & Readiness
# ===================================================================

def test_health_check(client):
    """Service health endpoint returns valid status."""
    response = client.get("/health")
    assert response.status_code in {200, 503}
    data = response.json()
    assert "status" in data
    assert data["service"] == "HIEN Backend"
    assert "database" in data


def test_readiness_check(client):
    """Readiness endpoint matches health check contract."""
    response = client.get("/ready")
    assert response.status_code in {200, 503}
    data = response.json()
    assert "status" in data


# ===================================================================
# 2. Authoritative Product Catalog
# ===================================================================

def test_catalog_lookup_by_barcode_success(client):
    """Lookup by known barcode returns authoritative product metadata and 15% open-box price."""
    response = client.get("/api/v1/catalog/barcode/890123456789")
    assert response.status_code == 200
    data = response.json()
    assert data["barcode"] == "890123456789"
    assert data["sku"] == "NIKE-AZ-10"
    assert "Nike Air Zoom" in data["name"]
    assert data["msrp"] == 3000.0
    assert data["open_box_price"] == 2550.0  # exactly 15% discount
    assert data["category"] == "Footwear"
    assert data["image_url"] is not None


def test_catalog_lookup_by_sku_success(client):
    """Lookup by known SKU also resolves successfully."""
    response = client.get("/api/v1/catalog/barcode/SAMSUNG-GB-2")
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "SAMSUNG-GB-2"
    assert "Galaxy Buds" in data["name"]
    assert data["msrp"] == 5000.0
    assert data["open_box_price"] == 4250.0


def test_catalog_lookup_not_found(client):
    """Unknown barcode returns HTTP 404."""
    response = client.get("/api/v1/catalog/barcode/UNKNOWN_99999999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_catalog_list_products(client):
    """List all catalog products returns a non-empty list."""
    response = client.get("/api/v1/catalog/products")
    assert response.status_code == 200
    products = response.json()
    assert isinstance(products, list)
    assert len(products) >= 6


# ===================================================================
# 3. Access Points (Listing, Details, Location Updates)
# ===================================================================

def test_list_access_points(client):
    """List all Access Points returns default seeded APs."""
    response = client.get("/api/v1/access-points")
    assert response.status_code == 200
    aps = response.json()
    assert isinstance(aps, list)
    assert len(aps) >= 3
    codes = {ap["code"] for ap in aps}
    assert "AP-04" in codes


def test_get_access_point_by_id(client):
    """Retrieve details for AP-04."""
    response = client.get("/api/v1/access-points/ap-04")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "ap-04"
    assert data["code"] == "AP-04"
    assert "Express Electronics" in data["name"]


def test_update_access_point_location(client):
    """Update address and coordinates of AP-04."""
    payload = {
        "address": "125 Anna Salai, Teynampet, Chennai, Tamil Nadu - 600018",
        "area": "Teynampet Central",
        "latitude": 13.0425,
        "longitude": 80.2350,
    }
    response = client.patch("/api/v1/access-points/ap-04", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["address"] == payload["address"]
    assert data["area"] == "Teynampet Central"
    assert data["latitude"] == 13.0425
    assert data["longitude"] == 80.2350


# ===================================================================
# 4. Demand Evaluation
# ===================================================================

def test_evaluate_demand_valid(client):
    """Demand evaluation computes LDS and returns a routing decision."""
    payload = {
        "access_point_lat": 13.0827,
        "access_point_lon": 80.2707,
        "category": "footwear",
        "sku": "NIKE-AZ-10",
    }
    response = client.post("/api/v1/returns/evaluate-demand", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["routing"] in {"LOCAL_LIVE", "CENTRAL_ROUTING"}
    assert isinstance(data["lds_score"], (int, float))
    assert "breakdown" in data
    assert "wishlist_count" in data["breakdown"]
    assert "search_count" in data["breakdown"]
    assert "category_velocity" in data["breakdown"]
    assert "existing_inventory" in data["breakdown"]


def test_evaluate_demand_invalid_coordinates(client):
    """Invalid latitude (>90) returns HTTP 422 validation error."""
    payload = {
        "access_point_lat": 95.0,
        "access_point_lon": 80.2707,
        "category": "footwear",
        "sku": "NIKE-AZ-10",
    }
    response = client.post("/api/v1/returns/evaluate-demand", json=payload)
    assert response.status_code == 422


# ===================================================================
# 5. Inventory Ingestion (Standard & Mismatch Returns)
# ===================================================================

def test_inventory_ingest_local_live(client):
    """LOCAL_LIVE item receives 15% discount and stores server-generated ID."""
    payload = {
        "sku": "TEST-SKU-01",
        "category": "electronics",
        "msrp": 10000.0,
        "lat": 13.0418,
        "lon": 80.2341,
        "access_point_id": "ap-04",
        "routing_decision": "LOCAL_LIVE",
        "barcode": "890123456790",
        "product_name": "Test Electronics",
    }
    response = client.post("/api/v1/inventory/ingest", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "LOCAL_LIVE"
    assert data["msrp"] == 10000.0
    assert data["current_price"] == 8500.0  # 15% discount
    assert data["inventory_id"] is not None
    assert data["access_point_id"] == "ap-04"


def test_inventory_ingest_mismatch_return(client):
    """Ingest a mismatch return preserving claimed barcode and AI detected product."""
    payload = {
        "sku": "ADIDAS-RUN-01",
        "product_name": "Adidas Running Shoes",
        "category": "Footwear",
        "msrp": 4000.0,
        "lat": 13.0418,
        "lon": 80.2341,
        "access_point_id": "ap-04",
        "routing_decision": "LOCAL_LIVE",
        "barcode": "890123456789",  # Nike box barcode
        "condition": "Pristine",
        "is_mismatch_return": True,
        "ai_confidence": 96.0,
        "original_barcode": "890123456789",
        "original_sku": "NIKE-AZ-10",
        "original_product_name": "Nike Air Zoom",
    }
    response = client.post("/api/v1/inventory/ingest", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["is_mismatch_return"] is True
    assert data["ai_confidence"] == 96.0
    assert data["original_sku"] == "NIKE-AZ-10"
    assert data["product_name"] == "Adidas Running Shoes"
    assert data["current_price"] == 3400.0  # 15% discount on 4000


def test_inventory_ingest_central_routing(client):
    """CENTRAL_ROUTING item is priced at 0.0 and routed."""
    payload = {
        "sku": "TEST-SKU-DAMAGED",
        "category": "footwear",
        "msrp": 4000.0,
        "lat": 13.0418,
        "lon": 80.2341,
        "access_point_id": "ap-04",
        "routing_decision": "CENTRAL_ROUTING",
    }
    response = client.post("/api/v1/inventory/ingest", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "CENTRAL_ROUTING"
    assert data["current_price"] == 0.0


def test_inventory_ingest_invalid_routing(client):
    """Invalid routing decision string returns HTTP 422."""
    payload = {
        "sku": "TEST-SKU-INVALID",
        "category": "footwear",
        "msrp": 3000.0,
        "lat": 13.0418,
        "lon": 80.2341,
        "access_point_id": "ap-04",
        "routing_decision": "INVALID_DECISION",
    }
    response = client.post("/api/v1/inventory/ingest", json=payload)
    assert response.status_code == 422


# ===================================================================
# 6. Local Discovery Feed (GeoJSON)
# ===================================================================

def test_local_feed_geojson_structure(client):
    """Local discovery feed returns standard GeoJSON FeatureCollection with [lon, lat] coordinates."""
    response = client.get("/api/v1/discovery/local-feed?buyer_lat=13.0418&buyer_lon=80.2341&radius_meters=5000")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert isinstance(data["features"], list)

    for feature in data["features"]:
        assert feature["type"] == "Feature"
        assert feature["geometry"]["type"] == "Point"
        coords = feature["geometry"]["coordinates"]
        assert len(coords) == 2
        lon, lat = coords
        assert -180 <= lon <= 180
        assert -90 <= lat <= 90

        props = feature["properties"]
        assert "id" in props
        assert "sku" in props
        assert "category" in props
        assert "msrp" in props
        assert "current_price" in props
        assert "discount_percent" in props
        assert "access_point_id" in props
        assert "name" in props


# ===================================================================
# 7. Demand Signals
# ===================================================================

def test_create_demand_signal(client):
    """Create wishlist demand signal."""
    payload = {
        "signal_type": "wishlist",
        "category": "footwear",
        "lat": 13.0827,
        "lon": 80.2707,
    }
    response = client.post("/api/v1/demand-signals", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["signal_type"] == "wishlist"
    assert data["category"] == "footwear"
    assert data["signal_id"] is not None


def test_create_demand_signal_invalid_type(client):
    """Invalid signal type returns HTTP 422."""
    payload = {
        "signal_type": "invalid_type",
        "category": "footwear",
        "lat": 13.0827,
        "lon": 80.2707,
    }
    response = client.post("/api/v1/demand-signals", json=payload)
    assert response.status_code == 422


# ===================================================================
# 8. Return Orders & Doorstep Pickups
# ===================================================================

def test_list_return_orders(client):
    """List return orders returns default seeded pickups."""
    response = client.get("/api/v1/returns")
    assert response.status_code == 200
    orders = response.json()
    assert isinstance(orders, list)
    assert len(orders) >= 3


def test_return_order_lifecycle(client):
    """Create return order, update status to PRODUCT_COLLECTED, and verify warehouse custody status."""
    import uuid
    ret_id = f"RET-TEST-{uuid.uuid4().hex[:6]}"
    create_payload = {
        "id": ret_id,
        "order_number": f"ORD-TEST-{uuid.uuid4().hex[:4]}",
        "product_id": "prod-test-01",
        "product_name": "Test Wireless Headphones",
        "product_sku": "TEST-HD-01",
        "refund_amount": 2500.0,
        "returner_id": "buyer-test",
        "returner_name": "Test User",
        "returner_phone": "+91 99999 88888",
        "access_point_id": "ap-04",
        "pickup_address": "Test Street, Chennai",
        "pickup_lat": 13.0450,
        "pickup_lon": 80.2380,
    }
    create_res = client.post("/api/v1/returns", json=create_payload)
    assert create_res.status_code == 201
    order = create_res.json()
    assert order["id"] == ret_id
    assert order["status"] == "RETURN_REQUESTED"

    # Advance status to PRODUCT_COLLECTED
    status_payload = {
        "status": "PRODUCT_COLLECTED",
        "pickup_person_name": "Raj",
        "pickup_person_phone": "+91 98409 88776",
        "vehicle_number": "TN-09-AX-4412",
    }
    patch_res = client.patch(f"/api/v1/returns/{ret_id}/status", json=status_payload)
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["status"] == "PRODUCT_COLLECTED"
    assert updated["warehouse_pickup_status"] == "STORED_AT_ACCESS_POINT"
    assert updated["collected_at"] is not None
    assert updated["warehouse_custody_events"] is not None
    assert len(updated["warehouse_custody_events"]) >= 1


def test_update_return_location(client):
    """Update live location sharing coordinates."""
    loc_payload = {
        "latitude": 13.0460,
        "longitude": 80.2390,
        "accuracy": 8.5,
        "location_sharing_enabled": True,
    }
    response = client.patch("/api/v1/returns/RET-1042/location", json=loc_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["pickup_location"]["latitude"] == 13.0460
    assert data["pickup_location"]["longitude"] == 80.2390
    assert data["location_sharing_enabled"] is True


# ===================================================================
# 9. Warehouse Custody Flow
# ===================================================================

def test_warehouse_custody_queue(client):
    """Warehouse custody queue lists returns stored at access points or in transit."""
    response = client.get("/api/v1/warehouse/custody-queue")
    assert response.status_code == 200
    items = response.json()
    assert isinstance(items, list)


def test_warehouse_status_progression(client):
    """Advance warehouse custody status: STORED_AT_ACCESS_POINT -> COLLECTION_SCHEDULED -> IN_TRANSIT_TO_WAREHOUSE."""
    import uuid
    ret_id = f"RET-WH-{uuid.uuid4().hex[:6]}"
    # Create test order
    client.post("/api/v1/returns", json={
        "id": ret_id,
        "order_number": f"ORD-WH-{uuid.uuid4().hex[:4]}",
        "product_id": "prod-wh",
        "product_name": "WH Test Item",
        "product_sku": "WH-SKU",
        "refund_amount": 1000.0,
        "returner_id": "returner-wh",
        "returner_name": "WH Returner",
        "returner_phone": "+91 98401 11111",
        "access_point_id": "ap-04",
        "pickup_address": "Anna Salai, Chennai",
        "pickup_lat": 13.0418,
        "pickup_lon": 80.2341,
    })
    # Advance to PRODUCT_COLLECTED -> STORED_AT_ACCESS_POINT
    client.patch(f"/api/v1/returns/{ret_id}/status", json={"status": "PRODUCT_COLLECTED"})

    # Schedule collection
    res1 = client.patch(
        f"/api/v1/warehouse/returns/{ret_id}/status",
        json={"status": "COLLECTION_SCHEDULED", "actor": "Demo Logistics Hub"}
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["warehouse_pickup_status"] == "COLLECTION_SCHEDULED"

    # Confirm transit
    res2 = client.patch(
        f"/api/v1/warehouse/returns/{ret_id}/status",
        json={"status": "IN_TRANSIT_TO_WAREHOUSE", "actor": "Demo Logistics Hub"}
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["warehouse_pickup_status"] == "IN_TRANSIT_TO_WAREHOUSE"


# ===================================================================
# 10. In-Store Buyer Reservations
# ===================================================================

def test_reservations_lifecycle(client):
    """Create reservation, mark ready for pickup, and complete handover."""
    import uuid
    res_id = f"res-test-{uuid.uuid4().hex[:6]}"
    create_payload = {
        "id": res_id,
        "product_id": "prod-01",
        "buyer_id": f"buyer-{uuid.uuid4().hex[:4]}",
        "buyer_name": "Test Buyer",
        "buyer_phone": "+91 98401 99999",
        "access_point_id": "ap-04",
    }
    res = client.post("/api/v1/reservations", json=create_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["id"] == res_id
    assert data["status"] == "RESERVED"

    # Advance to READY_FOR_PICKUP
    patch_res = client.patch(f"/api/v1/reservations/{res_id}/status", json={"status": "READY_FOR_PICKUP"})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "READY_FOR_PICKUP"

    # Advance to COMPLETED (handover/sold)
    complete_res = client.patch(f"/api/v1/reservations/{res_id}/status", json={"status": "COMPLETED"})
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "COMPLETED"


# ===================================================================
# 11. Conversations & Messaging
# ===================================================================

def test_conversations_and_messaging(client):
    """Create conversation thread and send a chat message."""
    import uuid
    conv_id = f"conv-test-{uuid.uuid4().hex[:6]}"
    prod_id = f"prod-test-{uuid.uuid4().hex[:6]}"
    conv_payload = {
        "id": conv_id,
        "buyer_id": f"buyer-{uuid.uuid4().hex[:4]}",
        "buyer_name": "Rahul Verma",
        "access_point_id": "ap-04",
        "product_id": prod_id,
        "product_name": "Nike Air Zoom",
        "initial_message": "Hello, is this item available for inspection?",
    }
    conv_res = client.post("/api/v1/conversations", json=conv_payload)
    assert conv_res.status_code == 201
    conv = conv_res.json()
    assert conv["id"] == conv_id
    assert len(conv["messages"]) == 1

    # Send message in thread
    msg_payload = {
        "sender_id": "ap-04-mgr",
        "sender_role": "manager",
        "sender_name": "Express Electronics",
        "text": "Yes, it is ready at the counter!",
    }
    msg_res = client.post(f"/api/v1/conversations/{conv['id']}/messages", json=msg_payload)
    assert msg_res.status_code == 201
    msg = msg_res.json()
    assert msg["text"] == "Yes, it is ready at the counter!"
