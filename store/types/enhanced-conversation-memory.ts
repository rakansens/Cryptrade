// Enhanced Conversation Memory Store 型定義 - Phase 3
// 🟢 Green Phase: Enhanced Conversation Memory Store の as any キャスト削除のための型定義

import type { ConversationMessage, ConversationMessageMetadata } from '@/types/conversation-memory';
import type { MemoryProcessor } from '@/lib/store/processors';

// Message Role 型安全性向上
export type ConversationMessageRole = 'user' | 'assistant' | 'system';

// Enhanced Session Metadata 型定義
export interface EnhancedSessionMetadata {
  processors: ProcessorConfiguration[];
  tokenUsage: TokenUsageStats;
  [key: string]: unknown;
}

// Processor Configuration 型定義  
export interface ProcessorConfiguration {
  name: string;
  type: string;
  config?: Record<string, unknown>;
}

// Token Usage Statistics 型定義
export interface TokenUsageStats {
  total: number;
  input: number;
  output: number;
}

// Database Session with Enhanced Metadata
export interface DatabaseSessionWithMetadata {
  id: string;
  userId: string | null;
  startedAt: Date;
  lastActiveAt: Date;
  summary?: string | null;
  metadata: EnhancedSessionMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

// Prisma Message Creation Data
export interface PrismaMessageCreationData {
  sessionId: string;
  role: ConversationMessageRole;
  content: string;
  agentId?: string;
  metadata: ConversationMessageMetadata;
  timestamp?: Date;
}

// Enhanced Message with Required Properties
export interface EnhancedConversationMessage extends ConversationMessage {
  role: ConversationMessageRole;
  metadata: ConversationMessageMetadata;
}

// Storage Adapter Types for Persist Configuration
export interface StorageAdapter {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

// Type Guard Functions for Enhanced Conversation Memory
export function isValidConversationRole(role: string): role is ConversationMessageRole {
  return ['user', 'assistant', 'system'].includes(role);
}

export function isEnhancedSessionMetadata(metadata: unknown): metadata is EnhancedSessionMetadata {
  if (!metadata || typeof metadata !== 'object') return false;
  
  const meta = metadata as Record<string, unknown>;
  
  return (
    Array.isArray(meta['processors']) &&
    typeof meta['tokenUsage'] === 'object' &&
    meta['tokenUsage'] !== null &&
    typeof (meta['tokenUsage'] as any).total === 'number' &&
    typeof (meta['tokenUsage'] as any).input === 'number' &&
    typeof (meta['tokenUsage'] as any).output === 'number'
  );
}

export function isProcessorConfiguration(config: unknown): config is ProcessorConfiguration {
  if (!config || typeof config !== 'object') return false;
  
  const cfg = config as Record<string, unknown>;
  
  return (
    typeof cfg['name'] === 'string' &&
    typeof cfg['type'] === 'string'
  );
}

export function isTokenUsageStats(usage: unknown): usage is TokenUsageStats {
  if (!usage || typeof usage !== 'object') return false;
  
  const stats = usage as Record<string, unknown>;
  
  return (
    typeof stats['total'] === 'number' &&
    typeof stats['input'] === 'number' &&
    typeof stats['output'] === 'number'
  );
}

// Safe Session Property Extraction
export function extractSessionWithoutProcessedMessages<T extends { processedMessages?: unknown }>(
  session: T
): Omit<T, 'processedMessages'> {
  const { processedMessages, ...rest } = session;
  return rest;
}

// Metadata Type Conversion Utilities
export function safelyConvertToSessionMetadata(metadata: unknown): EnhancedSessionMetadata | null {
  if (!isEnhancedSessionMetadata(metadata)) {
    return null;
  }
  return metadata;
}

export function safelyConvertToMessageMetadata(metadata: unknown): ConversationMessageMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  return metadata as ConversationMessageMetadata;
}

export function safelyConvertToMessageRole(role: unknown): ConversationMessageRole {
  if (typeof role === 'string' && isValidConversationRole(role)) {
    return role;
  }
  return 'user'; // デフォルト値
}

// Enhanced Store Persist Configuration Types
export interface EnhancedStorePartialState {
  sessions: Record<string, any>;
  currentSessionId: string | null;
  isDbEnabled: boolean;
  defaultProcessors: MemoryProcessor[];
}

// Noop Storage Implementation
export function createNoopStorage(): StorageAdapter {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}