#!/bin/bash

echo "🔍 Finding Code Duplication Patterns with grep"
echo "=============================================="

# Create reports directory if it doesn't exist
mkdir -p reports

# Output file
OUTPUT="reports/duplication-patterns-grep.md"

echo "# Code Duplication Patterns Analysis" > $OUTPUT
echo "Generated on: $(date)" >> $OUTPUT
echo "" >> $OUTPUT

# Function to find and count patterns
find_pattern() {
    local pattern_name="$1"
    local pattern="$2"
    local path="$3"
    
    echo "## $pattern_name" >> $OUTPUT
    echo "Path: $path" >> $OUTPUT
    echo "" >> $OUTPUT
    
    echo "Analyzing: $pattern_name in $path"
    
    # Find files and count occurrences
    local file_count=$(find "$path" -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/.next/*" -not -name "*.test.*" -not -name "*.spec.*" -exec grep -l "$pattern" {} \; 2>/dev/null | wc -l | tr -d ' ')
    
    echo "Found in $file_count files" >> $OUTPUT
    
    # Show top occurrences
    echo "### Sample occurrences:" >> $OUTPUT
    echo '```' >> $OUTPUT
    find "$path" -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/.next/*" -not -name "*.test.*" -not -name "*.spec.*" -exec grep -h "$pattern" {} \; 2>/dev/null | sort | uniq -c | sort -nr | head -10 >> $OUTPUT
    echo '```' >> $OUTPUT
    echo "" >> $OUTPUT
}

# 1. API Route Patterns
echo "# API Route Patterns" >> $OUTPUT
echo "" >> $OUTPUT

find_pattern "NextResponse patterns" "NextResponse\." "app/api"
find_pattern "Error responses" "status(4[0-9][0-9])" "app/api"
find_pattern "Try-catch blocks" "catch.*{" "app/api"

# 2. Store Patterns
echo "# Store Patterns" >> $OUTPUT
echo "" >> $OUTPUT

find_pattern "Zustand set patterns" "set(" "store"
find_pattern "State reset patterns" "reset\|initial" "store"

# 3. Hook Patterns
echo "# Hook Patterns" >> $OUTPUT
echo "" >> $OUTPUT

find_pattern "useEffect patterns" "useEffect(" "hooks"
find_pattern "useState patterns" "useState(" "hooks"
find_pattern "Error handling in hooks" "catch.*{" "hooks"

# 4. Component Patterns
echo "# Component Patterns" >> $OUTPUT
echo "" >> $OUTPUT

find_pattern "Loading states" "loading\|isLoading" "components"
find_pattern "Error states" "error\|isError" "components"

# 5. Specific duplicate pattern search
echo "# Specific Duplication Patterns" >> $OUTPUT
echo "" >> $OUTPUT

echo "## Similar function structures" >> $OUTPUT
echo "Looking for functions with similar signatures..." >> $OUTPUT
echo "" >> $OUTPUT

# Find async functions with try-catch
echo "### Async functions with try-catch:" >> $OUTPUT
echo '```' >> $OUTPUT
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec grep -A 5 "async.*{" {} \; 2>/dev/null | grep -B 5 "try {" | grep "async" | sort | uniq -c | sort -nr | head -10 >> $OUTPUT
echo '```' >> $OUTPUT
echo "" >> $OUTPUT

# Find similar imports
echo "### Most common imports:" >> $OUTPUT
echo '```' >> $OUTPUT
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec grep "^import" {} \; 2>/dev/null | sort | uniq -c | sort -nr | head -20 >> $OUTPUT
echo '```' >> $OUTPUT
echo "" >> $OUTPUT

echo "✅ Analysis complete! Results saved to $OUTPUT"

# Create a summary report
cat > reports/duplication-summary.json << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "analyzedAreas": [
    {
      "name": "API Routes",
      "path": "app/api",
      "patterns": [
        "NextResponse usage",
        "Error handling",
        "Try-catch blocks"
      ]
    },
    {
      "name": "Stores",
      "path": "store",
      "patterns": [
        "State updates",
        "State reset logic"
      ]
    },
    {
      "name": "Hooks",
      "path": "hooks",
      "patterns": [
        "Effect hooks",
        "State hooks",
        "Error handling"
      ]
    },
    {
      "name": "Components",
      "path": "components",
      "patterns": [
        "Loading states",
        "Error states"
      ]
    }
  ],
  "recommendations": [
    {
      "area": "API Routes",
      "issue": "Repeated error response patterns",
      "solution": "Create unified response handlers",
      "priority": "High"
    },
    {
      "area": "Stores",
      "issue": "Similar state update logic",
      "solution": "Extract common store utilities",
      "priority": "Medium"
    },
    {
      "area": "Hooks",
      "issue": "Duplicate async operation handling",
      "solution": "Create base async hooks",
      "priority": "High"
    },
    {
      "area": "Components",
      "issue": "Repeated loading/error UI patterns",
      "solution": "Create shared UI state components",
      "priority": "Low"
    }
  ]
}
EOF

echo "📊 Summary saved to reports/duplication-summary.json"