"""
HIEN Backend — Pydantic schemas
================================
Request / response contracts for every API endpoint.
All validation (lat/lon ranges, positive values, types) lives here.
"""

from __future__ import annotations

import uuid
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator


# =====================================================================
# Shared validators
# =====================================================================

def _validate_latitude(v: float) -> float:
    if not (-90 <= v <= 90):
        raise ValueError("Latitude must be between -90 and 90")
    return v


def _validate_longitude(v: float) -> float:
    if not (-180 <= v <= 180):
        raise ValueError("Longitude must be between -180 and 180")
    return v


# =====================================================================
# Catalog Products
# =====================================================================

class CatalogProductResponse(BaseModel):
    """GET /api/v1/catalog/barcode/{barcode}"""
    barcode: str
    sku: str
    name: str
    category: str
    size_or_variant: Optional[str] = None
    msrp: float
    open_box_price: float
    image_url: Optional[str] = None


class CatalogProductCreate(BaseModel):
    barcode: str = Field(..., min_length=1)
    sku: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    size_or_variant: Optional[str] = None
    msrp: float = Field(..., ge=0)
    image_url: Optional[str] = None


# =====================================================================
# Access Points
# =====================================================================

class AccessPointResponse(BaseModel):
    id: str
    code: str
    name: str
    address: str
    area: str
    city: str
    state: str
    pincode: str
    phone: Optional[str] = None
    status: str
    latitude: float
    longitude: float


class AccessPointCreate(BaseModel):
    id: Optional[str] = None
    code: Optional[str] = None
    name: str = Field(..., min_length=1)
    address: str = Field(..., min_length=1)
    area: str = Field(..., min_length=1)
    city: str = Field(..., min_length=1)
    state: Optional[str] = "Tamil Nadu"
    pincode: str = Field(..., min_length=1)
    latitude: float
    longitude: float
    phone: Optional[str] = None
    status: Optional[str] = "ACTIVE"

    @field_validator("latitude")
    @classmethod
    def lat_range(cls, v: float) -> float:
        return _validate_latitude(v)

    @field_validator("longitude")
    @classmethod
    def lon_range(cls, v: float) -> float:
        return _validate_longitude(v)


class AccessPointUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    area: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @field_validator("latitude")
    @classmethod
    def lat_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            return _validate_latitude(v)
        return v

    @field_validator("longitude")
    @classmethod
    def lon_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            return _validate_longitude(v)
        return v


# =====================================================================
# Demand Signals (Capture & Evaluation)
# =====================================================================

