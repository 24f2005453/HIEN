# HIEN Backend — Hyperlocal Inventory Exchange Network

> **Hackathon MVP** — Redirect eligible e-commerce returns to nearby partner stores ("Access Points") instead of shipping everything back to a central warehouse.

---

## Architecture

```
Customer Return
      ↓
  FastAPI API
      ↓
PostGIS Local Demand Check (3 km radius)
      ↓
Local Demand Score (LDS)
      ↓
 ┌───────────────┐
 │               │
LDS ≥ 40      LDS < 40
 │               │
 ▼               ▼
LOCAL_LIVE    CENTRAL_ROUTING
 │
 ▼
Local Inventory → Buyer via Mapbox
```

### LDS Formula

```
LDS = (50 × wishlist_count)
    + (30 × search_count)
    + (20 × category_velocity)
    - (15 × existing_inventory)
```

| Symbol              | Description                                     |
|---------------------|-------------------------------------------------|
| `wishlist_count`    | Wishlist signals within 3 km                    |
| `search_count`      | Search signals within 3 km                      |
| `category_velocity` | Mock ML velocity score (0.1 – 1.0)              |
| `existing_inventory`| Same-SKU items already LOCAL_LIVE within 3 km   |

**Routing:** LDS ≥ 40 → `LOCAL_LIVE` · LDS < 40 → `CENTRAL_ROUTING`

---

## Tech Stack

- Python 3.11 (Docker) / 3.10+ (local)
- FastAPI + Uvicorn
- PostgreSQL 15 + PostGIS 3.3+ (`postgis/postgis:15-3.3`)
- SQLAlchemy 2.x + GeoAlchemy2
- Pydantic v2
- Docker + Docker Compose

---

## Quick Start (Docker — Recommended)

> **Only requirement:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running on Windows.
>
> No need to install Python, PostgreSQL, or PostGIS locally.

### 1. Clone and configure

```bash
git clone <repo-url>
cd hien-backend
copy .env.example .env
```

Edit `.env` and set a secure password:

```env
POSTGRES_DB=hien
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_this_password
DATABASE_URL=postgresql://postgres:change_this_password@postgres:5432/hien
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

> **Important:** The `DATABASE_URL` host must be `postgres` (the Docker service name), **not** `localhost`.

### 2. Build and start

```bash
docker compose up --build
```

Or run in the background:

```bash
docker compose up -d --build
```

This will:
- Pull the `postgis/postgis:15-3.3` image
- Build the FastAPI backend image
- Create a persistent PostgreSQL volume
- Run `init_db.sql` to enable PostGIS (first run only)
- Start PostgreSQL, wait for it to be healthy, then start the backend
- Create all database tables automatically on startup

### 3. Verify everything is running

**Check containers:**

```bash
docker compose ps
```

**Check PostgreSQL / PostGIS:**

```bash
docker compose exec postgres psql -U postgres -d hien -c "SELECT PostGIS_Full_Version();"
```

**Check FastAPI health:**

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "HIEN Backend",
  "database": "connected"
}
```

**Open Swagger docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

### 4. Seed demo data

```bash
curl -X POST http://localhost:8000/api/v1/demo/seed
```

### 5. Stop

```bash
docker compose down
```

Stop **and remove database volume** (fresh start):

```bash
docker compose down -v
```

### 6. View logs

```bash
docker compose logs -f backend
docker compose logs -f postgres
```

---

## Local Setup (Without Docker)

<details>
<summary>Click to expand local setup instructions</summary>

### Prerequisites

- Python 3.10+
- PostgreSQL 15 with PostGIS extension installed locally

### Create the database

```bash
createdb hien
psql -U postgres -d hien -f init_db.sql
```

### Configure environment

```bash
copy .env.example .env
```

Edit `.env` — change the host to `localhost`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/hien
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

Tables are created automatically on startup.

</details>

---

## API Endpoints

