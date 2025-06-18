#!/bin/bash

# Script to generate tests for API routes with 0% coverage
# This script finds API routes without tests and generates them using the test generator

echo "🔍 Finding API routes without test coverage..."

# Array to store generated test files
generated_tests=()

# Find all route.ts files without corresponding tests
while IFS= read -r route_file; do
  # Construct the test file path
  test_file="tests/unit/${route_file%.ts}.test.ts"
  
  # Check if test file already exists
  if [ ! -f "$test_file" ]; then
    echo "📝 Generating test for: $route_file"
    
    # Create directory structure if it doesn't exist
    test_dir=$(dirname "$test_file")
    mkdir -p "$test_dir"
    
    # Generate the test file
    if npx ts-node scripts/generate-tests.ts "$route_file" -o "$test_file" -f 2>/dev/null; then
      generated_tests+=("$test_file")
      echo "✅ Generated: $test_file"
    else
      echo "❌ Failed to generate test for: $route_file"
    fi
  fi
done < <(find app/api -name "route.ts" -type f | grep -E "(alerts|analysis/active|analysis/records|auth/me|chat/migrate|csp-report|events|health/db|logs|metrics|monitoring|test|ui-events|ws/metrics|chart/sessions|memory/sessions|analysis/records/\[recordId\]|analysis/sessions/\[sessionId\]|chart/sessions/\[sessionId\]|memory/sessions/\[sessionId\])" | head -30)

echo ""
echo "📊 Summary:"
echo "Generated ${#generated_tests[@]} test files"
echo ""
echo "📁 Generated test files:"
printf '%s\n' "${generated_tests[@]}"

# Estimate coverage gain
echo ""
echo "📈 Expected coverage gain:"
echo "Each API route test typically adds 50-100 lines of coverage"
echo "With ${#generated_tests[@]} files, expecting ~${#generated_tests[@]}00-${#generated_tests[@]}000 lines covered"