class DemandSignalCreateRequest(BaseModel):
    """POST /api/v1/demand-signals"""
    signal_type: str = Field(..., description="Must be 'wishlist' or 'search'")
    category: str = Field(..., min_length=1, description="Product category")
    lat: float
    lon: float

    @field_validator("lat")
    @classmethod
    def lat_range(cls, v: float) -> float:
        return _validate_latitude(v)

    @field_validator("lon")
    @classmethod
    def lon_range(cls, v: float) -> float:
        return _validate_longitude(v)

    @field_validator("signal_type")
    @classmethod
    def valid_signal(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if cleaned not in {"wishlist", "search"}:
            raise ValueError("signal_type must be 'wishlist' or 'search'")
        return cleaned


class DemandSignalCreateResponse(BaseModel):
    success: bool
    signal_id: str
    signal_type: str
    category: str
    lat: float
    lon: float
    timestamp: str


class DemandEvaluationRequest(BaseModel):
    """POST /api/v1/returns/evaluate-demand"""
    access_point_lat: float = Field(..., description="Latitude of the Access Point")
    access_point_lon: float = Field(..., description="Longitude of the Access Point")
    category: str = Field(..., min_length=1, description="Product category")
    sku: str = Field(..., min_length=1, description="Stock Keeping Unit identifier")

    @field_validator("access_point_lat")
    @classmethod
    def lat_range(cls, v: float) -> float:
        return _validate_latitude(v)

    @field_validator("access_point_lon")
    @classmethod
    def lon_range(cls, v: float) -> float:
        return _validate_longitude(v)


class DemandBreakdown(BaseModel):
    wishlist_count: int
    search_count: int
    category_velocity: float
    existing_inventory: int


class DemandEvaluationResponse(BaseModel):
    routing: str
    lds_score: float
    breakdown: DemandBreakdown


# =====================================================================
# Inventory Ingestion
# =====================================================================

class InventoryIngestRequest(BaseModel):
    """POST /api/v1/inventory/ingest"""
    sku: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    msrp: float = Field(..., ge=0, description="Manufacturer's Suggested Retail Price")
    lat: float
    lon: float
    access_point_id: str = Field(..., min_length=1)
    routing_decision: str = Field(
        ...,
        description="Must be LOCAL_LIVE or CENTRAL_ROUTING",
    )

    # Metadata extensions
    barcode: Optional[str] = None
    product_name: Optional[str] = None
    image_url: Optional[str] = None
    condition: Optional[str] = "Pristine"
    size_or_variant: Optional[str] = None
    access_point_name: Optional[str] = None
    access_point_code: Optional[str] = None
    access_point_address: Optional[str] = None
    is_mismatch_return: Optional[bool] = False
    ai_confidence: Optional[float] = None

    # Mismatch dual-identity audit extensions
    original_barcode: Optional[str] = None
    original_sku: Optional[str] = None
    original_product_name: Optional[str] = None

    @field_validator("lat")
    @classmethod
    def lat_range(cls, v: float) -> float:
        return _validate_latitude(v)

    @field_validator("lon")
    @classmethod
    def lon_range(cls, v: float) -> float:
        return _validate_longitude(v)

    @field_validator("routing_decision")
    @classmethod
    def valid_routing(cls, v: str) -> str:
        allowed = {"LOCAL_LIVE", "CENTRAL_ROUTING"}
        if v not in allowed:
            raise ValueError(f"routing_decision must be one of {allowed}")
        return v


class InventoryIngestResponse(BaseModel):
    success: bool
    inventory_id: str
    status: str
    sku: str
    msrp: float
    current_price: float
    product_name: Optional[str] = None
    image_url: Optional[str] = None
    condition: Optional[str] = None
    access_point_id: str
    is_mismatch_return: Optional[bool] = False
    ai_confidence: Optional[float] = None
    original_barcode: Optional[str] = None
    original_sku: Optional[str] = None
    original_product_name: Optional[str] = None


# =====================================================================
# Local Discovery Feed (GeoJSON)
# =====================================================================

class LocalFeedQuery(BaseModel):
    """Query parameters for GET /api/v1/discovery/local-feed"""
    buyer_lat: float
    buyer_lon: float
    radius_meters: float = Field(default=3000, gt=0)

    @field_validator("buyer_lat")
    @classmethod
    def lat_range(cls, v: float) -> float:
        return _validate_latitude(v)

    @field_validator("buyer_lon")
    @classmethod
    def lon_range(cls, v: float) -> float:
        return _validate_longitude(v)


class GeoJSONPointGeometry(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]


class GeoJSONFeatureProperties(BaseModel):
    id: str
    sku: str
    category: str
    msrp: float
    current_price: float
    discount_percent: float
    access_point_id: str
    distance_meters: Optional[float] = None

    # Extended authoritative properties
    name: Optional[str] = None
    barcode: Optional[str] = None
    image_url: Optional[str] = None
    condition: Optional[str] = None
    size_or_variant: Optional[str] = None
    access_point_name: Optional[str] = None
    access_point_code: Optional[str] = None
    access_point_address: Optional[str] = None
    is_mismatch_return: Optional[bool] = False
    ai_confidence: Optional[float] = None

    # Dual identity properties
    original_barcode: Optional[str] = None
    original_sku: Optional[str] = None
    original_product_name: Optional[str] = None


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONPointGeometry
    properties: GeoJSONFeatureProperties


class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]


# =====================================================================
# Doorstep Return Pickups & Warehouse Custody
# =====================================================================

