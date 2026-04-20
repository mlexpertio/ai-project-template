# TODO

Progress tracker for [`PRD.md`](./PRD.md). Tasks follow the PRD's build sequence (§7).

## Completed

- [x] Monorepo scaffold: `/backend` (Python 3.12, `uv`) and `/frontend` (Next.js 16, React 19, TypeScript 6, Tailwind 4, ESLint 9 flat config, `src/` dir, `@/*` alias)
- [x] Backend: FastAPI app skeleton with `GET /healthz` liveness check
- [x] Backend: `POST /api/v1/documents` upload endpoint (in-memory storage)
- [x] Backend: `GET /api/v1/documents/{id}` fetch endpoint
- [x] Backend: `client.py` CLI for upload/fetch smoke testing
- [x] Backend: `pytest` + `httpx` ASGI transport, red/green TDD cycle
- [x] Pre-commit hooks: `check-yaml`, `check-json`, `ruff check --fix`, `ruff format`, frontend ESLint, backend `pytest`

> **Known constraint:** ESLint pinned to `^9` — ESLint 10 is incompatible with `eslint-config-next@16.2.4`'s bundled `eslint-plugin-react` (uses a removed internal API). Bump once Next's config ships a fix.

---

## Cleanup (current implementation diverges from revised PRD)

The current `POST /api/v1/documents` splits uploads into chunks (RAG-oriented). The revised PRD stores plain text for inline context injection — no chunking, no vector search.

- [ ] Remove `MarkdownHeaderTextSplitter` + `CharacterTextSplitter` chunking from the documents endpoint
- [ ] Replace with plain-text extraction: read `.txt` / `.md` as UTF-8; extract `.pdf` via `pypdfium2`
- [ ] Add MIME validation (`text/plain`, `text/markdown`, `application/pdf`) → `415` on mismatch
- [ ] Add size validation (≤ 5 MB) → `413` on overflow
- [ ] Replace `GET /api/v1/documents/{id}` with `GET /api/v1/documents` list (metadata-only: `id`, `filename`, `char_count`, `created_at`)
- [ ] Add `DELETE /api/v1/documents/{id}` → `204`

## Backend — state & module layout

- [ ] Move in-memory storage from module-level dict into `app.state` with typed dataclasses (`Document`, `Message`, `Thread`, `AppState`) per PRD §3
- [ ] Snapshot document text into threads at creation (not references) — deletion of a doc must not affect existing threads
- [ ] Add `asyncio.Lock` per thread to serialize `/chat/stream` calls per thread
- [ ] Split `main.py` into `schemas.py`, `state.py`, `routers/{health,documents,threads,chat}.py`, `services/{llm,parse,graph,sse}.py` per PRD §4.4
- [ ] `.env.example` at repo root: `AI_PROVIDER`, `OLLAMA_BASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_API_URL`

## Backend — LLM & LangGraph

- [ ] `services/llm.py` — `get_llm()` factory reading `AI_PROVIDER` env var; wire `langchain-ollama`, `langchain-openai`, `langchain-anthropic`
- [ ] `services/parse.py` — `extract_text()` for txt / md / pdf
- [ ] `services/graph.py` — LangGraph single-node graph with `TypedDict` state (`messages`, `attached_docs`); `generate` node builds system message from `attached_docs` (`--- Context: {filename} ---\n{text}`) and calls `get_llm()`
- [ ] `services/sse.py` — SSE encoder compatible with Vercel AI SDK

## Backend — threads endpoints

- [ ] `POST /api/v1/threads` — body `{ document_ids?: UUID[] }`; validate IDs exist (`400`); cap combined attached text at 100 k chars (`400`); snapshot doc text into thread → `201 { id, created_at, documents: [{id, filename}] }`
- [ ] `GET /api/v1/threads` → `200 [{ id, title, created_at, updated_at }]`
- [ ] `GET /api/v1/threads/{id}` → `200 { id, title, created_at, messages, documents: [{id, filename}] }`
- [ ] `DELETE /api/v1/threads/{id}` → `204`

## Backend — chat streaming

- [ ] `POST /api/v1/chat/stream` — body `{ thread_id, message }`; append user message; invoke LangGraph with thread state; stream tokens via SSE (Vercel AI SDK format); append final assistant message on close; auto-derive `title` from first 60 chars on first user message; emit terminal SSE `error` on mid-stream failure

## Frontend — foundation

- [ ] Initialize shadcn/ui (`npx shadcn@latest init`)
- [ ] Install Lucide Icons
- [ ] Install Vercel AI SDK (`@ai-sdk/react`)
- [ ] Install `react-markdown`, `remark-gfm`, `rehype-highlight`
- [ ] Configure dark mode as default (no toggle)
- [ ] Root layout with shared Sidebar
- [ ] `openapi-typescript` codegen wired into `postinstall` / CI, consuming backend `/openapi.json`

## Frontend — pages & components

- [ ] `Sidebar` — `+ New Chat` button, thread list from `GET /threads` (title + relative timestamp), `Documents` link at bottom
- [ ] `/documents` page — `<input type="file">`, table (filename / size / date / delete button)
- [ ] New Chat landing (inline, not modal) — checkbox list of docs from `GET /documents`, `Start Chat` → `POST /threads` → redirect to `/chat/{id}`; empty state links to `/documents`
- [ ] `/chat/[threadId]` — `useChat` pointing at `${NEXT_PUBLIC_API_URL}/api/v1/chat/stream`; read-only chips in header showing attached doc filenames
- [ ] Message renderer: `react-markdown` + `remark-gfm` + `rehype-highlight`; collapsible UI for `<think>...</think>` tags
- [ ] `/` — redirect to most recent thread, or show empty-state new-chat landing if none exist

## Testing

- [ ] `vitest` setup for frontend units
- [ ] `@playwright/test` setup for end-to-end flows (reserve until unit layer is green)

## DX / Infrastructure

- [ ] Backend `Dockerfile` — multi-stage, non-root user
- [ ] Frontend `Dockerfile` — multi-stage, non-root user
- [ ] `docker-compose.yml` — `frontend` (3000), `backend` (8000), `ollama` (optional `local` profile, port 11434, volume for weights)
- [ ] GitHub Actions CI — single workflow on PR; parallel jobs: backend (`ruff`, `pytest`) and frontend (`eslint`, `vitest`, `tsc --noEmit`)
