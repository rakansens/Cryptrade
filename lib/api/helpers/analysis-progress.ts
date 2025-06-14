import type { AnalysisProgressEvent, AnalysisStep } from '@/types/analysis-progress';

/**
 * Emit a step progress event to the SSE stream
 */
export function emitProgress(
  step: AnalysisStep,
  currentIndex: number,
  totalSteps: number,
  sendEvent: (event: AnalysisProgressEvent) => void,
  sessionId: string
): void {
  sendEvent({
    type: 'analysis:step-progress',
    sessionId,
    timestamp: Date.now(),
    data: {
      step,
      currentStepIndex: currentIndex,
      totalSteps,
    },
  });
}

/**
 * Simple async generator that yields progress values from 0 to 100
 */
export async function* progressGenerator(
  step: number = 20,
  delayMs: number = 100
): AsyncGenerator<number> {
  for (let progress = 0; progress <= 100; progress += step) {
    yield progress;
    if (progress < 100 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Simulate progress for non-streaming steps
 */
export async function simulateStepProgress(
  step: AnalysisStep,
  currentIndex: number,
  totalSteps: number,
  sendEvent: (event: AnalysisProgressEvent) => void,
  sessionId: string
): Promise<void> {
  switch (step.type) {
    case 'data-collection':
      for await (const progress of progressGenerator(20, 100)) {
        step.progress = progress;
        emitProgress(step, currentIndex, totalSteps, sendEvent, sessionId);
      }
      step.details = {
        dataPoints: 500,
        timeRange: '過去500本のローソク足',
      };
      break;

    case 'technical-analysis': {
      const indicators = ['Moving Average', 'RSI', 'MACD', 'Bollinger Bands'];
      for (let i = 0; i < indicators.length; i++) {
        step.progress = ((i + 1) / indicators.length) * 100;
        step.details = {
          currentIndicator: indicators[i],
          completedIndicators: indicators.slice(0, i + 1),
        };
        emitProgress(step, currentIndex, totalSteps, sendEvent, sessionId);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      break;
    }

    case 'pattern-detection': {
      const patterns = ['Triangle', 'Head and Shoulders', 'Double Bottom', 'Flag'];
      for (let i = 0; i < patterns.length; i++) {
        step.progress = ((i + 1) / patterns.length) * 100;
        step.details = {
          scanning: patterns[i],
          found: Math.floor(Math.random() * 3),
        };
        emitProgress(step, currentIndex, totalSteps, sendEvent, sessionId);
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      step.details = {
        patternsFound: 2,
        types: ['Triangle', 'Double Bottom'],
      };
      break;
    }

    case 'line-calculation': {
      const lineTypes = ['Support', 'Resistance', 'Trendline', 'Channel'];
      for (let i = 0; i < lineTypes.length; i++) {
        step.progress = ((i + 1) / lineTypes.length) * 100;
        step.details = {
          calculating: lineTypes[i],
          calculated: i + 1,
        };
        emitProgress(step, currentIndex, totalSteps, sendEvent, sessionId);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      step.details = {
        linesCalculated: 5,
        types: lineTypes,
      };
      break;
    }

    case 'reasoning-generation':
      for await (const progress of progressGenerator(25, 300)) {
        step.progress = progress;
        step.details = {
          analyzing: 'AIが分析理由を生成中...',
          confidence: progress / 100,
        };
        emitProgress(step, currentIndex, totalSteps, sendEvent, sessionId);
      }
      break;

    case 'proposal-creation':
      for await (const progress of progressGenerator(33, 200)) {
        step.progress = progress;
        step.details = {
          creating: '描画提案を生成中...',
          proposalsCreated: Math.floor(progress / 33),
        };
        emitProgress(step, currentIndex, totalSteps, sendEvent, sessionId);
      }
      break;

    default:
      for await (const progress of progressGenerator(20, 100)) {
        step.progress = progress;
        emitProgress(step, currentIndex, totalSteps, sendEvent, sessionId);
      }
  }
}
