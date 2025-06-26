#!/usr/bin/env node

/**
 * Check test coverage against defined thresholds
 */

const fs = require('fs');
const path = require('path');

// Define coverage thresholds
const THRESHOLDS = {
  global: {
    branches: 60,
    functions: 70,
    lines: 75,
    statements: 75,
  },
  critical: {
    // Critical paths that need higher coverage
    'lib/services/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'lib/errors/': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'lib/api/': {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
};

class CoverageChecker {
  constructor() {
    this.coverageSummary = null;
    this.coverageDetail = null;
    this.violations = [];
    this.suggestions = [];
  }

  /**
   * Load coverage data
   */
  loadCoverage() {
    const summaryPath = path.join(__dirname, '../coverage/coverage-summary.json');
    const lcovPath = path.join(__dirname, '../coverage/lcov.info');
    
    if (!fs.existsSync(summaryPath)) {
      throw new Error('Coverage summary not found. Run tests with --coverage first.');
    }
    
    this.coverageSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    
    // Parse lcov for detailed file coverage if needed
    if (fs.existsSync(lcovPath)) {
      this.parseLcov(fs.readFileSync(lcovPath, 'utf8'));
    }
  }

  /**
   * Parse LCOV file for detailed coverage
   */
  parseLcov(lcovContent) {
    this.coverageDetail = {};
    const lines = lcovContent.split('\n');
    let currentFile = null;
    
    for (const line of lines) {
      if (line.startsWith('SF:')) {
        currentFile = line.substring(3);
        this.coverageDetail[currentFile] = {
          lines: { found: 0, hit: 0 },
          functions: { found: 0, hit: 0 },
          branches: { found: 0, hit: 0 },
        };
      } else if (currentFile) {
        if (line.startsWith('FNF:')) {
          this.coverageDetail[currentFile].functions.found = parseInt(line.substring(4));
        } else if (line.startsWith('FNH:')) {
          this.coverageDetail[currentFile].functions.hit = parseInt(line.substring(4));
        } else if (line.startsWith('LF:')) {
          this.coverageDetail[currentFile].lines.found = parseInt(line.substring(3));
        } else if (line.startsWith('LH:')) {
          this.coverageDetail[currentFile].lines.hit = parseInt(line.substring(3));
        } else if (line.startsWith('BRF:')) {
          this.coverageDetail[currentFile].branches.found = parseInt(line.substring(4));
        } else if (line.startsWith('BRH:')) {
          this.coverageDetail[currentFile].branches.hit = parseInt(line.substring(4));
        }
      }
    }
  }

  /**
   * Check global coverage thresholds
   */
  checkGlobalThresholds() {
    const total = this.coverageSummary.total;
    
    for (const [metric, threshold] of Object.entries(THRESHOLDS.global)) {
      const actual = total[metric].pct;
      if (actual < threshold) {
        this.violations.push({
          type: 'global',
          metric,
          threshold,
          actual,
          diff: threshold - actual,
        });
      }
    }
  }

  /**
   * Check critical path coverage
   */
  checkCriticalPaths() {
    for (const [pathPattern, thresholds] of Object.entries(THRESHOLDS.critical)) {
      const matchingFiles = Object.entries(this.coverageSummary)
        .filter(([file]) => file.includes(pathPattern) && file !== 'total');
      
      for (const [file, coverage] of matchingFiles) {
        for (const [metric, threshold] of Object.entries(thresholds)) {
          const actual = coverage[metric].pct;
          if (actual < threshold) {
            this.violations.push({
              type: 'critical',
              file,
              metric,
              threshold,
              actual,
              diff: threshold - actual,
            });
          }
        }
      }
    }
  }

  /**
   * Find uncovered files
   */
  findUncoveredFiles() {
    const uncovered = Object.entries(this.coverageSummary)
      .filter(([file, coverage]) => 
        file !== 'total' && coverage.lines.pct === 0
      )
      .map(([file]) => file);
    
    if (uncovered.length > 0) {
      this.suggestions.push({
        type: 'uncovered',
        message: `Found ${uncovered.length} files with 0% coverage`,
        files: uncovered.slice(0, 10), // Show max 10 files
      });
    }
  }

  /**
   * Generate improvement suggestions
   */
  generateSuggestions() {
    // Find files with low coverage
    const lowCoverage = Object.entries(this.coverageSummary)
      .filter(([file, coverage]) => 
        file !== 'total' && 
        coverage.lines.pct > 0 && 
        coverage.lines.pct < 50
      )
      .sort((a, b) => a[1].lines.pct - b[1].lines.pct)
      .slice(0, 10);
    
    if (lowCoverage.length > 0) {
      this.suggestions.push({
        type: 'low_coverage',
        message: 'Files with coverage below 50%:',
        files: lowCoverage.map(([file, coverage]) => ({
          file,
          coverage: coverage.lines.pct,
        })),
      });
    }
    
    // Suggest focusing on critical paths
    const criticalViolations = this.violations.filter(v => v.type === 'critical');
    if (criticalViolations.length > 0) {
      this.suggestions.push({
        type: 'critical_focus',
        message: 'Critical paths need attention:',
        paths: [...new Set(criticalViolations.map(v => v.file))],
      });
    }
  }

  /**
   * Generate report
   */
  generateReport() {
    console.log('📊 Coverage Threshold Check Report');
    console.log('==================================\n');
    
    // Overall coverage
    const total = this.coverageSummary.total;
    console.log('Overall Coverage:');
    console.log(`  Lines:      ${total.lines.pct}% (${total.lines.covered}/${total.lines.total})`);
    console.log(`  Statements: ${total.statements.pct}% (${total.statements.covered}/${total.statements.total})`);
    console.log(`  Functions:  ${total.functions.pct}% (${total.functions.covered}/${total.functions.total})`);
    console.log(`  Branches:   ${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`);
    console.log('');
    
    // Check results
    if (this.violations.length === 0) {
      console.log('✅ All coverage thresholds met!');
    } else {
      console.log(`❌ Found ${this.violations.length} threshold violations:\n`);
      
      // Group violations
      const globalViolations = this.violations.filter(v => v.type === 'global');
      const criticalViolations = this.violations.filter(v => v.type === 'critical');
      
      if (globalViolations.length > 0) {
        console.log('Global Threshold Violations:');
        globalViolations.forEach(v => {
          console.log(`  - ${v.metric}: ${v.actual.toFixed(2)}% (threshold: ${v.threshold}%, need +${v.diff.toFixed(2)}%)`);
        });
        console.log('');
      }
      
      if (criticalViolations.length > 0) {
        console.log('Critical Path Violations:');
        const byFile = {};
        criticalViolations.forEach(v => {
          if (!byFile[v.file]) byFile[v.file] = [];
          byFile[v.file].push(v);
        });
        
        Object.entries(byFile).forEach(([file, violations]) => {
          console.log(`  ${file}:`);
          violations.forEach(v => {
            console.log(`    - ${v.metric}: ${v.actual.toFixed(2)}% (threshold: ${v.threshold}%)`);
          });
        });
        console.log('');
      }
    }
    
    // Suggestions
    if (this.suggestions.length > 0) {
      console.log('📝 Suggestions for Improvement:');
      this.suggestions.forEach(suggestion => {
        console.log(`\n${suggestion.message}`);
        if (suggestion.files) {
          if (suggestion.type === 'low_coverage') {
            suggestion.files.forEach(f => {
              console.log(`  - ${f.file}: ${f.coverage.toFixed(2)}%`);
            });
          } else {
            suggestion.files.forEach(f => {
              console.log(`  - ${f}`);
            });
          }
        }
        if (suggestion.paths) {
          suggestion.paths.forEach(p => {
            console.log(`  - ${p}`);
          });
        }
      });
    }
    
    // Exit code
    return this.violations.length > 0 ? 1 : 0;
  }

  /**
   * Run the coverage check
   */
  run() {
    try {
      this.loadCoverage();
      this.checkGlobalThresholds();
      this.checkCriticalPaths();
      this.findUncoveredFiles();
      this.generateSuggestions();
      const exitCode = this.generateReport();
      process.exit(exitCode);
    } catch (error) {
      console.error('❌ Error checking coverage:', error.message);
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const checker = new CoverageChecker();
  checker.run();
}

module.exports = { CoverageChecker, THRESHOLDS };