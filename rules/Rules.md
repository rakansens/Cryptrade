# Cryptrade Development Rules and Guidelines

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Development Environment Setup](#development-environment-setup)
3. [Code Style and Conventions](#code-style-and-conventions)
4. [Architecture Patterns](#architecture-patterns)
5. [TypeScript Guidelines](#typescript-guidelines)
6. [Testing Requirements](#testing-requirements)
7. [API Design Principles](#api-design-principles)
8. [Real-time Communication](#real-time-communication)
9. [Database Conventions](#database-conventions)
10. [Security Guidelines](#security-guidelines)
11. [Performance Standards](#performance-standards)
12. [AI/ML Integration](#aiml-integration)
13. [Git Workflow](#git-workflow)
14. [CI/CD Processes](#cicd-processes)
15. [Documentation Standards](#documentation-standards)

## 🎯 Project Overview

**Cryptrade** is an AI-driven cryptocurrency trading support platform that combines advanced market analysis, real-time trading suggestions, and intuitive chart operations through natural language processing.

### Core Technologies
- **Frontend**: Next.js 15.3.3 (App Router), React 18.3.1, TypeScript 5.2.2
- **State Management**: Zustand 5.0.5
- **Styling**: Tailwind CSS 3.3.3
- **Charts**: Lightweight Charts 4.1.3
- **AI Framework**: Mastra 0.10.1 with OpenAI GPT-4
- **Database**: PostgreSQL (Supabase) with Prisma 6.9.0
- **Real-time**: Custom WebSocket implementation with RxJS
- **Authentication**: Supabase Auth

### Key Features
- Multi-agent AI system for market analysis
- Real-time WebSocket data streaming
- Advanced charting with pattern recognition
- Natural language trading assistant
- Secure authentication and authorization

## 🚀 Development Environment Setup

### Prerequisites
- Node.js 18.x or higher
- npm 8.x or higher
- PostgreSQL (via Supabase local development)

### Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd Cryptrade

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start Supabase (for local development)
npm run db:start

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Required Environment Variables
```bash
# Core Requirements
OPENAI_API_KEY=sk-xxxxx              # Required: OpenAI API key
NODE_ENV=development                  # Environment mode
PORT=3000                            # Server port

# Database
DATABASE_URL=postgresql://...         # Supabase connection string
NEXT_PUBLIC_SUPABASE_URL=...         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...    # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=...        # Supabase service role key

# Optional Features
LOG_LEVEL=debug                      # Logging level
ENABLE_SENTRY=false                  # Error tracking
USE_NEW_WS_MANAGER=true             # Enable new WebSocket manager
```

## 💻 Code Style and Conventions

### TypeScript
```typescript
// ✅ Good: Explicit types and interfaces
interface UserData {
  id: string;
  name: string;
  email: string;
}

export async function fetchUser(id: string): Promise<Result<UserData>> {
  try {
    const user = await api.getUser(id);
    return createSuccess(user);
  } catch (error) {
    return createError(new Error(`Failed to fetch user: ${error}`));
  }
}

// ❌ Bad: Implicit any or missing types
function fetchUser(id) {
  return api.getUser(id);
}
```

### React Components
```typescript
// ✅ Good: Typed props with explicit interfaces
interface ButtonProps {
  variant: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant, 
  size = 'medium',
  onClick,
  children,
  disabled = false 
}) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size }))}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

// ❌ Bad: Untyped or inline props
export const Button = ({ variant, onClick, children }) => {
  // Implementation
};
```

### File Organization
```
src/
├── app/                    # Next.js app router pages
│   ├── (auth)/            # Auth group routes
│   ├── api/               # API routes
│   └── dashboard/         # Protected routes
├── components/            # React components
│   ├── chart/            # Chart-related components
│   ├── chat/             # Chat interface components
│   └── ui/               # Reusable UI components
├── hooks/                # Custom React hooks
├── lib/                  # Core business logic
│   ├── api/             # API clients and handlers
│   ├── mastra/          # AI agent configuration
│   └── ws/              # WebSocket management
├── store/               # Zustand state stores
└── types/               # TypeScript type definitions
```

### Naming Conventions
- **Files**: kebab-case (e.g., `user-profile.tsx`)
- **Components**: PascalCase (e.g., `UserProfile`)
- **Functions/Variables**: camelCase (e.g., `getUserData`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`)
- **Types/Interfaces**: PascalCase (e.g., `UserData`)
- **Enums**: PascalCase with PascalCase values (e.g., `UserRole.Admin`)

## 🏗️ Architecture Patterns

### 1. Single Source of Truth for Types
All domain types are centralized in `/types` directory:

```typescript
// types/market.ts - Single source for market-related types
export const ProcessedKlineSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export type ProcessedKline = z.infer<typeof ProcessedKlineSchema>;
```

### 2. Centralized Environment Configuration
Environment variables are managed through a single typed configuration:

```typescript
// config/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.number().default(3000),
  // ... other environment variables
});

export const env = loadEnv(); // Singleton with validation
```

### 3. Store Pattern with Zustand
```typescript
// store/market.store.ts
interface MarketStore {
  // State
  prices: Map<string, PriceData>;
  selectedSymbol: string;
  
  // Actions
  updatePrice: (symbol: string, price: PriceData) => void;
  selectSymbol: (symbol: string) => void;
  reset: () => void;
}

export const useMarketStore = create<MarketStore>((set) => ({
  prices: new Map(),
  selectedSymbol: 'BTCUSDT',
  
  updatePrice: (symbol, price) => set((state) => ({
    prices: new Map(state.prices).set(symbol, price)
  })),
  
  selectSymbol: (symbol) => set({ selectedSymbol: symbol }),
  
  reset: () => set({ prices: new Map(), selectedSymbol: 'BTCUSDT' })
}));
```

### 4. API Handler Pattern
```typescript
// lib/api/create-api-handler.ts
export function createApiHandler<TBody = unknown, TResponse = unknown>(
  handler: ApiHandler<TBody, TResponse>
): NextApiHandler {
  return withErrorBoundary(
    withRateLimit(
      withValidation(
        withAuth(handler)
      )
    )
  );
}

// Usage in API route
export const POST = createApiHandler<ChatRequest, ChatResponse>(
  async (req) => {
    const { message } = req.body;
    const result = await processChat(message);
    return NextResponse.json(result);
  }
);
```

## 📘 TypeScript Guidelines

### Strict Mode Rules
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Type Safety Patterns

#### 1. Result Type for Error Handling
```typescript
import { Result, createSuccess, createError } from '@/types/generic.types';

async function fetchData(): Promise<Result<Data>> {
  try {
    const data = await api.getData();
    return createSuccess(data);
  } catch (error) {
    return createError(new Error('Failed to fetch data'));
  }
}

// Usage
const result = await fetchData();
if (result.success) {
  console.log(result.data); // Type-safe access
} else {
  console.error(result.error);
}
```

#### 2. Discriminated Unions for State
```typescript
type LoadingState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// Type-safe state handling
function handleState<T>(state: LoadingState<T>) {
  switch (state.status) {
    case 'idle':
      return <div>Ready to load</div>;
    case 'loading':
      return <div>Loading...</div>;
    case 'success':
      return <div>{JSON.stringify(state.data)}</div>;
    case 'error':
      return <div>Error: {state.error.message}</div>;
  }
}
```

#### 3. Type Guards
```typescript
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}

// Usage
if (isUser(data)) {
  console.log(data.email); // Type-safe access
}
```

### Forbidden Patterns
- ❌ Never use `any` type
- ❌ Avoid type assertions without guards
- ❌ No `@ts-ignore` or `@ts-nocheck`
- ❌ No implicit any in function parameters

## 🧪 Testing Requirements

### Test Coverage Standards
- **Overall**: Minimum 80% coverage
- **Critical Paths**: 100% coverage (auth, payments, trading)
- **Components**: 80%+ focusing on user interactions
- **Utilities**: 95%+ including edge cases

### Test Organization
```
tests/
├── unit/              # Unit tests (mirrors src structure)
│   ├── components/
│   ├── hooks/
│   └── lib/
├── integration/       # Integration tests
│   ├── api/
│   └── websocket/
├── e2e/              # End-to-end tests
│   ├── auth.spec.ts
│   └── trading.spec.ts
└── performance/      # Performance benchmarks
```

### Testing Patterns

#### 1. Component Testing
```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ChatPanel } from '@/components/chat/ChatPanel';

describe('ChatPanel', () => {
  it('handles message submission', async () => {
    const onSubmit = jest.fn();
    const { getByRole, getByPlaceholderText } = render(
      <ChatPanel onSubmit={onSubmit} />
    );
    
    const input = getByPlaceholderText('メッセージを入力...');
    const button = getByRole('button', { name: '送信' });
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Test message');
    });
  });
});
```

#### 2. Hook Testing
```typescript
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '@/hooks/use-websocket';

describe('useWebSocket', () => {
  it('connects and receives messages', async () => {
    const { result } = renderHook(() => 
      useWebSocket('wss://test.example.com')
    );
    
    expect(result.current.status).toBe('connecting');
    
    // Simulate connection
    act(() => {
      mockWebSocket.simulateOpen();
    });
    
    expect(result.current.status).toBe('connected');
  });
});
```

#### 3. E2E Testing
```typescript
import { test, expect } from '@playwright/test';

test('complete trading flow', async ({ page }) => {
  // 1. Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('[type="submit"]');
  
  // 2. Navigate to dashboard
  await page.waitForURL('/dashboard');
  
  // 3. Interact with AI
  await page.fill('[data-testid="chat-input"]', 'BTCの分析をして');
  await page.click('[data-testid="send-button"]');
  
  // 4. Verify response
  await expect(page.locator('.analysis-result')).toBeVisible();
});
```

### Running Tests
```bash
# Unit tests
npm test                    # Run all unit tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e           # Headless
npm run test:e2e:ui        # With UI
npm run test:e2e:debug     # Debug mode

# Performance tests
npm run test:performance
```

## 🌐 API Design Principles

### RESTful Endpoints
```typescript
// API Route Structure
/api/
├── auth/          # Authentication endpoints
│   ├── login      # POST - User login
│   ├── logout     # POST - User logout
│   └── me         # GET - Current user info
├── ai/            # AI-related endpoints
│   ├── chat       # POST - Chat with AI
│   └── analysis   # POST - Market analysis
├── market/        # Market data endpoints
│   ├── klines     # GET - Candlestick data
│   └── ticker     # GET - Price ticker
└── chart/         # Chart management
    └── drawings   # GET, POST, DELETE - Drawing operations
```

### API Handler Example
```typescript
// app/api/market/klines/route.ts
import { createApiHandler } from '@/lib/api/create-api-handler';
import { z } from 'zod';

const QuerySchema = z.object({
  symbol: z.string(),
  interval: z.enum(['1m', '5m', '15m', '1h', '1d']),
  limit: z.number().min(1).max(1000).default(100),
});

export const GET = createApiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const query = QuerySchema.parse({
    symbol: searchParams.get('symbol'),
    interval: searchParams.get('interval'),
    limit: Number(searchParams.get('limit')),
  });
  
  const klines = await fetchKlines(query);
  
  return NextResponse.json({
    success: true,
    data: klines,
    timestamp: Date.now(),
  });
});
```

### Error Response Format
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: number;
}

// Example error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid symbol format",
    "details": {
      "field": "symbol",
      "received": "BTC",
      "expected": "BTCUSDT"
    }
  },
  "timestamp": 1234567890
}
```

## 🔌 Real-time Communication

### WebSocket Manager (WSManager)
The application uses a custom WebSocket manager with RxJS for real-time data:

```typescript
// Usage example
import { WSManager } from '@/lib/ws/WSManager';

const manager = new WSManager({
  url: 'wss://stream.binance.com:9443/ws/',
  maxRetryAttempts: 10,
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
});

// Subscribe to price updates
const subscription = manager.subscribe('btcusdt@trade').subscribe({
  next: (trade) => {
    console.log(`Price: ${trade.p}`);
  },
  error: (error) => {
    console.error('Stream error:', error);
  }
});

// Cleanup
subscription.unsubscribe();
```

### Server-Sent Events (SSE)
For AI streaming responses:

```typescript
// lib/api/create-sse-handler.ts
export function createSSEHandler(
  handler: (req: Request) => AsyncGenerator<any>
) {
  return async (req: Request) => {
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();
    
    (async () => {
      try {
        for await (const data of handler(req)) {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        }
      } finally {
        await writer.close();
      }
    })();
    
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  };
}
```

## 🗄️ Database Conventions

### Prisma Schema Organization
```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  sessions  Session[]
  chats     Chat[]
  
  @@index([email])
}

model Chat {
  id        String   @id @default(cuid())
  userId    String
  message   String
  response  String?
  createdAt DateTime @default(now())
  
  // Relations
  user      User     @relation(fields: [userId], references: [id])
  
  @@index([userId, createdAt])
}
```

### Database Access Patterns
```typescript
// lib/db/repositories/user.repository.ts
import { prisma } from '@/lib/db/prisma';

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { sessions: true }
    });
  }
  
  async create(data: CreateUserDto) {
    return prisma.user.create({
      data,
    });
  }
  
  async updateLastActive(id: string) {
    return prisma.user.update({
      where: { id },
      data: { lastActiveAt: new Date() }
    });
  }
}
```

### Migration Commands
```bash
# Create a new migration
npm run db:migrate -- --name add_user_table

# Apply migrations
npm run db:push

# Reset database
npm run db:reset
```

## 🔒 Security Guidelines

### Authentication & Authorization
```typescript
// lib/auth/server.ts
export async function requireAuth(req: Request): Promise<User> {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new AuthError('Unauthorized');
  }
  
  return session.user;
}

// Usage in API route
export const GET = withAuth(async (req) => {
  const user = req.user; // Guaranteed to exist
  // ... handle request
});
```

### Security Headers
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}
```

### API Security
- Rate limiting on all endpoints
- Input validation with Zod schemas
- API key authentication for external access
- CORS configuration for allowed origins

## ⚡ Performance Standards

### Target Metrics
- **Initial Load**: < 3 seconds
- **API Response**: < 500ms average
- **WebSocket Latency**: < 100ms
- **Concurrent Users**: 1000+

### Performance Optimization Patterns

#### 1. Memoization
```typescript
import { useMemo } from 'react';

function ExpensiveComponent({ data }: { data: MarketData[] }) {
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      ma20: calculateMA(data, 20),
      ma50: calculateMA(data, 50),
    }));
  }, [data]);
  
  return <Chart data={processedData} />;
}
```

#### 2. Virtualization
```typescript
import { VirtualList } from '@/components/ui/virtual-list';

function LargeList({ items }: { items: Item[] }) {
  return (
    <VirtualList
      items={items}
      height={600}
      itemHeight={50}
      renderItem={(item) => <ListItem {...item} />}
    />
  );
}
```

#### 3. Lazy Loading
```typescript
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(
  () => import('@/components/chart/HeavyChart'),
  { 
    loading: () => <ChartSkeleton />,
    ssr: false 
  }
);
```

### Performance Monitoring
```typescript
// lib/monitoring/metrics.ts
export function measurePerformance(name: string, fn: () => void) {
  const start = performance.now();
  fn();
  const duration = performance.now() - start;
  
  metrics.record('function_duration', duration, { name });
}
```

## 🤖 AI/ML Integration

### Multi-Agent Architecture
```typescript
// lib/mastra/agents/orchestrator.agent.ts
export const orchestratorAgent = new Agent({
  name: 'orchestrator',
  description: 'Routes user requests to appropriate specialist agents',
  model: 'gpt-4',
  
  async execute(input: string) {
    const intent = await analyzeIntent(input);
    
    switch (intent.type) {
      case 'price_inquiry':
        return priceAgent.execute(input);
      case 'technical_analysis':
        return tradingAgent.execute(input);
      case 'chart_control':
        return chartAgent.execute(input);
      default:
        return this.handleUnknown(input);
    }
  }
});
```

### Streaming AI Responses
```typescript
// hooks/use-ai-stream.ts
export function useAIStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  
  const sendMessage = useCallback(async (content: string) => {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content }),
    });
    
    const reader = response.body?.getReader();
    if (!reader) return;
    
    let accumulated = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = new TextDecoder().decode(value);
      accumulated += text;
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: accumulated,
      }]);
    }
  }, []);
  
  return { messages, sendMessage };
}
```

## 📝 Git Workflow

### Branch Strategy
```
main
├── develop
│   ├── feature/auth-implementation
│   ├── feature/websocket-upgrade
│   └── feature/ai-agents
├── hotfix/critical-bug
└── release/v1.0.0
```

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

Examples:
```
feat(auth): Supabase認証機能を実装

