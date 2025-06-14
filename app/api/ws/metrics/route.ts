/**
 * WebSocket Metrics API endpoint for monitoring (T-6)
 * Provides metrics for SRE monitoring and alerting
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBinanceConnection } from '@/lib/ws';

export async function GET(request: NextRequest) {
  try {
    const connection = getBinanceConnection();
    
    // Check if we have access to metrics (only available with WSManager implementation)
    if ('getMetrics' in connection) {
      const metrics = connection.getMetrics();
      
      // Support different output formats
      const format = request.nextUrl.searchParams.get('format') || 'json';
      
      if (format === 'prometheus') {
        const prometheusMetrics = connection.getPrometheusMetrics();
        return new NextResponse(prometheusMetrics, {
          headers: {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
          }
        });
      }
      
      // Default JSON format
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        metrics: {
          // Core monitoring metrics
          activeConnections: metrics.activeConnections,
          retryCount: metrics.retryCount,
          
          // Health indicators
          isHealthy: metrics.activeConnections <= 100, // Configurable threshold
          lastRetryAgo: metrics.lastRetryTime ? Date.now() - metrics.lastRetryTime : null,
          
          // Extended metrics for debugging
          implementation: metrics.implementation,
          totalStreamCreations: metrics.totalStreamCreations,
          totalStreamCleanups: metrics.totalStreamCleanups,
          activeConnectionsHWM: metrics.activeConnectionsHWM,
          uptime: metrics.uptime
        }
      });
    }
    
    // Fallback for legacy implementation (limited metrics)
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        activeConnections: 0, // Legacy doesn't track this
        retryCount: 0,        // Legacy doesn't track this
        isHealthy: connection.getConnectionStatus(),
        implementation: 'Legacy',
        lastRetryAgo: null,
        note: 'Limited metrics available in legacy mode'
      }
    });
    
  } catch (error) {
    console.error('[WS-Metrics-API] Error getting metrics:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve WebSocket metrics',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Health check endpoint for load balancers
 */
export async function HEAD() {
  try {
    const connection = getBinanceConnection();
    const isConnected = connection.getConnectionStatus();
    
    if (isConnected) {
      return new NextResponse(null, { status: 200 });
    } else {
      return new NextResponse(null, { status: 503 }); // Service Unavailable
    }
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}