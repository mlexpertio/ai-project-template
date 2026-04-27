"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import {
  Trash2,
  Upload,
  X,
  Loader2,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { DocumentItem } from "@/lib/types"

function formatSize(chars: number) {
  if (chars < 1024) return `${chars} B`
  if (chars < 1048576) return `${(chars / 1024).toFixed(1)} KB`
  return `${(chars / 1048576).toFixed(1)} MB`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function fileExt(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "file"
}

function UploadDropzone({
  onUpload,
  uploading,
  compact = false,
}: {
  onUpload: (file: File) => void
  uploading: boolean
  compact?: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) onUpload(files[0])
    },
    [onUpload]
  )

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          e.target.value = ""
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "group flex w-full flex-col items-center justify-center rounded-lg border border-dashed transition-colors",
          compact ? "gap-2 px-6 py-8" : "gap-3 px-6 py-16",
          dragging
            ? "border-accent-cyan/60 bg-accent-cyan/5"
            : "border-border bg-muted/10 hover:border-accent-cyan/40 hover:bg-accent-cyan/3",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        {uploading ? (
          <>
            <Loader2
              className={cn(
                "animate-spin text-accent-cyan",
                compact ? "size-5" : "size-7"
              )}
            />
            <span
              className={cn(
                "font-medium text-foreground",
                compact ? "text-[14px]" : "text-[15px]"
              )}
            >
              uploading…
            </span>
          </>
        ) : (
          <>
            <div
              className={cn(
                "flex items-center justify-center rounded-full border border-border bg-background/40 transition-colors",
                compact ? "size-10" : "size-14",
                dragging
                  ? "border-accent-cyan/60 bg-accent-cyan/10"
                  : "group-hover:border-accent-cyan/40 group-hover:bg-accent-cyan/5"
              )}
            >
              <Upload
                className={cn(
                  "transition-colors",
                  compact ? "size-4" : "size-6",
                  dragging
                    ? "text-accent-cyan"
                    : "text-muted-foreground group-hover:text-accent-cyan"
                )}
              />
            </div>
            <span
              className={cn(
                "font-medium transition-colors",
                compact ? "text-[14px]" : "text-[15px]",
                dragging ? "text-accent-cyan" : "text-foreground"
              )}
            >
              {dragging ? "release to upload" : "drop file or click to browse"}
            </span>
            <span
              className={cn(
                "font-mono text-muted-foreground",
                compact ? "text-[11px]" : "text-[12px]"
              )}
            >
              .txt .md .pdf · 5MB max
            </span>
          </>
        )}
      </button>
    </>
  )
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const loadDocs = () => {
    apiFetch<DocumentItem[]>("/api/v1/documents")
      .then(setDocs)
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    loadDocs()
  }, [])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)

    const form = new FormData()
    form.append("file", file)

    try {
      await apiFetch("/api/v1/documents", {
        method: "POST",
        body: form,
      })
      loadDocs()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setPendingDelete(id)
    try {
      await apiFetch(`/api/v1/documents/${id}`, { method: "DELETE" })
      setDocs((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setPendingDelete(null)
    }
  }

  const sorted = [...docs].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-baseline gap-3 border-b border-border/60 px-6 py-4">
        <h1 className="text-[17px] font-semibold tracking-tight text-foreground">
          Documents
        </h1>
        <span className="font-mono text-[12px] text-muted-foreground">
          {docs.length} file{docs.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[12px] text-destructive animate-fade-in">
              <X className="size-3 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {docs.length === 0 ? (
            <div className="mt-8 animate-fade-up">
              <div className="mb-6 text-center">
                <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
                  No documents yet
                </h2>
                <p className="mt-1.5 text-[14px] text-muted-foreground">
                  Upload a source file to attach as chat context.
                </p>
              </div>
              <UploadDropzone onUpload={handleUpload} uploading={uploading} />
            </div>
          ) : (
            <>
              <div className="mb-6">
                <UploadDropzone
                  onUpload={handleUpload}
                  uploading={uploading}
                  compact
                />
              </div>

              <ul className="overflow-hidden rounded-md border border-border/60 bg-card/40 divide-y divide-border/40">
                {sorted.map((doc, i) => {
                  const deleting = pendingDelete === doc.id
                  return (
                    <li
                      key={doc.id}
                      className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/20 animate-fade-up"
                      style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded border border-border/60 bg-muted/30 font-mono text-[10px] uppercase tracking-wider text-foreground/80">
                        {fileExt(doc.filename)}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[14px] text-foreground">
                          {doc.filename}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {doc.char_count.toLocaleString()} chars · {formatSize(doc.char_count)} · {formatDate(doc.created_at)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        disabled={deleting}
                        className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-60 transition-all hover:bg-destructive/10 hover:text-destructive hover:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
                        aria-label={`Delete ${doc.filename}`}
                      >
                        {deleting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
