# MLExpert AI App Starter

Monorepo boilerplate for AI SaaS apps. See [`PRD.md`](./PRD.md) for the full spec.

## Status

### Completed

- `backend/` — Python 3.12 project managed by `uv`. Full FastAPI app with:
  - `POST /api/v1/documents` — upload `.md` file, splits into chunks using `MarkdownHeaderTextSplitter` + `CharacterTextSplitter` (500 chars, 50 overlap).
  - `GET /api/v1/documents/{id}` — returns document with all chunks.
  - `GET /healthz` — liveness check.
  - In-memory storage (module-level dict, resets on restart).
  - `client.py` — CLI script to upload a `.md` file and fetch it back.
  - Tests: `pytest` + `httpx` ASGI transport, TDD red/green cycle.
- `frontend/` — Next.js 16 (App Router), React 19, TypeScript 6, Tailwind 4, ESLint 9 (flat config), `src/` dir, `@/*` import alias.
- `.pre-commit-config.yaml` — on every commit runs: `check-yaml`, `check-json`, `ruff check --fix`, `ruff format`, ESLint (frontend), `pytest` (backend).

> **ESLint pinned to `^9`** — ESLint 10 is incompatible with `eslint-config-next@16.2.4`'s bundled `eslint-plugin-react` (uses a removed internal API). Bump once Next's config ships a fix.

### Not yet implemented

LangGraph workflow, Supabase/pgvector integration, PDF ingestion (`docling` + `arq`), LLM providers (`langchain-ollama`, `langchain-openai`, `langchain-anthropic`), chat streaming, shadcn/ui, CI, Docker, observability (`mlflow`), etc. — see the PRD for the roadmap.

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

Runs at `http://localhost:8000`. See `client.py` for a CLI tool to upload and fetch documents.

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
