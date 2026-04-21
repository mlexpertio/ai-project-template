This is a **strong 8.5/10** starter template. The scope discipline is excellent, the stack choices are modern and opinionated without being exotic, and the TDD mandate is a genuinely differentiating signal of quality. It respects the "starter" constraint while leaving clear extension hooks.

Here is my structured critique and a concrete roadmap to 9.5+.

---

## Pros (What’s Excellent)

| Area | Verdict |
|------|---------|
| **Scope Control** | The explicit non-goals (no auth, no RAG, no DB) are the most important feature. This prevents the template from becoming a framework. |
| **Tech Choices** | `uv` + `ruff` + `pypdfium2` + LangGraph + Vercel AI SDK is a coherent, 2026-modern stack. No cargo-cult dependencies. |
| **State Design** | In-memory `app.state` with documented tradeoffs is correct for a single-user local starter. Document snapshotting into threads is good UX. |
| **Type Safety** | `openapi-typescript` codegen is the right way to eliminate FE/BE drift. Most templates skip this. |
| **TDD Discipline** | Mandating red/green commits is unusual and elevates this from a "code dump" to an engineering template. |
| **Docker Hygiene** | Multi-stage, non-root images. Ollama as an optional profile is thoughtful cost engineering. |
| **UI Pragmatism** | Dark-mode-default, no toggle, no drag-and-drop. Reduces decision fatigue and dependency count. |

---

## Cons (Friction & Risks)

| Issue | Severity | Explanation |
|-------|----------|-------------|
| **No CORS Specified** | 🔴 High | FastAPI defaults will block the Next.js dev server. This is a "clone and it doesn't work" risk. |
| **No Context Window Guard** | 🔴 High | 100k *characters* of attached docs can easily exceed a local model's token limit. The template will crash or truncate unpredictably. |
| **No Model Name Config** | 🟡 Medium | `AI_PROVIDER=ollama` is insufficient. Users need `MODEL_NAME=llama3.2` etc. |
| **Concurrent Stream Risk** | 🟡 Medium | You rely on client-side invariant only. A backend guard per thread is cheap insurance. |
| **Pre-commit Running `pytest`** | 🟡 Medium | Will become punishingly slow as the backend grows. Should run fast checks (lint/format/typecheck) on commit; full test suite in CI. |
| **Missing Type Checker** | 🟡 Medium | You specify `ruff` but no `mypy`/`pyright`. For a template selling type safety, this is a gap. |
| **Thread Title Derivation** | 🟢 Low | First 60 chars of user message is brittle. "How do I..." becomes the title for every thread. |
| **No LLM Health Check** | 🟢 Low | `/healthz` should verify provider connectivity (Ollama up, API key valid). |
| **SSE Error Opacity** | 🟢 Low | "Emits terminal SSE `error` event" is vague. What does the frontend do with it? |

---

## Roadmap to 9.5+/10

### 1. Fix the "Clone and Run" Experience (Immediate)
Add a `backend/app/core/config.py` and document CORS:
```python
# Allow Next.js dev server and Docker networking
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://frontend:3000").split(",")
```

Add `MODEL_NAME` to `.env.example`:
```env
AI_PROVIDER=ollama
MODEL_NAME=llama3.2
OLLAMA_BASE_URL=http://localhost:11434
```

### 2. Add a Context Budget (Critical)
Replace the naive 100k char cap with a **token-aware budget**. You don't need a full tokenizer; approximate:
```python
# ~4 chars per token for English text
MAX_CONTEXT_CHARS = int(os.getenv("MAX_CONTEXT_CHARS", 25_000))  # ~6k tokens headroom for history
```
If attached docs exceed this, truncate with a `... [truncated]` footer and log a warning. This makes the starter *actually work* with local 7B models.

### 3. Harden the Streaming Contract
- **Backend:** Add an `asyncio` timeout around the LangGraph invoke (configurable, default 60s).
- **Backend:** Maintain a `thread_locks: dict[UUID, asyncio.Lock]` in `AppState`. Guard `/chat/stream` so concurrent calls to the same thread serialize or return `409 Conflict`.
- **Frontend:** Wrap `useChat` in an error boundary. Handle the terminal SSE error by rendering an inline retry button, not a silent failure.

### 4. Elevate Type Safety
Add `pyright` (or `mypy --strict`) to the backend quality gates. Add a `typecheck` script to `package.json` frontend. Update pre-commit:
```yaml
# Fast checks only
- ruff check --fix
- ruff format
- pyright  # or mypy
# pytest stays in CI only
```

### 5. Smarter Thread Titling
Use the LLM itself for titling on first message. Add a cheap `generate_title` node in LangGraph (or a separate lightweight call) with a hardcoded prompt:
```
Summarize this user request into a 4-word chat title. No quotes.
Input: {first_message}
```
This costs ~50 tokens and eliminates the "How do I..." problem entirely.

### 6. Add Minimal Observability
Even without an observability stack, add `structlog` to the backend and propagate a `x-request-id` header. Log:
- LLM provider used
- Tokens generated (if available from provider)
- Errors with full context

This makes debugging the "it works on my machine" issue trivial when forkers open GitHub issues.

### 7. Frontend Polish
- **Optimistic UI:** Append the user message to the thread immediately in `useChat` before the SSE connects.
- **Loading Skeleton:** For the sidebar thread list.
- **Empty State for Chat:** If a thread has no messages yet, show a subtle hint: "Context locked: 3 documents attached."

### 8. Documentation Upgrades
Add three files:
1. **`ARCHITECTURE.md`** — ADRs for in-memory state, document snapshotting, and why LangGraph for a single node (extensibility).
2. **`TROUBLESHOOTING.md`** — CORS errors, Ollama not reachable, model not pulled, `openapi-typescript` drift.
3. **`EXTENSIONS.md`** — Empty stubs for RAG, Auth, SQLite migration, Multi-user. This signals the roadmap without bloating the code.

### 9. Test Strategy Refinement
- Add a **contract test** that asserts the SSE output matches Vercel AI SDK's expected format exactly (event names, JSON structure).
- Add one **end-to-end TDD example** in the README showing the red/green cycle for adding a new endpoint. Don't just mandate TDD—*demonstrate* it.

---

## Summary Judgment

The template’s greatest strength is **what it refuses to do**. To reach 9.5+, you need to eliminate the "gotchas" that make forkers abandon a template in the first hour (CORS, context overflow, cryptic streaming errors) and add just enough observability to make debugging pleasant. Keep the scope locked; just make the existing scope bulletproof.