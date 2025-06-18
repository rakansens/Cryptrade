import {
  IntentCategory,
  IntentDefinition,
  INTENT_DEFINITIONS,
  getCategoryByAgentId,
  getAgentIdByCategory,
  classifyIntentByKeywords,
  getAvailableIntents
} from '@/lib/mastra/utils/intent-definitions';

describe('intent-definitions', () => {
  describe('INTENT_DEFINITIONS', () => {
    it('should have all required properties for each definition', () => {
      INTENT_DEFINITIONS.forEach(definition => {
        expect(definition).toHaveProperty('category');
        expect(definition).toHaveProperty('agentId');
        expect(definition).toHaveProperty('keywords');
        expect(definition).toHaveProperty('patterns');
        expect(definition).toHaveProperty('description');
        expect(definition).toHaveProperty('examples');
        expect(definition).toHaveProperty('priority');
        
        expect(Array.isArray(definition.keywords)).toBe(true);
        expect(Array.isArray(definition.patterns)).toBe(true);
        expect(Array.isArray(definition.examples)).toBe(true);
        expect(typeof definition.priority).toBe('number');
      });
    });

    it('should have unique agent IDs', () => {
      const agentIds = INTENT_DEFINITIONS.map(def => def.agentId);
      const uniqueAgentIds = new Set(agentIds);
      
      expect(uniqueAgentIds.size).toBe(agentIds.length);
    });

    it('should have unique categories', () => {
      const categories = INTENT_DEFINITIONS.map(def => def.category);
      const uniqueCategories = new Set(categories);
      
      expect(uniqueCategories.size).toBe(categories.length);
    });

    it('should have valid RegExp patterns', () => {
      INTENT_DEFINITIONS.forEach(definition => {
        definition.patterns.forEach(pattern => {
          expect(pattern).toBeInstanceOf(RegExp);
        });
      });
    });

    it('should have priority values', () => {
      INTENT_DEFINITIONS.forEach(definition => {
        expect(definition.priority).toBeGreaterThanOrEqual(0);
        expect(definition.priority).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('getCategoryByAgentId', () => {
    it('should return correct category for known agent IDs', () => {
      expect(getCategoryByAgentId('priceInquiryAgent')).toBe(IntentCategory.PRICE_INQUIRY);
      expect(getCategoryByAgentId('uiControlAgent')).toBe(IntentCategory.UI_CONTROL);
      expect(getCategoryByAgentId('tradingAnalysisAgent')).toBe(IntentCategory.TRADING_ANALYSIS);
      expect(getCategoryByAgentId('orchestratorAgent')).toBe(IntentCategory.CONVERSATIONAL);
    });

    it('should return null for unknown agent ID', () => {
      expect(getCategoryByAgentId('unknownAgent')).toBeNull();
    });

    it('should handle empty string', () => {
      expect(getCategoryByAgentId('')).toBeNull();
    });
  });

  describe('getAgentIdByCategory', () => {
    it('should return correct agent ID for known categories', () => {
      expect(getAgentIdByCategory(IntentCategory.PRICE_INQUIRY)).toBe('priceInquiryAgent');
      expect(getAgentIdByCategory(IntentCategory.UI_CONTROL)).toBe('uiControlAgent');
      expect(getAgentIdByCategory(IntentCategory.TRADING_ANALYSIS)).toBe('tradingAnalysisAgent');
      expect(getAgentIdByCategory(IntentCategory.CONVERSATIONAL)).toBe('orchestratorAgent');
    });

    it('should return agent ID for future categories', () => {
      expect(getAgentIdByCategory(IntentCategory.NEWS_LOOKUP)).toBe('newsAgent');
      expect(getAgentIdByCategory(IntentCategory.PORTFOLIO_CHECK)).toBe('portfolioAgent');
    });
  });

  describe('classifyIntentByKeywords', () => {
    describe('price inquiry classification', () => {
      it('should classify price-related queries', () => {
        const testCases = [
          'BTCの価格は？',
          'What is the price of ETH?',
          'XRPのいくら？',
          'Show me BTC price',
          'ADAの相場を教えて',
          'Current ETH quote',
          'SOLのprcを知りたい'
        ];

        testCases.forEach(query => {
          const result = classifyIntentByKeywords(query);
          expect(result).not.toBeNull();
          expect(result!.category).toBe(IntentCategory.PRICE_INQUIRY);
          expect(result!.confidence).toBeGreaterThan(0);
          expect(result!.matchedKeywords.length).toBeGreaterThan(0);
        });
      });

      it('should match price patterns', () => {
        const query = 'BTCの価格は？';
        const result = classifyIntentByKeywords(query);
        
        expect(result).not.toBeNull();
        expect(result!.category).toBe(IntentCategory.PRICE_INQUIRY);
        expect(result!.matchedKeywords).toContain('価格');
      });

      it('should handle abbreviated keywords', () => {
        const result = classifyIntentByKeywords('ETH prc?');
        
        expect(result).not.toBeNull();
        expect(result!.category).toBe(IntentCategory.PRICE_INQUIRY);
        expect(result!.matchedKeywords).toContain('prc');
      });
    });

    describe('UI control classification', () => {
      it('should classify UI control queries', () => {
        const testCases = [
          'チャートを1時間足に変更',
          'Display MA indicator',
          'RSIを表示して',
          'Switch to 4H chart',
          'トレンドラインを描画',
          'MAを表示',
          'tfを日足にchg'
        ];

        testCases.forEach(query => {
          const result = classifyIntentByKeywords(query);
          expect(result).not.toBeNull();
          expect(result!.category).toBe(IntentCategory.UI_CONTROL);
        });
      });

      it('should handle abbreviations', () => {
        const testCases = [
          { query: 'disp MA', keywords: ['disp'] },
          { query: 'sw to 1H', keywords: ['sw'] },
          { query: 'chg tf', keywords: ['chg', 'tf'] }
        ];

        testCases.forEach(({ query, keywords }) => {
          const result = classifyIntentByKeywords(query);
          expect(result).not.toBeNull();
          expect(result!.category).toBe(IntentCategory.UI_CONTROL);
          keywords.forEach(keyword => {
            expect(result!.matchedKeywords).toContain(keyword);
          });
        });
      });
    });

    describe('trading analysis classification', () => {
      it('should classify trading analysis queries', () => {
        const testCases = [
          'BTCの技術分析をして',
          'Trading strategy for ETH',
          'リスク評価をお願い',
          'Investment advice needed',
          'BTCのTAお願い',
          'ETHのFA見せて',
          'entryポイントは？'
        ];

        testCases.forEach(query => {
          const result = classifyIntentByKeywords(query);
          expect(result).not.toBeNull();
          expect(result!.category).toBe(IntentCategory.TRADING_ANALYSIS);
        });
      });

      it('should handle trading abbreviations', () => {
        const abbreviations = ['ta', 'fa', 'entry', 'exit', 'tp', 'sl'];
        
        abbreviations.forEach(abbr => {
          const result = classifyIntentByKeywords(`Show ${abbr} for BTC`);
          expect(result).not.toBeNull();
          expect(result!.category).toBe(IntentCategory.TRADING_ANALYSIS);
          expect(result!.matchedKeywords).toContain(abbr);
        });
      });
    });

    describe('conversational classification', () => {
      it('should classify greetings and general queries', () => {
        const testCases = [
          'こんにちは',
          'Hello',
          'Thank you',
          'ありがとう',
          'hey',
          'thx',
          'pls help'
        ];

        testCases.forEach(query => {
          const result = classifyIntentByKeywords(query);
          expect(result).not.toBeNull();
          expect(result!.category).toBe(IntentCategory.CONVERSATIONAL);
        });
      });

      it('should have lowest priority', () => {
        const definition = INTENT_DEFINITIONS.find(
          def => def.category === IntentCategory.CONVERSATIONAL
        );
        
        expect(definition).toBeDefined();
        expect(definition!.priority).toBe(10);
        
        // Check it's the lowest
        const allPriorities = INTENT_DEFINITIONS.map(def => def.priority);
        expect(Math.min(...allPriorities)).toBe(10);
      });
    });

    describe('confidence scoring', () => {
      it('should increase confidence with more matches', () => {
        const query1 = classifyIntentByKeywords('price');
        const query2 = classifyIntentByKeywords('BTC price in USD');
        
        expect(query1).not.toBeNull();
        expect(query2).not.toBeNull();
        expect(query2!.confidence).toBeGreaterThan(query1!.confidence);
      });

      it('should cap confidence at 1.0', () => {
        const query = 'BTC ETH ADA SOL price quote 価格 相場 レート';
        const result = classifyIntentByKeywords(query);
        
        expect(result).not.toBeNull();
        expect(result!.confidence).toBeLessThanOrEqual(1.0);
      });

      it('should return null for low confidence matches', () => {
        const result = classifyIntentByKeywords('random text without keywords');
        
        expect(result).toBeNull();
      });
    });

    describe('case sensitivity', () => {
      it('should be case insensitive for keywords', () => {
        const queries = ['PRICE', 'Price', 'price', 'PrIcE'];
        
        queries.forEach(query => {
          const result = classifyIntentByKeywords(query);
          expect(result).not.toBeNull();
          expect(result!.category).toBe(IntentCategory.PRICE_INQUIRY);
        });
      });

      it('should handle mixed case in patterns', () => {
        const result = classifyIntentByKeywords('BTC価格');
        
        expect(result).not.toBeNull();
        expect(result!.category).toBe(IntentCategory.PRICE_INQUIRY);
      });
    });

    describe('priority handling', () => {
      it('should prefer higher priority intents', () => {
        // Create a query that could match multiple intents
        const query = 'hello show me the price chart';
        const result = classifyIntentByKeywords(query);
        
        expect(result).not.toBeNull();
        // Should prefer PRICE_INQUIRY (priority 90) over CONVERSATIONAL (priority 10)
        expect(result!.category).toBe(IntentCategory.PRICE_INQUIRY);
      });
    });
  });

  describe('getAvailableIntents', () => {
    it('should return only implemented intents', () => {
      const available = getAvailableIntents();
      
      const agentIds = available.map(intent => intent.agentId);
      expect(agentIds).not.toContain('newsAgent');
      expect(agentIds).not.toContain('portfolioAgent');
    });

    it('should return intent information', () => {
      const available = getAvailableIntents();
      
      expect(available.length).toBeGreaterThan(0);
      
      available.forEach(intent => {
        expect(intent).toHaveProperty('category');
        expect(intent).toHaveProperty('agentId');
        expect(intent).toHaveProperty('description');
        expect(intent).toHaveProperty('examples');
        expect(Array.isArray(intent.examples)).toBe(true);
      });
    });

    it('should include main intent categories', () => {
      const available = getAvailableIntents();
      const categories = available.map(intent => intent.category);
      
      expect(categories).toContain(IntentCategory.PRICE_INQUIRY);
      expect(categories).toContain(IntentCategory.UI_CONTROL);
      expect(categories).toContain(IntentCategory.TRADING_ANALYSIS);
      expect(categories).toContain(IntentCategory.CONVERSATIONAL);
    });
  });

  describe('edge cases', () => {
    it('should handle empty queries', () => {
      const result = classifyIntentByKeywords('');
      expect(result).toBeNull();
    });

    it('should handle queries with only spaces', () => {
      const result = classifyIntentByKeywords('   ');
      expect(result).toBeNull();
    });

    it('should handle very long queries', () => {
      const longQuery = 'price '.repeat(100);
      const result = classifyIntentByKeywords(longQuery);
      
      expect(result).not.toBeNull();
      expect(result!.category).toBe(IntentCategory.PRICE_INQUIRY);
    });

    it('should handle special characters in queries', () => {
      const queries = [
        'BTC価格！！！',
        'Show price???',
        'チャート***表示',
        '@#$% price @#$%'
      ];

      queries.forEach(query => {
        const result = classifyIntentByKeywords(query);
        expect(result).not.toBeNull();
      });
    });

    it('should handle queries with multiple languages', () => {
      const result = classifyIntentByKeywords('BTCのprice教えてplease');
      
      expect(result).not.toBeNull();
      expect(result!.category).toBe(IntentCategory.PRICE_INQUIRY);
      expect(result!.matchedKeywords).toContain('price');
    });
  });
});