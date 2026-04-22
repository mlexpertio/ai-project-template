# MLExpert AI App Template

## 1. Product Overview
**Name:** MLExpert AI App Starter
**Purpose:** Minimal decoupled monorepo boilerplate for AI engineers to launch single-user, private/local AI applications. Multi-turn chat with swappable LLM providers and optional per-thread document context.
**Key Constraint:** Toggle between Local AI (Ollama) and Cloud AI (OpenAI / Anthropic) via a single env var, with zero changes to core logic.

**Explicit non-goals for v1:** RAG / vector search, persistent storage (no database), background job queues, observability stack, auth / multi-user. These are deferred to follow-up extension guides so the starter stays small and easy to fork.

## 2. Tech Stack
Strictly adhere to this stack. Install via the package manager — never pin versions manually; use latest.

### Backend
*   **Language/Framework:** Python 3.12+, FastAPI
*   **AI Orchestration:** LangChain Core, LangGraph
*   **LLM Integration:** `langchain-ollama`, `langchain-openai`, `langchain-anthropic`
*   **Document Parsing:** `pypdfium2` (small, pure Python — skip `docling` until layout-aware parsing is actually needed)
*   **Testing:** `pytest`, `pytest-asyncio`, `httpx` (ASGI transport)
*   **Lint/Format:** `ruff` (check + format)
*   **Package Manager:** `uv`

### Frontend
*   **Framework:** Next.js 16 (App Router), React 19
*   **Styling & UI:** Tailwind CSS, shadcn/ui (initialized via `npx shadcn@latest init`), Lucide Icons. Ship dark mode as the default — no toggle.
*   **AI Integration:** Vercel AI SDK (`@ai-sdk/react` for `useChat` and SSE parsing)
*   **Markdown Parsing:** `react-markdown`, `remark-gfm`, `rehype-highlight` (for `<think>` tags and code blocks)
*   **Typed API Client:** `openapi-typescript` — codegen TS types from FastAPI's OpenAPI schema to eliminate FE/BE drift.
*   **Testing:** `vitest` (unit), `@playwright/test` (e2e)

### Infrastructure
*   **Deployment:** Docker (multi-stage, non-root user), Docker Compose
*   **Quality Gates:** `pre-commit` (ruff + pytest on commit), GitHub Actions CI (lint + test on PR)

---

## 3. Server-Side State

All state lives in memory on `app.state`. Tradeoffs are explicit and documented:

*   **Single uvicorn worker only** — each process has its own dict.
*   **State is lost on restart.**
*   **Single in-flight stream per thread is a client-side invariant.** `useChat` disables send while streaming; the backend does not guard against concurrent `/chat/stream` calls on the same thread.
*   Swap to SQLite / Postgres when either tradeoff becomes blocking; that migration is the first extension guide.

```python
@dataclass
class Document:
    id: UUID; filename: str; text: str
    char_count: int; created_at: datetime

@dataclass
class Message:
    role: Literal["user", "assistant"]; content: str; created_at: datetime

@dataclass
class Thread:
    id: UUID; title: str | None
    attached_docs: list[Document]   # snapshot at creation — not refs
    messages: list[Message]
    created_at: datetime; updated_at: datetime

class AppState:
    documents: dict[UUID, Document]
    threads: dict[UUID, Thread]
```

**Attached documents are snapshotted into the thread at creation.** Deleting a document from the global pool afterwards does not affect existing threads — "locked at the start" really means locked.

`Thread.create()` enforces `MAX_CONTEXT_CHARS` and raises `ContextLimitExceeded`; routers surface that as HTTP 400.

---

## 4. Backend Architecture (FastAPI)

### 4.1 Global Dependencies
*   **API Versioning:** All routes under `/api/v1/...` from day one.
*   **Model Router:** A factory function `get_llm()` that reads `AI_PROVIDER` and `MODEL_NAME` env vars and returns the instantiated LangChain `BaseChatModel`. `AI_PROVIDER` alone is insufficient — `MODEL_NAME` picks the actual model (e.g. `llama3.2`, `gpt-4o-mini`, `claude-haiku-4-5`).
*   **CORS:** `CORSMiddleware` configured from a `CORS_ORIGINS` env var (comma-separated). Default includes `http://localhost:3000` (Next.js dev) and `http://frontend:3000` (Docker Compose network). Without this, the clone-and-run flow is broken on first try.
*   **Health Endpoint:** `GET /healthz` — simple liveness check.
*   **OpenAPI:** `GET /openapi.json` is free from FastAPI, consumed by the frontend's `openapi-typescript` codegen.

