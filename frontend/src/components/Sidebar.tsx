"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Plus, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { API_BASE } from "@/lib/api"
import type { ThreadListItem } from "@/lib/types"

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return new Date(dateStr).toLocaleDateString()
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [threads, setThreads] = useState<ThreadListItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadThreads = () => {
      fetch(`${API_BASE}/api/v1/threads`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load threads")
          return res.json()
        })
        .then((nextThreads) => {
          setThreads(nextThreads)
          setError(null)
        })
        .catch((e) => setError(e.message))
    }

    loadThreads()
    window.addEventListener("threads:refresh", loadThreads)
    return () => window.removeEventListener("threads:refresh", loadThreads)
  }, [pathname])

  const sorted = [...threads].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )

  const docsActive = pathname.startsWith("/documents")

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-between px-3 pt-4 pb-2">
        <Link
          href="/"
          className="flex items-baseline gap-1.5 font-mono text-[13px] tracking-tight text-foreground"
        >
          <span className="text-accent-cyan">~/</span>
          <span className="font-medium">mlexpert</span>
        </Link>
      </div>

      <div className="px-2 pt-2 pb-1">
        <button
          type="button"
          onClick={() => router.push("/?new=1")}
          className="group flex w-full items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-2 text-[13px] font-mono text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:bg-accent-cyan/5 hover:text-foreground"
        >
          <Plus className="size-4 text-muted-foreground transition-colors group-hover:text-accent-cyan" />
          <span>new chat</span>
        </button>
      </div>

      <div className="px-3 pt-3 pb-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
          threads
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {error && (
          <p className="px-3 py-4 font-mono text-[11px] text-destructive/80">
            {"// connection error"}
          </p>
        )}
        {!error && sorted.length === 0 && (
          <p className="px-3 py-4 font-mono text-[11px] text-muted-foreground/80">
            {"// no threads yet"}
          </p>
        )}
        {sorted.map((t) => {
          const active = pathname === `/chat/${t.id}`
          return (
            <Link
              key={t.id}
              href={`/chat/${t.id}`}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full transition-colors",
                  active ? "bg-accent-cyan" : "bg-muted-foreground/50"
                )}
              />
              <span className="truncate">
                {t.title || "untitled"}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                {relativeTime(t.updated_at)}
              </span>
            </Link>
          )
        })}
      </div>

      <div className="border-t border-sidebar-border/60 p-1.5">
        <Link
          href="/documents"
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
            docsActive
              ? "bg-sidebar-accent text-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
          )}
        >
          <FileText
            className={cn(
              "size-3.5 shrink-0",
              docsActive ? "text-accent-cyan" : "opacity-60"
            )}
          />
          <span>documents</span>
        </Link>
      </div>
    </aside>
  )
}
