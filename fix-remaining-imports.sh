#!/bin/bash

echo "Fixing remaining import issues..."

# Fix logging helpers imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/helpers'\''|from '\''@/lib/logging/helpers'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/index'\''|from '\''@/lib/logging/index'\''|g'

# Fix mastra utils/intent imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/utils/intent'\''|from '\''@/lib/mastra/utils/intent'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/mastra/intent'\''|from '\''@/lib/mastra/utils/intent'\''|g'

# Fix mastra network imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/mastra/message-utils'\''|from '\''@/lib/mastra/network/message-utils'\''|g'

# Fix mastra tools imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/mastra/entry-proposal-generation'\''|from '\''@/lib/mastra/tools/entry-proposal-generation'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/mastra/memory-recall\.tool'\''|from '\''@/lib/mastra/tools/memory-recall.tool'\''|g'

# Fix ML imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/feature-extractor'\''|from '\''@/lib/ml/feature-extractor'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/line-predictor'\''|from '\''@/lib/ml/line-predictor'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/streaming-ml-analyzer'\''|from '\''@/lib/ml/streaming-ml-analyzer'\''|g'

# Fix monitoring imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/metrics'\''|from '\''@/lib/monitoring/metrics'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/trace'\''|from '\''@/lib/monitoring/trace'\''|g'

# Fix notifications imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/browser-notifications'\''|from '\''@/lib/notifications/browser-notifications'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/toast'\''|from '\''@/lib/notifications/toast'\''|g'

# Fix services imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/analysis\.service'\''|from '\''@/lib/services/database/analysis.service'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/chart-drawing\.service'\''|from '\''@/lib/services/database/chart-drawing.service'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/chat\.service'\''|from '\''@/lib/services/database/chat.service'\''|g'

# Fix binance imports
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/api-service'\''|from '\''@/lib/binance/api-service'\''|g'
find tests -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's|from '\''@/lib/connection-manager'\''|from '\''@/lib/binance/connection-manager'\''|g'

echo "Fixed remaining imports!"