### 4.2 Endpoints

**Ops**
*   `GET /healthz` → `{ "status": "ok" }`

**Documents** (global pool)
*   `POST /api/v1/documents` — `multipart/form-data`, single file. Validates MIME (`text/plain`, `text/markdown`, `application/pdf`) and size (≤ 5MB). Extracts text synchronously. → `201 { id, filename, char_count, created_at }`
*   `GET /api/v1/documents` → `200 [{ id, filename, char_count, created_at }]` (metadata only; no `text` field to keep list responses small)
*   `DELETE /api/v1/documents/{id}` → `204`

**Threads**
*   `POST /api/v1/threads` — body `{ document_ids?: UUID[] }`. Validates all IDs exist, caps combined attached text at `MAX_CONTEXT_CHARS` (default `25_000`, ~6k tokens at ~4 chars/token — leaves headroom for chat history on a local 7B model), snapshots doc text into the thread. → `201 { id, created_at, documents: [{ id, filename }] }`
*   `GET /api/v1/threads` → `200 [{ id, title, created_at, updated_at }]` (sidebar list; no messages)
*   `GET /api/v1/threads/{id}` → `200 { id, title, created_at, messages, documents: [{ id, filename }] }` (rehydrate chat view)
*   `DELETE /api/v1/threads/{id}` → `204`

**Chat**
*   `POST /api/v1/chat/stream` — body `{ thread_id, message }`. Appends the user message, invokes the LangGraph workflow with the thread's `messages` and `attached_docs` in state, streams tokens via SSE (Vercel AI SDK format), and appends the final assistant message when the stream closes. On the first user message in a thread, auto-derives `title` from the first 60 chars. Emits a terminal SSE `error` event on mid-stream failures.

**Error codes**
*   `400` — unknown `document_ids` at thread creation; combined attached text exceeds `MAX_CONTEXT_CHARS`
*   `404` — thread or document not found
*   `413` — upload too large
*   `415` — unsupported MIME
*   `422` — malformed body (FastAPI default)

### 4.3 LangGraph Workflow
Minimal single-node graph, designed to grow:
*   **State:** `TypedDict` containing `messages`, `attached_docs`.
*   **Nodes:**
    *   `generate`: builds a system message from `attached_docs` (concatenated as `--- Context: {filename} ---\n{text}`), then calls `get_llm()`.
*   **No checkpointer, no router, no tool node in v1.** Add them when you need persistence, conditional routing, or tool use.

### 4.4 Module Layout

```
backend/app/
  main.py            # FastAPI app, lifespan sets app.state, mounts routers
  schemas.py         # Pydantic request/response models
  state.py           # dataclasses from §3
  routers/
    health.py
    documents.py
    threads.py
    chat.py
  services/
    llm.py           # get_llm() provider factory
    parse.py         # extract_text() for txt/md/pdf via pypdf
    graph.py         # LangGraph build
    chat.py          # stream_chat orchestration (Thread mutation + graph + SSE framing)
    sse.py           # Vercel-AI-SDK-compatible SSE encoder
```

---

## 5. Frontend Architecture (Next.js)

### 5.1 Routes
*   `/` — redirects to most recent thread; shows an empty-state "new chat" landing if none exist.
*   `/documents` — upload + list + delete.
*   `/chat/[threadId]` — chat view.

The sidebar lives in the root layout, shared across routes.

### 5.2 Core Components

**1. Sidebar (`/components/Sidebar.tsx`)**
*   `+ New Chat` button at the top → routes to an inline "new chat" landing state.
*   Thread list from `GET /api/v1/threads` (title + relative timestamp).
*   `Documents` link at the bottom.

