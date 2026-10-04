"""
HIEN Backend — Pydantic schemas
================================
Request / response contracts for every API endpoint.
All validation (lat/lon ranges, positive values, etc.) lives here.
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
# A — Demand Evaluation
# =====================================================================

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
# B — Inventory Ingestion
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


# =====================================================================
# C — Local Discovery Feed (query params)
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


# GeoJSON structures (typed for clarity)

class GeoJSONPointGeometry(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [lon, lat]


class GeoJSONFeatureProperties(BaseModel):
    id: str
    sku: str
    category: str
    msrp: float
    current_price: float
    discount_percent: float
    access_point_id: str
    distance_meters: Optional[float] = None


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONPointGeometry
    properties: GeoJSONFeatureProperties


class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]


# =====================================================================
# D — Price Decay
# =====================================================================

class PriceDecayResponse(BaseModel):
    success: bool
    updated_items: int
    routed_to_central: int


# =====================================================================
# Demo Seed
# =====================================================================

class DemoSeedResponse(BaseModel):
    success: bool
    demand_signals_created: int
    inventory_items_created: int


# =====================================================================
# Health
# =====================================================================

class HealthResponse(BaseModel):
    status: str
    service: str
    database: Optional[str] = None
