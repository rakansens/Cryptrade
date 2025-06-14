# Proposal Generation System Fix

## Problem Summary
The proposal generation system was not working correctly. The API returned "No response from agent" even though:
- Proposal mode was correctly detected (isProposalMode: true, intent: proposal_request)
- Tool usage was being forced for proposal mode in agent-network.ts
- The agent had clear instructions to use proposalGeneration tool
- The tool was properly registered in the agent

## Root Causes Identified

### 1. Missing Tool Result Extraction
The `agent-network.ts` file only had extraction logic for `marketDataResilientTool` but was missing similar logic for `proposalGenerationTool`.

### 2. Tool Name Mismatch
The tool was registered as `proposalGeneration` in the agent's tools object, but the extraction logic was looking for `proposalGenerationTool`.

### 3. Response Structure Issue
The API route was trying to access `response.proposalGroup` before the `response` object was created, causing a reference error.

## Fixes Applied

### 1. Added Tool Result Extraction in agent-network.ts (lines 371-385)
```typescript
// proposalGenerationToolの結果を抽出
const proposalResult = step.toolResults.find((tr: any) => 
  tr.toolName === 'proposalGeneration' || // This is the actual registered name
  tr.toolName === 'proposalGenerationTool' || 
  tr.toolName === 'proposal-generation'
);

if (proposalResult) {
  toolExecutionData = proposalResult.result;
  logger.info('[AgentNetwork] Proposal generation result extracted', {
    success: toolExecutionData?.success,
    proposalGroup: toolExecutionData?.proposalGroup,
    proposalCount: toolExecutionData?.proposalGroup?.proposals?.length,
  });
}
```

### 2. Added Response Handling for Proposal Mode (lines 421-435)
```typescript
// 提案生成エージェントの場合、ツール実行結果から提案データを返す
if (targetId === 'tradingAnalysisAgent' && hasToolExecution && toolExecutionData?.proposalGroup) {
  // proposalGroupデータをJSON形式で返す
  responseText = JSON.stringify({
    type: 'proposalGroup',
    data: toolExecutionData.proposalGroup,
    success: true,
  });
  
  logger.info('[AgentNetwork] Generated proposal response from tool data', {
    originalText: response.text,
    proposalCount: toolExecutionData.proposalGroup.proposals?.length,
    proposalGroupId: toolExecutionData.proposalGroup.id,
  });
}
```

### 3. Fixed Response Structure in API Route (app/api/ai/chat/route.ts)
- Created a separate `proposalGroup` variable to avoid reference errors
- Added JSON parsing logic to extract proposalGroup from response
- Fixed the response object to properly include proposalGroup

## Verification
After applying these fixes, the proposal generation now works correctly:
- Request: "トレンドラインを提案して"
- Response: Successfully returns a proposalGroup with 5 trendline proposals
- Each proposal includes proper drawing data, confidence scores, and reasoning

## Key Learnings
1. Always ensure tool result extraction logic exists for all registered tools
2. Tool names must match between registration and extraction
3. Avoid accessing object properties before the object is created
4. Test the full flow from agent to API response to catch integration issues