"""
HIEN Backend — SQLAlchemy / PostGIS models
==========================================
Core tables:

1. **demand_signals**   — wishlist and search signals geotagged with PostGIS (SRID 4326)
2. **local_inventory**  — products held at Access Points with pricing, lifecycle, and metadata
3. **catalog_products** — authoritative master product catalog mapped by unique barcode / SKU
4. **access_points**    — partner Access Points with geocoded PostGIS coordinates
5. **return_orders**    — doorstep return pickups, live tracking, and warehouse custody queue
6. **reservations**     — in-store buyer holds and counter handover state
7. **conversations**    — buyer-manager-courier messaging threads
8. **messages**         — individual chat inquiry messages

All geometry columns use SRID 4326 (WGS 84 lat/lon).
Distance queries use ``geography`` casts so ST_DWithin operates in **metres**.
"""

import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    DateTime,
    Text,
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SignalType(str, enum.Enum):
    """Kind of demand signal captured by the platform."""
    wishlist = "wishlist"
    search = "search"


class InventoryStatus(str, enum.Enum):
    """Lifecycle state of a returned product."""
    PENDING_AI = "PENDING_AI"
    LOCAL_LIVE = "LOCAL_LIVE"
    CENTRAL_ROUTING = "CENTRAL_ROUTING"
    RESERVED = "RESERVED"
    SOLD = "SOLD"


# ---------------------------------------------------------------------------
# catalog_products — Authoritative Master Catalog
# ---------------------------------------------------------------------------

class CatalogProduct(Base):
    __tablename__ = "catalog_products"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    barcode = Column(String, unique=True, nullable=False, index=True)
    sku = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False, index=True)
    size_or_variant = Column(String, nullable=True)
    msrp = Column(Float, nullable=False)
    image_url = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<CatalogProduct {self.sku} | {self.barcode} | {self.name}>"


# ---------------------------------------------------------------------------
# demand_signals
# ---------------------------------------------------------------------------

class DemandSignal(Base):
    __tablename__ = "demand_signals"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    signal_type = Column(
        SAEnum(SignalType, name="signal_type_enum", create_constraint=True),
        nullable=False,
    )
    category = Column(String, nullable=False, index=True)

    # PostGIS Point — stored in SRID 4326
    geom = Column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=False,
    )

    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<DemandSignal {self.signal_type.value} | {self.category}>"


# ---------------------------------------------------------------------------
# local_inventory
# ---------------------------------------------------------------------------

class LocalInventory(Base):
    __tablename__ = "local_inventory"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    access_point_id = Column(String, nullable=False, index=True)
    sku = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, index=True)

    # PostGIS Point — stored in SRID 4326
    geom = Column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=False,
    )

    status = Column(
        SAEnum(InventoryStatus, name="inventory_status_enum", create_constraint=True),
        nullable=False,
        index=True,
    )

    msrp = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    days_on_shelf = Column(Integer, nullable=False, default=0)

    # Extended authoritative metadata fields for buyer discovery and frontend sync
    product_name = Column(String, nullable=True)
    barcode = Column(String, nullable=True, index=True)
    image_url = Column(String, nullable=True)
    condition = Column(String, nullable=True, default="Pristine")
    size_or_variant = Column(String, nullable=True)
    access_point_name = Column(String, nullable=True)
    access_point_code = Column(String, nullable=True)
    access_point_address = Column(String, nullable=True)
    is_mismatch_return = Column(Boolean, nullable=True, default=False)
    ai_confidence = Column(Float, nullable=True)

    # Dual identity mismatch audit fields
    original_barcode = Column(String, nullable=True)
    original_sku = Column(String, nullable=True)
    original_product_name = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<LocalInventory {self.sku} | {self.status.value}>"


# ---------------------------------------------------------------------------
# access_points — Verified Partner Stores & Hubs
# ---------------------------------------------------------------------------

class AccessPoint(Base):
    __tablename__ = "access_points"

    id = Column(String, primary_key=True)  # e.g. "ap-04"
    code = Column(String, unique=True, nullable=False, index=True)  # e.g. "AP-04"
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    area = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False, default="Tamil Nadu")
    pincode = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    status = Column(String, nullable=False, default="ACTIVE")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    geom = Column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<AccessPoint {self.code} | {self.name}>"


