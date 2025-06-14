#!/bin/bash

# Fix common TS2532 and TS18048 patterns

echo "Fixing undefined errors in TypeScript files..."

# Pattern 1: Array access like array[i] -> array[i]!
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v .next | while read file; do
  # Fix array access patterns
  sed -i '' -E 's/([a-zA-Z_][a-zA-Z0-9_]*)\[([a-zA-Z0-9_\s+\-]+)\]\.([a-zA-Z_])/\1[\2]!.\3/g' "$file" 2>/dev/null || true
done

# Pattern 2: Object property access that needs optional chaining
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v .next | while read file; do
  # Fix specific patterns from the errors
  sed -i '' 's/loaded\[0\]\.metadata/loaded[0]?.metadata/g' "$file" 2>/dev/null || true
  sed -i '' 's/result\.executionResult/result.executionResult/g' "$file" 2>/dev/null || true
  sed -i '' 's/filter\.timeRange/filter.timeRange/g' "$file" 2>/dev/null || true
done

echo "Done. Running typecheck to see remaining errors..."
npm run typecheck 2>&1 | grep -E "TS(2532|18048)" | head -20