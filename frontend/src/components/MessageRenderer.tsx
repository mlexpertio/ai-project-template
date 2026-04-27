"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { Check, ChevronRight, Copy } from "lucide-react"

interface Props {
  content: string
}

const markdownClasses =
  "leading-7 space-y-4 [&_p]:my-0 [&_strong]:font-semibold [&_strong]:text-foreground " +
  "[&_a]:text-accent-cyan [&_a]:underline [&_a]:decoration-accent-cyan/30 [&_a]:underline-offset-4 hover:[&_a]:decoration-accent-cyan " +
  "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 " +
  "[&_li::marker]:text-muted-foreground/50 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:bg-muted/20 [&_blockquote]:px-3 [&_blockquote]:py-2 [&_blockquote]:text-muted-foreground " +
  "[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted/30 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left " +
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_hr]:my-4 [&_hr]:border-border " +
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
    <div className="group my-3 overflow-hidden rounded-md border border-border/60 bg-[#0b0d12]">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {lang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground opacity-70 transition-all hover:bg-muted/50 hover:text-foreground hover:opacity-100 group-hover:opacity-100"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3" />
              copied
            </>
          ) : (
            <>
              <Copy className="size-3" />
              copy
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4 text-[14px] leading-relaxed">
        <code ref={codeEl} className={`${className || ""} !bg-transparent`}>
          {children}
        </code>
      </div>
    </div>
  )
}

function InlineCode({ children }: { children?: React.ReactNode }) {
  return (
    <code className="rounded border border-border/60 bg-muted/40 px-1 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  )
}

function ThinkBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  const [mountTime] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState("")

  useEffect(() => {
    if (!open) return
    const update = () => setElapsed(formatElapsed(mountTime))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [open, mountTime])

  return (
    <div className="my-3 overflow-hidden rounded-md border border-border/60 bg-muted/15">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
          reasoning
        </span>
        {elapsed && (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {elapsed}
          </span>
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-border/60 px-3 py-3">
          <div className={`${markdownClasses} text-[13px] leading-relaxed text-muted-foreground`}>
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
