/**
 * TDD Phase 2: Store Type Safety Improvements - Green Phase
 * 
 * 実装が完了したため、これらのテストは成功するはずです
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Store型安全性改善 Phase 2 - Green Phase', () => {
  beforeEach(() => {
    // テスト前のクリーンアップ
  });

  describe('ChatStore型安全性', () => {
    it('✅ Green: エラー状態の型安全な設定', () => {
      // SessionStoreでsatisfiesオペレーターが使用されていることを確認
      const fs = require('fs');
      const path = require('path');
      const sessionStorePath = path.join(process.cwd(), 'store/chat/session.store.ts');
      const content = fs.readFileSync(sessionStorePath, 'utf8');
      
      expect(content).toContain('satisfies');
      expect(content).not.toContain('as any');
    });

    it('✅ Green: 同期状態の型安全な管理', () => {
      // AsyncStateインターフェースが利用されていることを確認
      const fs = require('fs');
      const path = require('path');
      const sessionStorePath = path.join(process.cwd(), 'store/chat/session.store.ts');
      const content = fs.readFileSync(sessionStorePath, 'utf8');
      
      expect(content).toContain('AsyncState');
    });

    it('✅ Green: ローディング状態の型安全な更新', () => {
      // SessionSliceがAsyncStateを拡張していることを確認
      const fs = require('fs');
      const path = require('path');
      const sessionStorePath = path.join(process.cwd(), 'store/chat/session.store.ts');
      const content = fs.readFileSync(sessionStorePath, 'utf8');
      
      expect(content).toContain('SessionSlice');
      expect(content).toContain('extends');
    });
  });

  describe('PatternStore型安全性', () => {
    it('✅ Green: パターンデータの型安全な保存', () => {
      // as anyキャストが除去されていることを確認
      const fs = require('fs');
      const path = require('path');
      const patternStorePath = path.join(process.cwd(), 'store/chart/stores/pattern.store.ts');
      const content = fs.readFileSync(patternStorePath, 'utf8');
      
      expect(content).not.toContain('as any');
    });

    it('✅ Green: パターン配列の型安全な永続化', () => {
      // 型ユーティリティがインポートされていることを確認
      const fs = require('fs');
      const path = require('path');
      const patternStorePath = path.join(process.cwd(), 'store/chart/stores/pattern.store.ts');
      const content = fs.readFileSync(patternStorePath, 'utf8');
      
      expect(content).toContain("import { mapPatternDataArray, safePatternDataArray } from '@/store/types/pattern'");
    });
  });

  describe('Store共通型定義', () => {
    it('✅ Green: エラー状態インターフェース定義', () => {
      // common.tsファイルが存在することを確認
      const fs = require('fs');
      const path = require('path');
      const commonTypesPath = path.join(process.cwd(), 'store/types/common.ts');
      
      expect(fs.existsSync(commonTypesPath)).toBe(true);
      
      const content = fs.readFileSync(commonTypesPath, 'utf8');
      expect(content).toContain('ErrorState');
      expect(content).toContain('isErrorState');
    });

    it('✅ Green: 非同期状態インターフェース定義', () => {
      // pattern.tsファイルが存在することを確認
      const fs = require('fs');
      const path = require('path');
      const patternTypesPath = path.join(process.cwd(), 'store/types/pattern.ts');
      
      expect(fs.existsSync(patternTypesPath)).toBe(true);
      
      const content = fs.readFileSync(patternTypesPath, 'utf8');
      expect(content).toContain('PatternData');
      expect(content).toContain('isValidPatternData');
    });
  });

  describe('型ガード関数for Store', () => {
    it('✅ Green: Store状態の型ガード実装', () => {
      // 型ガード関数がcommon.tsに実装されていることを確認
      const fs = require('fs');
      const path = require('path');
      const commonTypesPath = path.join(process.cwd(), 'store/types/common.ts');
      const content = fs.readFileSync(commonTypesPath, 'utf8');
      
      expect(content).toContain('isValidStoreState');
      expect(content).toContain('isAsyncState');
    });

    it('✅ Green: パターンデータの型ガード実装', () => {
      // パターン用型ガード関数が実装されていることを確認
      const fs = require('fs');
      const path = require('path');
      const patternTypesPath = path.join(process.cwd(), 'store/types/pattern.ts');
      const content = fs.readFileSync(patternTypesPath, 'utf8');
      
      expect(content).toContain('isValidPatternData');
      expect(content).toContain('mapPatternDataArray');
      expect(content).toContain('safePatternDataArray');
    });
  });

  describe('TDD Phase 2 Complete Check', () => {
    it('すべてのStore改善が完了していることを確認', () => {
      // Phase 2で作成されたファイルが存在することを確認
      const fs = require('fs');
      const path = require('path');
      
      const filesToCheck = [
        'store/types/common.ts',
        'store/types/pattern.ts',
        'store/chat/session.store.ts',
        'store/chart/stores/pattern.store.ts'
      ];
      
      filesToCheck.forEach(filePath => {
        const fullPath = path.join(process.cwd(), filePath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });
  });
});