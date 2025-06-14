# SSE-Based Analysis Progress Visualization

This document describes the implementation of Server-Sent Events (SSE) for real-time analysis progress visualization during proposal generation.

## Overview

The SSE analysis progress feature provides users with real-time feedback about the AI's analysis process when generating drawing proposals. It shows detailed progress through an accordion-style UI that displays each step of the analysis.

## Architecture

### Components

1. **SSE Endpoint** (`/api/ai/analysis-stream`)
   - Streams real-time progress events during proposal generation
   - Simulates analysis steps with realistic timing
   - Integrates with the actual proposal generation tool

2. **AnalysisProgress Component**
   - React component with accordion UI
   - Displays analysis steps with progress bars
   - Auto-collapses after completion
   - Shows detailed information for each step

3. **useAnalysisStream Hook**
   - Manages SSE connection and state
   - Handles event parsing and callbacks
   - Provides clean API for components

4. **Types** (`types/analysis-progress.ts`)
   - Comprehensive type definitions
   - Zod schemas for validation
   - Helper functions for creating steps

## Analysis Steps

The analysis process is broken down into 6 main steps:

1. **Data Collection** - Fetching market data
2. **Technical Analysis** - Running indicators and trend analysis
3. **Pattern Detection** - Identifying chart patterns
4. **Line Calculation** - Computing support/resistance levels
5. **Reasoning Generation** - AI generates explanations
6. **Proposal Creation** - Final proposal generation

## Usage

### In Chat Panel

The ChatPanel component automatically detects when a user is requesting analysis and shows the progress:

```typescript
// Automatic detection of analysis requests
const analysisKeywords = [
  'トレンドライン', 'trendline',
  'サポート', 'レジスタンス',
  'フィボナッチ', 'fibonacci',
  'パターン', 'pattern',
  '分析', 'analysis',
  '提案', 'proposal'
];
```

### Manual Integration

```tsx
import { AnalysisProgress } from '@/components/chat/AnalysisProgress';

<AnalysisProgress
  symbol="BTCUSDT"
  interval="1h"
  analysisType="trendline"
  onComplete={(data) => {
    console.log('Analysis completed', data);
  }}
  autoStart={true}
/>
```

### Using the Hook

```tsx
import { useAnalysisStream } from '@/hooks/use-analysis-stream';

const {
  steps,
  currentStepIndex,
  isAnalyzing,
  error,
  startAnalysis,
  reset,
} = useAnalysisStream({
  onStepComplete: (step) => {
    console.log('Step completed:', step);
  },
  onComplete: (data) => {
    console.log('Analysis complete:', data);
  },
});

// Start analysis
startAnalysis({
  symbol: 'BTCUSDT',
  interval: '1h',
  analysisType: 'trendline',
  maxProposals: 5,
});
```

## Event Types

### SSE Events

```typescript
type AnalysisEventType = 
  | 'analysis:start'        // Analysis begins
  | 'analysis:step-start'   // Step starts
  | 'analysis:step-progress'// Step progress update
  | 'analysis:step-complete'// Step completes
  | 'analysis:complete'     // Analysis completes
  | 'analysis:error'        // Error occurred
```

### Event Data Structure

```typescript
interface AnalysisProgressEvent {
  type: AnalysisEventType;
  sessionId: string;
  timestamp: number;
  data: {
    // Varies by event type
    step?: AnalysisStep;
    totalSteps?: number;
    currentStepIndex?: number;
    proposalCount?: number;
    error?: string;
  };
}
```

## Testing

### Browser Test

Open `/public/test-analysis-progress.html` in a browser for an interactive demo.

### Node.js Test

```bash
node scripts/test-analysis-progress.js
```

### Manual cURL Test

```bash
curl -X POST http://localhost:3000/api/ai/analysis-stream \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "interval": "1h",
    "analysisType": "trendline",
    "maxProposals": 5
  }'
```

## UI Features

### Accordion Design
- Collapsible progress panel
- Auto-expands during analysis
- Auto-collapses 2 seconds after completion

### Progress Indicators
- Overall progress bar with percentage
- Individual step progress bars
- Status icons (pending, in-progress, completed, error)
- Duration tracking for each step

### Visual States
- **Pending**: Gray/muted appearance
- **In Progress**: Blue accent with animation
- **Completed**: Green success state
- **Error**: Red error state

## Integration Points

### Chat Panel
- Automatically detects analysis requests
- Shows progress instead of typing indicator
- Seamlessly integrates with existing chat flow

### Proposal Generation
- Progress events can be emitted from actual analysis
- Currently uses simulation for demo purposes
- Ready for integration with real proposal generation

## Future Enhancements

1. **Real-time Data Integration**
   - Connect to actual market data fetching
   - Show real indicator calculations
   - Display actual pattern detection results

2. **Cancellation Support**
   - Allow users to cancel ongoing analysis
   - Clean up resources properly

3. **Progress Persistence**
   - Save analysis progress to session
   - Resume from last step if interrupted

4. **Enhanced Details**
   - Show more detailed information per step
   - Include charts/visualizations in progress
   - Display confidence scores in real-time

## Performance Considerations

- SSE connections are lightweight
- Progress updates are throttled appropriately
- Auto-cleanup on component unmount
- Proper error handling and reconnection logic