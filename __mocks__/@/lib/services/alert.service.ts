// Mock for lib/services/alert.service.ts

export class AlertService {
  static async createAlert(data: {
    userId: string;
    symbol: string;
    conditions: any;
    metadata?: any;
  }) {
    // Mock successful creation
    return {
      id: 'mock-alert-id',
      userId: data.userId,
      symbol: data.symbol,
      conditions: data.conditions,
      createdAt: new Date(),
    };
  }

  static async getUserAlerts(userId: string) {
    // Mock empty array response
    return [];
  }

  static async deleteAlert(id: string) {
    // Mock successful deletion
    return true;
  }

  static async triggerAlert(alertId: string, price: number, description?: string) {
    // Mock successful trigger
    return {
      alertId,
      price,
      description,
      triggeredAt: new Date(),
    };
  }
}