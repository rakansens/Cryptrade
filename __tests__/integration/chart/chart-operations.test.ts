import 'dotenv/config';
import { config } from 'dotenv';
import { enhancedChartControlTool } from '../../../lib/mastra/tools/enhanced-chart-control.tool';
import { enhancedLineAnalysisTool } from '../../../lib/mastra/tools/enhanced-line-analysis.tool';
import { chartDataAnalysisTool } from '../../../lib/mastra/tools/chart-data-analysis.tool';
import { multiTimeframeLineDetector } from '../../../lib/analysis/multi-timeframe-line-detector';
import type { CandlestickData } from '../../../types/market';
import { 
  createMockCandlestickData, 
  createMockChartEvent,
  waitFor 
} from '../../helpers/test-factory';

// Load environment variables
config({ path: '.env.local' });

describe('Chart Operations Integration Tests', () => {
  describe('Chart Control Tool', () => {
    const defaultContext = {
      userRequest: '',
      conversationHistory: [],
      currentState: {
        symbol: 'BTCUSDT',
        timeframe: '1h'
      }
    };

    describe('Drawing Operations', () => {
      test('should create trendline with coordinates', async () => {
        const result = await enhancedChartControlTool.execute({
          context: {
            ...defaultContext,
            userRequest: 'トレンドラインを引いて'
          }
        });

        expect(result.success).toBe(true);
        expect(result.operations).toBeDefined();
        expect(result.operations.length).toBeGreaterThan(0);

        // Check for proper draw event
        const drawEvent = result.operations.find(op => 
          op.clientEvent?.event === 'draw:trendline'
        );
        
        expect(drawEvent).toBeDefined();
        expect(drawEvent?.clientEvent?.data?.points).toBeDefined();
        expect(drawEvent?.clientEvent?.data?.points.length).toBeGreaterThan(0);
      });

      test('should create horizontal line', async () => {
        const result = await enhancedChartControlTool.execute({
          context: {
            ...defaultContext,
            userRequest: '水平線を描いて'
          }
        });

        expect(result.success).toBe(true);
        
        const drawEvent = result.operations.find(op => 
          op.clientEvent?.event === 'draw:horizontal_line'
        );
        
        expect(drawEvent).toBeDefined();
        expect(drawEvent?.clientEvent?.data?.price).toBeDefined();
      });

      test('should create support and resistance lines', async () => {
        const result = await enhancedChartControlTool.execute({
          context: {
            ...defaultContext,
            userRequest: 'サポートとレジスタンスラインを描いて'
          }
        });

        expect(result.success).toBe(true);
        
        // Should have multiple draw operations
        const drawEvents = result.operations.filter(op => 
          op.clientEvent?.event?.startsWith('draw:')
        );
        
        expect(drawEvents.length).toBeGreaterThanOrEqual(2);
      });

      test('should handle Fibonacci retracement', async () => {
        const result = await enhancedChartControlTool.execute({
          context: {
            ...defaultContext,
            userRequest: 'フィボナッチリトレースメントを追加'
          }
        });

        expect(result.success).toBe(true);
        
        const fiboEvent = result.operations.find(op => 
          op.clientEvent?.event === 'draw:fibonacci'
        );
        
        expect(fiboEvent).toBeDefined();
        expect(fiboEvent?.clientEvent?.data?.points).toBeDefined();
      });
    });

    describe('Chart Navigation', () => {
      test('should switch symbol', async () => {
        const result = await enhancedChartControlTool.execute({
          context: {
            ...defaultContext,
            userRequest: 'ETHのチャートに切り替えて'
          }
        });

        expect(result.success).toBe(true);
        
        const switchEvent = result.operations.find(op => 
          op.action === 'switch_symbol'
        );
        
        expect(switchEvent).toBeDefined();
        expect(switchEvent?.parameters?.symbol).toBe('ETHUSDT');
      });

      test('should change timeframe', async () => {
        const result = await enhancedChartControlTool.execute({
          context: {
            ...defaultContext,
            userRequest: '15分足に変更'
          }
        });

        expect(result.success).toBe(true);
        
        const timeframeEvent = result.operations.find(op => 
          op.action === 'change_timeframe'
        );
        
        expect(timeframeEvent).toBeDefined();
        expect(timeframeEvent?.parameters?.timeframe).toBe('15m');
      });

      test('should add indicators', async () => {
        const result = await enhancedChartControlTool.execute({
          context: {
            ...defaultContext,
            userRequest: 'RSIとMACDを追加して'
          }
        });

        expect(result.success).toBe(true);
        
        const indicatorEvents = result.operations.filter(op => 
          op.action === 'add_indicator'
        );
        
        expect(indicatorEvents.length).toBe(2);
        expect(indicatorEvents[0]?.parameters?.indicator).toBe('RSI');
        expect(indicatorEvents[1]?.parameters?.indicator).toBe('MACD');
      });
    });

    describe('Error Handling', () => {
      test('should handle ambiguous requests gracefully', async () => {
        const result = await enhancedChartControlTool.execute({
          context: {
            ...defaultContext,
            userRequest: '何か描いて'
          }
        });

        expect(result.success).toBe(true);
        expect(result.response).toContain('どのような');
      });

      test('should handle invalid symbol', async () => {
        const result = await enhancedChartControlTool.execute({
          context: {
            ...defaultContext,
            userRequest: 'XYZABCのチャートを表示'
          }
        });

        expect(result.success).toBe(true);
        // Should provide feedback about invalid symbol
        expect(result.response).toBeDefined();
      });
    });
  });

  describe('Line Detection Accuracy', () => {
    let mockCandleData: CandlestickData[];

    beforeEach(() => {
      // Create realistic candle data with trends
      mockCandleData = createMockCandlestickData(200);
    });

    describe('Multi-timeframe Analysis', () => {
      test('should detect lines across multiple timeframes', async () => {
        const result = await multiTimeframeLineDetector.detectLines(
          'BTCUSDT',
          mockCandleData
        );

        expect(result).toBeDefined();
        expect(result.lines).toBeDefined();
        expect(Array.isArray(result.lines)).toBe(true);
        
        // Should detect at least some lines
        expect(result.lines.length).toBeGreaterThan(0);
        
        // Check line properties
        if (result.lines.length > 0) {
          const line = result.lines[0];
          expect(line).toHaveProperty('type');
          expect(line).toHaveProperty('confidence');
          expect(line).toHaveProperty('strength');
          expect(line).toHaveProperty('points');
          expect(line.points.length).toBeGreaterThanOrEqual(2);
        }
      });

      test('should identify confluence zones', async () => {
        const result = await multiTimeframeLineDetector.detectLines(
          'BTCUSDT',
          mockCandleData
        );

        if (result.confluenceZones && result.confluenceZones.length > 0) {
          const zone = result.confluenceZones[0];
          expect(zone).toHaveProperty('priceRange');
          expect(zone).toHaveProperty('lineCount');
          expect(zone).toHaveProperty('strength');
          expect(zone.lineCount).toBeGreaterThanOrEqual(2);
        }
      });

      test('should provide quality metrics', async () => {
        const result = await multiTimeframeLineDetector.detectLines(
          'BTCUSDT',
          mockCandleData
        );

        expect(result.qualityMetrics).toBeDefined();
        expect(result.qualityMetrics).toHaveProperty('overallConfidence');
        expect(result.qualityMetrics).toHaveProperty('dataQuality');
        expect(result.qualityMetrics).toHaveProperty('timeframeCoverage');
        
        // Confidence should be between 0 and 1
        expect(result.qualityMetrics.overallConfidence).toBeGreaterThanOrEqual(0);
        expect(result.qualityMetrics.overallConfidence).toBeLessThanOrEqual(1);
      });
    });

    describe('Line Analysis Tool', () => {
      test('should analyze chart data and find patterns', async () => {
        const result = await enhancedLineAnalysisTool.execute({
          symbol: 'BTCUSDT',
          timeframe: '1h',
          analysisType: 'comprehensive'
        });

        expect(result).toBeDefined();
        expect(result.analysis).toBeDefined();
        expect(result.detectedLines).toBeDefined();
        expect(Array.isArray(result.detectedLines)).toBe(true);
      });

      test('should provide trading recommendations', async () => {
        const result = await enhancedLineAnalysisTool.execute({
          symbol: 'BTCUSDT',
          timeframe: '1h',
          analysisType: 'entry_points'
        });

        if (result.recommendations) {
          expect(result.recommendations).toHaveProperty('action');
          expect(result.recommendations).toHaveProperty('confidence');
          expect(result.recommendations).toHaveProperty('reasoning');
        }
      });
    });

    describe('Chart Data Analysis', () => {
      test('should analyze current chart state', async () => {
        const result = await chartDataAnalysisTool.execute({
          analysisRequest: 'Analyze current trend',
          chartContext: {
            symbol: 'BTCUSDT',
            timeframe: '1h',
            visibleRange: {
              from: Date.now() / 1000 - 86400,
              to: Date.now() / 1000
            }
          }
        });

        expect(result).toBeDefined();
        expect(result.analysis).toBeDefined();
        expect(result.insights).toBeDefined();
      });

      test('should identify key levels', async () => {
        const result = await chartDataAnalysisTool.execute({
          analysisRequest: 'Find support and resistance',
          chartContext: {
            symbol: 'BTCUSDT',
            timeframe: '4h'
          }
        });

        if (result.keyLevels) {
          expect(result.keyLevels).toHaveProperty('support');
          expect(result.keyLevels).toHaveProperty('resistance');
          expect(Array.isArray(result.keyLevels.support)).toBe(true);
          expect(Array.isArray(result.keyLevels.resistance)).toBe(true);
        }
      });
    });
  });

  describe('Pattern Detection', () => {
    describe('Chart Patterns', () => {
      test('should detect common patterns', async () => {
        const patterns = [
          'トライアングル',
          'ヘッドアンドショルダー',
          'ダブルトップ',
          'フラッグ'
        ];

        for (const pattern of patterns) {
          const result = await enhancedChartControlTool.execute({
            context: {
              userRequest: `${pattern}パターンを探して`,
              conversationHistory: [],
              currentState: {
                symbol: 'BTCUSDT',
                timeframe: '1h'
              }
            }
          });

          expect(result.success).toBe(true);
          expect(result.response).toBeDefined();
        }
      });
    });
  });

  describe('Performance Benchmarks', () => {
    test('chart operations should complete within time limits', async () => {
      const operations = [
        { request: 'トレンドラインを描いて', maxTime: 1000 },
        { request: 'BTCに切り替えて', maxTime: 500 },
        { request: 'RSIを追加', maxTime: 500 },
      ];

      for (const { request, maxTime } of operations) {
        const startTime = Date.now();
        
        await enhancedChartControlTool.execute({
          context: {
            userRequest: request,
            conversationHistory: [],
            currentState: {
              symbol: 'BTCUSDT',
              timeframe: '1h'
            }
          }
        });
        
        const executionTime = Date.now() - startTime;
        expect(executionTime).toBeLessThan(maxTime);
      }
    });

    test('line detection should scale with data size', async () => {
      const dataSizes = [100, 500, 1000];
      const times: number[] = [];

      for (const size of dataSizes) {
        const data = createMockCandlestickData(size);
        const startTime = Date.now();
        
        await multiTimeframeLineDetector.detectLines('BTCUSDT', data);
        
        times.push(Date.now() - startTime);
      }

      // Execution time should not grow exponentially
      const timeGrowthRate = times[2] / times[0];
      const sizeGrowthRate = dataSizes[2] / dataSizes[0];
      
      // Time should grow slower than O(n²)
      expect(timeGrowthRate).toBeLessThan(sizeGrowthRate * sizeGrowthRate);
    });
  });
});