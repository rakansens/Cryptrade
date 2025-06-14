/**
 * Sentry Transport for Unified Logger
 * 
 * Enhanced Sentry integration with error tracking
 */

import type { IUnifiedTransport, UnifiedLogEntry, UnifiedLoggerConfig } from '../unified-logger';

// Minimal Sentry type definitions
interface SentryScope {
  setLevel(level: string): void;
  setTag(key: string, value: string): void;
  setContext(key: string, context: Record<string, unknown>): void;
  setUser(user: { id: string }): void;
  setExtra(key: string, extra: unknown): void;
}

interface SentrySDK {
  withScope(callback: (scope: SentryScope) => void): void;
  captureException(error: unknown): void;
  captureMessage(message: string): void;
  close?(timeout?: number): Promise<boolean>;
}

export class SentryTransport implements IUnifiedTransport {
  private config: UnifiedLoggerConfig;
  private sentryEnabled: boolean;

  constructor(config: UnifiedLoggerConfig) {
    this.config = config;
    this.sentryEnabled = this.checkSentryAvailability();
  }

  configure(config: Partial<UnifiedLoggerConfig>): void {
    Object.assign(this.config, config);
  }

  log(entry: UnifiedLogEntry): void {
    if (!this.sentryEnabled) return;
    
    // Only send errors and critical logs to Sentry
    if (entry.level !== 'error' && entry.level !== 'critical') return;
    
    try {
      this.sendToSentry(entry);
    } catch (error) {
      console.warn('[SentryTransport] Failed to send to Sentry:', error);
    }
  }

  async close(): Promise<void> {
    // Flush any pending Sentry data
    if (this.sentryEnabled && typeof window === 'undefined') {
      try {
        // Server-side Sentry flush
        const Sentry = await this.getSentry();
        if (Sentry?.close) {
          await Sentry.close(2000);
        }
      } catch {
        // Ignore errors during cleanup
      }
    }
  }

  private checkSentryAvailability(): boolean {
    const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    return !!sentryDsn && process.env.ENABLE_SENTRY !== 'false';
  }

  private async getSentry(): Promise<SentrySDK | null> {
    try {
      if (typeof window !== 'undefined') {
        // Browser environment
        return await import('@sentry/nextjs') as unknown as SentrySDK;
      } else {
        // Server environment
        return await import('@sentry/node') as unknown as SentrySDK;
      }
    } catch {
      return null;
    }
  }

  private async sendToSentry(entry: UnifiedLogEntry): Promise<void> {
    const Sentry = await this.getSentry();
    if (!Sentry) {
      // Fallback to console warning if Sentry is not available
      console.warn('[SENTRY STUB] Would send to Sentry:', {
        message: entry.message,
        level: entry.level,
        meta: entry.meta,
        error: entry.error,
        environment: entry.environment,
        tags: entry.tags,
      });
      return;
    }

    // Set context
    Sentry.withScope((scope: SentryScope) => {
      // Set level
      scope.setLevel(this.mapLogLevelToSentryLevel(entry.level));
      
      // Set tags
      scope.setTag('source', entry.source);
      scope.setTag('environment', entry.environment);
      
      if (entry.agentName) {
        scope.setTag('agent', entry.agentName);
      }
      
      if (entry.toolName) {
        scope.setTag('tool', entry.toolName);
      }
      
      if (entry.tags) {
        entry.tags.forEach(tag => scope.setTag('custom', tag));
      }
      
      // Set context
      if (entry.correlationId) {
        scope.setContext('correlation', { id: entry.correlationId });
      }
      
      if (entry.userId) {
        scope.setUser({ id: entry.userId });
      }
      
      if (entry.sessionId) {
        scope.setContext('session', { id: entry.sessionId });
      }
      
      if (entry.duration) {
        scope.setContext('performance', { duration: entry.duration });
      }
      
      // Set extra data
      if (entry.meta) {
        scope.setExtra('metadata', entry.meta);
      }
      
      // Send to Sentry
      if (entry.error) {
        // Send as exception
        Sentry.captureException(entry.error);
      } else {
        // Send as message
        Sentry.captureMessage(entry.message);
      }
    });
  }

  private mapLogLevelToSentryLevel(level: string): string {
    switch (level) {
      case 'debug': return 'debug';
      case 'info': return 'info';
      case 'warn': return 'warning';
      case 'error': return 'error';
      case 'critical': return 'fatal';
      default: return 'info';
    }
  }
}