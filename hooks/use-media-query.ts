// hooks/use-media-query.ts
// 追加: SSR/Jest 環境でもクラッシュしない簡易メディアクエリフック

import { useEffect, useState } from 'react';

/**
 * useMediaQuery — ブラウザの matchMedia を使ってブレイクポイント判定を行う簡易版。
 * Jest / SSR では常に false を返す。
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      setMatches(false);
      return;
    }
    const media = window.matchMedia(query);
    const handleChange = () => setMatches(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
};

export default { useMediaQuery }; 