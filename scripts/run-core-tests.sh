#!/bin/bash

echo "🧪 Running Core Unit Tests..."
echo "=============================="

# Run specific test categories
echo -e "\n📁 Running Hook Tests..."
npm test -- tests/unit/hooks/__tests__/use-is-client.test.ts --no-coverage 2>&1 | grep -E "(PASS|FAIL|Tests:)" || true

echo -e "\n📁 Running Store Tests..."
npm test -- tests/unit/store/chart.store.test.ts --no-coverage 2>&1 | grep -E "(PASS|FAIL|Tests:)" || true

echo -e "\n📁 Running API Tests..."
npm test -- tests/unit/lib/api/middleware.test.ts --no-coverage 2>&1 | grep -E "(PASS|FAIL|Tests:)" || true

echo -e "\n📁 Running Validation Tests..."
npm test -- lib/indicators/validation.ts --no-coverage 2>&1 | grep -E "(PASS|FAIL|Tests:)" || true

echo -e "\n📁 Running WebSocket Mock Tests..."
npm test -- tests/helpers/websocket-mock.ts --no-coverage 2>&1 | grep -E "(PASS|FAIL|Tests:)" || true

echo -e "\n✅ Core test run completed!"