#!/usr/bin/env node

/**
 * CSP Violation Monitoring Script
 * 
 * Monitors CSP violations in real-time during development
 */

import { createServer } from 'http';
import chalk from 'chalk';

const PORT = process.env.CSP_MONITOR_PORT || 3001;

interface ViolationReport {
  timestamp: string;
  documentUri: string;
  violatedDirective: string;
  effectiveDirective: string;
  blockedUri: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  sample?: string;
}

const violations: ViolationReport[] = [];

function formatViolation(violation: ViolationReport): string {
  const lines = [
    chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    chalk.red('CSP Violation Detected'),
    chalk.yellow(`Time: ${violation.timestamp}`),
    chalk.cyan(`Page: ${violation.documentUri}`),
    chalk.magenta(`Directive: ${violation.violatedDirective}`),
    chalk.white(`Blocked: ${violation.blockedUri}`),
  ];

  if (violation.sourceFile) {
    lines.push(chalk.gray(`Source: ${violation.sourceFile}:${violation.lineNumber}:${violation.columnNumber}`));
  }

  if (violation.sample) {
    lines.push(chalk.gray(`Sample: ${violation.sample}`));
  }

  return lines.join('\n');
}

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/csp-report') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const report = JSON.parse(body);
        const cspReport = report['csp-report'];
        
        if (cspReport) {
          const violation: ViolationReport = {
            timestamp: new Date().toISOString(),
            documentUri: cspReport['document-uri'],
            violatedDirective: cspReport['violated-directive'],
            effectiveDirective: cspReport['effective-directive'],
            blockedUri: cspReport['blocked-uri'],
            sourceFile: cspReport['source-file'],
            lineNumber: cspReport['line-number'],
            columnNumber: cspReport['column-number'],
            sample: cspReport['script-sample'],
          };
          
          violations.push(violation);
          console.log(formatViolation(violation));
        }
        
        res.writeHead(204);
        res.end();
      } catch (error) {
        res.writeHead(400);
        res.end('Invalid report');
      }
    });
  } else if (req.method === 'GET' && req.url === '/violations') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      count: violations.length,
      violations: violations.slice(-50), // Last 50 violations
    }, null, 2));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(chalk.green(`
╔════════════════════════════════════════════════════╗
║           CSP Violation Monitor Started            ║
╚════════════════════════════════════════════════════╝

${chalk.cyan('Monitor URL:')} http://localhost:${PORT}/csp-report
${chalk.cyan('View violations:')} http://localhost:${PORT}/violations

${chalk.yellow('To use this monitor, add the following to your CSP:')}
${chalk.gray(`report-uri http://localhost:${PORT}/csp-report`)}

${chalk.green('Waiting for CSP violations...')}
`));
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nShutting down CSP monitor...'));
  server.close(() => {
    console.log(chalk.green('Monitor stopped.'));
    process.exit(0);
  });
});