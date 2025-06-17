#!/bin/bash

# Fix unused variables by prefixing with underscore
echo "Fixing unused variables (TS6133 errors)..."

# Extract files with TS6133 errors
npm run typecheck 2>&1 | grep "TS6133" | cut -d'(' -f1 | sort -u > /tmp/files-with-unused.txt

fixed_count=0

while IFS= read -r file; do
  if [[ -f "$file" ]]; then
    echo "Processing: $file"
    
    # Get line numbers and variable names
    npm run typecheck 2>&1 | grep "$file" | grep "TS6133" | while IFS= read -r error_line; do
      # Extract line number and variable name
      if [[ $error_line =~ $file\(([0-9]+),([0-9]+)\).*\'([^\']+)\' ]]; then
        line_num="${BASH_REMATCH[1]}"
        col_num="${BASH_REMATCH[2]}"
        var_name="${BASH_REMATCH[3]}"
        
        # Skip if already prefixed with underscore
        if [[ ! $var_name =~ ^_ ]]; then
          # Use sed to replace the variable name with _variable_name
          sed -i.bak "${line_num}s/\b${var_name}\b/_${var_name}/g" "$file"
          ((fixed_count++))
          echo "  Fixed: Line $line_num - $var_name -> _$var_name"
        fi
      fi
    done
  fi
done < /tmp/files-with-unused.txt

echo "Fixed $fixed_count unused variables"
rm /tmp/files-with-unused.txt