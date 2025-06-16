// import { prisma } from '@/lib/db/prisma';
// import { broadcastEvent } from '@/app/api/events/route';
import type { AlertConditions, AlertMetadata } from '@/types/database.types';

// Alert and AlertTrigger models are not defined in the Prisma schema
// This service is temporarily disabled until the schema is updated

/**
 * @alpha
 * Alert Service - Placeholder implementation
 * 
 * This service is currently not implemented as the required database models
 * (Alert and AlertTrigger) are not yet defined in the Prisma schema.
 * All methods will throw errors or return empty results.
 */
export class AlertService {
  /**
   * @alpha
   * Create a new alert (not implemented)
   * @throws {Error} Always throws - not implemented
   */
  static async createAlert(_data: {
    userId: string;
    symbol: string;
    conditions: AlertConditions;
    metadata?: AlertMetadata;
  }) {
    // TODO: Implement when alert model is added to Prisma schema
    throw new Error('Alert service is not implemented - missing Prisma models');
  }

  /**
   * @alpha
   * Get user alerts (not implemented)
   * @returns {Array} Always returns empty array
   */
  static async getUserAlerts(_userId: string) {
    // TODO: Implement when alert model is added to Prisma schema
    console.warn('[AlertService] getUserAlerts called but not implemented - returning empty array', {
      userId: _userId,
      reason: 'Alert and AlertTrigger models not defined in Prisma schema'
    });
    return [];
  }

  /**
   * @alpha
   * Delete an alert (not implemented)
   * @throws {Error} Always throws - not implemented
   */
  static async deleteAlert(_id: string) {
    // TODO: Implement when alert model is added to Prisma schema
    throw new Error('Alert service is not implemented - missing Prisma models');
  }

  /**
   * @alpha
   * Trigger an alert (not implemented)
   * @throws {Error} Always throws - not implemented
   */
  static async triggerAlert(_alertId: string, _price: number, _description?: string) {
    // TODO: Implement when alert model is added to Prisma schema
    throw new Error('Alert service is not implemented - missing Prisma models');
  }
}
