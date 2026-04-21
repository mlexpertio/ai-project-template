# MLExpert AI App Starter

Monorepo boilerplate for AI SaaS apps. See [`PRD.md`](./PRD.md) for the full spec and [`TODO.md`](./TODO.md) for progress.

## Prerequisites

- [`uv`](https://docs.astral.sh/uv/) (installs Python 3.12 automatically)
- Node.js 20+ and `npm`
- Git

## Install

```bash
# Backend deps (creates .venv and installs dev group)
uv sync --project backend

# Frontend deps
npm --prefix frontend install

# Install git hooks (one-time)
uv run --project backend pre-commit install
```

## Run

### Backend

```bash
uv run --project backend uvicorn main:app --reload
```

Runs at `http://localhost:8000`. See `client.py` for a CLI tool to upload, list, and delete documents:

```bash
uv run --project backend python client.py upload file.txt
uv run --project backend python client.py list
uv run --project backend python client.py delete <doc-id>
```

### Frontend

```bash
npm --prefix frontend run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Test & lint

### Run every check (FE + BE)

```bash
uv run --project backend pre-commit run --all-files && npm --prefix frontend run typecheck
```

This covers: YAML/JSON validation, `ruff check` + `ruff format`, ESLint, backend `pytest`, and frontend TypeScript typecheck (`tsc` isn't in pre-commit because it's too slow to run on every commit).

### Individual checks

```bash
# Backend
uv run --project backend pytest
uv run --project backend ruff check backend
uv run --project backend ruff format backend

# Frontend
npm --prefix frontend run lint
npm --prefix frontend run typecheck
```

Pre-commit runs automatically on `git commit`. If a hook fails, fix the issue, re-stage, and commit again.

## Layout

```
.
├── PRD.md                    # Product requirements
├── TODO.md                   # Progress tracker
├── README.md                 # You are here
├── .pre-commit-config.yaml   # yaml/json/ruff/eslint/pytest hooks
├── backend/
│   ├── pyproject.toml        # uv-managed deps, pytest config
│   ├── main.py               # FastAPI app (documents + healthz endpoints)
│   ├── client.py             # CLI tool to upload/fetch documents
│   └── tests/                # pytest (asyncio_mode = "auto")
└── frontend/
    ├── package.json
    ├── src/app/              # Next.js App Router
    └── ...
```
