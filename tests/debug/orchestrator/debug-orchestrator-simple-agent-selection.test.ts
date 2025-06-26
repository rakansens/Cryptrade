/**
 * Simple test to verify agentSelectionTool.execute is called correctly
 * after Memory Store mock fix
 */

import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import { agentSelectionTool } from '@/lib/mastra/tools/agent-selection.tool';

// Mock all dependencies
jest.mock('@/lib/store/enhanced-conversation-memory.store');
jest.mock('@/lib/mastra/tools/agent-selection.tool');
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/monitoring/trace');

describe('Orchestrator Agent Selection Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call agentSelectionTool.execute for price inquiry', async () => {
    console.log('=== Starting agentSelectionTool test ===');
    
    // Import the mocked agentSelectionTool
    const mockedAgentSelectionTool = agentSelectionTool as jest.Mocked<typeof agentSelectionTool>;
    
    // Mock the execute method to return a simple response
    mockedAgentSelectionTool.execute.mockResolvedValue({
      response: 'Mocked agent response for price inquiry',
      data: { price: 50000 }
    });
    
    console.log('AgentSelectionTool mock setup completed');
    console.log('Is execute mocked?', jest.isMockFunction(mockedAgentSelectionTool.execute));
    
    // Execute the orchestrator with a price inquiry
    const result = await executeImprovedOrchestrator('BTCの価格');
    
    console.log('=== Orchestrator execution completed ===');
    console.log('Result success:', result.success);
    console.log('Result analysis:', result.analysis);
    console.log('AgentSelectionTool calls:', mockedAgentSelectionTool.execute.mock.calls.length);
    
    if (mockedAgentSelectionTool.execute.mock.calls.length > 0) {
      console.log('First call arguments:', JSON.stringify(mockedAgentSelectionTool.execute.mock.calls[0], null, 2));
    }
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.analysis.intent).toBe('price_inquiry');
    
    // Verify agentSelectionTool.execute was called
    expect(mockedAgentSelectionTool.execute).toHaveBeenCalled();
    
    // Verify it was called with the correct context
    expect(mockedAgentSelectionTool.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          agentType: 'price_inquiry',
          query: 'BTCの価格'
        })
      })
    );
  });

  it('should call agentSelectionTool.execute for UI control', async () => {
    console.log('=== Starting UI control test ===');
    
    const mockedAgentSelectionTool = agentSelectionTool as jest.Mocked<typeof agentSelectionTool>;
    
    mockedAgentSelectionTool.execute.mockResolvedValue({
      response: 'Mocked agent response for UI control',
      data: { action: 'chart_change' }
    });
    
    const result = await executeImprovedOrchestrator('チャートをETHに変更');
    
    console.log('UI control result:', result.analysis);
    console.log('AgentSelectionTool calls:', mockedAgentSelectionTool.execute.mock.calls.length);
    
    expect(result.success).toBe(true);
    expect(result.analysis.intent).toBe('ui_control');
    expect(mockedAgentSelectionTool.execute).toHaveBeenCalled();
  });

  it('should call agentSelectionTool.execute for trading analysis', async () => {
    console.log('=== Starting trading analysis test ===');
    
    const mockedAgentSelectionTool = agentSelectionTool as jest.Mocked<typeof agentSelectionTool>;
    
    mockedAgentSelectionTool.execute.mockResolvedValue({
      response: 'Mocked agent response for trading analysis',
      data: { analysis: 'detailed_analysis' }
    });
    
    const result = await executeImprovedOrchestrator('BTCを分析して');
    
    console.log('Trading analysis result:', result.analysis);
    console.log('AgentSelectionTool calls:', mockedAgentSelectionTool.execute.mock.calls.length);
    
    expect(result.success).toBe(true);
    expect(result.analysis.intent).toBe('trading_analysis');
    expect(mockedAgentSelectionTool.execute).toHaveBeenCalled();
  });
});