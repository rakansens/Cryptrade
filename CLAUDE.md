
## 通知ルール
**必須**: あらゆるタスク完了時は必ず通知を送信してください。例外はありません。通知内容は実行したタスクに応じて適切に記述すること。

### 通知テンプレート（タスク別サウンド）

#### 1. ファイル編集完了
```bash
osascript -e 'display notification "📝 ファイル編集完了: [ファイル名]" with title "Claude Code" sound name "Tink"'
```

#### 2. ビルド・コンパイル完了
```bash
osascript -e 'display notification "🔨 ビルド完了" with title "Claude Code" sound name "Hero"'
```

#### 3. テスト実行完了
```bash
osascript -e 'display notification "✅ テスト実行完了 ([結果])" with title "Claude Code" sound name "Glass"'
```

#### 4. 検索・分析完了
```bash
osascript -e 'display notification "🔍 検索・分析完了" with title "Claude Code" sound name "Ping"'
```

#### 5. インストール・設定完了
```bash
osascript -e 'display notification "📦 インストール・設定完了" with title "Claude Code" sound name "Funk"'
```

## 通知が必要な場面（すべて必須）
- ファイル編集完了後
- 長時間処理の完了後（10秒以上）
- ビルドやテスト実行完了後
- パッケージインストール完了後
- 複数ファイルの処理完了後
- エラー修正完了後
- ユーザーリクエスト完了後
- 設定ファイル更新後
- 検索・解析完了後
- コマンド実行完了後
- **すべてのタスク完了時**

**重要**: 通知内容は必ず具体的で分かりやすく記述すること




---

# 🚫 Hard-coding Guardrail
Claude と開発者は **「テスト合格専用のハードコード」** を一切書かないこと。

## ❗ 禁止例
~~~ts
// NG: テスト用に出力を偽装
export const getGreeting = () => "2025-01-01 Hello";
~~~

## ✅ 許容例
~~~ts
export const getGreeting = (clock = Date) =>
  `${clock.now().toISOString().slice(0,10)} Hello`;
~~~

## 検出 & ブロック
1. **Pre-commit Hook** (`scripts/check-hardcode.js`) を  
   `/project:commit-and-push` の Step 3 で実行  
2. 走査対象: `src/**`, `lib/**`（テスト・fixture 除外）  
3. 検知パターン例:  
   - 固定日付: `"(20\\d{2}|19\\d{2})[-/]\\d{2}[-/]\\d{2}"`  
   - 長い `console.log`: `"\\bconsole\\.log\$begin:math:text$.{20,}\\$end:math:text$"`  
4. マッチしたら **コミット中止** + 該当行を一覧表示  
5. Claude が「リファクタ or モック化」案を提示  

## 手動チェック
- `> /project:check-hardcode` で任意時点でも実行可

---


# Implementation Log Policy
- **目的**: 実装経緯を残し、後工程の調査コストを最小化する  
- **保存先**: `_docs/` ディレクトリ直下  
- **ファイル名**: `YYYY-MM-DD_<feature-slug>.md`  
- **テンプレ**:
    # <機能名 or Issue #>
    ## Summary
    - なにを実装したか（1〜3 行）
    ## Decisions
    - 主要な設計判断
    ## Diff Highlights
    - 影響範囲・DB 変更など
    ## Follow-ups
    - 未解決の TODO
- **自動化手順**  
  1. `/project:commit-and-push` 成功直後に  
     `/internal:create-impl-log <feature-slug>` でテンプレ生成  
  2. Claude が追記を促す  
  3. 完成したログを **自動コミット**（`docs: add impl log`）

@_docs/                 <!-- 起動時に全ログを読み込む -->

