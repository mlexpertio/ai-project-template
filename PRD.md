# MLExpert AI App Template

## 1. Product Overview
**Name:** MLExpert AI App Starter
**Purpose:** Decoupled monorepo boilerplate for AI engineers to launch single-user, private/local AI applications. It supports multi-turn agentic chat, Document RAG (Retrieval-Augmented Generation), and long-term memory.
**Key Constraint:** The system must seamlessly toggle between Local AI (Ollama) for zero-cost development and Cloud AI (Google/OpenAI/Anthropic) for production, requiring zero changes to the core LangGraph logic.

## 2. Tech Stack Definition
AI Assistant, you must strictly adhere to this stack. Do not substitute libraries without explicit instruction.

### Backend (AI & Orchestration)
*   **Language/Framework:** Python 3.12+, FastAPI
*   **AI Orchestration:** LangChain Core, LangGraph
*   **LLM Integration:** `langchain-ollama`, `langchain-openai`, `langchain-anthropic`
*   **Memory Persistence:** `langgraph-checkpoint-postgres`
*   **Document Parsing:** `docling`
*   **Observability:** `mlflow` (`mlflow.langchain.autolog()`) for LLM tracing.
*   **Background Jobs:** `arq` (Redis-backed) — `fastapi.BackgroundTasks` is insufficient for doc ingestion at scale.
*   **Migrations:** Supabase CLI (`supabase/migrations/*.sql`) — not a single monolithic `schema.sql`.
*   **Testing:** `pytest`, `pytest-asyncio`, `httpx` (ASGI transport)
*   **Lint/Format:** `ruff` (check + format)
*   **Package Manager:** `uv`

### Frontend (UI & Client)
*   **Framework:** Next.js 16 (App Router), React 19
*   **Styling & UI:** Tailwind CSS, shadcn/ui (initialized via `npx shadcn@latest init`), Lucide Icons
*   **AI Integration:** Vercel AI SDK (`@ai-sdk/react` for `useChat` and parsing SSE)
*   **Markdown Parsing:** `react-markdown`, `remark-gfm`, `rehype-highlight` (for `<think>` tags and code blocks)
*   **Typed API Client:** `openapi-typescript` — codegen TS types from FastAPI's OpenAPI schema to eliminate FE/BE drift.
*   **Testing:** `vitest` (unit), `@playwright/test` (e2e)

### Infrastructure & State
*   **Database:** Supabase (PostgreSQL 15+, `pgvector`) — used for persistence and vector search only.
*   **Deployment:** Docker (multi-stage, non-root user), Docker Compose
*   **Quality Gates:** `pre-commit` (ruff + pytest on commit), GitHub Actions CI (lint + test on PR)

Always use the package manager to install the dependencies - never assign the version of the library yourself (make use of the latest versions)

---

## 3. Database Schema (Supabase / PostgreSQL)
The backend requires the following SQL migrations to be generated and applied.

### 3.1 Extensions
*   `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;`

### 3.2 Tables
**1. `documents`**
*   `id` (uuid, primary key)
*   `filename` (text)
*   `status` (enum: 'pending', 'processing', 'completed', 'failed')
*   `created_at` (timestamptz)

**2. `chunks`**
*   `id` (bigserial, primary key)
*   `document_id` (uuid, foreign key -> `documents.id` ON DELETE CASCADE)
*   `content` (text)
*   `metadata` (jsonb)
*   `embedding` (vector(N)) *Note: `N` is provider-bound (Qwen3/BGE=1024, OpenAI `text-embedding-3-small`=1536). Fix `N` per deployment — do NOT hardcode in schema; supply via migration variable.*

**3. LangGraph Checkpoints**
*   *Note to AI:* Use the standard schema required by `langgraph-checkpoint-postgres`.

---

## 4. Backend Architecture (FastAPI)

### 4.1 Global Dependencies
*   **API Versioning:** All routes under `/api/v1/...` from day one.
*   **Model Router:** A factory function `get_llm()` that reads the `AI_PROVIDER` env var and returns the instantiated LangChain BaseChatModel.
*   **Embeddings Router:** A parallel factory `get_embeddings()` — vector dimension is provider-bound and must match the `chunks.embedding` column.
*   **Health Endpoint:** `GET /healthz` — simple liveness check.

### 4.2 Core Endpoints
**1. `POST /api/v1/chat/stream`**
*   **Input:** JSON containing `messages` (list), `thread_id` (string).
*   **Process:**
    1. Invoke the compiled LangGraph workflow using `.astream(stream_mode="messages")`.
*   **Output:** Server-Sent Events (SSE) compatible with Vercel AI SDK. Emit a terminal SSE `error` event on mid-stream failures.

**2. `POST /api/v1/documents/upload`**
*   **Input:** `multipart/form-data` containing a PDF file.
*   **Validation:** enforce max size (e.g. 20MB), MIME allowlist (`application/pdf`), sanitized filename.
*   **Process:**
    1. Save file temporarily.
    2. Create `documents` row with status `pending`.
    3. Enqueue an `arq` job to parse via `docling`, chunk, embed, and insert into `chunks`. Update status to `completed` (or `failed`).
