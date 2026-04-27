"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useParams } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Paperclip, ArrowUp, Loader2 } from "lucide-react"
import { MessageRenderer } from "@/components/MessageRenderer"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { ThreadDetail, ThreadDocMeta } from "@/lib/types"

type DisplayMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

function getMessageText(message: {
  parts?: Array<{ type: string; text?: string }>
  content?: string
}) {
  const textParts = message.parts?.filter((part) => part.type === "text") ?? []
  if (textParts.length > 0) {
    return textParts.map((part) => part.text ?? "").join("")
  }
  return message.content ?? ""
}

function buildThreadTitle(thread: ThreadDetail | null, messages: DisplayMessage[]) {
  const firstUserText =
    messages.find((message) => message.role === "user")?.content.trim() || ""

  return thread?.title || firstUserText.slice(0, 60) || "new chat"
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
    </div>
  )
}

function ChatHeader({
  title,
  documents,
}: {
  title: string
  documents: ThreadDocMeta[]
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-6 py-4">
      <h1 className="truncate text-[17px] font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {documents.length > 0 && (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {documents.map((doc) => (
            <span
              key={doc.id}
              className="inline-flex shrink-0 items-center gap-1.5 rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-foreground/85"
              title={doc.filename}
            >
              <Paperclip className="size-3 text-muted-foreground" />
              {doc.filename}
            </span>
          ))}
        </div>
      )}
    </header>
  )
}

function EmptyThreadState() {
  return (
    <div className="flex flex-1 items-center justify-center py-24 animate-fade-in">
      <p className="font-mono text-[13px] text-muted-foreground">
        {"// type a message below to begin"}
      </p>
    </div>
  )
}

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
    </span>
  )
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end animate-fade-up">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-muted/50 px-4 py-3">
        <p className="whitespace-pre-wrap break-words text-[16px] leading-7 text-foreground">
          {content}
        </p>
      </div>
    </div>
  )
}

function AssistantMessage({
  content,
  loading,
}: {
  content: string
  loading: boolean
}) {
  return (
    <div className="animate-fade-up">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-accent-cyan" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          assistant
        </span>
      </div>
      <div className="text-[16px] leading-7 text-foreground">
        {loading && !content ? (
          <StreamingDots />
        ) : (
          <MessageRenderer content={content} />
        )}
      </div>
    </div>
  )
}

function ChatComposer({
  value,
  disabled,
  onChange,
  onSubmit,
}: {
  value: string
  disabled: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="shrink-0 px-6 pb-5 pt-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className="mx-auto max-w-3xl"
      >
        <div className="flex items-end gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 transition-all focus-within:border-accent-cyan/50 focus-within:bg-card focus-within:shadow-[0_0_0_3px_oklch(0.62_0.16_220/0.08)]">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message…"
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50 [field-sizing:content] max-h-48 min-h-6"
          />
          <button
            type="submit"
            disabled={!value.trim() || disabled}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md transition-all",
              value.trim() && !disabled
                ? "bg-accent-cyan text-background hover:bg-accent-cyan/90"
                : "bg-muted/60 text-muted-foreground"
            )}
            aria-label="Send"
          >
            {disabled ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
          </button>
        </div>
        <p className="mt-2 px-1 font-mono text-[11px] text-muted-foreground">
          <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-foreground/90">Enter</kbd> to send ·{" "}
          <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-foreground/90">Shift</kbd>+
          <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-foreground/90">Enter</kbd> for newline
        </p>
      </form>
    </div>
  )
}

export default function ChatPage() {
  const { threadId } = useParams<{ threadId: string }>()
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const handleSubmit = useCallback(() => {
    const text = inputValue.trim()
    if (!text || status === "streaming") return
    sendMessage({ text })
    setInputValue("")
  }, [inputValue, status, sendMessage])

  const initialMessages = useMemo<DisplayMessage[]>(
    () =>
      thread?.messages.map((message, index) => ({
        id: `${thread.id}-${index}`,
        role: message.role as "user" | "assistant",
        content: message.content,
      })) ?? [],
    [thread]
  )

  const liveMessages = useMemo<DisplayMessage[]>(
    () =>
      messages.map((message) => ({
        id: message.id,
        role: message.role as "user" | "assistant",
        content: getMessageText(message),
      })),
    [messages]
  )

  const displayMessages =
    liveMessages.length > 0 ? liveMessages : initialMessages
  const displayTitle = buildThreadTitle(thread, displayMessages)

  if (loading || (thread && thread.id !== threadId)) {
    return <LoadingState />
  }

  if (error && !thread) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="font-mono text-[12px] text-destructive">! {error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ChatHeader title={displayTitle} documents={thread?.documents ?? []} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6">
          {displayMessages.length === 0 && <EmptyThreadState />}
          {displayMessages.map((message, index) => {
            const isLast = index === displayMessages.length - 1
            const isStreamingThis =
              message.role === "assistant" &&
              status === "streaming" &&
              isLast

            return message.role === "user" ? (
              <UserMessage key={message.id} content={message.content} />
            ) : (
              <AssistantMessage
                key={message.id}
                content={message.content}
                loading={isStreamingThis}
              />
            )
          })}
          {error && displayMessages.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[12px] text-destructive animate-fade-in">
              ! {error}
            </div>
          )}
        </div>
      </div>

      <ChatComposer
        value={inputValue}
        disabled={status === "streaming"}
        onChange={setInputValue}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
