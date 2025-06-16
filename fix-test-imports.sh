#!/bin/bash

# Fix imports from @/tests/ to @/lib/mastra/
echo "Fixing @/tests/ imports..."

# Fix agent imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|@/tests/agents/orchestrator\.agent|@/lib/mastra/agents/orchestrator.agent|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|@/tests/agents/trading\.agent|@/lib/mastra/agents/trading.agent|g'

# Fix network imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|@/tests/network/agent-network|@/lib/mastra/network/agent-network|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|@/tests/network/agent-registry|@/lib/mastra/network/agent-registry|g'

# Fix tool imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|@/tests/tools/agent-selection\.tool|@/lib/mastra/tools/agent-selection.tool|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|@/tests/tools/chart-control\.tool|@/lib/mastra/tools/chart-control.tool|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|@/tests/tools/ui-state\.tool|@/lib/mastra/tools/ui-state.tool|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|@/tests/tools/entry-proposal-generation|@/lib/mastra/tools/entry-proposal-generation|g'

echo "Fixing @/lib/ imports to proper paths..."

# Fix API imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/client'\''|from '\''@/lib/api/client'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/middlewares'\''|from '\''@/lib/api/middlewares'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/streaming'\''|from '\''@/lib/api/streaming'\''|g'

# Fix binance imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/websocket-manager'\''|from '\''@/lib/binance/websocket-manager'\''|g'

# Fix chart imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/analyzer'\''|from '\''@/lib/chart/analyzer'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/drawing-renderer'\''|from '\''@/lib/chart/drawing-renderer'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/GlobalStateManager'\''|from '\''@/lib/chart/GlobalStateManager'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/pattern-renderer'\''|from '\''@/lib/chart/pattern-renderer'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/theme'\''|from '\''@/lib/chart/theme'\''|g'

# Fix error imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/base-error'\''|from '\''@/lib/errors/base-error'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/error-tracker'\''|from '\''@/lib/errors/error-tracker'\''|g'

# Fix indicator imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/bollinger-bands'\''|from '\''@/lib/indicators/bollinger-bands'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/macd'\''|from '\''@/lib/indicators/macd'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/moving-average'\''|from '\''@/lib/indicators/moving-average'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/rsi'\''|from '\''@/lib/indicators/rsi'\''|g'

# Fix logging imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/unified-logger'\''|from '\''@/lib/logging/unified-logger'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/helpers'\''|from '\''@/lib/logging/helpers'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/index'\''|from '\''@/lib/logging/index'\''|g'

# Fix mastra network/agent/tool imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/network/agent-network'\''|from '\''@/lib/mastra/network/agent-network'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/agents/orchestrator\.agent'\''|from '\''@/lib/mastra/agents/orchestrator.agent'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/tools/market-data-resilient\.tool'\''|from '\''@/lib/mastra/tools/market-data-resilient.tool'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/utils/intent'\''|from '\''@/lib/mastra/utils/intent'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/mastra/orchestrator\.agent'\''|from '\''@/lib/mastra/agents/orchestrator.agent'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/tools/agent-selection\.tool'\''|from '\''@/lib/mastra/tools/agent-selection.tool'\''|g'

# Fix service imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/semantic-embedding\.service'\''|from '\''@/lib/services/semantic-embedding.service'\''|g'

# Fix storage imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/chart-persistence'\''|from '\''@/lib/storage/chart-persistence'\''|g'

# Fix store imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/conversation-memory\.store'\''|from '\''@/lib/store/conversation-memory.store'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/db-sync'\''|from '\''@/lib/store/db-sync'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/store/token-limiter'\''|from '\''@/lib/store/processors/token-limiter'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/store/tool-call-filter'\''|from '\''@/lib/store/processors/tool-call-filter'\''|g'

# Fix utils imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/compose'\''|from '\''@/lib/utils/compose'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/drawing-queue'\''|from '\''@/lib/utils/drawing-queue'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/logger'\''|from '\''@/lib/utils/logger'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/parse-analysis'\''|from '\''@/lib/utils/parse-analysis'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/retry-with-circuit-breaker'\''|from '\''@/lib/utils/retry-with-circuit-breaker'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/retry-wrapper'\''|from '\''@/lib/utils/retry-wrapper'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/stream-utils'\''|from '\''@/lib/utils/stream-utils'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/validation'\''|from '\''@/lib/utils/validation'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/zustand-helpers'\''|from '\''@/lib/utils/zustand-helpers'\''|g'

# Fix validation imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/chart-drawing\.schema'\''|from '\''@/lib/validation/chart-drawing.schema'\''|g'

# Fix ws imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/migration'\''|from '\''@/lib/ws/migration'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/compat-shim'\''|from '\''@/lib/ws/compat-shim'\''|g'

echo "Done fixing imports!"