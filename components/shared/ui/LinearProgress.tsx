// components/shared/ui/LinearProgress.tsx
// 汎用横棒プログレスバー
// - value: 0-100 の進捗率
// - 背景色やグラデーションをクラスでカスタマイズ可能
// - オプションでパルスアニメーションを表示
//
// [2025-06-11] 新規作成

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LinearProgressProps {
  /** 進捗率 (0-100) */
  value: number;
  /** 外側 div の追加クラス */
  className?: string;
  /** 高さの Tailwind クラス (例: h-2)*/
  heightClass?: string;
  /** 背景色クラス (例: bg-gray-800)*/
  backgroundClass?: string;
  /** バー部分のクラス (例: bg-gradient-to-r from-blue-500 to-purple-500)*/
  barClass?: string;
  /** 追加 bar style */
  barStyle?: React.CSSProperties;
  /** バーパルスアニメーション表示 */
  showPulse?: boolean;
}

export const LinearProgress: React.FC<LinearProgressProps> = ({
  value,
  className,
  heightClass = 'h-2',
  backgroundClass = 'bg-gray-800',
  barClass = 'bg-[hsl(var(--color-accent))]',
  barStyle,
  showPulse = false,
}) => {
  return (
    <div className={cn('relative rounded-full overflow-hidden', heightClass, backgroundClass, className)}>
      <div
        className={cn('absolute inset-y-0 left-0 transition-all duration-300 ease-out rounded-full', barClass)}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, ...barStyle }}
      >
        {showPulse && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
      </div>
    </div>
  );
}; 