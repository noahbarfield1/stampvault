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
}

export type VoiceSessionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export interface VoiceSession {
  isActive: boolean;
  status: VoiceSessionStatus;
  transcript: string;
  error: string | null;
  duration: number; // seconds
}
