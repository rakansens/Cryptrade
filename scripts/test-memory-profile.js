#!/usr/bin/env node

/**
 * Memory profiling script for Jest tests
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class MemoryProfiler {
  constructor() {
    this.samples = [];
    this.testFiles = [];
    this.results = {
      baseline: null,
      peak: null,
      average: null,
      tests: {},
    };
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      timestamp: Date.now(),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB
    };
  }

  /**
   * Run a single test file and profile memory
   */
  async profileTestFile(testFile) {
    console.log(`📊 Profiling ${testFile}...`);
    
    const startMemory = this.getMemoryUsage();
    const startTime = Date.now();
    
    try {
      // Run test with memory tracking
      const output = execSync(
        `node --expose-gc ${path.join(__dirname, 'jest-memory-fix.js')} ${testFile} --silent`,
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            NODE_OPTIONS: '--max-old-space-size=4096 --expose-gc',
            FORCE_COLOR: '0',
          },
        }
      );
      
      const endMemory = this.getMemoryUsage();
      const duration = Date.now() - startTime;
      
      // Parse test count from output
      const testCountMatch = output.match(/Tests:\s+(\d+)\s+passed/);
      const testCount = testCountMatch ? parseInt(testCountMatch[1]) : 0;
      
      const result = {
        file: testFile,
        success: true,
        duration,
        testCount,
        memory: {
          start: startMemory,
          end: endMemory,
          growth: endMemory.heapUsed - startMemory.heapUsed,
          peak: endMemory.heapUsed,
        },
      };
      
      this.results.tests[testFile] = result;
      return result;
      
    } catch (error) {
      const endMemory = this.getMemoryUsage();
      const duration = Date.now() - startTime;
      
      const result = {
        file: testFile,
        success: false,
        duration,
        error: error.message,
        memory: {
          start: startMemory,
          end: endMemory,
          growth: endMemory.heapUsed - startMemory.heapUsed,
          peak: endMemory.heapUsed,
        },
      };
      
      this.results.tests[testFile] = result;
      return result;
    }
  }

  /**
   * Find test files to profile
   */
  findTestFiles() {
    const testDirs = [
      'tests/unit/lib/services',
      'tests/unit/lib/errors',
      'tests/unit/lib/mastra',
    ];
    
    const files = [];
    for (const dir of testDirs) {
      const fullPath = path.join(__dirname, '..', dir);
      if (fs.existsSync(fullPath)) {
        const dirFiles = fs.readdirSync(fullPath)
          .filter(f => f.endsWith('.test.ts') || f.endsWith('.test.js'))
          .map(f => path.join(dir, f))
          .slice(0, 5); // Limit to 5 files per directory
        files.push(...dirFiles);
      }
    }
    
    return files;
  }

  /**
   * Run memory profiling
   */
  async run() {
    console.log('🚀 Starting memory profiling...\n');
    
    // Get baseline memory
    if (global.gc) global.gc();
    this.results.baseline = this.getMemoryUsage();
    
    // Find test files
    this.testFiles = this.findTestFiles();
    console.log(`Found ${this.testFiles.length} test files to profile\n`);
    
    // Profile each test file
    for (const testFile of this.testFiles) {
      await this.profileTestFile(testFile);
      
      // Force GC between tests
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Calculate statistics
    this.calculateStats();
    
    // Generate report
    this.generateReport();
  }

  /**
   * Calculate memory statistics
   */
  calculateStats() {
    const allMemoryUsage = Object.values(this.results.tests)
      .map(t => t.memory.peak);
    
    if (allMemoryUsage.length > 0) {
      this.results.peak = Math.max(...allMemoryUsage);
      this.results.average = Math.round(
        allMemoryUsage.reduce((a, b) => a + b, 0) / allMemoryUsage.length
      );
    }
    
    // Find tests with highest memory usage
    this.results.topMemoryUsers = Object.entries(this.results.tests)
      .sort((a, b) => b[1].memory.peak - a[1].memory.peak)
      .slice(0, 5)
      .map(([file, data]) => ({
        file,
        peak: data.memory.peak,
        growth: data.memory.growth,
      }));
  }

  /**
   * Generate memory profiling report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.testFiles.length,
        successful: Object.values(this.results.tests).filter(t => t.success).length,
        failed: Object.values(this.results.tests).filter(t => !t.success).length,
        baselineMemoryMB: this.results.baseline.heapUsed,
        peakMemoryMB: this.results.peak,
        averageMemoryMB: this.results.average,
      },
      topMemoryUsers: this.results.topMemoryUsers,
      details: this.results.tests,
    };
    
    // Console output
    console.log('\n📊 Memory Profiling Results');
    console.log('==========================');
    console.log(`Total tests profiled: ${report.summary.totalTests}`);
    console.log(`Successful: ${report.summary.successful}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Baseline memory: ${report.summary.baselineMemoryMB}MB`);
    console.log(`Peak memory: ${report.summary.peakMemoryMB}MB`);
    console.log(`Average memory: ${report.summary.averageMemoryMB}MB`);
    
    if (this.results.topMemoryUsers.length > 0) {
      console.log('\n🔝 Top Memory Users:');
      this.results.topMemoryUsers.forEach((test, i) => {
        console.log(`${i + 1}. ${test.file}`);
        console.log(`   Peak: ${test.peak}MB, Growth: ${test.growth}MB`);
      });
    }
    
    // Write JSON report
    const reportPath = path.join(__dirname, '../memory-profile-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📁 Full report saved to: ${reportPath}`);
    
    // Check for concerning memory usage
    if (this.results.peak > 1000) {
      console.log('\n⚠️ WARNING: Peak memory usage exceeded 1GB!');
      process.exit(1);
    }
    
    const highGrowthTests = Object.values(this.results.tests)
      .filter(t => t.memory.growth > 100);
    
    if (highGrowthTests.length > 0) {
      console.log('\n⚠️ WARNING: Some tests have high memory growth (>100MB):');
      highGrowthTests.forEach(t => {
        console.log(`- ${t.file}: ${t.memory.growth}MB`);
      });
    }
  }
}

// Main execution
async function main() {
  const profiler = new MemoryProfiler();
  
  try {
    await profiler.run();
  } catch (error) {
    console.error('❌ Error during memory profiling:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { MemoryProfiler };