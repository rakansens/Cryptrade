import { Redis, Cluster } from 'ioredis';
import { logger } from '@/lib/logging';

// Helper function for optional env vars not in schema
function getOptionalEnvVar(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

function getOptionalEnvVarInt(key: string, defaultValue: number): number {
  const value = getOptionalEnvVar(key);
  return value ? parseInt(value, 10) : defaultValue;
}

export interface RedisConnectionConfig {
  // Primary connection
  primary: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  // Failover replicas
  replicas?: Array<{
    host: string;
    port: number;
    password?: string;
    db?: number;
  }>;
  // Cluster configuration
  cluster?: Array<{
    host: string;
    port: number;
  }>;
  // Connection options
  options?: {
    maxRetriesPerRequest?: number;
    enableOfflineQueue?: boolean;
    connectTimeout?: number;
    commandTimeout?: number;
    keepAlive?: number;
    retryDelayOnFailover?: number;
    retryDelayOnClusterDown?: number;
    sentinels?: Array<{ host: string; port: number }>;
    name?: string; // Sentinel master name
  };
}

export class RedisConnectionManager {
  private primaryConnection: Redis | null = null;
  private replicaConnections: Redis[] = [];
  private clusterConnection: Cluster | null = null;
  private activeConnection: Redis | Cluster | null = null;
  private currentReplicaIndex = 0;
  private isFailoverActive = false;
  private config: RedisConnectionConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionAttempts = new Map<string, number>();

  constructor(config: RedisConnectionConfig) {
    this.config = {
      ...config,
      options: {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
        keepAlive: 10000,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        ...config.options,
      },
    };
  }

  /**
   * Initialize all connections
   */
  async initialize(): Promise<void> {
    logger.info('[RedisConnectionManager] Initializing connections...');

    // Try cluster mode first if configured
    if (this.config.cluster && this.config.cluster.length > 0) {
      await this.initializeCluster();
      if (this.clusterConnection) {
        this.activeConnection = this.clusterConnection;
        return;
      }
    }

    // Initialize primary connection
    await this.initializePrimary();

    // Initialize replica connections
    if (this.config.replicas && this.config.replicas.length > 0) {
      await this.initializeReplicas();
    }

    // Set active connection
    this.activeConnection = this.primaryConnection;

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Initialize cluster connection
   */
  private async initializeCluster(): Promise<void> {
    try {
      this.clusterConnection = new Cluster(
        this.config.cluster!,
        {
          redisOptions: {
            password: this.config.primary.password,
            ...this.config.options,
          },
          clusterRetryStrategy: (times: number) => {
            const delay = Math.min(times * 100, 3000);
            logger.warn(`[RedisConnectionManager] Cluster retry attempt ${times}, delay: ${delay}ms`);
            return delay;
          },
        }
      );

      await new Promise<void>((resolve, reject) => {
        this.clusterConnection!.once('ready', () => {
          logger.info('[RedisConnectionManager] Cluster connection ready');
          resolve();
        });
        this.clusterConnection!.once('error', reject);
      });

    } catch (error) {
      logger.error('[RedisConnectionManager] Cluster initialization failed:', { error });
      this.clusterConnection = null;
    }
  }

  /**
   * Initialize primary connection
   */
  private async initializePrimary(): Promise<void> {
    const connectionId = `primary:${this.config.primary.host}:${this.config.primary.port}`;
    
    try {
      this.primaryConnection = new Redis({
        ...this.config.primary,
        ...this.config.options,
        retryStrategy: (times: number) => this.retryStrategy(connectionId, times),
      });

      await this.waitForConnection(this.primaryConnection, 'Primary');
      
    } catch (error) {
      logger.error('[RedisConnectionManager] Primary connection failed:', { error });
      throw error;
    }
  }

  /**
   * Initialize replica connections
   */
  private async initializeReplicas(): Promise<void> {
    if (!this.config.replicas) return;

    for (let i = 0; i < this.config.replicas.length; i++) {
      const replica = this.config.replicas[i];
      if (!replica) continue;
      const connectionId = `replica-${i}:${replica.host}:${replica.port}`;
      
      try {
        const connection = new Redis({
          ...replica,
          ...this.config.options,
          retryStrategy: (times: number) => this.retryStrategy(connectionId, times),
        });

        await this.waitForConnection(connection, `Replica ${i}`);
        this.replicaConnections.push(connection);
        
      } catch (error) {
        logger.warn(`[RedisConnectionManager] Replica ${i} connection failed:`, { error });
      }
    }
  }

  /**
   * Wait for connection to be ready
   */
  private async waitForConnection(connection: Redis, name: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${name} connection timeout`));
      }, this.config.options!.connectTimeout!);

      connection.once('ready', () => {
        clearTimeout(timeout);
        logger.info(`[RedisConnectionManager] ${name} connection ready`);
        resolve();
      });

      connection.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Custom retry strategy
   */
  private retryStrategy(connectionId: string, times: number): number | void {
    const attempts = this.connectionAttempts.get(connectionId) || 0;
    this.connectionAttempts.set(connectionId, attempts + 1);

    if (attempts > 5) {
      logger.error(`[RedisConnectionManager] Max retries exceeded for ${connectionId}`);
      return undefined;
    }

    const delay = Math.min(times * 1000, 5000);
    logger.warn(`[RedisConnectionManager] Retrying ${connectionId} in ${delay}ms`);
    return delay;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Perform health check on all connections
   */
  private async performHealthCheck(): Promise<void> {
    const checks = [];

    // Check primary
    if (this.primaryConnection) {
      checks.push(
        this.checkConnection(this.primaryConnection, 'Primary')
          .then(healthy => ({ type: 'primary', healthy }))
      );
    }

    // Check replicas
    this.replicaConnections.forEach((conn, index) => {
      checks.push(
        this.checkConnection(conn, `Replica ${index}`)
          .then(healthy => ({ type: 'replica', index, healthy }))
      );
    });

    // Check cluster
    if (this.clusterConnection) {
      checks.push(
        this.checkClusterHealth()
          .then(healthy => ({ type: 'cluster', healthy }))
      );
    }

    const results = await Promise.all(checks);
    
    // Handle failover if primary is unhealthy
    const primaryResult = results.find(r => r.type === 'primary');
    if (primaryResult && !primaryResult.healthy && !this.isFailoverActive) {
      await this.performFailover();
    }
  }

  /**
   * Check individual connection health
   */
  private async checkConnection(connection: Redis, name: string): Promise<boolean> {
    try {
      const start = Date.now();
      const result = await connection.ping();
      const latency = Date.now() - start;

      if (result === 'PONG') {
        if (latency > 1000) {
          logger.warn(`[RedisConnectionManager] ${name} high latency: ${latency}ms`);
        }
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`[RedisConnectionManager] ${name} health check failed:`, { error });
      return false;
    }
  }

  /**
   * Check cluster health
   */
  private async checkClusterHealth(): Promise<boolean> {
    if (!this.clusterConnection) return false;

    try {
      const nodes = this.clusterConnection.nodes('master');
      const checks = await Promise.all(
        nodes.map(node => node.ping())
      );
      return checks.every(result => result === 'PONG');
    } catch (error) {
      logger.error('[RedisConnectionManager] Cluster health check failed:', { error });
      return false;
    }
  }

  /**
   * Perform failover to replica
   */
  private async performFailover(): Promise<void> {
    if (this.isFailoverActive || this.replicaConnections.length === 0) {
      return;
    }

    this.isFailoverActive = true;
    logger.warn('[RedisConnectionManager] Initiating failover...');

    try {
      // Find healthy replica
      for (let i = 0; i < this.replicaConnections.length; i++) {
        const replicaIndex = (this.currentReplicaIndex + i) % this.replicaConnections.length;
        const replica = this.replicaConnections[replicaIndex];
        if (!replica) continue;
        
        const isHealthy = await this.checkConnection(replica, `Replica ${replicaIndex}`);
        
        if (isHealthy) {
          this.activeConnection = replica;
          this.currentReplicaIndex = replicaIndex;
          logger.info(`[RedisConnectionManager] Failover to Replica ${replicaIndex} successful`);
          
          // Try to restore primary in background
          this.attemptPrimaryRecovery();
          return;
        }
      }

      logger.error('[RedisConnectionManager] No healthy replicas available for failover');
      
    } finally {
      this.isFailoverActive = false;
    }
  }

  /**
   * Attempt to recover primary connection
   */
  private async attemptPrimaryRecovery(): Promise<void> {
    if (!this.primaryConnection) return;

    const checkInterval = setInterval(async () => {
      const isHealthy = await this.checkConnection(this.primaryConnection!, 'Primary');
      
      if (isHealthy) {
        logger.info('[RedisConnectionManager] Primary connection recovered');
        this.activeConnection = this.primaryConnection;
        clearInterval(checkInterval);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get active connection
   */
  getConnection(): Redis | Cluster {
    if (!this.activeConnection) {
      throw new Error('No active Redis connection available');
    }
    return this.activeConnection;
  }

  /**
   * Execute command with automatic failover
   */
  async execute<T>(
    command: (redis: Redis | Cluster) => Promise<T>,
    retries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        const connection = this.getConnection();
        return await command(connection);
      } catch (error) {
        lastError = error as Error;
        logger.error(`[RedisConnectionManager] Command execution failed (attempt ${i + 1}):`, { error });
        
        // Try failover on connection errors
        if (i < retries - 1 && this.shouldFailover(error)) {
          await this.performFailover();
        }
      }
    }

    throw lastError || new Error('Command execution failed');
  }

  /**
   * Check if error warrants failover
   */
  private shouldFailover(error: any): boolean {
    const failoverErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'Connection is closed',
      'Redis connection lost',
    ];

    const errorMessage = error.message || error.toString();
    return failoverErrors.some(msg => errorMessage.includes(msg));
  }

  /**
   * Get connection statistics
   */
  async getStats(): Promise<{
    active: string;
    primary: { connected: boolean; latency?: number };
    replicas: Array<{ index: number; connected: boolean; latency?: number }>;
    cluster?: { connected: boolean; nodes: number };
  }> {
    const stats: any = {
      active: this.getActiveConnectionName(),
      primary: { connected: false },
      replicas: [],
    };

    // Check primary
    if (this.primaryConnection) {
      const start = Date.now();
      const connected = await this.checkConnection(this.primaryConnection, 'Primary');
      stats.primary = {
        connected,
        latency: connected ? Date.now() - start : undefined,
      };
    }

    // Check replicas
    for (let i = 0; i < this.replicaConnections.length; i++) {
      const start = Date.now();
      const replica = this.replicaConnections[i];
      const connected = replica ? await this.checkConnection(replica, `Replica ${i}`) : false;
      stats.replicas.push({
        index: i,
        connected,
        latency: connected ? Date.now() - start : undefined,
      });
    }

    // Check cluster
    if (this.clusterConnection) {
      stats.cluster = {
        connected: await this.checkClusterHealth(),
        nodes: this.clusterConnection.nodes('all').length,
      };
    }

    return stats;
  }

  /**
   * Get active connection name
   */
  private getActiveConnectionName(): string {
    if (this.activeConnection === this.clusterConnection) {
      return 'cluster';
    } else if (this.activeConnection === this.primaryConnection) {
      return 'primary';
    } else {
      const replicaIndex = this.replicaConnections.indexOf(this.activeConnection as Redis);
      return replicaIndex >= 0 ? `replica-${replicaIndex}` : 'unknown';
    }
  }

  /**
   * Gracefully shutdown all connections
   */
  async shutdown(): Promise<void> {
    logger.info('[RedisConnectionManager] Shutting down connections...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    const disconnects = [];

    if (this.primaryConnection) {
      disconnects.push(this.primaryConnection.quit());
    }

    for (const replica of this.replicaConnections) {
      disconnects.push(replica.quit());
    }

    if (this.clusterConnection) {
      disconnects.push(this.clusterConnection.quit());
    }

    await Promise.all(disconnects);
    
    this.primaryConnection = null;
    this.replicaConnections = [];
    this.clusterConnection = null;
    this.activeConnection = null;

    logger.info('[RedisConnectionManager] All connections closed');
  }
}

// Singleton instance
let connectionManager: RedisConnectionManager | null = null;

/**
 * Get or create connection manager instance
 */
export async function getRedisConnectionManager(): Promise<RedisConnectionManager> {
  if (!connectionManager) {
    const config: RedisConnectionConfig = {
      primary: {
        host: getOptionalEnvVar('REDIS_HOST') || 'localhost',
        port: getOptionalEnvVarInt('REDIS_PORT', 6379),
        password: getOptionalEnvVar('REDIS_PASSWORD'),
        db: getOptionalEnvVarInt('REDIS_DB', 0),
      },
    };

    // Add replicas if configured
    const redisReplicas = getOptionalEnvVar('REDIS_REPLICAS');
    if (redisReplicas) {
      config.replicas = redisReplicas.split(',').map(replica => {
        const [host, port] = replica.split(':');
        return {
          host: host || 'localhost',
          port: parseInt(port || '6379', 10),
          password: getOptionalEnvVar('REDIS_PASSWORD'),
          db: getOptionalEnvVarInt('REDIS_DB', 0),
        };
      });
    }

    // Add cluster nodes if configured
    const redisClusterNodes = getOptionalEnvVar('REDIS_CLUSTER_NODES');
    if (redisClusterNodes) {
      config.cluster = redisClusterNodes.split(',').map(node => {
        const [host, port] = node.split(':');
        return { host: host || 'localhost', port: parseInt(port || '6379', 10) };
      });
    }

    connectionManager = new RedisConnectionManager(config);
    await connectionManager.initialize();
  }

  return connectionManager;
}