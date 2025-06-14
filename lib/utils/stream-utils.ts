// lib/utils/stream-utils.ts
// 共通ストリームユーティリティ
// - SSE/プレーンストリームを1行ずつパースするジェネレータ
//   ・`data: ` プレフィックスを削除して返却
//   ・空行はスキップ
//
// 追加日時: 2025-06-11
// 変更点:
//   - 初回作成: streamToLines ジェネレータを実装

import { logger } from '@/lib/utils/logger';

/**
 * Response の ReadableStream を 1 行ずつ AsyncGenerator で返す。
 * SSE で送られてくる行の場合 `data: ` プレフィックスを取り除く。
 *
 * @param response fetch() などで取得した Response オブジェクト
 * @param opts.removeDataPrefix `data: ` を除去するかどうか (デフォルト true)
 */
export async function* streamToLines(
  response: Response,
  opts: { removeDataPrefix?: boolean } = {}
): AsyncGenerator<string, void, unknown> {
  const { removeDataPrefix = true } = opts;

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        if (!rawLine.trim()) continue; // skip empty

        const line = removeDataPrefix && rawLine.startsWith('data: ')
          ? rawLine.slice(6)
          : rawLine;

        // 最終的な行を返却
        yield line;
      }
    }
  } catch (err) {
    logger.error('[stream-utils] streamToLines failed', { error: String(err) });
    throw err;
  } finally {
    reader.releaseLock();
  }
} 