class LiveCoordinatesSchema(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    timestamp: Optional[str] = None


class WarehouseCustodyEventSchema(BaseModel):
    id: str
    status: str
    timestamp: str
    actor: str


class ReturnOrderResponse(BaseModel):
    id: str
    order_number: str
    product_id: str
    product_name: str
    product_sku: str
    product_image_url: Optional[str] = None
    refund_amount: float
    returner_id: str
    returner_name: str
    returner_phone: str
    access_point_id: str
    access_point_name: str
    access_point_code: str
    status: str
    pickup_address: str
    pickup_location: LiveCoordinatesSchema
    location_sharing_enabled: bool
    pickup_person_id: Optional[str] = None
    pickup_person_name: Optional[str] = None
    pickup_person_phone: Optional[str] = None
    pickup_person_location: Optional[LiveCoordinatesSchema] = None
    vehicle_number: Optional[str] = None
    eta_minutes: Optional[int] = None
    distance_km: Optional[float] = None
    created_at: str
    collected_at: Optional[str] = None
    refund_completed_at: Optional[str] = None
    is_demo_movement: Optional[bool] = True
    warehouse_pickup_status: Optional[str] = "AWAITING_ACCESS_POINT"
    warehouse_custody_events: Optional[List[WarehouseCustodyEventSchema]] = None


class ReturnOrderCreateRequest(BaseModel):
    id: Optional[str] = None
    order_number: str = Field(..., min_length=1)
    product_id: str = Field(..., min_length=1)
    product_name: str = Field(..., min_length=1)
    product_sku: str = Field(..., min_length=1)
    product_image_url: Optional[str] = None
    refund_amount: float = Field(..., ge=0)
    returner_id: str = Field(..., min_length=1)
    returner_name: str = Field(..., min_length=1)
    returner_phone: str = Field(..., min_length=1)
    access_point_id: str = Field(..., min_length=1)
    pickup_address: str = Field(..., min_length=1)
    pickup_lat: float
    pickup_lon: float
    location_sharing_enabled: Optional[bool] = False

    @field_validator("pickup_lat")
    @classmethod
    def lat_range(cls, v: float) -> float:
        return _validate_latitude(v)

    @field_validator("pickup_lon")
    @classmethod
    def lon_range(cls, v: float) -> float:
        return _validate_longitude(v)


class ReturnStatusUpdateRequest(BaseModel):
    status: str
    pickup_person_id: Optional[str] = None
    pickup_person_name: Optional[str] = None
    pickup_person_phone: Optional[str] = None
    vehicle_number: Optional[str] = None
    eta_minutes: Optional[int] = None
    distance_km: Optional[float] = None


class ReturnLocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    location_sharing_enabled: Optional[bool] = True

    @field_validator("latitude")
    @classmethod
    def lat_range(cls, v: float) -> float:
        return _validate_latitude(v)

    @field_validator("longitude")
    @classmethod
    def lon_range(cls, v: float) -> float:
        return _validate_longitude(v)


class WarehouseStatusUpdateRequest(BaseModel):
    status: str  # e.g. "COLLECTION_SCHEDULED", "IN_TRANSIT_TO_WAREHOUSE", "RECEIVED_AT_WAREHOUSE"
    actor: Optional[str] = "Warehouse Operations Team"


# =====================================================================
# In-Store Buyer Reservations
# =====================================================================

class ReservationResponse(BaseModel):
    id: str
    product_id: str
    product_name: str
    product_sku: str
    product_price: float
    product_image_url: Optional[str] = None
    access_point_id: str
    access_point_name: str
    access_point_code: str
    buyer_id: str
    buyer_name: str
    buyer_phone: Optional[str] = None
    status: str
    reserved_at: str
    updated_at: str


class ReservationCreateRequest(BaseModel):
    id: Optional[str] = None
    product_id: str = Field(..., min_length=1)
    buyer_id: str = Field(..., min_length=1)
    buyer_name: str = Field(..., min_length=1)
    buyer_phone: Optional[str] = None
    access_point_id: Optional[str] = None


class ReservationStatusUpdateRequest(BaseModel):
    status: str  # e.g. "READY_FOR_PICKUP", "COMPLETED", "CANCELLED"


# =====================================================================
# Conversations & Messaging
# =====================================================================

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_role: str
    sender_name: str
    text: str
    timestamp: str


class MessageCreateRequest(BaseModel):
    sender_id: str = Field(..., min_length=1)
    sender_role: str = Field(..., min_length=1)
    sender_name: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)


class ConversationResponse(BaseModel):
    id: str
    buyer_id: str
    buyer_name: str
    access_point_id: str
    access_point_name: str
    access_point_code: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    product_image_url: Optional[str] = None
    return_order_id: Optional[str] = None
    last_message_snippet: Optional[str] = None
    last_message_time: Optional[str] = None
    unread_count: int = 0
    messages: List[MessageResponse] = []


class ConversationCreateRequest(BaseModel):
    id: Optional[str] = None
    buyer_id: str = Field(..., min_length=1)
    buyer_name: str = Field(..., min_length=1)
    access_point_id: str = Field(..., min_length=1)
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    product_image_url: Optional[str] = None
    return_order_id: Optional[str] = None
    initial_message: Optional[str] = None


# =====================================================================
# Administrative & Status
# =====================================================================

class PriceDecayResponse(BaseModel):
    success: bool
    updated_items: int
    routed_to_central: int


class DemoSeedResponse(BaseModel):
    success: bool
    catalog_items_seeded: int
    demand_signals_created: int
    inventory_items_created: int
    access_points_seeded: Optional[int] = 0
    return_orders_seeded: Optional[int] = 0
    reservations_seeded: Optional[int] = 0


class HealthResponse(BaseModel):
    status: str
    service: str
    database: Optional[str] = None
    version: Optional[str] = "0.2.0"
