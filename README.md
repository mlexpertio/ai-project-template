# MLExpert AI App Starter

Monorepo boilerplate for AI SaaS apps. See [`PRD.md`](./PRD.md) for the full spec.

## Status

Scaffolded so far:

- `backend/` — Python 3.12 project managed by `uv`. Dev deps: `ruff`, `pytest`, `pytest-asyncio`, `httpx`, `pre-commit`.
- `frontend/` — Next.js 16 (App Router), React 19, TypeScript 6, Tailwind 4, ESLint 9 (flat config), `src/` dir, `@/*` import alias.
- `.pre-commit-config.yaml` — on every commit runs: `check-yaml`, `check-json`, `ruff check --fix`, `ruff format`, ESLint (frontend), `pytest` (backend).

> **ESLint pinned to `^9`** — ESLint 10 is incompatible with `eslint-config-next@16.2.4`'s bundled `eslint-plugin-react` (uses a removed internal API). Bump once Next's config ships a fix.

FastAPI app, LangGraph workflow, Supabase integration, shadcn/ui, CI, Docker, etc. are **not** implemented yet — see the PRD for the roadmap.

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

No FastAPI app yet — the scaffold just has `backend/main.py` with a `main()` function:

```bash
uv run --project backend python backend/main.py
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
├── README.md                 # You are here
├── .pre-commit-config.yaml   # yaml/json/ruff/eslint/pytest hooks
├── backend/
│   ├── pyproject.toml        # uv-managed deps, pytest config
│   ├── main.py
│   └── tests/                # pytest (asyncio_mode = "auto")
└── frontend/
    ├── package.json
    ├── src/app/              # Next.js App Router
    └── ...
```
