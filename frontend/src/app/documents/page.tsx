"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import {
  Trash2,
  Upload,
  FileText,
  Terminal,
  FileCode,
  File,
  FileImage,
  FileArchive,
  Clock,
  Merge,
  X,
  Database,
  HardDrive,
  Plus,
  ShieldCheck,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
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

function getColorPair(filename: string) {
  const colors = [
    { dot: "bg-cyan-accent/60", border: "border-cyan-accent/20", bg: "bg-cyan-accent/5" },
    { dot: "bg-amber-accent/60", border: "border-amber-accent/20", bg: "bg-amber-accent/5" },
    { dot: "bg-emerald-500/60", border: "border-emerald-500/20", bg: "bg-emerald-500/5" },
    { dot: "bg-violet-500/60", border: "border-violet-500/20", bg: "bg-violet-500/5" },
    { dot: "bg-rose-500/60", border: "border-rose-500/20", bg: "bg-rose-500/5" },
    { dot: "bg-sky-500/60", border: "border-sky-500/20", bg: "bg-sky-500/5" },
  ]
  let hash = 0
  for (let i = 0; i < filename.length; i++) hash = (hash * 31 + filename.charCodeAt(i)) | 0
  return colors[Math.abs(hash) % colors.length]
}

function UploadZone({
  onUpload,
  uploading,
  disabled,
}: {
  onUpload: (file: File) => void
  uploading: boolean
  disabled: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const [dropping, setDropping] = useState(false)
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
    setDropping(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(false)
      setDropping(true)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) onUpload(files[0])
      setTimeout(() => setDropping(false), 600)
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
        disabled={disabled}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          group relative flex min-h-[236px] cursor-pointer flex-col justify-between overflow-hidden
          rounded-sm border border-dashed p-4 text-left outline-none transition-all duration-300
          ${
            dropping
              ? "scale-[1.01] border-cyan-accent/70 bg-cyan-accent/10 shadow-[0_0_30px_oklch(0.6_0.18_225/0.10)]"
              : dragging
                ? "border-cyan-accent/45 bg-cyan-accent/6"
                : "border-border/45 bg-muted/10 hover:border-cyan-accent/30 hover:bg-cyan-accent/4"
          }
          ${disabled ? "pointer-events-none opacity-40" : ""}
        `}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,oklch(0.6_0.18_225/0.10),transparent_38%,oklch(0.68_0.18_70/0.06))] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="pointer-events-none absolute -right-12 -top-12 size-28 rounded-full border border-cyan-accent/10" />
        <div className="pointer-events-none absolute bottom-3 left-4 right-4 h-px bg-gradient-to-r from-cyan-accent/0 via-cyan-accent/20 to-cyan-accent/0" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[10px] font-body uppercase tracking-[0.24em] text-cyan-accent/55">
              ingest
            </p>
            <p className="mt-2 max-w-44 text-[18px] font-semibold leading-tight tracking-tight text-foreground/90">
              add source material
            </p>
          </div>
          <div
            className={`flex size-10 items-center justify-center rounded-sm border transition-all duration-300 ${
              dropping
                ? "scale-110 border-cyan-accent/50 bg-cyan-accent/15"
                : "border-border/40 bg-background/40 group-hover:border-cyan-accent/25 group-hover:bg-cyan-accent/8"
            }`}
          >
            {uploading ? (
              <div className="size-4 animate-spin rounded-full border border-cyan-accent/40 border-t-cyan-accent" />
            ) : (
              <Upload
                className={`size-4 transition-all duration-300 ${
                  dropping ? "text-cyan-accent" : "text-muted-foreground/55 group-hover:text-cyan-accent/75"
                }`}
              />
            )}
          </div>
        </div>

        <div className="relative">
          <p
            className={`text-[12px] font-body tracking-tight transition-colors duration-300 ${
              dropping ? "text-cyan-accent" : "text-muted-foreground/65"
            }`}
          >
            {uploading
              ? "uploading document..."
              : dropping
                ? "release to upload"
                : "drop a file here or click to browse"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[".txt", ".md", ".pdf"].map((type) => (
              <span
                key={type}
                className="rounded-xs border border-border/35 bg-background/35 px-1.5 py-0.5 text-[10px] font-body tracking-wider text-muted-foreground/55"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
        {dragging && !dropping && (
          <div className="pointer-events-none absolute inset-0 rounded-sm bg-cyan-accent/[0.025] animate-fade-in" />
        )}
      </button>
    </>
  )
}

function EmptyLibrary({
  onUpload,
  uploading,
}: {
  onUpload: (file: File) => void
  uploading: boolean
}) {
  return (
    <div className="grid min-h-[420px] grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="relative overflow-hidden rounded-sm border border-border/45 bg-muted/10 p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-accent/35 to-transparent" />
        <div className="absolute -right-16 -top-16 size-44 rounded-full border border-cyan-accent/10" />
        <div className="flex h-full flex-col justify-end">
          <div className="mb-8 flex size-14 items-center justify-center rounded-sm border border-dashed border-border/35 bg-background/30">
            <FileText className="size-6 text-muted-foreground/25" />
          </div>
          <p className="text-[11px] font-body uppercase tracking-[0.28em] text-muted-foreground/45">
            empty library
          </p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-none tracking-tight text-foreground/95">
            upload references before starting a grounded chat
          </h2>
          <p className="mt-4 max-w-md text-[13px] font-body leading-relaxed tracking-tight text-muted-foreground/60">
            Documents become selectable context for new conversations and stay available across threads.
          </p>
        </div>
      </div>
      <UploadZone onUpload={onUpload} uploading={uploading} disabled={false} />
    </div>
  )
}

function LibraryStats({ docs }: { docs: DocumentItem[] }) {
  const totalChars = docs.reduce((sum, doc) => sum + doc.char_count, 0)
  const latest = docs
    .map((doc) => new Date(doc.created_at).getTime())
    .sort((a, b) => b - a)[0]

  const stats = [
    { label: "files", value: docs.length.toLocaleString(), icon: Database },
    { label: "indexed", value: formatSize(totalChars), icon: HardDrive },
    {
      label: "latest",
      value: latest ? formatDate(new Date(latest).toISOString()) : "none",
      icon: Clock,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="rounded-sm border border-border/35 bg-muted/10 px-3 py-2.5"
          >
            <div className="flex items-center gap-2 text-[10px] font-body uppercase tracking-[0.22em] text-muted-foreground/45">
              <Icon className="size-3 text-cyan-accent/45" />
              {stat.label}
            </div>
            <p className="mt-2 text-[15px] font-semibold tracking-tight text-foreground/85">
              {stat.value}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function UploadStrip({
  onUpload,
  uploading,
}: {
  onUpload: (file: File) => void
  uploading: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-border/40 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between">
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
      <div className="flex items-center gap-3">
        <div
          className="flex size-9 items-center justify-center rounded-sm border border-cyan-accent/18 bg-cyan-accent/7"
        >
          <ShieldCheck className="size-4 text-cyan-accent/70" />
        </div>
        <div>
          <p className="text-[12px] font-body tracking-tight text-foreground/80">
            library accepts text, markdown, and pdf sources
          </p>
          <p className="mt-0.5 text-[10px] font-body tracking-wider text-muted-foreground/40">
            uploaded files are immediately available as chat context
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-cyan-accent/25 bg-cyan-accent/10 px-3 text-[11px] font-body uppercase tracking-wider text-cyan-accent/85 transition-all duration-200 hover:border-cyan-accent/45 hover:bg-cyan-accent/15 disabled:opacity-40"
      >
        {uploading ? (
          <div className="size-3 animate-spin rounded-full border border-cyan-accent/35 border-t-cyan-accent" />
        ) : (
          <Plus className="size-3" />
        )}
        upload
      </button>
    </div>
  )
}

function FileGlyph({
  filename,
  className,
}: {
  filename: string
  className: string
}) {
  const ext = filename.split(".").pop()?.toLowerCase() || ""

  if (ext === "txt" || ext === "csv") return <FileText className={className} />
  if (ext === "pdf") return <FileImage className={className} />
  if (ext === "zip" || ext === "tar" || ext === "gz") {
    return <FileArchive className={className} />
  }
  if (
    ["md", "py", "js", "ts", "jsx", "tsx", "json", "yaml", "yml"].includes(ext)
  ) {
    return <FileCode className={className} />
  }
  return <File className={className} />
}

function DocumentCard({
  doc,
  onDelete,
  index,
}: {
  doc: DocumentItem
  onDelete: (id: string) => void
  index: number
}) {
  const colors = getColorPair(doc.filename)

  return (
    <div
      className="group relative animate-fade-up"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div
        className={`
          relative min-h-[236px] overflow-hidden rounded-sm border transition-all duration-200
          ${colors.border} ${colors.bg}
          hover:-translate-y-0.5 hover:shadow-[0_18px_40px_oklch(0.03_0.02_260/0.18)]
        `}
      >
        <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br from-cyan-accent/[0.08] to-transparent" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="flex min-h-[236px] flex-col p-4">
          <div className="mb-5 flex items-start justify-between">
            <div className={`flex size-10 items-center justify-center rounded-sm border ${colors.border} ${colors.dot.replace("bg-", "bg-").replace("/60", "/10")}`}>
              <FileGlyph
                filename={doc.filename}
                className={`size-4 ${colors.dot.replace("bg-", "text-").replace("/60", "/70")}`}
              />
            </div>
            <button
              type="button"
              onClick={() => onDelete(doc.id)}
              className="rounded-sm p-1.5 text-muted-foreground/20 opacity-0 transition-all duration-150 hover:text-destructive hover:bg-destructive/10 group-hover:opacity-100"
              title="Delete"
            >
              <Trash2 className="size-3" />
            </button>
          </div>

          <p className="line-clamp-2 text-[14px] font-semibold leading-tight tracking-tight text-foreground/90">
            {doc.filename}
          </p>

          <div className="mt-auto space-y-3 pt-8">
            <div className="flex items-center justify-between border-t border-border/25 pt-3 text-[10px] font-body uppercase tracking-[0.18em] text-muted-foreground/40">
              <span>source</span>
              <span>{doc.filename.split(".").pop()?.toUpperCase() || "FILE"}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/45 font-body tracking-wider">
              <span className="flex items-center gap-1">
                <Merge className="size-2.5" />
                {formatSize(doc.char_count)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-2.5" />
                {formatDate(doc.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`h-[2px] w-0 transition-all duration-500 group-hover:w-full ${colors.dot}`}
        />
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    try {
      await apiFetch(`/api/v1/documents/${id}`, { method: "DELETE" })
      setDocs((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Terminal className="size-3.5 text-cyan-accent/60" />
          <h1
            className="text-[13px] font-semibold tracking-tight text-foreground/90"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            documents
          </h1>
          {docs.length > 0 && (
            <span className="text-[10px] text-muted-foreground font-body tracking-wider px-1.5 py-0.5 rounded-sm border border-border/20 bg-muted/20">
              {docs.length}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 rounded-xs border border-destructive/25 bg-destructive/6 px-3 py-2 text-[11px] font-body text-destructive/90 tracking-tight animate-fade-in flex items-center gap-2">
          <X className="size-2.5 shrink-0 opacity-60" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5">
        {docs.length === 0 && !uploading ? (
          <div className="mx-auto max-w-5xl animate-fade-up">
            <EmptyLibrary onUpload={handleUpload} uploading={uploading} />
          </div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-4">
            <LibraryStats docs={docs} />
            <UploadStrip onUpload={handleUpload} uploading={uploading} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {docs.map((doc, i) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onDelete={handleDelete}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
