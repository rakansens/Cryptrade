# 🗒 Implementation Log Policy
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

# 🔧 追加 Slash コマンド
| Command | 概要 |
|---------|------|
| `/internal:create-impl-log <slug>` | `_docs/YYYY-MM-DD_<slug>.md` を生成しテンプレ挿入 |
| `/project:check-hardcode` | Pre-commit と同じスキャンを即時実行 |

---

## Workflow Quick Guide
1. **実装** → `/project:commit-and-push`  
2. テスト合格後、ログ生成プロンプトに従い `_docs/` を執筆  
3. ハードコード検出が 0 件なら Push 完了

> **Claude へのお願い**  
> - ハードコードが疑われる変更があれば *必ず* commit を abort し、修正案を提案すること。  
> - 起動時に `_docs/` を読み込み、過去の設計判断を踏まえた提案を行うこと。