**2. New Chat Landing** (inline, not a modal)
*   Checkbox list of available documents from `GET /api/v1/documents`. Empty state links to `/documents`.
*   `Start Chat` button → `POST /api/v1/threads` with selected IDs → redirect to `/chat/{id}`.
*   Skipping selection = plain chat, no attached docs.

**3. Chat Interface (`/app/chat/[threadId]/page.tsx`)**
*   Implements `useChat` from `@ai-sdk/react` pointing to `${NEXT_PUBLIC_API_URL}/api/v1/chat/stream`.
*   Read-only chips in the header show attached doc filenames (signals the locked context; no remove control).
*   **Message Renderer:** `react-markdown` with collapsible UI for `<think>...</think>` tags and syntax highlighting via `rehype-highlight`.

**4. Documents Page (`/app/documents/page.tsx`)**
*   `<input type="file">` (no `react-dropzone` — one less dep).
*   Table: filename, size, date, delete button.

### 5.3 Deliberately Absent from v1
Thread rename / search / pin / archive, settings page, provider-switch UI, dark-mode toggle, collapsible sidebar, toast notifications (use inline errors), drag-and-drop upload, multi-file upload, upload progress bars.

---

## 6. Developer Experience

### 6.1 Docker Compose (`docker-compose.yml`)
Two services by default; Ollama is an optional profile so forkers who use cloud providers don't pay its cost:
1.  `frontend` — Next.js dev server (port 3000).
2.  `backend` — FastAPI with hot-reload (port 8000).
3.  `ollama` — (profile: `local`) Ollama container with a volume for model weights (port 11434).

Each service has a dedicated multi-stage `Dockerfile` (build → slim runtime, non-root user).

### 6.2 Environment Variables (`.env.example`)
```env
# Backend
AI_PROVIDER=ollama          # or openai, anthropic
MODEL_NAME=llama3.2         # provider-specific model id (e.g. gpt-4o-mini, claude-haiku-4-5)
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
CORS_ORIGINS=http://localhost:3000,http://frontend:3000
MAX_CONTEXT_CHARS=25000     # combined attached doc text cap (~6k tokens)

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 6.3 Quality Gates
*   **`pre-commit`** at repo root runs `ruff check --fix`, `ruff format`, and `pytest` on every commit. Install via `uv run --project backend pre-commit install`.
*   **GitHub Actions CI:** single workflow on PR — runs backend (`ruff`, `pytest`) and frontend (`eslint`, `vitest`, `tsc --noEmit`) in parallel jobs.
*   **Type sharing:** backend exports OpenAPI at `/openapi.json`; frontend runs `openapi-typescript` in `postinstall` / CI to generate typed fetch clients.

---

## 7. AI Implementation Instructions

**Development discipline — red/green TDD is mandatory.** Every unit of behavior (API endpoint, LangGraph node, React component with logic, utility) must be built in this cycle:
1.  **Red:** write a failing test that expresses the desired behavior. Run it and confirm it fails for the right reason (not a syntax/import error).
2.  **Green:** write the minimum production code to make the test pass. No speculative code, no features the test doesn't cover.
3.  **Refactor:** clean up while keeping the suite green.

Do not write production code ahead of a failing test. Do not batch tests after the fact. Commit in red/green increments so the history reflects the cycle. Use `pytest` for the backend and `vitest` for frontend units; reserve `@playwright/test` for end-to-end flows once the unit layer is green.

**Build sequence (each step applied via the TDD cycle above):**
1.  **Initialize the Monorepo:** Create `/frontend` and `/backend`. `uv init backend`, `npx create-next-app@latest frontend`.
2.  **Backend core:** `app.state` dataclasses, `get_llm()` factory, single-node LangGraph, routers in order: `health` → `documents` → `threads` → `chat`.
3.  **Frontend core:** `shadcn@latest init`, root layout with sidebar, `/documents`, `/chat/[threadId]` with `useChat`.
4.  **Wire the stream:** Ensure the FastAPI SSE output exactly matches the format expected by the Vercel AI SDK.
5.  **Type sharing:** generate client types from `/openapi.json` and consume them in the frontend fetchers.

**Do not add features beyond §4 and §5 until this core loop is fully functional and type-safe.**
