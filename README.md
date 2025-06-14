# Cryptrade

A modern cryptocurrency trading application built with Next.js, featuring real-time market data, technical indicators, and AI-powered trading insights.

## Features

- 📈 **Real-time Market Data**: Live cryptocurrency prices and trading data
- 📊 **Technical Indicators**: RSI, MACD, Bollinger Bands, Moving Averages
- 🤖 **AI Trading Assistant**: Powered by OpenAI for market analysis and insights
- 🔄 **WebSocket Integration**: Real-time price updates via Binance WebSocket
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔒 **Type-Safe**: Built with TypeScript for reliability and maintainability

## Quick Start

### Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Cryptrade

# Install dependencies
npm install

# Set up environment variables (see Environment Configuration below)
cp .env.local.example .env.local

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Configuration

Cryptrade uses a centralized, type-safe environment variable management system. All environment variables are defined in `/config/env.ts` with Zod validation.

### Required Variables

```bash
# OpenAI API for trading insights (required)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### Optional Variables

```bash
# Application Environment
NODE_ENV=development          # development | test | production
PORT=3000                    # Server port (default: 3000)

# Logging Configuration  
LOG_LEVEL=debug              # debug | info | warn | error
LOG_TRANSPORT=console        # console | noop | sentry | multi
DISABLE_CONSOLE_LOGS=false   # Disable console output
ENABLE_SENTRY=false          # Enable Sentry error tracking

# Database Configuration (optional)
UPSTASH_REDIS_REST_URL=https://your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
KV_REST_API_URL=https://your-kv-url
KV_REST_API_TOKEN=your-kv-token

# Application URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3000
VERCEL_URL=your-vercel-deployment-url

# Feature Flags
USE_NEW_WS_MANAGER=false     # WebSocket implementation toggle

# CORS Configuration
ALLOWED_ORIGINS=*            # Comma-separated allowed origins
```

### Using Environment Variables in Code

**✅ Correct Usage:**
```typescript
import { env, isDevelopment, hasRedis } from '@/config/env';

// Type-safe access with validation
const apiKey = env.OPENAI_API_KEY; // string (guaranteed)
const port = env.PORT;             // number (guaranteed)

// Utility functions
if (isDevelopment()) {
  console.log('Development mode enabled');
}

if (hasRedis()) {
  // Initialize Redis connection
}
```

**❌ Incorrect Usage:**
```typescript
// Direct process.env access is prohibited
const apiKey = process.env.OPENAI_API_KEY; // ESLint error
```

### Environment Setup for Development

1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Add your OpenAI API key:
   ```bash
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

If required environment variables are missing, the application will display helpful error messages with setup instructions.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Environment Variables in Tests

Use the built-in testing utilities for clean environment mocking:

```typescript
import { mockEnv, createTestEnv } from '@/config/testing/setupEnvMock';

describe('API Tests', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = mockEnv(createTestEnv({
      OPENAI_API_KEY: 'sk-test-key-12345',
      LOG_TRANSPORT: 'noop' // Disable logging in tests
    }));
  });

  afterEach(() => {
    restoreEnv();
  });

  // Your tests here...
});
```

## Development

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Formatting
npm run format
```

### Environment Validation

The application includes fail-fast environment validation:

- **Development**: Detailed error messages with setup guidance
- **Production**: Immediate exit with error logging
- **Testing**: Throws errors for test assertion

### Adding New Environment Variables

1. Add to the schema in `/config/env.ts`:
   ```typescript
   const EnvSchema = z.object({
     // ... existing variables
     NEW_VARIABLE: z.string().min(1, 'New variable is required'),
   });
   ```

2. Update your `.env.local`:
   ```bash
   NEW_VARIABLE=your-value-here
   ```

3. Use in your code:
   ```typescript
   import { env } from '@/config/env';
   const newValue = env.NEW_VARIABLE; // Type-safe access
   ```

## Deployment

### Vercel Deployment

1. Set up environment variables in Vercel dashboard
2. Ensure all required variables are configured
3. Deploy using Vercel CLI or GitHub integration

### Environment Variables for Production

Ensure these variables are set in your production environment:

- `OPENAI_API_KEY` - Your production OpenAI API key
- `NODE_ENV=production` - Enables production optimizations
- Additional variables as needed for your deployment

## Architecture

### Key Technologies

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, WebSocket integration
- **Database**: Redis (Upstash/Vercel KV support)
- **AI Integration**: OpenAI GPT-4 for trading insights
- **Real-time Data**: Binance WebSocket API
- **Validation**: Zod for runtime type checking
- **Testing**: Jest with custom environment utilities

### Project Structure

```
├── app/                    # Next.js App Router pages and API routes
├── components/             # React components
├── config/                 # Configuration and environment management
│   ├── env.ts             # Centralized environment configuration
│   └── testing/           # Test utilities
├── hooks/                  # Custom React hooks
├── lib/                    # Utility libraries and business logic
├── store/                  # State management (Zustand)
├── types/                  # TypeScript type definitions
└── docs/                   # Documentation and ADRs
```

For detailed architecture decisions, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes with appropriate tests
4. Ensure all tests pass: `npm test`
5. Lint your code: `npm run lint`
6. Commit your changes: `git commit -m 'Add your feature'`
7. Push to the branch: `git push origin feature/your-feature`
8. Submit a pull request

### Environment Variables for Contributors

When contributing, ensure you:

- Never commit `.env.local` or other environment files
- Use the provided testing utilities for environment mocking
- Follow the centralized environment variable patterns
- Update documentation when adding new environment variables

## Support

- 📖 Documentation: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- 🐛 Issues: Use GitHub Issues for bug reports
- 💬 Discussions: Use GitHub Discussions for questions

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.