import { extractProposalGroup, debugProposalGroupStructure } from '../proposal-extractor';
import { logger } from '@/lib/utils/logger';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  }
}));

describe('proposal-extractor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractProposalGroup', () => {
    it('should return null for invalid input', () => {
      expect(extractProposalGroup(null)).toBeNull();
      expect(extractProposalGroup(undefined)).toBeNull();
      expect(extractProposalGroup('string')).toBeNull();
      expect(extractProposalGroup(123)).toBeNull();
    });

    it('should extract from JSON response string', () => {
      const proposalGroup = {
        proposals: [
          { id: 1, type: 'trendline' },
          { id: 2, type: 'horizontal' }
        ]
      };

      const executionResult = {
        response: JSON.stringify({
          type: 'proposalGroup',
          data: proposalGroup
        })
      };

      const result = extractProposalGroup(executionResult);
      
      expect(result).toEqual(proposalGroup);
      expect(logger.info).toHaveBeenCalledWith(
        '[ProposalExtractor] Found proposalGroup in JSON response',
        { proposalCount: 2 }
      );
    });

    it('should handle invalid JSON in response', () => {
      const executionResult = {
        response: 'invalid json proposalGroup'
      };

      const result = extractProposalGroup(executionResult);
      
      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        '[ProposalExtractor] Failed to parse JSON response',
        expect.any(Object)
      );
    });

    it('should extract from toolResults', () => {
      const proposalGroup = {
        proposals: [{ id: 1, type: 'pattern' }]
      };

      const executionResult = {
        toolResults: [
          { toolName: 'other-tool', result: {} },
          { 
            toolName: 'proposal-tool',
            result: { proposalGroup }
          }
        ]
      };

      const result = extractProposalGroup(executionResult);
      
      expect(result).toEqual(proposalGroup);
      expect(logger.info).toHaveBeenCalledWith(
        '[ProposalExtractor] Found proposalGroup in toolResults',
        {
          toolName: 'proposal-tool',
          proposalCount: 1,
          source: 'toolResults'
        }
      );
    });

    it('should extract from steps with toolResults', () => {
      const proposalGroup = {
        proposals: [{ id: 1 }, { id: 2 }, { id: 3 }]
      };

      const executionResult = {
        steps: [
          {
            toolResults: [
              { result: {} },
              { result: { proposalGroup } }
            ]
          }
        ]
      };

      const result = extractProposalGroup(executionResult);
      
      expect(result).toEqual(proposalGroup);
      expect(logger.info).toHaveBeenCalledWith(
        '[ProposalExtractor] Found proposalGroup in toolResults',
        expect.any(Object)
      );
    });

    it('should extract from A2A executionResult structure', () => {
      const proposalGroup = {
        proposals: []
      };

      const executionResult = {
        executionResult: {
          steps: [
            {
              toolResults: [
                { result: { proposalGroup } }
              ]
            }
          ]
        }
      };

      const result = extractProposalGroup(executionResult);
      
      expect(result).toEqual(proposalGroup);
    });

    it('should extract from direct proposalGroup property', () => {
      const proposalGroup = {
        proposals: [{ id: 1 }]
      };

      const executionResult = {
        proposalGroup
      };

      const result = extractProposalGroup(executionResult);
      
      expect(result).toEqual(proposalGroup);
      expect(logger.info).toHaveBeenCalledWith(
        '[ProposalExtractor] Found proposalGroup in direct location'
      );
    });

    it('should extract from nested executionResult.proposalGroup', () => {
      const proposalGroup = {
        proposals: []
      };

      const executionResult = {
        executionResult: {
          proposalGroup
        }
      };

      const result = extractProposalGroup(executionResult);
      
      expect(result).toEqual(proposalGroup);
    });

    it('should extract from data.proposalGroup', () => {
      const proposalGroup = {
        proposals: [{ id: 1 }]
      };

      const executionResult = {
        data: {
          proposalGroup
        }
      };

      const result = extractProposalGroup(executionResult);
      
      expect(result).toEqual(proposalGroup);
    });

    it('should prioritize JSON response over other locations', () => {
      const jsonProposalGroup = {
        proposals: [{ id: 1, source: 'json' }]
      };

      const directProposalGroup = {
        proposals: [{ id: 2, source: 'direct' }]
      };

      const executionResult = {
        response: JSON.stringify({
          type: 'proposalGroup',
          data: jsonProposalGroup
        }),
        proposalGroup: directProposalGroup
      };

      const result = extractProposalGroup(executionResult);
      
      expect(result).toEqual(jsonProposalGroup);
    });

    it('should handle complex A2A structure with multiple locations', () => {
      const proposalGroup = {
        proposals: [{ id: 1 }]
      };

      const executionResult = {
        executionResult: {
          toolResults: [
            { result: { proposalGroup } }
          ],
          steps: [
            {
              toolResults: [
                { result: { data: 'other' } }
              ]
            }
          ]
        }
      };

      const result = extractProposalGroup(executionResult);
      
      expect(result).toEqual(proposalGroup);
    });
  });

  describe('debugProposalGroupStructure', () => {
    it('should handle null or invalid input', () => {
      debugProposalGroupStructure(null);
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[ProposalExtractor] No execution result to debug'
      );
    });

    it('should log structure information', () => {
      const executionResult = {
        executionResult: {
          steps: [],
          toolResults: [],
          proposalGroup: {}
        },
        steps: [],
        toolResults: [],
        proposalGroup: {}
      };

      debugProposalGroupStructure(executionResult);
      
      expect(logger.debug).toHaveBeenCalledWith(
        '[ProposalExtractor] Debugging structure',
        {
          hasExecutionResult: true,
          executionResultKeys: ['steps', 'toolResults', 'proposalGroup'],
          hasSteps: true,
          hasToolResults: true,
          hasExecutionResultSteps: true,
          hasExecutionResultToolResults: true,
          hasProposalGroup: true,
          hasExecutionResultProposalGroup: true,
        }
      );
    });

    it('should handle minimal structure', () => {
      const executionResult = {};

      debugProposalGroupStructure(executionResult);
      
      expect(logger.debug).toHaveBeenCalledWith(
        '[ProposalExtractor] Debugging structure',
        {
          hasExecutionResult: false,
          executionResultKeys: [],
          hasSteps: false,
          hasToolResults: false,
          hasExecutionResultSteps: false,
          hasExecutionResultToolResults: false,
          hasProposalGroup: false,
          hasExecutionResultProposalGroup: false,
        }
      );
    });
  });
});