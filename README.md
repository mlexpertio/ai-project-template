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
uv run --project backend uvicorn app.main:app --reload --app-dir backend
```

Runs at `http://localhost:8000`.

**Backend API**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/healthz` | Liveness check |
| POST | `/api/v1/documents` | Upload a `.txt`, `.md`, or `.pdf` (≤ 5 MB) |
| GET | `/api/v1/documents` | List uploaded documents (metadata only) |
| DELETE | `/api/v1/documents/{id}` | Remove a document |
| POST | `/api/v1/threads` | Create a thread (optionally attach documents) |
| GET | `/api/v1/threads` | List threads |
| GET | `/api/v1/threads/{id}` | Get thread with messages |
| DELETE | `/api/v1/threads/{id}` | Delete a thread |
| POST | `/api/v1/chat/stream` | Stream chat response (Vercel AI SDK data-stream format) |

See `client.py` for a CLI tool to upload, list, and delete documents:

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

### Environment variables

Copy `.env.example` to `.env` and fill in your keys. `AI_PROVIDER` + `MODEL_NAME` control which LLM is used (`ollama`, `openai`, or `anthropic`).

### API types for the frontend

The backend exposes an OpenAPI schema at `http://localhost:8000/openapi.json`. The frontend can generate typed clients from it using `openapi-typescript`.

## Layout

```
.
├── PRD.md                    # Product requirements
├── TODO.md                   # Progress tracker
├── README.md                 # You are here
├── .env.example              # Environment variables template
├── .pre-commit-config.yaml   # yaml/json/ruff/eslint/pytest hooks
├── backend/
│   ├── pyproject.toml        # uv-managed deps, pytest config
│   ├── client.py             # CLI tool to upload/list/delete documents
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, router mounts
│   │   ├── schemas.py        # Pydantic request/response models
│   │   ├── state.py          # In-memory dataclasses (Document, Thread, etc.)
│   │   ├── config.py         # Env-driven settings
│   │   ├── routers/
│   │   │   ├── health.py     # GET /healthz
│   │   │   ├── documents.py  # Upload, list, delete documents
│   │   │   ├── threads.py    # Create, list, get, delete threads
│   │   │   └── chat.py       # Streaming chat endpoint
│   │   └── services/
│   │       ├── parse.py      # Text extraction (txt/md/pdf)
│   │       ├── llm.py        # get_llm() provider factory
│   │       ├── graph.py      # LangGraph single-node workflow
│   │       ├── chat.py       # stream_chat orchestration
│   │       └── sse.py        # Vercel AI SDK data-stream encoder
│   └── tests/                # pytest (asyncio_mode = "auto")
└── frontend/
    ├── package.json
    ├── src/app/              # Next.js App Router
    └── ...
```
