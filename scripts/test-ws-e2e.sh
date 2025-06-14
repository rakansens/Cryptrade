#!/bin/bash

echo "🧪 Running WSManager E2E Tests (Split Version)..."
echo "============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test files
E2E_TEST_FILES=(
  "lib/ws/__tests__/e2e/connection.test.ts"
  "lib/ws/__tests__/e2e/message.test.ts"
  "lib/ws/__tests__/e2e/reconnect.test.ts"
  "lib/ws/__tests__/e2e/error-handling.test.ts"
)

BASIC_TEST_FILES=(
  "lib/ws/__tests__/ws-basic.test.ts"
  "lib/ws/__tests__/ws-error-handling.test.ts"
)

# Track results
PASSED=0
FAILED=0

# Function to run test and check result
run_test() {
  local file=$1
  echo ""
  echo "📁 Testing: $file"
  echo "---"
  
  if npm test -- "$file" --no-coverage --testTimeout=10000 --maxWorkers=1 > /tmp/test-output.log 2>&1; then
    echo -e "${GREEN}✅ PASSED${NC}"
    PASSED=$((PASSED + 1))
    # Show summary
    grep -E "Tests:.*passed" /tmp/test-output.log | tail -1
  else
    echo -e "${RED}❌ FAILED${NC}"
    FAILED=$((FAILED + 1))
    # Show errors
    grep -E "(FAIL|✕|Error:|Tests:)" /tmp/test-output.log | tail -10
  fi
}

# Run basic tests first
echo ""
echo "🔧 Running Basic Tests..."
echo "========================"
for file in "${BASIC_TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    run_test "$file"
  fi
done

# Run E2E tests
echo ""
echo ""
echo "🌐 Running E2E Tests..."
echo "====================="
for file in "${E2E_TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    run_test "$file"
  fi
done

# Summary
echo ""
echo "============================================="
echo "📊 Test Summary:"
echo "   ✅ Passed: $PASSED"
echo "   ❌ Failed: $FAILED"
echo "   📋 Total: $((PASSED + FAILED))"
echo "============================================="

# Exit with error if any tests failed
if [ $FAILED -gt 0 ]; then
  exit 1
else
  echo "✨ All tests passed!"
  exit 0
fi