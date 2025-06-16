import { prisma } from '@/lib/db/prisma';
import { broadcastEvent } from '@/app/api/events/route';
import type { AlertConditions, AlertMetadata } from '@/types/database.types';

export class AlertService {
  static async createAlert(data: {
    userId: string;
    symbol: string;
    conditions: AlertConditions;
    metadata?: AlertMetadata;
  }) {
    return prisma.alert.create({
      data: {
        userId: data.userId,
        symbol: data.symbol,
        conditions: data.conditions as any,
        metadata: (data.metadata ?? { triggerCount: 0 }) as any,
      },
    });
  }

  static async getUserAlerts(userId: string) {
    return prisma.alert.findMany({ where: { userId } });
  }

  static async deleteAlert(id: string) {
    return prisma.alert.delete({ where: { id } });
  }

  static async triggerAlert(alertId: string, price: number, description?: string) {
    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        metadata: {
          ...(await prisma.alert
            .findUnique({ where: { id: alertId }, select: { metadata: true } }))
            ?.metadata,
          triggerCount: {
            increment: 1,
          },
          lastTriggered: new Date().toISOString(),
        } as any,
      },
    });

    const trigger = await prisma.alertTrigger.create({
      data: { alertId, price, description },
    });

    broadcastEvent({
      type: 'alertTriggered',
      data: { alertId, userId: alert.userId, symbol: alert.symbol, price, description },
    });

    return trigger;
  }
}
