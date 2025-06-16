#!/bin/bash

echo "Fixing dynamic imports in test files..."

# Fix dynamic imports in unified-logger.test.ts
sed -i '' "s|await import('@/lib/helpers')|await import('@/lib/logging/helpers')|g" tests/unit/lib/logging/unified-logger.test.ts
sed -i '' "s|await import('@/lib/index')|await import('@/lib/logging/index')|g" tests/unit/lib/logging/unified-logger.test.ts

# Fix import in improved-orchestrator.test.ts
sed -i '' "s|import('@/lib/utils/intent')|import('@/lib/mastra/utils/intent')|g" tests/unit/lib/mastra/improved-orchestrator.test.ts

# Fix dynamic import in browser-notifications.test.ts
sed -i '' "s|import('@/lib/browser-notifications')|import('@/lib/notifications/browser-notifications')|g" tests/unit/lib/notifications/browser-notifications.test.ts

# Fix service imports
sed -i '' "s|from '@/lib/database/analysis.service'|from '@/lib/services/database/analysis.service'|g" tests/unit/lib/services/analysis.service.test.ts
sed -i '' "s|from '@/lib/database/chart-drawing.service'|from '@/lib/services/database/chart-drawing.service'|g" tests/unit/lib/services/chart-drawing.service.test.ts
sed -i '' "s|from '@/lib/database/chat.service'|from '@/lib/services/database/chat.service'|g" tests/unit/lib/services/chat.service.test.ts

# Fix monitoring imports
sed -i '' "s|from '@/lib/metrics'|from '@/lib/monitoring/metrics'|g" tests/unit/lib/monitoring/metrics.test.ts
sed -i '' "s|from '@/lib/trace'|from '@/lib/monitoring/trace'|g" tests/unit/lib/monitoring/trace.test.ts

# Fix mastra tools imports
sed -i '' "s|from '@/lib/mastra/entry-proposal-generation'|from '@/lib/mastra/tools/entry-proposal-generation'|g" tests/unit/lib/mastra/tools/entry-proposal-generation.test.ts

# Fix mastra utils imports
sed -i '' "s|from '@/lib/mastra/intent'|from '@/lib/mastra/utils/intent'|g" tests/unit/lib/mastra/utils/intent-helpers.test.ts
sed -i '' "s|from '@/lib/mastra/intent'|from '@/lib/mastra/utils/intent'|g" tests/unit/lib/mastra/utils/intent-symbol-extraction.test.ts
sed -i '' "s|from '@/lib/mastra/intent'|from '@/lib/mastra/utils/intent'|g" tests/unit/lib/mastra/utils/intent.test.ts

echo "Fixed dynamic imports!"