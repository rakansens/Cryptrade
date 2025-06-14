// types/shared/progress.ts
// 進捗ステップ共通型
// [2025-06-11] 初版

/** ステップ状態 */
export type ProgressStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * 進捗ステップのベース型
 */
export interface BaseProgressStep<T = unknown> {
  id: string;
  name?: string;
  title?: string;
  status: ProgressStatus;
  progress: number;
  data?: T;
  startedAt?: Date;
  completedAt?: Date;
}

// 具体的な別名型（必要に応じて拡張）
export type AnalysisStep<T = unknown> = BaseProgressStep<T>;
export type MLAnalysisStep<T = unknown> = BaseProgressStep<T>; 