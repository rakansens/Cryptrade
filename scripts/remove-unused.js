#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get TypeScript errors
const errors = execSync('npm run typecheck 2>&1 || true', { encoding: 'utf-8' });
const lines = errors.split('\n');

// Parse TS6133 errors (unused variables)
const unusedErrors = lines
  .filter(line => line.includes('TS6133'))
  .map(line => {
    const match = line.match(/(.+?)\((\d+),(\d+)\): error TS6133: '(.+?)' is declared but its value is never read\./);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        variable: match[4]
      };
    }
    return null;
  })
  .filter(Boolean);

// Group by file
const errorsByFile = {};
unusedErrors.forEach(error => {
  if (!errorsByFile[error.file]) {
    errorsByFile[error.file] = [];
  }
  errorsByFile[error.file].push(error);
});

// Process each file
Object.entries(errorsByFile).forEach(([filePath, errors]) => {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Sort errors by line number in reverse order to avoid offset issues
  errors.sort((a, b) => b.line - a.line);
  
  errors.forEach(error => {
    const lineIndex = error.line - 1;
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      
      // Handle imports
      if (line.includes('import')) {
        // Check if it's a destructured import
        const destructuredMatch = line.match(/import\s*{\s*([^}]+)\s*}\s*from/);
        if (destructuredMatch) {
          const imports = destructuredMatch[1].split(',').map(s => s.trim());
          const filteredImports = imports.filter(imp => {
            const impName = imp.split(' as ')[0].trim();
            return impName !== error.variable;
          });
          
          if (filteredImports.length === 0) {
            // Remove entire import line
            lines[lineIndex] = '';
          } else {
            // Update import line
            const newImportList = filteredImports.join(', ');
            lines[lineIndex] = line.replace(destructuredMatch[1], newImportList);
          }
        } else if (line.includes(`import ${error.variable}`)) {
          // Remove entire import line
          lines[lineIndex] = '';
        }
      } else {
        // Handle variable declarations
        const patterns = [
          new RegExp(`const\\s+${error.variable}\\s*=`),
          new RegExp(`let\\s+${error.variable}\\s*=`),
          new RegExp(`var\\s+${error.variable}\\s*=`),
          new RegExp(`,\\s*${error.variable}\\s*[,\\)]`),
          new RegExp(`\\(\\s*${error.variable}\\s*,`),
          new RegExp(`,\\s*${error.variable}\\s*=`),
        ];
        
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            // For destructuring assignments, try to remove just the variable
            if (line.includes('{') && line.includes('}')) {
              const destructMatch = line.match(/{\s*([^}]+)\s*}/);
              if (destructMatch) {
                const vars = destructMatch[1].split(',').map(s => s.trim());
                const filteredVars = vars.filter(v => {
                  const varName = v.split(':')[0].split('=')[0].trim();
                  return varName !== error.variable;
                });
                if (filteredVars.length === 0 && line.includes('const') && line.includes('=')) {
                  lines[lineIndex] = '';
                } else {
                  lines[lineIndex] = line.replace(destructMatch[1], filteredVars.join(', '));
                }
              }
            } else {
              // For simple declarations, comment out or remove
              lines[lineIndex] = '';
            }
            break;
          }
        }
      }
    }
  });
  
  // Clean up empty lines
  content = lines
    .filter((line, index) => {
      // Keep line if it's not empty or if previous/next line has content
      return line.trim() !== '' || 
             (index > 0 && lines[index - 1].trim() !== '') ||
             (index < lines.length - 1 && lines[index + 1].trim() !== '');
    })
    .join('\n');
  
  fs.writeFileSync(filePath, content);
  console.log(`Processed ${filePath}: removed ${errors.length} unused variables`);
});

console.log(`\nTotal files processed: ${Object.keys(errorsByFile).length}`);
console.log(`Total unused variables removed: ${unusedErrors.length}`);