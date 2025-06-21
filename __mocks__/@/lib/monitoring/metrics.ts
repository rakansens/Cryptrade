// __mocks__/@/lib/monitoring/metrics.ts
// 変更点: metrics.incrementMetric などの呼び出しをフックする Jest モックを追加

export const metrics = {
  incrementMetric: jest.fn(),
  setMetric: jest.fn(),
  observeMetric: jest.fn(),
  recordAgentExecution: jest.fn(),
  getCacheMetrics: jest.fn(() => ({ hitRate: 1 })),
};

export const incrementMetric = metrics.incrementMetric;
export const setMetric = metrics.setMetric;
export const observeMetric = metrics.observeMetric;

export default { metrics, incrementMetric, setMetric, observeMetric }; 