// types/shared/chat.ts
// 共通チャット関連型
// [2025-06-11] 初版

export type ChatRole = 'user' | 'assistant' | 'system';

export interface BaseChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * ストリーミング中のメッセージ（フロント専用）
 */
export interface StreamMessage extends BaseChatMessage {
  id: string;
  timestamp: Date;
  /** AI 返信がストリーミング中か */
  isStreaming?: boolean;
}

// /** 提案・分析の承認状態 */
// export type ProposalStatus = 'pending' | 'approved' | 'rejected'; 