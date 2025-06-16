import { AlertService } from '@/lib/services/alert.service';
import { broadcastEvent } from '@/app/api/events/route';

// Create mock objects
const mockAlert = {
  create: jest.fn(),
  findMany: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  findUnique: jest.fn(),
};

const mockAlertTrigger = {
  create: jest.fn(),
};

const mockPrisma = {
  alert: mockAlert,
  alertTrigger: mockAlertTrigger,
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/app/api/events/route', () => ({
  broadcastEvent: jest.fn(),
}));

describe('AlertService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createAlert should call prisma.create', async () => {
    mockAlert.create.mockResolvedValue({ id: 'a1' });
    const result = await AlertService.createAlert({
      userId: 'u1',
      symbol: 'BTC',
      conditions: { priceAbove: 100 },
    });
    expect(mockAlert.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 'a1' });
  });

  it('triggerAlert should update alert, create trigger and broadcast', async () => {
    mockAlert.findUnique.mockResolvedValue({ metadata: { triggerCount: 1 } });
    mockAlert.update.mockResolvedValue({ id: 'a1', userId: 'u1', symbol: 'BTC' });
    mockAlertTrigger.create.mockResolvedValue({ id: 't1' });

    const res = await AlertService.triggerAlert('a1', 100);

    expect(mockAlert.update).toHaveBeenCalled();
    expect(mockAlertTrigger.create).toHaveBeenCalledWith({ data: { alertId: 'a1', price: 100, description: undefined } });
    expect(broadcastEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'alertTriggered' }));
    expect(res).toEqual({ id: 't1' });
  });
});
