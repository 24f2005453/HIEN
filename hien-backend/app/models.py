"""
HIEN Backend — SQLAlchemy / PostGIS models
==========================================
Two tables:

1. **demand_signals** — wishlist and search signals geotagged with PostGIS
2. **local_inventory**  — products held at Access Points

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
    DateTime,
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
    access_point_id = Column(String, nullable=False)
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

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<LocalInventory {self.sku} | {self.status.value}>"
