"""
HIEN Backend — Demand Score Engine
===================================
Contains:
  • get_category_velocity()  — mock ML category velocity (future: AWS SageMaker)
  • calculate_lds()          — Local Demand Score formula

The LDS formula:
    LDS = (50 × W_L) + (30 × S_L) + (20 × C_V) - (15 × I_E)

Where:
    W_L = wishlist signal count within 3 km
    S_L = search signal count within 3 km
    C_V = category velocity  (0.1 – 1.0)
    I_E = existing local inventory count for the same SKU

Routing rule:
    LDS >= 40  →  LOCAL_LIVE   (keep at Access Point)
    LDS <  40  →  CENTRAL_ROUTING (send to central warehouse)
"""


# -----------------------------------------------------------------------
# Category Velocity (mock)
# -----------------------------------------------------------------------
# FUTURE PRODUCTION NOTE:
# Replace this function with a call to the ML inference pipeline
# (e.g. AWS SageMaker endpoint) that returns real-time category velocity
# based on historical sales data, seasonality, and regional demand.
# -----------------------------------------------------------------------

_CATEGORY_VELOCITY: dict[str, float] = {
    "shoes": 0.85,
    "jackets": 0.72,
    "electronics": 0.90,
    "bags": 0.65,
    "accessories": 0.60,
    "clothing": 0.78,
    "sportswear": 0.80,
    "home": 0.55,
}


def get_category_velocity(category: str) -> float:
    """Return a deterministic velocity score for the given category.

    Production replacement: call the ML model endpoint here.

    Returns:
        float between 0.1 and 1.0
    """
    return _CATEGORY_VELOCITY.get(category.lower(), 0.50)


# -----------------------------------------------------------------------
# Local Demand Score (LDS)
# -----------------------------------------------------------------------

def calculate_lds(
    wishlist_count: int,
    search_count: int,
    category_velocity: float,
    existing_inventory: int,
) -> float:
    """Compute the Local Demand Score.

    Args:
        wishlist_count:     Number of wishlist signals within the radius.
        search_count:       Number of search signals within the radius.
        category_velocity:  Velocity score for the product category (0.1–1.0).
        existing_inventory: Count of same-SKU items already at the Access Point.

    Returns:
        LDS as a float (can be negative if inventory is saturated).
    """
    lds = (
        (50 * wishlist_count)
        + (30 * search_count)
        + (20 * category_velocity)
        - (15 * existing_inventory)
    )
    return round(lds, 2)


def route_decision(lds_score: float) -> str:
    """Return the routing label based on the LDS threshold.

    Threshold: 40
    """
    return "LOCAL_LIVE" if lds_score >= 40 else "CENTRAL_ROUTING"
