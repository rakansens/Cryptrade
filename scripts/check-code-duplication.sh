#!/bin/bash
# Code duplication check for pre-commit hook
# This script checks for high-similarity code and provides recommendations

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check if similarity-ts is installed
if ! command -v similarity-ts &> /dev/null; then
    echo -e "${YELLOW}⚠️  similarity-ts not found. Skipping duplication check.${NC}"
    echo "To install: cargo install --git https://github.com/mizchi/similarity --bin similarity-ts"
    exit 0
fi

echo "🔍 Checking for code duplication..."

# Run similarity check on staged files only (if possible)
# Otherwise run on all files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E "\.(ts|tsx|js|jsx)$" | tr '\n' ' ')

if [ -z "$STAGED_FILES" ]; then
    echo "No TypeScript/JavaScript files staged. Skipping duplication check."
    exit 0
fi

# Run similarity-ts
similarity-ts . -e ts,tsx,js,jsx -m 8 -t 0.90 > .duplication-check.tmp 2>&1

# Check for very high similarity (Score 150+)
HIGH_SCORES=$(grep -E "Score: [1-9][5-9][0-9]|Score: [2-9][0-9][0-9]" .duplication-check.tmp)

if [ ! -z "$HIGH_SCORES" ]; then
    echo -e "${YELLOW}⚠️  High similarity code detected!${NC}"
    echo ""
    echo "Top duplicates found:"
    echo "$HIGH_SCORES" | head -5
    echo ""
    echo -e "${YELLOW}Consider using existing base components:${NC}"
    echo "  • useEventHandlerBase - for event handling patterns"
    echo "  • useChartDataBase - for chart data processing"
    echo "  • useChatProposalBase - for chat proposal handling"
    echo "  • useStreamBase - for streaming/SSE/WebSocket"
    echo ""
    echo "See hooks/shared/README.md for usage examples."
    echo ""
    
    # Ask for confirmation
    read -p "Do you want to continue with the commit anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        rm .duplication-check.tmp
        exit 1
    fi
fi

# Check for moderate similarity (Score 100-149) - just warn
MODERATE_SCORES=$(grep -E "Score: 1[0-4][0-9]" .duplication-check.tmp | head -3)
if [ ! -z "$MODERATE_SCORES" ]; then
    echo -e "${YELLOW}ℹ️  Moderate code similarity detected (Score 100-149)${NC}"
    echo "Consider refactoring if these are in the same domain."
fi

echo -e "${GREEN}✅ Code duplication check passed${NC}"

# Cleanup
rm -f .duplication-check.tmp
exit 0