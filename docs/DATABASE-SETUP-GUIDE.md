# Database Setup Guide for Cryptrade

This guide will help you set up Prisma and Supabase for local development.

## Prerequisites

- Node.js 18+ installed
- Docker installed (for Supabase local development)
- pnpm or npm package manager

## Quick Start

### 1. Install Dependencies

```bash
# Install Prisma and Supabase dependencies
pnpm add -D prisma @prisma/client
pnpm add @supabase/supabase-js
pnpm add -D supabase
```

### 2. Initialize Supabase

```bash
# Initialize Supabase in your project
npx supabase init

# Start Supabase locally (requires Docker)
npx supabase start
```

After running `supabase start`, you'll see output with your local credentials:
```
Started supabase local development setup.

API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
anon key: your-anon-key
service_role key: your-service-role-key
```

### 3. Setup Environment Variables

Copy `.env.local.example` to `.env.local` and update with your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Update the values in `.env.local` with the credentials from `supabase start`.

### 4. Initialize Prisma

```bash
# Generate Prisma client
npx prisma generate

# Push the schema to your local database
npx prisma db push

# (Optional) Run migrations instead of push for production-like setup
npx prisma migrate dev --name init
```

### 5. Seed the Database

```bash
# Run the seed script
npx supabase db seed
```

### 6. Verify Setup

```bash
# Open Prisma Studio to view your data
npx prisma studio

# Open Supabase Studio
# Navigate to http://localhost:54323 in your browser
```

## Database Schema Overview

The database includes the following main entities:

### Core Entities

1. **Users** - User accounts and profiles
2. **ConversationSessions** - Chat sessions with the AI
3. **ConversationMessages** - Individual messages in sessions
4. **AnalysisRecords** - AI-generated trading analysis and proposals
5. **TouchEvents** - Price interaction tracking for analysis validation

### Market Data

1. **MarketData** - OHLCV candlestick data
2. **TechnicalIndicators** - Calculated indicator values (RSI, MACD, etc.)

### Chart & Visualization

1. **ChartDrawings** - User-created chart objects (trendlines, fibonacci, etc.)
2. **PatternAnalyses** - Detected chart patterns

### System

1. **SystemLogs** - Application logs and debugging information

## Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- Users can only access their own data
- Market data is publicly readable
- Proper session-based access control

## Common Commands

```bash
# Reset database
npx supabase db reset

# Run migrations
npx prisma migrate dev

# Generate Prisma types
npx prisma generate

# View database logs
npx supabase db logs

# Stop Supabase
npx supabase stop
```

## Integration with Application

### Using Prisma Client

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Example: Fetch user's sessions
const sessions = await prisma.conversationSession.findMany({
  where: { userId: user.id },
  include: { messages: true }
})
```

### Using Supabase Client

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Example: Real-time subscription
const channel = supabase
  .channel('market-updates')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'market_data' },
    (payload) => console.log('New market data:', payload)
  )
  .subscribe()
```

## Migration from LocalStorage

The application currently uses localStorage and SQLite for data persistence. To migrate:

1. Export existing data from localStorage
2. Transform data to match the new schema
3. Import into Supabase using the seed scripts

Example migration script location: `scripts/migrate-to-supabase.ts` (to be created)

## Production Deployment

For production deployment:

1. Create a Supabase project at https://supabase.com
2. Update environment variables with production credentials
3. Run migrations against production database
4. Enable additional security features (2FA, audit logs, etc.)

## Troubleshooting

### Common Issues

1. **Docker not running**: Ensure Docker Desktop is running before `supabase start`
2. **Port conflicts**: Check if ports 54321-54329 are available
3. **Migration errors**: Check Prisma schema syntax and database connection

### Debug Commands

```bash
# Check Supabase status
npx supabase status

# View Prisma config
npx prisma validate

# Test database connection
npx prisma db pull
```

## Next Steps

1. Configure Supabase Auth for user authentication
2. Set up real-time subscriptions for live data
3. Implement database backup strategies
4. Configure monitoring and alerts

For more information:
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Project README](../README.md)