/* ─── StampVault Chat & Voice Types ───────────────────────────────────── */

export type ChatContextType =
  | 'general'
  | 'stamp_detail'
  | 'collection'
  | 'pricing'
  | 'identification';

export interface ChatContext {
  type: ChatContextType;
  stampId: string | null;
  metadata: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  context: ChatContext | null;
  imageUrl?: string;
}

export type VoiceSessionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export interface VoiceSession {
  isActive?: boolean;
  isListening?: boolean;
  isProcessing?: boolean;
  isSpeaking?: boolean;
  status?: VoiceSessionStatus;
  transcript: string;
  error?: string | null;
  duration?: number; // seconds
}

/* ─── Citation ───────────────────────────────────────────────────────── */

export interface Citation {
  title: string;
  url: string;
  snippet: string;
}

/* ─── Voice Command (parsed voice input) ─────────────────────────────── */

export type VoiceCommand =
  | { type: 'navigate'; destination: string }
  | { type: 'search'; query: string }
  | { type: 'action'; action: string; params: Record<string, string> }
  | { type: 'query'; question: string };