# ---------------------------------------------------------------------------
# return_orders — Doorstep Return Pickups & Warehouse Custody
# ---------------------------------------------------------------------------

class ReturnOrder(Base):
    __tablename__ = "return_orders"

    id = Column(String, primary_key=True)  # e.g. "RET-1042"
    order_number = Column(String, nullable=False, index=True)  # e.g. "ORD-99214"
    product_id = Column(String, nullable=False)
    product_name = Column(String, nullable=False)
    product_sku = Column(String, nullable=False)
    product_image_url = Column(String, nullable=True)
    refund_amount = Column(Float, nullable=False)
    returner_id = Column(String, nullable=False)
    returner_name = Column(String, nullable=False)
    returner_phone = Column(String, nullable=False)
    access_point_id = Column(String, nullable=False, index=True)
    access_point_name = Column(String, nullable=False)
    access_point_code = Column(String, nullable=False)
    status = Column(String, nullable=False, default="RETURN_REQUESTED", index=True)
    pickup_address = Column(String, nullable=False)
    pickup_lat = Column(Float, nullable=False)
    pickup_lon = Column(Float, nullable=False)

    geom = Column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=True,
    )

    location_sharing_enabled = Column(Boolean, default=False, nullable=False)
    pickup_person_id = Column(String, nullable=True)
    pickup_person_name = Column(String, nullable=True)
    pickup_person_phone = Column(String, nullable=True)
    pickup_person_lat = Column(Float, nullable=True)
    pickup_person_lon = Column(Float, nullable=True)
    vehicle_number = Column(String, nullable=True)
    eta_minutes = Column(Integer, nullable=True)
    distance_km = Column(Float, nullable=True)

    # Warehouse Custody Flow
    warehouse_pickup_status = Column(
        String,
        nullable=False,
        default="AWAITING_ACCESS_POINT",
        index=True,
    )
    warehouse_custody_events = Column(Text, nullable=True)  # JSON-encoded array of custody events
    is_demo_movement = Column(Boolean, default=True, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    collected_at = Column(DateTime(timezone=True), nullable=True)
    refund_completed_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<ReturnOrder {self.id} | {self.status} | {self.warehouse_pickup_status}>"


# ---------------------------------------------------------------------------
# reservations — In-Store Buyer Holds & Counter Handover
# ---------------------------------------------------------------------------

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(String, primary_key=True)  # e.g. "res-01"
    product_id = Column(String, nullable=False, index=True)
    product_name = Column(String, nullable=False)
    product_sku = Column(String, nullable=False)
    product_price = Column(Float, nullable=False)
    product_image_url = Column(String, nullable=True)
    access_point_id = Column(String, nullable=False, index=True)
    access_point_name = Column(String, nullable=False)
    access_point_code = Column(String, nullable=False)
    buyer_id = Column(String, nullable=False, index=True)
    buyer_name = Column(String, nullable=False)
    buyer_phone = Column(String, nullable=True)
    status = Column(String, nullable=False, default="RESERVED", index=True)

    reserved_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Reservation {self.id} | {self.product_name} | {self.status}>"


# ---------------------------------------------------------------------------
# conversations & messages — Inquiries and Logistics Chat
# ---------------------------------------------------------------------------

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True)  # e.g. "conv-01"
    buyer_id = Column(String, nullable=False, index=True)
    buyer_name = Column(String, nullable=False)
    access_point_id = Column(String, nullable=False, index=True)
    access_point_name = Column(String, nullable=False)
    access_point_code = Column(String, nullable=False)
    product_id = Column(String, nullable=True)
    product_name = Column(String, nullable=True)
    product_image_url = Column(String, nullable=True)
    return_order_id = Column(String, nullable=True, index=True)
    last_message_snippet = Column(String, nullable=True)
    last_message_time = Column(String, nullable=True)
    unread_count = Column(Integer, default=0, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Conversation {self.id} | {self.product_name}>"


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True)  # e.g. "msg-101"
    conversation_id = Column(String, nullable=False, index=True)
    sender_id = Column(String, nullable=False)
    sender_role = Column(String, nullable=False)
    sender_name = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    timestamp = Column(String, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Message {self.id} from {self.sender_name}>"