- ログイン/サインアップページを追加
- 認証ミドルウェアを実装
- セッション管理を追加

Closes #123
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build process or auxiliary tool changes

### Pull Request Process
1. Create feature branch from `develop`
2. Make changes and commit
3. Run tests and linting
4. Create PR with description
5. Code review by at least 1 reviewer
6. Merge after approval

## 🚢 CI/CD Processes

### GitHub Actions Workflows
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:coverage
      - run: npm run test:e2e
```

### Deployment Process
1. **Development**: Auto-deploy to preview on PR
2. **Staging**: Deploy on merge to develop
3. **Production**: Deploy on merge to main with approval

### Quality Gates
- Code coverage > 80%
- All tests passing
- No TypeScript errors
- No ESLint errors
- Security scan passed

## 📚 Documentation Standards

### Code Documentation
```typescript
/**
 * Fetches market data for the specified symbol and timeframe
 * 
 * @param symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param interval - Candlestick interval
 * @param limit - Number of candles to fetch
 * @returns Promise resolving to array of candlestick data
 * @throws {APIError} When the API request fails
 * 
 * @example
 * ```typescript
 * const candles = await fetchKlines('BTCUSDT', '1h', 100);
 * ```
 */
export async function fetchKlines(
  symbol: string,
  interval: CandlestickInterval,
  limit: number = 100
): Promise<Kline[]> {
  // Implementation
}
```

### README Structure
1. Project overview
2. Features
3. Installation
4. Usage examples
5. API documentation
6. Contributing guidelines
7. License

### API Documentation
- Use OpenAPI/Swagger for REST APIs
- Document all endpoints with examples
- Include authentication requirements
- Provide sample requests/responses

### Architecture Decision Records (ADRs)
Document significant architectural decisions:
```markdown
# ADR-001: Use Supabase for Authentication

## Status
Accepted

## Context
We need a robust authentication solution that integrates well with our stack.

## Decision
We will use Supabase Auth for authentication and authorization.

## Consequences
- Simplified auth implementation
- Built-in security features
- Requires Supabase dependency
```

---

## 🎯 Quick Reference

### Common Commands
```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run test            # Run tests
npm run lint            # Run linter
npm run type-check      # Check types

# Database
npm run db:migrate      # Run migrations
npm run db:push         # Push schema changes
npm run db:reset        # Reset database

# Utilities
npm run generate:api-key # Generate API key
npm run docs:api        # Generate API docs
```

### Important Links
- [TypeScript Guidelines](./docs/guides/TYPE_SAFETY_GUIDELINES.md)
- [Testing Best Practices](./docs/testing/TEST_BEST_PRACTICES.md)
- [WebSocket Manager Guide](./docs/guides/WS_MANAGER.md)
- [Architecture Documentation](./docs/architecture/ARCHITECTURE.md)

### Support Contacts
- Technical Issues: Create GitHub issue
- Security Issues: security@cryptrade.com
- General Questions: Use discussions

---

*Last Updated: 2025-06-17*
*Version: 1.0.0*