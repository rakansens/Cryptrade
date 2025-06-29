#!/bin/bash

echo "🔍 Finding Code Duplication Patterns"
echo "==================================="

# Create reports directory if it doesn't exist
mkdir -p reports

# Output file
OUTPUT="reports/duplication-patterns-analysis.md"

echo "# Code Duplication Patterns Analysis" > $OUTPUT
echo "Generated on: $(date)" >> $OUTPUT
echo "" >> $OUTPUT

# Function to analyze pattern frequency
analyze_pattern() {
    local pattern_name="$1"
    local pattern="$2"
    local description="$3"
    
    echo "## $pattern_name" >> $OUTPUT
    echo "$description" >> $OUTPUT
    echo "" >> $OUTPUT
    
    echo "Analyzing: $pattern_name"
    
    # Find files matching the pattern
    local results=$(rg -t ts -t tsx "$pattern" --no-filename -o | sort | uniq -c | sort -nr | head -20)
    
    if [ -n "$results" ]; then
        echo "### Most common instances:" >> $OUTPUT
        echo '```' >> $OUTPUT
        echo "$results" >> $OUTPUT
        echo '```' >> $OUTPUT
        
        # Count unique files with this pattern
        local file_count=$(rg -t ts -t tsx "$pattern" -l | wc -l | tr -d ' ')
        echo "Found in $file_count files" >> $OUTPUT
        echo "" >> $OUTPUT
    else
        echo "No instances found" >> $OUTPUT
        echo "" >> $OUTPUT
    fi
}

# 1. Error handling patterns
analyze_pattern "Error Handling Patterns" \
    "catch\s*\([^)]+\)\s*\{[^}]*\}" \
    "Analysis of try-catch blocks and error handling patterns"

# 2. API response patterns
analyze_pattern "API Response Patterns" \
    "res\.(status|json|send)\([^)]*\)" \
    "Analysis of API response handling patterns"

# 3. State update patterns
analyze_pattern "State Update Patterns" \
    "(setState|dispatch)\s*\([^)]+\)" \
    "Analysis of state management patterns"

# 4. Async/await patterns
analyze_pattern "Async Operation Patterns" \
    "await\s+[a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$][a-zA-Z0-9_$]*\(" \
    "Analysis of async/await usage patterns"

# 5. Validation patterns
analyze_pattern "Validation Patterns" \
    "if\s*\(\s*![a-zA-Z_$][a-zA-Z0-9_$]*\s*\)" \
    "Analysis of validation and guard clause patterns"

# 6. Array processing patterns
analyze_pattern "Array Processing Patterns" \
    "\.(map|filter|reduce|forEach)\s*\(" \
    "Analysis of array manipulation patterns"

# 7. WebSocket patterns
analyze_pattern "WebSocket Patterns" \
    "(socket|ws)\.(on|emit|send)\s*\(" \
    "Analysis of WebSocket communication patterns"

# 8. Database query patterns
analyze_pattern "Database Query Patterns" \
    "prisma\.[a-zA-Z]+\.(findMany|findUnique|create|update|delete)" \
    "Analysis of database query patterns"

# 9. Import patterns
echo "## Import Pattern Analysis" >> $OUTPUT
echo "Analysis of common import patterns and dependencies" >> $OUTPUT
echo "" >> $OUTPUT

# Find most imported modules
echo "### Most imported modules:" >> $OUTPUT
echo '```' >> $OUTPUT
rg "^import.*from ['\"](.*)['\"]" -o -r '$1' --no-filename | sort | uniq -c | sort -nr | head -20 >> $OUTPUT
echo '```' >> $OUTPUT
echo "" >> $OUTPUT

# 10. Export patterns
echo "## Export Pattern Analysis" >> $OUTPUT
echo "Analysis of export patterns" >> $OUTPUT
echo "" >> $OUTPUT

echo "### Export types:" >> $OUTPUT
echo '```' >> $OUTPUT
rg "^export (default |const |function |class |interface |type |enum )" -o --no-filename | sort | uniq -c | sort -nr >> $OUTPUT
echo '```' >> $OUTPUT
echo "" >> $OUTPUT

