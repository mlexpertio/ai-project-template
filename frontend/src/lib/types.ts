export interface DocumentItem {
  id: string
  filename: string
  char_count: number
  created_at: string
}

export interface ThreadListItem {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface ThreadDocMeta {
  id: string
  filename: string
}

export interface MessageItem {
  role: string
  content: string
  created_at: string
}

export interface ThreadDetail {
  id: string
  title: string | null
  created_at: string
  messages: MessageItem[]
  documents: ThreadDocMeta[]
}

export interface ThreadCreateResponse {
  id: string
  created_at: string
  documents: ThreadDocMeta[]
}
