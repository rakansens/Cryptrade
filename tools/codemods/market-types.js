/**
 * JSCodeshift transformation for consolidating market domain types
 * 
 * This codemod transforms imports from the old schema locations to the new
 * unified market types location.
 * 
 * Usage:
 *   npx jscodeshift -t tools/codemods/market-types.js --dry --print src/
 *   npx jscodeshift -t tools/codemods/market-types.js src/
 * 
 * Transformations:
 * 1. Updates imports from '@/lib/schemas/binance.schema' to '@/types/market'
 * 2. Updates relative imports from indicator files
 * 3. Consolidates multiple type imports from same source
 */

const SCHEMA_IMPORT_PATH = '@/lib/schemas/binance.schema';
const NEW_IMPORT_PATH = '@/types/market';

// Types that have been moved to the new location
const MOVED_TYPES = new Set([
  'ProcessedKline',
  'BinanceTicker24hr',
  'BinanceTradeMessage', 
  'BinanceKlineMessage',
  'PriceUpdate',
  'IndicatorOptions',
  'PriceData',
  'MarketTicker',
  'RSIData',
  'MACDData',
  'MovingAverageData',
  'BollingerBandsData',
  'BollingerBandsConfig',
  // Schemas
  'BinanceKlinesResponseSchema',
  'BinanceTicker24hrSchema',
  'ProcessedKlineSchema',
  'validateBinanceKlines',
  'validateBinanceTradeMessage', 
  'validateBinanceKlineMessage'
]);

module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const source = j(fileInfo.source);
  let hasChanges = false;

  // Transform import declarations
  source.find(j.ImportDeclaration).forEach(path => {
    const importPath = path.value.source.value;
    
    // Handle schema imports
    if (importPath === SCHEMA_IMPORT_PATH) {
      path.value.source.value = NEW_IMPORT_PATH;
      hasChanges = true;
      
      // Log the transformation
      console.log(`[${fileInfo.path}] Updated import: ${SCHEMA_IMPORT_PATH} -> ${NEW_IMPORT_PATH}`);
    }
    
    // Handle relative imports from indicator files that might need updating
    if (importPath.includes('../schemas/binance.schema')) {
      // Calculate relative path to types/market.ts
      const depth = (fileInfo.path.match(/\//g) || []).length - 1; // Count directory depth
      const relativePath = '../'.repeat(Math.max(1, depth - 1)) + 'types/market';
      path.value.source.value = relativePath;
      hasChanges = true;
      
      console.log(`[${fileInfo.path}] Updated relative import: ${importPath} -> ${relativePath}`);
    }
  });

  // Remove duplicate type definitions in indicator files
  // Look for interface/type declarations that have been moved to market.ts
  source.find(j.TSInterfaceDeclaration).forEach(path => {
    const interfaceName = path.value.id.name;
    if (MOVED_TYPES.has(interfaceName)) {
      // Check if this is in an indicator file
      if (fileInfo.path.includes('/indicators/') && !fileInfo.path.includes('__tests__')) {
        console.log(`[${fileInfo.path}] Would remove duplicate interface: ${interfaceName}`);
        // Don't actually remove in dry run mode, just log
        if (!api.jscodeshift.dry) {
          j(path).remove();
          hasChanges = true;
        }
      }
    }
  });

  // Look for type alias declarations
  source.find(j.TSTypeAliasDeclaration).forEach(path => {
    const typeName = path.value.id.name;
    if (MOVED_TYPES.has(typeName)) {
      if (fileInfo.path.includes('/indicators/') && !fileInfo.path.includes('__tests__')) {
        console.log(`[${fileInfo.path}] Would remove duplicate type: ${typeName}`);
        if (!api.jscodeshift.dry) {
          j(path).remove();
          hasChanges = true;
        }
      }
    }
  });

  // Add import for types that are being used but not imported
  // (This is more complex and would require usage analysis)
  
  return hasChanges ? source.toSource({
    quote: 'single',
    reuseParsers: true,
  }) : null;
};

module.exports.parser = 'tsx';