| Method | Path                                 | Description                    |
|--------|--------------------------------------|--------------------------------|
| GET    | `/health`                            | Health check                   |
| POST   | `/api/v1/returns/evaluate-demand`    | Calculate LDS & routing        |
| POST   | `/api/v1/inventory/ingest`           | Ingest returned product        |
| GET    | `/api/v1/discovery/local-feed`       | GeoJSON feed for Mapbox        |
| POST   | `/api/v1/cron/price-decay`           | Simulate shelf-aging           |
| POST   | `/api/v1/demo/seed`                  | Seed demo data (dev only)      |

---

## Example API Requests

### Evaluate Demand

```bash
curl -X POST http://localhost:8000/api/v1/returns/evaluate-demand ^
  -H "Content-Type: application/json" ^
  -d "{\"access_point_lat\": 13.0827, \"access_point_lon\": 80.2707, \"category\": \"jackets\", \"sku\": \"JACKET-001\"}"
```

**Response:**

```json
{
  "routing": "LOCAL_LIVE",
  "lds_score": 64.4,
  "breakdown": {
    "wishlist_count": 1,
    "search_count": 1,
    "category_velocity": 0.72,
    "existing_inventory": 0
  }
}
```

### Ingest Inventory

```bash
curl -X POST http://localhost:8000/api/v1/inventory/ingest ^
  -H "Content-Type: application/json" ^
  -d "{\"sku\": \"JACKET-001\", \"category\": \"jackets\", \"msrp\": 4000, \"lat\": 13.0827, \"lon\": 80.2707, \"access_point_id\": \"AP-001\", \"routing_decision\": \"LOCAL_LIVE\"}"
```

**Response:**

```json
{
  "success": true,
  "inventory_id": "...",
  "status": "LOCAL_LIVE",
  "sku": "JACKET-001",
  "msrp": 4000,
  "current_price": 3400
}
```

### Local Discovery Feed (GeoJSON)

```bash
curl "http://localhost:8000/api/v1/discovery/local-feed?buyer_lat=13.0827&buyer_lon=80.2707&radius_meters=3000"
```

### Price Decay

```bash
curl -X POST http://localhost:8000/api/v1/cron/price-decay
```

---

## Price Decay Logic

```
decay_periods = floor(days_on_shelf / 2)
new_price     = msrp × 0.85 × (0.99 ^ decay_periods)
```

- Price is **always** recalculated from MSRP (idempotent — safe to call repeatedly).
- Items with `days_on_shelf ≥ 14` are moved to `CENTRAL_ROUTING`.

---

## Frontend Integration

The React + Vite frontend connects to:

```
http://localhost:8000
```

- Normal endpoints return **JSON**.
- `/api/v1/discovery/local-feed` returns **GeoJSON** (FeatureCollection) ready for Mapbox GL JS.
- GeoJSON coordinates are `[longitude, latitude]` per spec.
- CORS is configured for `http://localhost:5173` by default (configurable via `CORS_ORIGINS`).

---

## Project Structure

```
hien-backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app & all endpoints
│   ├── database.py          # SQLAlchemy engine & session
│   ├── models.py            # PostGIS-backed ORM models
│   ├── schemas.py           # Pydantic request/response schemas
│   └── services/
│       ├── __init__.py
│       └── demand.py        # LDS calculation & category velocity
├── Dockerfile               # FastAPI container image
├── docker-compose.yml       # PostgreSQL + Backend orchestration
├── .dockerignore
├── .env.example             # Environment variable template
├── requirements.txt
├── init_db.sql              # PostGIS extension init (auto-run by Docker)
└── README.md
```

---

## Docker Commands Reference

| Action                                | Command                          |
|---------------------------------------|----------------------------------|
| Build and start                       | `docker compose up --build`      |
| Build and start (background)          | `docker compose up -d --build`   |
| Stop                                  | `docker compose down`            |
| Stop and delete database              | `docker compose down -v`         |
| View backend logs                     | `docker compose logs -f backend` |
| View database logs                    | `docker compose logs -f postgres`|
| Check running containers              | `docker compose ps`              |
| Open a psql shell                     | `docker compose exec postgres psql -U postgres -d hien` |
| Rebuild backend only                  | `docker compose build backend`   |

---

## License

Hackathon project — MIT License.
