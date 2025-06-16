import { AlertService } from '@/lib/services/alert.service';
import { prisma } from '@/lib/db/prisma';
import { broadcastEvent } from '@/app/api/events/route';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    alert: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    alertTrigger: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/app/api/events/route', () => ({
  broadcastEvent: jest.fn(),
}));

describe('AlertService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createAlert should call prisma.create', async () => {
    (prisma.alert.create as jest.Mock).mockResolvedValue({ id: 'a1' });
    const result = await AlertService.createAlert({
      userId: 'u1',
      symbol: 'BTC',
      conditions: { priceAbove: 100 },
    });
    expect(prisma.alert.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 'a1' });
  });

  it('triggerAlert should update alert, create trigger and broadcast', async () => {
    (prisma.alert.findUnique as jest.Mock).mockResolvedValue({ metadata: { triggerCount: 1 } });
    (prisma.alert.update as jest.Mock).mockResolvedValue({ id: 'a1', userId: 'u1', symbol: 'BTC' });
    (prisma.alertTrigger.create as jest.Mock).mockResolvedValue({ id: 't1' });

    const res = await AlertService.triggerAlert('a1', 100);

    expect(prisma.alert.update).toHaveBeenCalled();
    expect(prisma.alertTrigger.create).toHaveBeenCalledWith({ data: { alertId: 'a1', price: 100, description: undefined } });
    expect(broadcastEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'alertTriggered' }));
    expect(res).toEqual({ id: 't1' });
  });
});
