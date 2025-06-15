#!/bin/bash

# Script to help migrate old __tests__ directories to new test structure
# Usage: ./scripts/migrate-old-test-dirs.sh

echo "🔍 Finding old __tests__ directories..."
echo ""

# Find all __tests__ directories excluding node_modules
OLD_TEST_DIRS=$(find . -type d -name "__tests__" -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./coverage/*" | sort)

if [ -z "$OLD_TEST_DIRS" ]; then
    echo "✅ No old __tests__ directories found!"
    exit 0
fi

echo "Found the following __tests__ directories:"
echo "$OLD_TEST_DIRS"
echo ""

# Function to suggest new location
suggest_new_location() {
    local old_path=$1
    local parent_dir=$(dirname "$old_path")
    
    # Remove leading ./ and trailing __tests__
    local clean_path=${parent_dir#./}
    
    # Determine test type based on path
    if [[ "$clean_path" == *"api"* ]]; then
        echo "tests/unit/api/${clean_path#app/api/}"
    elif [[ "$clean_path" == "lib/"* ]]; then
        echo "tests/unit/${clean_path}"
    elif [[ "$clean_path" == "components/"* ]]; then
        echo "tests/unit/${clean_path}"
    elif [[ "$clean_path" == "hooks/"* ]]; then
        echo "tests/unit/${clean_path}"
    else
        echo "tests/unit/${clean_path}"
    fi
}

echo "Suggested migrations:"
echo "===================="

for dir in $OLD_TEST_DIRS; do
    new_location=$(suggest_new_location "$dir")
    echo ""
    echo "Old: $dir"
    echo "New: $new_location"
    
    # List files in the directory
    if [ -d "$dir" ]; then
        files=$(find "$dir" -type f -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$files" -gt 0 ]; then
            echo "Files to move: $files test file(s)"
        else
            echo "No test files found (directory might contain only helpers)"
        fi
    fi
done

echo ""
echo "To migrate a directory manually, use:"
echo "mkdir -p <new-location> && mv <old-location>/* <new-location>/"
echo ""
echo "Note: After moving files, update any relative imports and run 'npm run test:validate'!"