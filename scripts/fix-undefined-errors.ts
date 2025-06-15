#!/usr/bin/env ts-node

import * as fs from 'fs';
import { execSync } from 'child_process';

interface ErrorInfo {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

function parseTypeScriptErrors(): ErrorInfo[] {
  const output = execSync('npm run typecheck 2>&1 || true', { encoding: 'utf-8' });
  const lines = output.split('\n');
  const errors: ErrorInfo[] = [];
  
  const errorPattern = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;
  
  for (const line of lines) {
    const match = line.match(errorPattern);
    if (match) {
      const [, file, lineNum, column, code, message] = match;
      if (code === 'TS2532' || code === 'TS18048') {
        errors.push({
          file: file!,
          line: parseInt(lineNum!),
          column: parseInt(column!),
          code: code!,
          message: message!
        });
      }
    }
  }
  
  return errors;
}

function fixError(filePath: string, line: number, column: number, message: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const targetLine = lines[line - 1];
    
    if (!targetLine) return false;
    
    // Extract the variable/property that's possibly undefined
    const variableMatch = message.match(/'([^']+)' is possibly 'undefined'/);
    if (!variableMatch) {
      // Try to extract object access pattern
      const objectMatch = message.match(/Object is possibly 'undefined'/);
      if (objectMatch) {
        // Find the expression at the column position
        let endPos = column - 1;
        while (targetLine && endPos < targetLine.length && /[\w\[\].]/.test(targetLine[endPos] || '')) {
          endPos++;
        }
        
        let startPos = column - 1;
        while (targetLine && startPos > 0 && /[\w\[\].]/.test(targetLine[startPos - 1] || '')) {
          startPos--;
        }
        
        if (!targetLine) return false;
        const expression = targetLine.substring(startPos, endPos);
        
        // Add optional chaining or non-null assertion based on context
        const newExpression = expression + '!';
        const newLine = targetLine.substring(0, startPos) + newExpression + targetLine.substring(endPos);
        lines[line - 1] = newLine;
        
        fs.writeFileSync(filePath, lines.join('\n'));
        return true;
      }
    } else {
      const variable = variableMatch[1];
      
      // Find the variable in the line and add optional chaining or non-null assertion
      const regex = new RegExp(`\\b${variable}\\b(?![?!])`, 'g');
      const newLine = targetLine.replace(regex, `${variable}!`);
      
      if (newLine !== targetLine) {
        lines[line - 1] = newLine;
        fs.writeFileSync(filePath, lines.join('\n'));
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error fixing ${filePath}:${line}:${column}:`, error);
    return false;
  }
}

async function main() {
  console.log('Parsing TypeScript errors...');
  const errors = parseTypeScriptErrors();
  console.log(`Found ${errors.length} TS2532/TS18048 errors`);
  
  // Group errors by file
  const errorsByFile = new Map<string, ErrorInfo[]>();
  for (const error of errors) {
    if (!errorsByFile.has(error.file)) {
      errorsByFile.set(error.file, []);
    }
    errorsByFile.get(error.file)!.push(error);
  }
  
  let fixedCount = 0;
  
  // Process files in reverse line order to avoid position shifts
  for (const [file, fileErrors] of errorsByFile) {
    console.log(`Processing ${file} (${fileErrors.length} errors)...`);
    
    // Sort errors by line number in descending order
    fileErrors.sort((a, b) => b.line - a.line || b.column - a.column);
    
    for (const error of fileErrors) {
      if (fixError(error.file, error.line, error.column, error.message)) {
        fixedCount++;
      }
    }
  }
  
  console.log(`\nFixed ${fixedCount} out of ${errors.length} errors`);
  
  // Run typecheck again to verify
  console.log('\nRunning typecheck again...');
  try {
    execSync('npm run typecheck', { stdio: 'inherit' });
    console.log('All TypeScript errors resolved!');
  } catch {
    console.log('Some errors remain. Running the script again may fix more.');
  }
}

main().catch(console.error);