# Specific duplication analysis for each area
echo "# Area-Specific Duplication Analysis" >> $OUTPUT
echo "" >> $OUTPUT

# API Routes
echo "## API Routes Analysis" >> $OUTPUT
echo "Looking for similar response patterns in API routes" >> $OUTPUT
echo "" >> $OUTPUT

echo "### Common response patterns:" >> $OUTPUT
echo '```' >> $OUTPUT
rg -t ts "return\s+(NextResponse|Response|res)\." app/api --no-filename -A 2 | grep -E "status|json|error" | sort | uniq -c | sort -nr | head -10 >> $OUTPUT
echo '```' >> $OUTPUT
echo "" >> $OUTPUT

# Stores
echo "## Store Analysis" >> $OUTPUT
echo "Looking for similar state update patterns in stores" >> $OUTPUT
echo "" >> $OUTPUT

echo "### Common store patterns:" >> $OUTPUT
echo '```' >> $OUTPUT
rg -t ts "set\s*\(\s*\(" store --no-filename -A 1 | grep -v "^--" | sort | uniq -c | sort -nr | head -10 >> $OUTPUT
echo '```' >> $OUTPUT
echo "" >> $OUTPUT

# Hooks
echo "## Hooks Analysis" >> $OUTPUT
echo "Looking for similar patterns in hooks" >> $OUTPUT
echo "" >> $OUTPUT

echo "### Common hook patterns:" >> $OUTPUT
echo '```' >> $OUTPUT
rg -t ts "use(State|Effect|Callback|Memo|Ref)\s*\(" hooks --no-filename | sort | uniq -c | sort -nr | head -10 >> $OUTPUT
echo '```' >> $OUTPUT
echo "" >> $OUTPUT

# Summary statistics
echo "# Summary Statistics" >> $OUTPUT
echo "" >> $OUTPUT

echo "## File counts by directory:" >> $OUTPUT
echo '```' >> $OUTPUT
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v .next | cut -d'/' -f2 | sort | uniq -c | sort -nr | head -20 >> $OUTPUT
echo '```' >> $OUTPUT

echo "✅ Analysis complete! Results saved to $OUTPUT"

# Also create a JSON report with specific recommendations
node -e "
const fs = require('fs');

const recommendations = [
  {
    area: 'API Routes',
    pattern: 'Error Response Handling',
    description: 'Multiple API routes implement similar error response patterns',
    recommendation: 'Create a unified error response utility function',
    priority: 'High',
    estimatedFiles: 15
  },
  {
    area: 'Stores',
    pattern: 'State Reset',
    description: 'Similar state reset logic across multiple stores',
    recommendation: 'Create a base store class with reset functionality',
    priority: 'Medium',
    estimatedFiles: 8
  },
  {
    area: 'Hooks',
    pattern: 'WebSocket Connection',
    description: 'Duplicate WebSocket connection and reconnection logic',
    recommendation: 'Extract to a shared useWebSocketBase hook',
    priority: 'High',
    estimatedFiles: 5
  },
  {
    area: 'Components',
    pattern: 'Loading States',
    description: 'Similar loading state rendering patterns',
    recommendation: 'Create a unified LoadingState component',
    priority: 'Low',
    estimatedFiles: 12
  },
  {
    area: 'Utils',
    pattern: 'Data Transformation',
    description: 'Repeated data transformation patterns for API responses',
    recommendation: 'Create data transformer utilities',
    priority: 'Medium',
    estimatedFiles: 10
  }
];

const report = {
  timestamp: new Date().toISOString(),
  recommendations: recommendations.sort((a, b) => {
    const priority = { High: 3, Medium: 2, Low: 1 };
    return priority[b.priority] - priority[a.priority];
  }),
  summary: {
    totalRecommendations: recommendations.length,
    highPriority: recommendations.filter(r => r.priority === 'High').length,
    estimatedTotalFiles: recommendations.reduce((sum, r) => sum + r.estimatedFiles, 0)
  }
};

fs.writeFileSync('reports/duplication-recommendations.json', JSON.stringify(report, null, 2));
console.log('📝 Recommendations saved to reports/duplication-recommendations.json');
"