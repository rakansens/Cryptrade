#!/bin/bash

# Script to update import paths in test files after file moves
# This script will update both @/ alias imports and relative imports

echo "Updating import paths in test files..."

# Update @/ imports to relative imports in lib/ test files
find lib -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/lib/utils/logger'|from '../logger'|g" \
  -e "s|from '@/lib/utils/|from '../|g" \
  -e "s|from '@/lib/services/|from '../../services/|g" \
  -e "s|from '@/lib/binance/|from '../../binance/|g" \
  -e "s|from '@/lib/monitoring/|from '../../monitoring/|g" \
  -e "s|from '@/lib/store/|from '../../store/|g" \
  -e "s|from '@/lib/chart/|from '../../chart/|g" \
  -e "s|from '@/lib/validation/|from '../|g" \
  -e "s|from '@/lib/server/|from '../../server/|g" \
  -e "s|from '@/lib/mastra/|from '../../mastra/|g" \
  -e "s|from '@/lib/analysis/|from '../../analysis/|g" \
  -e "s|from '@/lib/ml/|from '../../ml/|g" \
  -e "s|from '@/types/|from '../../../types/|g" \
  -e "s|from '@/config/|from '../../../config/|g" \
  -e "s|from '@/prisma/|from '../../../prisma/|g" \
  {} \;

# Update imports in lib/ml/__tests__/
find lib/ml/__tests__ -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|jest.mock('@/lib/utils/logger'|jest.mock('../../utils/logger'|g" \
  {} \;

# Update imports in lib/utils/__tests__/
find lib/utils/__tests__ -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/lib/utils/drawing-queue'|from '../drawing-queue'|g" \
  -e "s|from '@/lib/chart/drawing-primitives'|from '../../chart/drawing-primitives'|g" \
  -e "s|jest.mock('@/lib/utils/logger'|jest.mock('../logger'|g" \
  {} \;

# Update imports in lib/validation/__tests__/
find lib/validation/__tests__ -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/lib/validation/chart-drawing-schema'|from '../chart-drawing-schema'|g" \
  {} \;

# Update imports in lib/services/__tests__/
find lib/services/__tests__ -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/lib/services/database/|from '../../database/|g" \
  -e "s|from '@/lib/services/|from '../|g" \
  {} \;

# Update imports in lib/store/__tests__/
find lib/store/__tests__ -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/lib/store/conversation-memory.store'|from '../conversation-memory.store'|g" \
  -e "s|from '@/lib/services/database/chat.service'|from '../../services/database/chat.service'|g" \
  -e "s|from '@/config/app.config'|from '../../../config/app.config'|g" \
  -e "s|from '@/types/db'|from '../../../types/db'|g" \
  {} \;

# Update imports in lib/mastra/__tests__/
find lib/mastra/__tests__ -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/lib/utils/logger'|from '../../utils/logger'|g" \
  -e "s|from '@/types/ui-events.types'|from '../../../types/ui-events.types'|g" \
  {} \;

# Update imports in lib/ws/__tests__/
find lib/ws/__tests__ -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/lib/ws/WSManager'|from '../../WSManager'|g" \
  -e "s|from '@/lib/ws/types'|from '../../types'|g" \
  -e "s|from '@/lib/ws/compat-shim'|from '../../compat-shim'|g" \
  -e "s|from '@/lib/utils/logger'|from '../../../utils/logger'|g" \
  -e "s|from '@/lib/monitoring/metrics'|from '../../../monitoring/metrics'|g" \
  -e "s|from '@/lib/ws/|from '../|g" \
  {} \;

# Update imports in tests/unit/lib/ test files
find tests/unit/lib -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/lib/analysis/|from '../../../../lib/analysis/|g" \
  -e "s|from '@/lib/services/|from '../../../../lib/services/|g" \
  -e "s|from '@/lib/utils/|from '../../../../lib/utils/|g" \
  -e "s|from '@/lib/monitoring/|from '../../../../lib/monitoring/|g" \
  -e "s|from '@/lib/server/|from '../../../../lib/server/|g" \
  -e "s|from '@/lib/binance/|from '../../../../lib/binance/|g" \
  -e "s|from '@/lib/ml/|from '../../../../lib/ml/|g" \
  -e "s|from '@/types/|from '../../../../types/|g" \
  -e "s|from '@/__tests__/|from '../../../../__tests__/|g" \
  {} \;

# Update imports in tests/unit/lib/mastra/tools/ test files
find tests/unit/lib/mastra/tools -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '../chart-data-analysis.tool'|from '../../../../../lib/mastra/tools/chart-data-analysis.tool'|g" \
  -e "s|from '../ui-state.tool'|from '../../../../../lib/mastra/tools/ui-state.tool'|g" \
  -e "s|from '../market-data-resilient.tool'|from '../../../../../lib/mastra/tools/market-data-resilient.tool'|g" \
  -e "s|from '../agent-selection.tool'|from '../../../../../lib/mastra/tools/agent-selection.tool'|g" \
  -e "s|from '../enhanced-proposal-generation.tool'|from '../../../../../lib/mastra/tools/enhanced-proposal-generation.tool'|g" \
  -e "s|from '../proposal-generation'|from '../../../../../lib/mastra/tools/proposal-generation'|g" \
  -e "s|from '../../network/agent-network'|from '../../../../../lib/mastra/network/agent-network'|g" \
  -e "s|from '../../utils/fallback-handler'|from '../../../../../lib/mastra/utils/fallback-handler'|g" \
  -e "s|from '@/lib/mastra/|from '../../../../../lib/mastra/|g" \
  {} \;

# Update imports in types/__tests__/
find types/__tests__ -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '\.\./|from '../|g" \
  {} \;

# Update imports in types/events/__tests__/
find types/events/__tests__ -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '\.\./|from '../|g" \
  {} \;

# Update imports in config/__tests__/
find config/__tests__ -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '\.\./|from '../|g" \
  {} \;

# Update imports in __tests__/integration/
find __tests__/integration -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/|from '../../|g" \
  {} \;

# Update imports in hooks/ test files
find hooks -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '\.\./|from '../|g" \
  {} \;

# Update imports in components/ test files
find components -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '\.\./|from '../|g" \
  {} \;

# Update imports in app/api/ test files
find app/api -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '\.\./|from '../|g" \
  {} \;

# Update imports in store/__tests__/
find store/__tests__ -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '\.\./|from '../|g" \
  {} \;

echo "Import path updates completed!"

# Verify the changes
echo "Verifying changes..."
echo "Files with @/ imports in test files:"
find . -name "*.test.ts" -type f -exec grep -l "from '@/" {} \; | grep -v node_modules | head -10

echo ""
echo "Script completed. Please run tests to verify all imports are working correctly."