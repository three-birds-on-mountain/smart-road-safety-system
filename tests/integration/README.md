# Integration Test Environment

This folder contains the supporting files required to run backend integration tests (see `tests/integration/*.py`).  The tests spin up a temporary FastAPI app with an in-memory database override, but for end‑to‑end contract testing we still need a running PostGIS instance plus seeded environment variables.

## docker-compose (PostGIS)

```bash
docker-compose -f tests/integration/docker-compose.test.yml up -d
```

Services:

| Service | Purpose | Ports |
|---------|---------|-------|
| `postgres-test` | PostgreSQL 15 + PostGIS 3.4 (used by SQLAlchemy/Alembic during tests) | `55432:5432` |

Once the container is up, set the following env vars before running pytest:

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:55432/road_safety_test
export GOOGLE_MAPS_API_KEY=dummy-test-key
export ADMIN_JWT_SECRET=integration-test-secret
```

## Running the tests

```bash
cd backend
uv run pytest tests/integration
```

> Note: `uv run` automatically reuses the project virtualenv declared in `pyproject.toml`.  If you prefer `pip`, activate `.venv` first.

## Cleanup

```bash
docker-compose -f tests/integration/docker-compose.test.yml down -v
```

This removes the test database completely to ensure every run starts from a clean state.***
