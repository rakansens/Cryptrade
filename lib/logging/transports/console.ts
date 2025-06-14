/**
 * Console Transport for Unified Logger
 * 
 * Enhanced console transport with formatting and filtering
 */

import type { IUnifiedTransport, UnifiedLogEntry, UnifiedLoggerConfig } from '../unified-logger';

export class ConsoleTransport implements IUnifiedTransport {
  private config: UnifiedLoggerConfig;

  constructor(config: UnifiedLoggerConfig) {
    this.config = config;
  }

  configure(config: Partial<UnifiedLoggerConfig>): void {
    Object.assign(this.config, config);
  }

  log(entry: UnifiedLogEntry): void {
    if (!this.config.enableConsole) return;
    
    const formatted = this.formatMessage(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(formatted, ...(entry.error ? [entry.error] : []));
        break;
      case 'info':
        console.log(formatted, ...(entry.error ? [entry.error] : []));
        break;
      case 'warn':
        console.warn(formatted, ...(entry.error ? [entry.error] : []));
        break;
      case 'error':
        console.error(formatted, ...(entry.error ? [entry.error] : []));
        break;
      case 'critical':
        console.error(`🚨 ${formatted}`, ...(entry.error ? [entry.error] : []));
        break;
    }
  }

  private formatMessage(entry: UnifiedLogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(8);
    const environment = entry.environment.padEnd(11);
    
    let formatted = `[${timestamp}] [${level}] [${environment}]`;
    
    // Add context information
    if (entry.agentName) {
      formatted += ` [${entry.agentName}]`;
    }
    
    if (entry.toolName) {
      formatted += ` [${entry.toolName}]`;
    }
    
    formatted += ` ${entry.message}`;
    
    // Add metadata if present
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      if (this.config.format === 'json') {
        formatted += ` ${JSON.stringify(entry.meta)}`;
      } else {
        // Text format - simplified metadata display
        const metaStr = Object.entries(entry.meta)
          .filter(([key, value]) => value !== undefined)
          .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
          .join(' ');
        if (metaStr) {
          formatted += ` [${metaStr}]`;
        }
      }
    }
    
    // Add duration if present
    if (entry.duration !== undefined) {
      formatted += ` (${entry.duration}ms)`;
    }
    
    // Add correlation ID if present
    if (entry.correlationId) {
      formatted += ` {${entry.correlationId}}`;
    }
    
    return formatted;
  }
}