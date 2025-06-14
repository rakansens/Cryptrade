/**
 * Noop Transport for Unified Logger
 * 
 * Silent transport for testing or disabled logging
 */

import type { IUnifiedTransport, UnifiedLogEntry, UnifiedLoggerConfig } from '../unified-logger';

export class NoopTransport implements IUnifiedTransport {
  configure(_config: Partial<UnifiedLoggerConfig>): void {
    // Do nothing
  }

  log(_entry: UnifiedLogEntry): void {
    // Do nothing - useful for testing or disabling logs
  }

  async close(): Promise<void> {
    // Do nothing
  }
}