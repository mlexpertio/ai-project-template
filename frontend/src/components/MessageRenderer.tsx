"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { Check, ChevronRight, Code2, Copy, Sparkles } from "lucide-react"

interface Props {
  content: string
}

const markdownClasses =
  "leading-relaxed space-y-3 [&_p]:my-0 [&_strong]:font-semibold [&_strong]:text-foreground/95 " +
  "[&_a]:text-cyan-accent/85 [&_a]:underline [&_a]:decoration-cyan-accent/25 [&_a]:underline-offset-4 hover:[&_a]:decoration-cyan-accent/70 " +
  "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 " +
  "[&_li::marker]:text-cyan-accent/45 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-accent/35 [&_blockquote]:bg-amber-accent/[0.025] [&_blockquote]:px-3 [&_blockquote]:py-2 [&_blockquote]:text-muted-foreground " +
  "[&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-sm [&_table]:border-collapse [&_th]:border [&_th]:border-border/50 [&_th]:bg-muted/20 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left " +
  "[&_td]:border [&_td]:border-border/45 [&_td]:px-2 [&_td]:py-1.5 [&_hr]:my-4 [&_hr]:border-border/50 " +
  "[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:text-base [&_h3]:font-semibold"

function parseThinkSections(
  content: string
): { type: "think" | "text"; content: string }[] {
  const parts: { type: "think" | "text"; content: string }[] = []
  const regex = /<think>([\s\S]*?)(?:<\/think>|$)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) })
    }
    parts.push({ type: "think", content: match[1].trim() })
    lastIndex = match.index + match[0].length
    if (!match[0].endsWith("</think>")) break
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) })
  }

  return parts
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const lang = className?.replace("language-", "") || "text"
  const codeEl = useRef<HTMLElement>(null)

  const handleCopy = useCallback(() => {
    const text = codeEl.current?.textContent || ""
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [])

  return (
    <div className="group my-3 overflow-hidden rounded-sm border border-cyan-accent/12 bg-[#07090d] shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]">
      <div className="flex items-center justify-between border-b border-white/7 bg-white/[0.025] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Code2 className="size-3 text-cyan-accent/50" />
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/55">
            {lang}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-sm border border-transparent px-1.5 py-0.5 text-[10px] text-muted-foreground/45 opacity-0 transition-all duration-150 hover:border-cyan-accent/15 hover:bg-cyan-accent/8 hover:text-cyan-accent/75 group-hover:opacity-100"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-2.5 text-emerald-400" />
              <span className="text-emerald-400/70">copied</span>
            </>
          ) : (
            <>
              <Copy className="size-2.5" />
              copy
            </>
          )}
        </button>
      </div>
      <div className="relative overflow-x-auto p-4 text-xs leading-relaxed">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-accent/25 to-transparent" />
        <code ref={codeEl} className={`${className || ""} !bg-transparent`}>
          {children}
        </code>
      </div>
    </div>
  )
}

function InlineCode({ children }: { children?: React.ReactNode }) {
  return (
    <code className="rounded-xs border border-cyan-accent/18 bg-cyan-accent/7 px-1.5 py-0.5 text-[0.82em] font-mono text-cyan-accent/90 shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]">
      {children}
    </code>
  )
}

function ThinkBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  const [mountTime] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState("")
  const lines = content.split(/\n+/).filter(Boolean).length

  useEffect(() => {
    if (!open) return
    const update = () => setElapsed(formatElapsed(mountTime))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [open, mountTime])

  return (
    <div className="my-3 overflow-hidden rounded-sm border border-amber-accent/18 bg-[linear-gradient(135deg,oklch(0.68_0.18_70/0.045),transparent_50%)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group flex w-full items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground/65 transition-colors hover:text-amber-accent/85"
      >
        <span
          className={`flex size-5 items-center justify-center rounded-xs border border-amber-accent/12 bg-background/20 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        >
          <ChevronRight className="size-3" />
        </span>
        <Sparkles className="size-3 text-amber-accent/45 transition-colors group-hover:text-amber-accent/70" />
        <span className="font-mono text-[11px] uppercase tracking-[0.22em]">reasoning trace</span>
        <span className="rounded-xs border border-amber-accent/10 bg-background/20 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/35">
          {lines} lines
        </span>
        {elapsed && (
          <span className="ml-auto text-[10px] text-muted-foreground/35 font-mono">
            {elapsed}
          </span>
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-amber-accent/12 px-3 py-3">
          <div className={`${markdownClasses} text-xs text-muted-foreground/78`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code: ({ className, children }) => {
                  const isBlock = className?.startsWith("language-")
                  return isBlock ? (
                    <CodeBlock className={className}>{children}</CodeBlock>
                  ) : (
                    <InlineCode>{children}</InlineCode>
                  )
                },
                pre: ({ children }) => <>{children}</>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatElapsed(from: number): string {
  const secs = Math.floor((Date.now() - from) / 1000)
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s}s`
}

export function MessageRenderer({ content }: Props) {
  const sections = parseThinkSections(content)

  const markdownComponents: Components = {
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      const isBlock = className?.startsWith("language-")
      return isBlock ? (
        <CodeBlock className={className}>{children}</CodeBlock>
      ) : (
        <InlineCode>{children}</InlineCode>
      )
    },
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  }

  if (sections.length === 0) {
    return (
      <div className={`${markdownClasses} break-words`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }

  return (
    <div>
      {sections.map((part, i) =>
        part.type === "think" ? (
          <ThinkBlock key={i} content={part.content} />
        ) : (
          <div key={i} className={`${markdownClasses} break-words`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {part.content}
            </ReactMarkdown>
          </div>
        )
      )}
    </div>
  )
}
