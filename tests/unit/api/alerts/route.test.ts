import { mockTestEnv } from '@/tests/helpers/setupEnvMock';
const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/alerts/route';
import { AlertService } from '@/lib/services/alert.service';

jest.mock('@/lib/services/alert.service');

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Alerts API Route', () => {
  afterAll(() => {
    restoreEnv();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET should return alerts', async () => {
    (AlertService.getUserAlerts as jest.Mock).mockResolvedValue([{ id: 'a1' }]);
    const req = new NextRequest('http://localhost/api/alerts', { headers: { 'x-user-id': 'u1' } });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.alerts).toHaveLength(1);
  });

  it('POST should create alert', async () => {
    (AlertService.createAlert as jest.Mock).mockResolvedValue({ id: 'a1' });
    const req = new NextRequest('http://localhost/api/alerts', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'BTC', conditions: { priceAbove: 10 } }),
    } as any);
    req.headers.set('x-user-id', 'u1');
    const res = await POST(req);
    expect(AlertService.createAlert).toHaveBeenCalled();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.alert).toEqual({ id: 'a1' });
  });
});
