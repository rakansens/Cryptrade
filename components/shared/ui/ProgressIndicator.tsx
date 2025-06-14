// components/shared/ui/ProgressIndicator.tsx
// 完全汎用の進捗インジケータ（ヘッダー + 線形バー）
// - title / subtitle / progress / processing 状態を受け取り一貫した UI を表示
// - アイコンや色は呼び出し元でカスタマイズ可能
//
// [2025-06-11] 初版

'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LinearProgress } from './LinearProgress';

export interface ProgressIndicatorProps {
  /** メインタイトル（例: "AI分析中"） */
  title: string;
  /** サブタイトル（処理中のステップ等） */
  subtitle?: string;
  /** 0-100 の進捗率 */
  value: number;
  /** プロセス中アイコンを表示するか */
  isProcessing?: boolean;
  /** 右側に表示する追加ノード（例: % 表示以外にバッジなど） */
  rightSlot?: React.ReactNode;
  /** クラス追加 */
  className?: string;
  /** Progress バーの高さクラス */
  barHeightClass?: string;
  /** バー背景/塗りのカスタムクラス */
  barBgClass?: string;
  barClass?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  title,
  subtitle,
  value,
  isProcessing = false,
  rightSlot,
  className,
  barHeightClass = 'h-1.5',
  barBgClass = 'bg-[hsl(var(--color-secondary))]',
  barClass = 'bg-gradient-to-r from-[hsl(var(--color-accent))] to-[hsl(var(--color-profit))]',
}) => {
  return (
    <div className={cn('w-full flex items-center justify-between gap-[var(--space-sm)]', className)}>
      <div className="flex items-center gap-[var(--space-sm)] min-w-0 flex-1">
        <span className="truncate text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))]">
          {title}
        </span>
        {isProcessing && (
          <Loader2 className="w-3 h-3 text-[hsl(var(--color-info))] animate-spin" />
        )}
      </div>
      {subtitle && (
        <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))] truncate max-w-[40%]">
          {subtitle}
        </span>
      )}
      <div className="flex items-center gap-[var(--space-sm)]">
        <LinearProgress
          value={value}
          className="w-24"
          heightClass={barHeightClass}
          backgroundClass={barBgClass}
          barClass={barClass}
        />
        {rightSlot ?? (
          <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
            {Math.round(value)}%
          </span>
        )}
      </div>
    </div>
  );
}; 