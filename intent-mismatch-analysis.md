# Intent Classification Mismatch Analysis

## Summary
The tests expect different intent classifications than what the current implementation returns. The main issue is that the intent detection logic in `/lib/mastra/utils/intent.ts` has different priority orders and detection criteria than what the tests expect.

## Key Mismatches Found

### 1. Market Chat vs Trading Analysis
**Problem**: Casual market discussions are being classified as `trading_analysis` instead of `market_chat`

**Failing Examples**:
- "最近の市場はどう？" → Expected: `market_chat`, Received: `trading_analysis`
- "ビットコインの将来性" → Expected: `market_chat`, Received: `trading_analysis`
- "市場のトレンド" → Expected: `market_chat`, Received: `trading_analysis`

**Root Cause**: The `detectTradingAnalysis` function runs before `detectMarketChat` and has overlapping keywords like "将来性", "見通し", "トレンド" which cause these queries to be caught as trading analysis.

### 2. UI Control Detection
**Problem**: UI control commands are not being detected correctly

**Failing Examples**:
- "チャートを表示" → Not detected as `ui_control`
- "BTCに切り替えて" → Not detected as `ui_control`
- "トレンドラインを描いて" → Detected as `proposal_request` instead of `ui_control`
- "15分足に変更" → Not detected as `ui_control`

**Root Cause**: The `detectUIControl` function requires both UI keywords AND either a symbol or specific pattern. Simple commands without symbols are not being caught.

### 3. Small Talk vs Conversational
**Problem**: Some casual conversation is being classified as `conversational` instead of `small_talk`

**Failing Examples**:
- "今日は暑いね" → Expected: `small_talk`, Received: `conversational`

**Root Cause**: The `detectSmallTalk` function doesn't include weather-related keywords.

### 4. Proposal Detection Issues
**Problem**: Various proposal requests are not being detected correctly

**Failing Examples**:
- "トレンドラインで提案" → Not being detected as `proposal_request`
- "サポートベースで提案" → Not being detected as `proposal_request`
- "エントリーポイントを教えて" → Not being detected as `proposal_request`

**Root Cause**: The proposal detection requires both proposal keywords AND drawing keywords, which is too restrictive.

### 5. Symbol Extraction Failures
**Problem**: Symbol extraction fails for some Japanese and mixed inputs

**Failing Examples**:
- "BTCについて" → Symbol not extracted
- "ビットコインの話" → Symbol not extracted
- "リップル（XRP）" → Symbol not extracted

**Root Cause**: The symbol extraction logic may not be matching certain patterns correctly.

## Solution Approach

### Detection Order Change
The current order in `analyzeIntent` function is:
1. detectShortInput
2. detectGreeting
3. detectEntryProposal
4. detectUIControl
5. detectDrawingProposal
6. detectProposalRequest
7. detectPriceInquiry
8. detectHelpRequest
9. detectTradingAnalysis (runs before market chat!)
10. detectMarketChat
11. detectSmallTalk

This needs to be reordered to prioritize more specific intents before general ones.

### Keyword Overlap Resolution
Many keywords overlap between different intents:
- "将来性", "トレンド" appear in both `trading_analysis` and `market_chat`
- "提案" appears in multiple contexts
- UI commands need clearer separation from proposals

### Missing Test Coverage
The tests expect certain behaviors that aren't implemented:
- Weather-related small talk
- Simple UI commands without symbols
- More flexible proposal detection

## Recommendations

1. **Reorder Detection Functions**: Place more specific detectors before general ones
2. **Refine Keywords**: Remove overlapping keywords or add context checks
3. **Relax UI Detection**: Allow UI commands without requiring symbols
4. **Improve Symbol Extraction**: Handle more Japanese patterns and edge cases
5. **Add Missing Patterns**: Include weather talk, simple commands, etc.