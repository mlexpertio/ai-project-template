"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowRight, FileText, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { DocumentItem, ThreadCreateResponse } from "@/lib/types"

function HomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const forceNew = searchParams.get("new") === "1"
  const [threadsLoaded, setThreadsLoaded] = useState(false)
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<DocumentItem[]>("/api/v1/documents")
      .then(setDocs)
      .catch((e) => setError(e.message))

    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/threads`
    )
      .then((res) => res.json())
      .then((threads) => {
        setThreadsLoaded(true)
        if (!forceNew && Array.isArray(threads) && threads.length > 0) {
          const sorted = [...threads].sort(
            (a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )
          router.replace(`/chat/${sorted[0].id}`)
        }
      })
      .catch(() => setThreadsLoaded(true))
  }, [forceNew, router])

  const handleStart = async () => {
    setCreating(true)
    setError(null)
    try {
      const body = selected.size > 0 ? { document_ids: [...selected] } : {}
      const res = await apiFetch<ThreadCreateResponse>("/api/v1/threads", {
        method: "POST",
        body: JSON.stringify(body),
      })
      router.push(`/chat/${res.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create thread")
      setCreating(false)
    }
  }

  const toggleDoc = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!threadsLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12 animate-fade-up">
        <div className="mb-8">
          <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-accent-cyan/80">
            new thread
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Start a conversation
          </h1>
          <p className="mt-2 text-[16px] leading-7 text-foreground/80">
            Optionally attach documents as locked context.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[12px] text-destructive">
            ! {error}
          </div>
        )}

        <div className="mb-6">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
              context
              <span className="ml-2 text-muted-foreground/80 normal-case tracking-normal">
                {selected.size > 0
                  ? `${selected.size} selected`
                  : `${docs.length} available`}
              </span>
            </span>
            <Link
              href="/documents"
              className="font-mono text-[12px] text-muted-foreground transition-colors hover:text-accent-cyan"
            >
              manage →
            </Link>
          </div>

          {docs.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
              <FileText className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-[14px] text-foreground/80">
                No documents yet.
              </p>
              <Link
                href="/documents"
                className="mt-1 inline-block font-mono text-[13px] text-accent-cyan hover:underline"
              >
                upload one →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/40 overflow-hidden rounded-md border border-border/60 bg-card/40">
              {docs.map((doc) => {
                const isSelected = selected.has(doc.id)
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => toggleDoc(doc.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "bg-accent-cyan/10 hover:bg-accent-cyan/15"
                          : "hover:bg-muted/30"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                          isSelected
                            ? "border-accent-cyan bg-accent-cyan text-background"
                            : "border-border bg-background"
                        )}
                      >
                        {isSelected && (
                          <svg viewBox="0 0 12 12" className="size-2.5 fill-current">
                            <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 truncate text-[14px] text-foreground">
                        {doc.filename}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {doc.char_count.toLocaleString()} ch
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={creating}
          className="group inline-flex items-center justify-center gap-2 self-start rounded-md bg-accent-cyan px-4 py-2.5 text-[14px] font-medium text-background transition-all hover:bg-accent-cyan/90 disabled:opacity-50"
        >
          {creating ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              creating
            </>
          ) : (
            <>
              start chat
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  )
}
