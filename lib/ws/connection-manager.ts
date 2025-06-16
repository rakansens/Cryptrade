/**
 * WebSocket Connection Manager
 * Provides centralized management of WebSocket connections with proper cleanup
 */

import { logger } from '@/lib/utils/logger';

export interface ManagedConnection {
  url: string;
  ws: WebSocket | null;
  reconnectTimeout?: NodeJS.Timeout;
  heartbeatInterval?: NodeJS.Timeout;
  listeners: Array<{
    event: string;
    handler: EventListener;
  }>;
  isDestroyed: boolean;
}

export class ConnectionManager {
  private connections = new Map<string, ManagedConnection>();
  private globalCleanupHandlers: Array<() => void> = [];
  private isDestroyed = false;

  constructor() {
    // Register global cleanup handlers
    if (typeof window !== 'undefined') {
      const cleanup = () => this.destroyAll();
      
      window.addEventListener('beforeunload', cleanup);
      window.addEventListener('unload', cleanup);
      
      this.globalCleanupHandlers.push(() => {
        window.removeEventListener('beforeunload', cleanup);
        window.removeEventListener('unload', cleanup);
      });
      
      // Handle page visibility changes (important for mobile)
      const visibilityHandler = () => {
        if (document.hidden) {
          this.pauseAll();
        } else {
          this.resumeAll();
        }
      };
      
      document.addEventListener('visibilitychange', visibilityHandler);
      this.globalCleanupHandlers.push(() => {
        document.removeEventListener('visibilitychange', visibilityHandler);
      });
    }
  }

  /**
   * Create a managed WebSocket connection
   */
  createConnection(id: string, url: string): WebSocket | null {
    if (this.isDestroyed) {
      logger.warn('[ConnectionManager] Manager is destroyed, not creating connection', { id });
      return null;
    }

    // Cleanup existing connection
    this.closeConnection(id);

    const connection: ManagedConnection = {
      url,
      ws: null,
      listeners: [],
      isDestroyed: false,
    };

    try {
      const ws = new WebSocket(url);
      connection.ws = ws;
      this.connections.set(id, connection);
      
      logger.info('[ConnectionManager] Created connection', { id, url });
      return ws;
    } catch (error) {
      logger.error('[ConnectionManager] Failed to create connection', { id, url, error });
      return null;
    }
  }

  /**
   * Add event listener with automatic cleanup tracking
   */
  addEventListener(
    id: string, 
    event: string, 
    handler: EventListener
  ): void {
    const connection = this.connections.get(id);
    if (!connection?.ws) return;

    connection.ws.addEventListener(event, handler);
    connection.listeners.push({ event, handler });
  }

  /**
   * Set reconnect timeout with automatic cleanup
   */
  setReconnectTimeout(
    id: string, 
    callback: () => void, 
    delay: number
  ): void {
    const connection = this.connections.get(id);
    if (!connection || connection.isDestroyed) return;

    // Clear existing timeout
    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout);
    }

    connection.reconnectTimeout = setTimeout(() => {
      if (!connection.isDestroyed) {
        callback();
      }
      connection.reconnectTimeout = undefined;
    }, delay);
  }

  /**
   * Set heartbeat interval with automatic cleanup
   */
  setHeartbeatInterval(
    id: string, 
    callback: () => void, 
    interval: number
  ): void {
    const connection = this.connections.get(id);
    if (!connection || connection.isDestroyed) return;

    // Clear existing interval
    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
    }

    connection.heartbeatInterval = setInterval(() => {
      if (!connection.isDestroyed) {
        callback();
      }
    }, interval);
  }

  /**
   * Close a specific connection with full cleanup
   */
  closeConnection(id: string): void {
    const connection = this.connections.get(id);
    if (!connection) return;

    logger.info('[ConnectionManager] Closing connection', { id });
    
    connection.isDestroyed = true;

    // Clear timers
    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout);
      connection.reconnectTimeout = undefined;
    }

    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
      connection.heartbeatInterval = undefined;
    }

    // Remove event listeners
    if (connection.ws) {
      connection.listeners.forEach(({ event, handler }) => {
        connection.ws?.removeEventListener(event, handler);
      });
      connection.listeners = [];

      // Clear built-in handlers
      connection.ws.onopen = null;
      connection.ws.onclose = null;
      connection.ws.onmessage = null;
      connection.ws.onerror = null;

      // Close the WebSocket
      if (connection.ws.readyState === WebSocket.OPEN || 
          connection.ws.readyState === WebSocket.CONNECTING) {
        connection.ws.close();
      }
      
      connection.ws = null;
    }

    this.connections.delete(id);
  }

  /**
   * Pause all connections (for page visibility changes)
   */
  pauseAll(): void {
    logger.info('[ConnectionManager] Pausing all connections');
    
    this.connections.forEach((connection, id) => {
      // Clear heartbeats but keep connections
      if (connection.heartbeatInterval) {
        clearInterval(connection.heartbeatInterval);
        connection.heartbeatInterval = undefined;
      }
    });
  }

  /**
   * Resume all connections
   */
  resumeAll(): void {
    logger.info('[ConnectionManager] Resuming all connections');
    
    // Connections will need to re-establish their heartbeats
    // This is handled by the individual connection logic
  }

  /**
   * Destroy all connections and cleanup
   */
  destroyAll(): void {
    if (this.isDestroyed) return;
    
    logger.info('[ConnectionManager] Destroying all connections', { 
      count: this.connections.size 
    });
    
    this.isDestroyed = true;

    // Close all connections
    const connectionIds = Array.from(this.connections.keys());
    connectionIds.forEach(id => this.closeConnection(id));

    // Clear the map
    this.connections.clear();

    // Remove global handlers
    this.globalCleanupHandlers.forEach(handler => handler());
    this.globalCleanupHandlers = [];
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    activeConnections: number;
    connections: Array<{
      id: string;
      url: string;
      readyState: number;
      hasReconnectTimeout: boolean;
      hasHeartbeat: boolean;
    }>;
  } {
    const connections = Array.from(this.connections.entries()).map(([id, conn]) => ({
      id,
      url: conn.url,
      readyState: conn.ws?.readyState ?? WebSocket.CLOSED,
      hasReconnectTimeout: !!conn.reconnectTimeout,
      hasHeartbeat: !!conn.heartbeatInterval,
    }));

    return {
      activeConnections: connections.filter(c => 
        c.readyState === WebSocket.OPEN
      ).length,
      connections,
    };
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();