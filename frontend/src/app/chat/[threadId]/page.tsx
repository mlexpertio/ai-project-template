"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Paperclip, Terminal, SendHorizonal, Bot, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MessageRenderer } from "@/components/MessageRenderer"
import { apiFetch } from "@/lib/api"
import type { ThreadDetail } from "@/lib/types"

export default function ChatPage() {
  const { threadId } = useParams<{ threadId: string }>()
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    apiFetch<ThreadDetail>(`/api/v1/threads/${threadId}`)
      .then((nextThread) => {
        setThread(nextThread)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [threadId])

  const { messages, status, sendMessage } = useChat({
    id: threadId,
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/chat/stream`,
    }),
    onError: (e: Error) => setError(e.message),
  })
  const lastStatusRef = useRef(status)

  useEffect(() => {
    const wasStreaming = lastStatusRef.current === "streaming"
    lastStatusRef.current = status

    if (!wasStreaming || status === "streaming") return

    apiFetch<ThreadDetail>(`/api/v1/threads/${threadId}`)
      .then((nextThread) => {
        setThread(nextThread)
        window.dispatchEvent(new Event("threads:refresh"))
      })
      .catch(() => undefined)
  }, [status, threadId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const text = inputValue.trim()
      if (!text || status === "streaming") return
      sendMessage({ text })
      setInputValue("")
    },
    [inputValue, status, sendMessage]
  )

  const initialMessages = thread
    ? thread.messages.map((m) => ({
        id: crypto.randomUUID(),
        role: m.role as "user" | "assistant",
        content: m.content,
        parts: [{ type: "text" as const, text: m.content }],
      }))
    : []

  const displayMessages =
    messages.length === 0 && initialMessages.length > 0
      ? initialMessages
      : messages

  const firstUserMessage = displayMessages.find((m) => m.role === "user")
  const firstUserText =
    firstUserMessage?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("")
      .trim() || ""
  const displayTitle = thread?.title || firstUserText.slice(0, 60) || "new chat"

  if (loading || (thread && thread.id !== threadId)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-4 rounded-full border border-cyan-accent/30 border-t-cyan-accent animate-spin" />
          <span className="text-[11px] text-muted-foreground tracking-widest font-body">
            RESTORING THREAD
          </span>
        </div>
      </div>
    )
  }

  if (error && !thread) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[13px] text-destructive font-body">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-5 py-2.5">
        <Terminal className="size-3.5 text-cyan-accent/60" />
        <h1
          className="truncate text-[13px] font-semibold tracking-tight text-foreground/90"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          {displayTitle}
        </h1>
        {thread?.documents.map((doc) => (
          <span
            key={doc.id}
            className="inline-flex items-center gap-1 rounded-sm border border-amber-accent/15 bg-amber-accent/5 px-2 py-0.5 text-[10px] text-amber-accent/80 font-body tracking-tight"
          >
            <Paperclip className="size-2.5" />
            {doc.filename}
          </span>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 scroll-smooth">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          {displayMessages.length === 0 && (
            <div className="flex items-center justify-center py-24 animate-fade-in">
              <div className="text-center">
                <Terminal className="mx-auto mb-3 size-6 text-muted-foreground/20" />
                <p className="text-[13px] text-muted-foreground/50 font-body tracking-tight">
                  ── send a message to begin ──
                </p>
              </div>
            </div>
          )}
          {displayMessages.map((m, idx) => {
            const isUser = m.role === "user"
            const textParts = m.parts?.filter(
              (p) => p.type === "text"
            ) ?? []
            const content =
              textParts.length > 0
                ? textParts.map((p) => p.text).join("")
                : ""

            const isLoading =
              !isUser &&
              !content &&
              status === "streaming" &&
              m.id === displayMessages[displayMessages.length - 1]?.id

            return (
              <div
                key={m.id}
                className="animate-fade-up group"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div
                  className={`flex w-full items-start gap-3 ${
                    isUser ? "flex-row-reverse justify-start" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-sm ${
                      isUser
                        ? "bg-amber-accent/10 border border-amber-accent/15"
                        : "bg-cyan-accent/10 border border-cyan-accent/15"
                    }`}
                  >
                    {isUser ? (
                      <User className="size-3 text-amber-accent/70" />
                    ) : (
                      <Bot className="size-3 text-cyan-accent/70" />
                    )}
                  </div>
                  <div
                    className={`flex min-w-0 ${
                      isUser ? "w-full max-w-[720px]" : "w-full max-w-[820px]"
                    } flex-col ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <span
                      className={`mb-1.5 text-[10px] font-body tracking-wider ${
                        isUser ? "text-amber-accent/50" : "text-cyan-accent/50"
                      }`}
                    >
                      {isUser ? "you" : "assistant"}
                    </span>
                    <div
                      className={`max-w-full rounded-sm ${
                        isUser
                          ? "border border-amber-accent/16 bg-amber-accent/8 px-4 py-3 shadow-[0_12px_40px_oklch(0.02_0.02_260/0.14)]"
                          : "bg-transparent px-1 py-1"
                      }`}
                    >
                      {isUser ? (
                        <p className="message-copy whitespace-pre-wrap break-words text-[15px] leading-7 tracking-normal text-foreground/88">
                          {content}
                        </p>
                      ) : isLoading ? (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-accent/50 [animation-delay:0ms]" />
                          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-accent/50 [animation-delay:150ms]" />
                          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-accent/50 [animation-delay:300ms]" />
                        </div>
                      ) : (
                        <div className="message-copy text-[15px] leading-7 tracking-normal text-foreground/86 [&>*:first-child]:mt-0">
                          <MessageRenderer content={content} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {error && (
            <div className="mx-auto mt-4 max-w-lg rounded-sm border border-destructive/30 bg-destructive/8 px-3.5 py-2 text-[12px] font-body text-destructive tracking-tight">
              <span className="opacity-60">!</span> {error}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/60 px-5 py-3">
        <form onSubmit={handleSend} className="mx-auto max-w-5xl">
          <div className="flex items-center gap-2 rounded-sm border border-border/60 bg-card/50 px-3 py-0.5 transition-all duration-200 focus-within:border-cyan-accent/30 focus-within:bg-cyan-accent/3 focus-within:shadow-[0_0_12px_oklch(0.6_0.18_225/0.06)]">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="type a message..."
              disabled={status === "streaming"}
              className="flex-1 bg-transparent py-2.5 text-[13px] font-body tracking-tight text-foreground/90 outline-none placeholder:text-muted-foreground/40 disabled:opacity-40"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || status === "streaming"}
              size="icon-xs"
              variant="ghost"
              className="size-7 rounded-sm text-muted-foreground/50 hover:text-cyan-accent hover:bg-cyan-accent/8 disabled:opacity-25"
            >
              <SendHorizonal className="size-3.5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
