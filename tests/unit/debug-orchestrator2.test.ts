import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import { agentSelectionTool } from '@/lib/mastra/tools/agent-selection.tool';

describe('debug orchestrator2', () => {
  it('should call agentSelectionTool.execute', async () => {
    // Mock with proper A2A communication response structure
    const mockResponse = {
      success: true,
      selectedAgent: 'priceInquiryAgent',
      executionResult: {
        response: 'Current BTC price is $50,000',
        metadata: {
          model: 'a2a-communication',
          processedBy: 'trading-agent'
        }
      },
      message: 'Price inquiry successful'
    };
    
    jest.spyOn(agentSelectionTool, 'execute').mockResolvedValue(mockResponse);
    const res = await executeImprovedOrchestrator('BTCの価格', 'session-1');
    expect((agentSelectionTool.execute as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log('analysis', res.analysis, 'execRes', res.executionResult?.metadata?.processedBy);
  });
}); 