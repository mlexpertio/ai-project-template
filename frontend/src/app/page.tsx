"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Terminal, FileText, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { apiFetch } from "@/lib/api"
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
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-5 animate-spin text-cyan-accent" />
          <span className="text-[11px] text-muted-foreground tracking-widest font-body">
            INITIALIZING
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg animate-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-sm border border-cyan-accent/20 bg-cyan-accent/5">
            <Terminal className="size-5 text-cyan-accent" />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            new chat
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground font-body tracking-tight">
            select context or start fresh below
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-sm border border-destructive/40 bg-destructive/8 px-3.5 py-2.5 text-[12px] font-body text-destructive tracking-tight">
            <span className="opacity-60">!</span> {error}
          </div>
        )}

        <div className="mb-6">
          {docs.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border/60 px-4 py-8 text-center">
              <FileText className="mx-auto mb-2 size-5 text-muted-foreground/40" />
              <p className="text-[12px] text-muted-foreground font-body tracking-tight">
                no documents available.
              </p>
              <button
                type="button"
                onClick={() => router.push("/documents")}
                className="mt-1.5 text-[12px] text-cyan-accent font-body tracking-tight hover:underline"
              >
                upload some to attach context
              </button>
            </div>
          ) : (
            <div>
              <p className="mb-2.5 text-[11px] text-muted-foreground font-body tracking-widest uppercase">
                attach documents
                <span className="ml-1.5 opacity-50">({docs.length})</span>
              </p>
              <div className="space-y-px">
                {docs.map((doc) => (
                  <label
                    key={doc.id}
                    className="group flex cursor-pointer items-center gap-3 rounded-sm border border-transparent px-3 py-2.5 transition-all duration-150 hover:border-cyan-accent/15 hover:bg-cyan-accent/3"
                  >
                    <Checkbox
                      checked={selected.has(doc.id)}
                      onCheckedChange={() => toggleDoc(doc.id)}
                      className="data-[checked]:border-cyan-accent data-[checked]:bg-cyan-accent"
                    />
                    <span className="text-[13px] font-body tracking-tight text-foreground/80 group-hover:text-foreground">
                      {doc.filename}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-body tracking-wider">
                      {doc.char_count.toLocaleString()} chars
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleStart}
          disabled={creating}
          size="lg"
          className="w-full h-10 rounded-sm text-[13px] font-body tracking-wider uppercase bg-cyan-accent/90 hover:bg-cyan-accent text-white disabled:opacity-40 transition-all duration-200 animate-pulse-glow"
        >
          {creating ? (
            <>
              <Loader2 className="size-3.5 animate-spin mr-2" />
              creating...
            </>
          ) : (
            <>
              <Sparkles className="size-3.5 mr-2" />
              start chat
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-5 animate-spin text-cyan-accent" />
            <span className="text-[11px] text-muted-foreground tracking-widest font-body">
              INITIALIZING
            </span>
          </div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  )
}