*   **Output:** `{"document_id": "uuid"}`.

### 4.3 LangGraph Agentic Workflow
*   **State:** `TypedDict` containing `messages`, `context` (retrieved docs).
*   **Nodes:**
    *   `router`: Analyzes the last user message. Routes to `retrieve` if document context is needed, or `generate` if not.
    *   `retrieve`: Embeds the query, hits Supabase `match_chunks` RPC (pgvector), appends to state.
    *   `generate`: Calls `get_llm().bind_tools()`.
    *   `tools`: Executes any bound tools (e.g., Web Search, Calculator).
*   **Memory:** Wrapped with `PostgresSaver(conn_pool)`.

---

## 5. Frontend Architecture (Next.js)

### 5.1 Layouts & Routing
*   `/` - Main layout. Contains a fixed Sidebar and dynamic Main Content area.
*   `/chat/[threadId]` - Active conversation view.
*   `/documents` - Document manager.

### 5.2 Core Components
**1. Sidebar (`/components/Sidebar.tsx`)**
*   Fetches and displays past conversation threads.
*   Link to Settings.

**2. Chat Interface (`/app/chat/[threadId]/page.tsx`)**
*   Implements `useChat` from `@ai-sdk/react` pointing to `${NEXT_PUBLIC_API_URL}/api/v1/chat/stream`.
*   **Message Renderer:** Must use `react-markdown`. Must support a collapsible UI component for `<think>...</think>` tags to elegantly display reasoning models' internal monologues without cluttering the chat.

**3. Document Manager (`/app/documents/page.tsx`)**
*   Drag-and-drop zone using `react-dropzone`.
*   A data table displaying uploaded documents and their ingestion status (`pending`, `completed`).
*   A "Delete" button that triggers backend deletion.

---

## 6. Developer Experience

### 6.1 Docker Compose (`docker-compose.yml`)
The root directory must contain a docker-compose file that orchestrates the local dev environment:
1.  `frontend`: Next.js development server (Port 3000).
2.  `backend`: FastAPI server with hot-reloading (Port 8000).
3.  `mlflow`: MLflow tracking server (Port 5000).
4.  `redis`: Broker for `arq` job queue (Port 6379).
5.  `ollama`: (Optional profile) Local Ollama container with volume mapping for model weights.

Each service has a dedicated multi-stage `Dockerfile` (build → slim runtime, non-root user).

### 6.2 Environment Variables (`.env.example`)
```env
# Backend
AI_PROVIDER=ollama # or openai, anthropic
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=sk-...
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=ey...
MLFLOW_TRACKING_URI=http://localhost:5000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 6.3 Quality Gates
*   **`pre-commit`** config at repo root runs `ruff check --fix`, `ruff format`, and `pytest` on every commit. Install via `uv run --project backend pre-commit install`.
*   **GitHub Actions CI:** single workflow on PR — runs backend (`ruff`, `pytest`) and frontend (`biome`/`eslint`, `vitest`, `tsc --noEmit`) in parallel jobs.
*   **Type sharing:** backend exports OpenAPI at `/openapi.json`; frontend runs `openapi-typescript` in `postinstall` / CI to generate typed fetch clients.

---

## 7. AI Implementation Instructions (How to Build This)

**Development discipline — red/green TDD is mandatory.** Every unit of behavior (API endpoint, LangGraph node, React component with logic, utility) must be built in this cycle:
1.  **Red:** write a failing test that expresses the desired behavior. Run it and confirm it fails for the right reason (not a syntax/import error).
2.  **Green:** write the minimum production code to make the test pass. No speculative code, no features the test doesn't cover.
3.  **Refactor:** clean up while keeping the suite green.

Do not write production code ahead of a failing test. Do not batch tests after the fact. Commit in red/green increments so the history reflects the cycle. Use `pytest` for the backend and `vitest` for frontend units; reserve `@playwright/test` for end-to-end flows once the unit layer is green.

AI Assistant, when executing this PRD, follow this strict sequence (each step applied via the TDD cycle above):
1.  **Initialize the Monorepo:** Create `/frontend` and `/backend` directories. Set up `uv` in the backend and `npx create-next-app@latest` in the frontend.
2.  **Generate Database Schema:** Output the Supabase migration(s) including the `pgvector` extension and the tables defined in §3.
3.  **Build the Backend Core:** Implement `server.py`, the LangGraph workflow (`agent.py`), and the Supabase database connector.
4.  **Build the Frontend Core:** Scaffold the shadcn/ui layout and implement the `useChat` interface.
5.  **Wire the Stream:** Ensure the FastAPI SSE output perfectly matches the format expected by the Vercel AI SDK.

**Do not add extraneous features until this core loop is fully functional and type-safe.**
