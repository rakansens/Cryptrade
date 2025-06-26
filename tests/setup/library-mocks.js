// tests/setup/library-mocks.js
// Library and framework mocks for test environment

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock API response helpers
jest.mock('@/app/api/utils/responses', () => require('../../__mocks__/@/app/api/utils/responses.ts'));

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-id-123'),
}));

// Mock AI SDK
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn().mockReturnValue({
    chat: jest.fn(),
    completion: jest.fn(),
  }),
}));

jest.mock('ai', () => ({
  generateText: jest.fn().mockResolvedValue({
    text: 'Mock AI response',
  }),
  streamText: jest.fn().mockResolvedValue({
    stream: new ReadableStream(),
  }),
}));

// Mock Next.js headers module
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(),
    getAll: jest.fn(() => []),
  })),
  headers: jest.fn(() => new Headers()),
}));

// Mock Supabase auth for server components
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
            },
            access_token: 'mock-access-token',
          }
        },
        error: null
      })
    }
  }))
}));

// Mock @neondatabase/serverless
jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => {
    return jest.fn((sql) => Promise.resolve([]));
  }),
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn(),
  })),
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn(),
  })),
}));

// Mock semantic embedding service to avoid API calls in tests
jest.mock('@/lib/services/semantic-embedding.service', () => {
  const { MockSemanticEmbeddingService } = require('./mock-semantic-embedding');
  return {
    SemanticEmbeddingService: MockSemanticEmbeddingService,
    embeddingService: MockSemanticEmbeddingService.getInstance(),
  };
});

// Mock utilities
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  },
}));

// Mock metrics
jest.mock('@/lib/monitoring/metrics', () => ({
  metricsCollector: {
    register: jest.fn(),
    increment: jest.fn(),
    set: jest.fn(),
    observe: jest.fn(),
    export: jest.fn(() => ''),
    toJSON: jest.fn(() => ({})),
    reset: jest.fn(),
  },
  incrementMetric: jest.fn(),
  setMetric: jest.fn(),
  observeMetric: jest.fn(),
  // Legacy exports for backward compatibility
  metrics: {
    incrementMetric: jest.fn(),
    recordMetric: jest.fn(),
    recordHistogram: jest.fn(),
    recordGauge: jest.fn(),
    startTimer: jest.fn(() => jest.fn()),
    recordAgentExecution: jest.fn(),
    getCacheMetrics: jest.fn(() => ({
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0
    })),
  },
}));

// Mock chart agent utils
jest.mock('@/lib/chart/agent-utils', () => ({
  agentUtils: {
    validateChartDrawing: jest.fn((drawing) => drawing),
    prepareDrawingData: jest.fn((data) => data),
    executeDrawingOperation: jest.fn(async (fn) => await fn()),
    showAgentSuccess: jest.fn(),
    handleAgentError: jest.fn(),
    handleValidationError: jest.fn(),
    validatePatternData: jest.fn((pattern) => pattern),
    executePatternOperation: jest.fn(async (fn) => await fn()),
    preparePatternData: jest.fn((data) => data),
  }
}));

// Mock Prisma client before any imports use it
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $on: jest.fn(),
    $use: jest.fn(),
    conversationSession: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    conversationMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
  serializeBigInt: jest.fn((data) => data),
  withTransaction: jest.fn(),
}));

// Mock Next.js Image component
jest.mock('next/image', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: function Image({ src, alt, width, height, ...props }) {
      // eslint-disable-next-line @next/next/no-img-element
      return React.createElement('img', {
        src,
        alt,
        width,
        height,
        ...props,
      });
    },
  };
});

// Mock Next.js Link component
jest.mock('next/link', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: function Link({ children, href, ...props }) {
      return React.createElement('a', { href: href.toString(), ...props }, children);
    },
  };
});

// Mock common UI components
jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }) => require('react').createElement('div', { 'data-testid': 'scroll-area', ...props }, children),
}))

jest.mock('@/components/ui/separator', () => ({
  Separator: (props) => require('react').createElement('hr', { 'data-testid': 'separator', ...props }),
}))

// Mock hooks that are commonly missing
jest.mock('@/hooks/use-ui-event-stream', () => ({
  useUIEventStream: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn(),
  })),
  useUiEventStream: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn(),
  }))
}));

jest.mock('@/hooks/use-typed-ui-event-stream', () => ({
  useTypedUIEventStream: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn(),
  })),
  useTypedUiEventStream: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn(),
  }))
}));

// axios mock (simple)
jest.mock('axios', () => {
  const fn = () => Promise.resolve({ data: {} });
  fn.create = () => fn;
  fn.get = jest.fn(() => Promise.resolve({ data: {} }));
  fn.post = jest.fn(() => Promise.resolve({ data: {} }));
  return { default: fn };
});

// nanoid non-secure mock
jest.mock('nanoid/non-secure', () => ({ nanoid: () => 'test-id' }));

// pg client mock to bypass database connections
jest.mock(
  'pg',
  () => ({
    Client: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      end: jest.fn(),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    })),
  }),
  { virtual: true }
);