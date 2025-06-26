#!/usr/bin/env node

/**
 * Generate leak detection report from test output
 */

const fs = require('fs');
const path = require('path');

class LeakReportGenerator {
  constructor() {
    this.leaks = [];
    this.warnings = [];
    this.stats = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      memoryLeaks: 0,
      timerLeaks: 0,
      handleLeaks: 0,
    };
  }

  /**
   * Parse test output for leak indicators
   */
  parseTestOutput(output) {
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Check for force exit warning
      if (line.includes('Force exiting Jest')) {
        this.warnings.push('Jest had to force exit - likely due to open handles');
        this.stats.handleLeaks++;
      }
      
      // Check for timer warnings
      if (line.includes('timer(s) still active')) {
        const match = line.match(/(\d+) timer\(s\) still active/);
        if (match) {
          this.leaks.push({
            type: 'timer',
            count: parseInt(match[1]),
            message: line,
          });
          this.stats.timerLeaks += parseInt(match[1]);
        }
      }
      
      // Check for memory growth warnings
      if (line.includes('memory grew by')) {
        const match = line.match(/memory grew by (\d+)MB/);
        if (match) {
          this.leaks.push({
            type: 'memory',
            size: parseInt(match[1]),
            message: line,
          });
          this.stats.memoryLeaks++;
        }
      }
      
      // Check for unhandled promises
      if (line.includes('UnhandledPromiseRejection')) {
        this.leaks.push({
          type: 'promise',
          message: line,
        });
      }
      
      // Parse test stats
      if (line.includes('Tests:')) {
        const passMatch = line.match(/(\d+) passed/);
        const failMatch = line.match(/(\d+) failed/);
        const totalMatch = line.match(/(\d+) total/);
        
        if (passMatch) this.stats.passedTests = parseInt(passMatch[1]);
        if (failMatch) this.stats.failedTests = parseInt(failMatch[1]);
        if (totalMatch) this.stats.totalTests = parseInt(totalMatch[1]);
      }
    }
  }

  /**
   * Check for WebSocket leaks
   */
  checkWebSocketLeaks() {
    try {
      // Check if MockWebSocket has tracking info
      const mockWsPath = path.join(__dirname, '../tests/__mocks__/websocket.ts');
      if (fs.existsSync(mockWsPath)) {
        // In a real implementation, we'd parse runtime data
        // For now, we'll add a placeholder
        this.warnings.push('WebSocket leak detection requires runtime analysis');
      }
    } catch (error) {
      console.error('Error checking WebSocket leaks:', error);
    }
  }

  /**
   * Generate the report
   */
  generateReport() {
    const hasLeaks = this.leaks.length > 0;
    const timestamp = new Date().toISOString();
    
    let report = `# Leak Detection Report
Generated at: ${timestamp}

## Summary
- Total Tests: ${this.stats.totalTests}
- Passed: ${this.stats.passedTests}
- Failed: ${this.stats.failedTests}
- Memory Leaks: ${this.stats.memoryLeaks}
- Timer Leaks: ${this.stats.timerLeaks}
- Handle Leaks: ${this.stats.handleLeaks}

## Status: ${hasLeaks ? '❌ LEAK DETECTED' : '✅ No leaks detected'}

`;

    if (this.warnings.length > 0) {
      report += `## Warnings\n`;
      this.warnings.forEach(warning => {
        report += `- ⚠️ ${warning}\n`;
      });
      report += '\n';
    }

    if (this.leaks.length > 0) {
      report += `## Detected Leaks\n`;
      
      // Group leaks by type
      const leaksByType = this.leaks.reduce((acc, leak) => {
        if (!acc[leak.type]) acc[leak.type] = [];
        acc[leak.type].push(leak);
        return acc;
      }, {});
      
      for (const [type, leaks] of Object.entries(leaksByType)) {
        report += `\n### ${type.charAt(0).toUpperCase() + type.slice(1)} Leaks\n`;
        leaks.forEach(leak => {
          if (leak.type === 'timer') {
            report += `- ${leak.count} timer(s) not cleared\n`;
          } else if (leak.type === 'memory') {
            report += `- Memory grew by ${leak.size}MB\n`;
          } else {
            report += `- ${leak.message}\n`;
          }
        });
      }
    }

    report += `
## Recommendations
`;

    if (this.stats.timerLeaks > 0) {
      report += `- Clear all timers in afterEach() or afterAll() hooks
`;
    }

    if (this.stats.memoryLeaks > 0) {
      report += `- Check for memory leaks in long-running operations
- Ensure proper cleanup of large objects and arrays
`;
    }

    if (this.stats.handleLeaks > 0) {
      report += `- Use --detectOpenHandles to identify open handles
- Ensure all servers, database connections, and file handles are closed
`;
    }

    if (!hasLeaks) {
      report += `- Continue monitoring for leaks in future test runs
- Consider adding more comprehensive leak detection tests
`;
    }

    return report;
  }

  /**
   * Read test output from stdin or file
   */
  async readTestOutput() {
    // Try to read from test-results.txt if it exists
    const testResultsPath = path.join(__dirname, '../test-results.txt');
    if (fs.existsSync(testResultsPath)) {
      return fs.readFileSync(testResultsPath, 'utf8');
    }
    
    // Otherwise read from stdin
    return new Promise((resolve) => {
      let data = '';
      process.stdin.on('data', chunk => data += chunk);
      process.stdin.on('end', () => resolve(data));
    });
  }
}

// Main execution
async function main() {
  const generator = new LeakReportGenerator();
  
  try {
    // Read test output
    const testOutput = await generator.readTestOutput();
    
    // Parse output
    generator.parseTestOutput(testOutput);
    
    // Additional checks
    generator.checkWebSocketLeaks();
    
    // Generate and output report
    const report = generator.generateReport();
    console.log(report);
    
    // Exit with error if leaks detected
    if (generator.leaks.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error generating leak report:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { LeakReportGenerator };