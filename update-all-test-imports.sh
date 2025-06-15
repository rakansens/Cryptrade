#!/bin/bash

# Script to update all @/ imports to relative imports in test files

echo "Updating @/ imports to relative imports in all test files..."

# Function to calculate relative path
calculate_relative_path() {
    local from="$1"
    local to="$2"
    
    # Get directory of from file
    local from_dir=$(dirname "$from")
    
    # Calculate relative path from from_dir to to
    local relative=$(python3 -c "
import os
from_dir = '$from_dir'
to_path = '$to'
rel_path = os.path.relpath(to_path, from_dir)
print(rel_path)
")
    
    echo "$relative"
}

# Update imports in tests/unit/chart-persistence.test.ts
sed -i '' \
  -e "s|from '@/lib/storage/chart-persistence'|from '../../lib/storage/chart-persistence'|g" \
  -e "s|from '@/lib/chart/theme'|from '../../lib/chart/theme'|g" \
  -e "s|from '@/types/drawing'|from '../../types/drawing'|g" \
  -e "s|from '@/types/market'|from '../../types/market'|g" \
  tests/unit/chart-persistence.test.ts 2>/dev/null || true

# Update imports in tests/unit/advanced-touch-detection.test.ts
sed -i '' \
  -e "s|from '@/lib/analysis/advanced-touch-detector'|from '../../lib/analysis/advanced-touch-detector'|g" \
  -e "s|from '@/types/market'|from '../../types/market'|g" \
  tests/unit/advanced-touch-detection.test.ts 2>/dev/null || true

# Update imports in tests/unit/enhanced-line-detector-v2.test.ts
sed -i '' \
  -e "s|from '@/lib/analysis/enhanced-line-detector-v2'|from '../../lib/analysis/enhanced-line-detector-v2'|g" \
  -e "s|from '@/lib/analysis/advanced-touch-detector'|from '../../lib/analysis/advanced-touch-detector'|g" \
  -e "s|from '@/lib/services/enhanced-market-data.service'|from '../../lib/services/enhanced-market-data.service'|g" \
  -e "s|from '@/types/market'|from '../../types/market'|g" \
  -e "s|from '@/lib/utils/logger'|from '../../lib/utils/logger'|g" \
  tests/unit/enhanced-line-detector-v2.test.ts 2>/dev/null || true

# Update imports in tests/unit/components/
find tests/unit/components -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/components/|from '../../../../components/|g" \
  -e "s|from '@/lib/|from '../../../../lib/|g" \
  -e "s|from '@/types/|from '../../../../types/|g" \
  -e "s|from '@/hooks/|from '../../../../hooks/|g" \
  -e "s|from '@/store/|from '../../../../store/|g" \
  {} \;

# Update imports in tests/unit/hooks/
find tests/unit/hooks -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/hooks/|from '../../../hooks/|g" \
  -e "s|from '@/lib/|from '../../../lib/|g" \
  -e "s|from '@/types/|from '../../../types/|g" \
  -e "s|from '@/store/|from '../../../store/|g" \
  -e "s|from '@/config/|from '../../../config/|g" \
  {} \;

# Update imports in tests/unit/lib/
find tests/unit/lib -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/lib/|from '../../../../lib/|g" \
  -e "s|from '@/types/|from '../../../../types/|g" \
  -e "s|from '@/config/|from '../../../../config/|g" \
  -e "s|from '@/store/|from '../../../../store/|g" \
  -e "s|from '@/__tests__/|from '../../../../__tests__/|g" \
  {} \;

# Update imports in tests/unit/store/
find tests/unit/store -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/store/|from '../../../store/|g" \
  -e "s|from '@/lib/|from '../../../lib/|g" \
  -e "s|from '@/types/|from '../../../types/|g" \
  {} \;

# Update imports in tests/unit/api/
find tests/unit/api -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/app/api/|from '../../../app/api/|g" \
  -e "s|from '@/lib/|from '../../../lib/|g" \
  -e "s|from '@/types/|from '../../../types/|g" \
  {} \;

# Update imports in tests/integration/
find tests/integration -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/|from '../../|g" \
  {} \;

# Update imports in tests/performance/
find tests/performance -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/|from '../../|g" \
  {} \;

# Update imports in tests/e2e/
find tests/e2e -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|from '@/|from '../../|g" \
  {} \;

# Update mocked module paths
find tests -name "*.test.ts" -type f -exec sed -i '' \
  -e "s|jest.mock('@/lib/utils/logger'|jest.mock('../../lib/utils/logger'|g" \
  -e "s|jest.mock('@/lib/|jest.mock('../../lib/|g" \
  -e "s|jest.mock('@/store/|jest.mock('../../store/|g" \
  -e "s|jest.mock('@/hooks/|jest.mock('../../hooks/|g" \
  {} \;

echo "Import updates completed!"

# Verify remaining @/ imports
echo ""
echo "Checking for remaining @/ imports in test files..."
remaining=$(find . -path "./node_modules" -prune -o -name "*.test.ts" -type f -print | xargs grep -l "from '@/" 2>/dev/null | grep -v node_modules | wc -l)

if [ "$remaining" -gt 0 ]; then
    echo "Found $remaining files with remaining @/ imports:"
    find . -path "./node_modules" -prune -o -name "*.test.ts" -type f -print | xargs grep -l "from '@/" 2>/dev/null | grep -v node_modules | head -10
else
    echo "All @/ imports have been updated!"
fi

echo ""
echo "Script completed. Please run tests to verify all imports are working correctly."