#!/bin/bash

echo "🧪 Running WSManager Tests..."
echo "================================"

# Test files
TEST_FILES=(
  "lib/ws/__tests__/WSManager.test.ts"
  "lib/ws/__tests__/WSManager.coverage.test.ts"
  "lib/ws/__tests__/e2e.test.ts"
  "lib/ws/__tests__/e2e-advanced.test.ts"
  "lib/ws/__tests__/e2e-simple.test.ts"
  "lib/ws/__tests__/e2e-simple-fixed.test.ts"
  "lib/ws/__tests__/websocket-coverage.test.ts"
  "lib/ws/__tests__/compat-shim.test.ts"
  "lib/ws/__tests__/migration.test.ts"
  "lib/ws/__tests__/index.test.ts"
)

# Run each test file
for file in "${TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo ""
    echo "📁 Testing: $file"
    echo "---"
    npm test -- "$file" --no-coverage --testTimeout=10000 --maxWorkers=1 2>&1 | grep -E "(PASS|FAIL|✓|✕|Tests:)" | tail -10
  fi
done

echo ""
echo "================================"
echo "✅ Test run complete!"