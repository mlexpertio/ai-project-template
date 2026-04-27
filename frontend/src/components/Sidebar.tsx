"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Plus, MessageSquare, FileText, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { ThreadListItem } from "@/lib/types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-3 pt-4 pb-3">
        <Terminal className="size-3.5 text-cyan-accent" />
        <span
          className="text-sm font-semibold tracking-wider text-sidebar-foreground"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          MLExpert
        </span>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => router.push("/?new=1")}
            title="New Chat"
            className="text-sidebar-foreground/50 hover:text-cyan-accent hover:bg-sidebar-accent"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>
      <Separator className="bg-sidebar-border/50" />
      <ScrollArea className="flex-1">
        <div className="p-1.5">
          {error && (
            <p className="px-2.5 py-6 text-[11px] text-muted-foreground text-center tracking-wide">
              ── connection error ──
            </p>
          )}
          {!error && sorted.length === 0 && (
            <p className="px-2.5 py-6 text-[11px] text-muted-foreground text-center tracking-wide">
              ── no threads ──
            </p>
          )}
          {sorted.map((t) => {
            const active = pathname === `/chat/${t.id}`
            return (
              <Link
                key={t.id}
                href={`/chat/${t.id}`}
                className={cn(
                  "group relative flex items-center gap-2 rounded-sm px-2.5 py-2 text-[13px] transition-all duration-150",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/90"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-cyan-accent" />
                )}
                <MessageSquare
                  className={cn(
                    "size-3 shrink-0",
                    active ? "text-cyan-accent" : "opacity-40"
                  )}
                />
                <span className="truncate font-body text-[12px] tracking-tight">
                  {t.title || "new chat"}
                </span>
                <span
                  className={cn(
                    "ml-auto shrink-0 text-[10px] tracking-wider",
                    active
                      ? "text-sidebar-foreground/40"
                      : "text-sidebar-foreground/30"
                  )}
                >
                  {relativeTime(t.updated_at)}
                </span>
              </Link>
            )
          })}
        </div>
      </ScrollArea>
      <div className="p-1.5">
        <Separator className="bg-sidebar-border/50 mb-1" />
        <Link
          href="/documents"
          className={cn(
            "group relative flex items-center gap-2 rounded-sm px-2.5 py-2 text-[13px] transition-all duration-150",
            pathname.startsWith("/documents")
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/90"
          )}
        >
          {pathname.startsWith("/documents") && (
            <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-cyan-accent" />
          )}
          <FileText
            className={cn(
              "size-3 shrink-0",
              pathname.startsWith("/documents") ? "text-cyan-accent" : "opacity-40"
            )}
          />
          <span className="font-body text-[12px] tracking-tight">documents</span>
        </Link>
      </div>
    </aside>
  )
}
