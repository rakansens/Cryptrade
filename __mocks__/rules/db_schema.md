# Database Schema Documentation

## Database Provider and Configuration

- **Provider**: PostgreSQL
- **ORM**: Prisma
- **Database URLs**: 
  - `DATABASE_URL`: Standard connection URL
  - `DIRECT_DATABASE_URL`: Direct connection for migrations
- **Security**: Row Level Security (RLS) enabled on all tables via Supabase

## Data Models and Relationships

### Core Models

#### 1. User
- Central authentication model integrated with Supabase Auth
- **Fields**: id (UUID), email (unique), name, timestamps
- **Relationships**:
  - Has many ConversationSessions
  - Has many SystemLogs
  - Has many Alerts

#### 2. ConversationSession
- Tracks user chat sessions with the trading assistant
- **Fields**: id, userId, startedAt, lastActiveAt, summary, metadata
- **Relationships**:
  - Belongs to User
  - Has many AnalysisRecords
  - Has many ChartDrawings
  - Has many ConversationMessages
  - Has many PatternAnalyses
  - Has many SystemLogs

#### 3. ConversationMessage
- Stores chat messages between users and the AI assistant
- **Fields**: id, sessionId, role (user/assistant/system), content, timestamp, agentId, metadata
- **Relationships**:
  - Belongs to ConversationSession

### Analysis Models

#### 4. AnalysisRecord
- Core trading analysis data with ML predictions
- **Fields**: id, proposalId, sessionId, timestamp, symbol, interval, type, proposalData (JSON), trackingData (JSON), performanceData (JSON)
- **Types**: support, resistance, trendline, pattern, fibonacci, volume
- **Relationships**:
  - Belongs to ConversationSession (optional)
  - Has many TouchEvents

#### 5. TouchEvent
- Tracks price interactions with analysis levels
- **Fields**: id, recordId, timestamp, price, result (bounce/break/test), volume, strength
- **Relationships**:
  - Belongs to AnalysisRecord

#### 6. PatternAnalysis
- Technical pattern recognition results
- **Fields**: id, sessionId, type, symbol, interval, timeRange, confidence, visualization (JSON), metrics (JSON), tradingImplication
- **Pattern Types**: headAndShoulders, doubleTop/Bottom, triangles, wedges, flags, channels, etc.
- **Relationships**:
  - Belongs to ConversationSession (optional)

### Market Data Models

#### 7. MarketData
- OHLCV candle data
- **Fields**: symbol, interval, time, open, high, low, close, volume
- **Primary Key**: Composite (symbol, interval, time)
- **Access**: Public read access

#### 8. TechnicalIndicator
- Calculated technical indicators
- **Fields**: symbol, interval, indicatorType, time, values (JSON), config (JSON)
- **Types**: rsi, macd, ma, bollinger
- **Primary Key**: Composite (symbol, interval, indicatorType, time)
- **Access**: Public read access

### User Features

#### 9. ChartDrawing
- User-created chart annotations
- **Fields**: id, sessionId, type, points (JSON), style (JSON), price, time, levels (JSON), metadata
- **Types**: trendline, fibonacci, horizontal, vertical, pattern
- **Relationships**:
  - Belongs to ConversationSession (optional)

#### 10. Alert
- Price alert configurations
- **Fields**: id, userId, symbol, conditions (JSON), metadata, isActive
- **Relationships**:
  - Belongs to User

### System Models

#### 11. SystemLog
- Application logging and monitoring
- **Fields**: id, timestamp, level, source, message, metadata, correlationId, userId, sessionId, agentName, toolName, stack, duration, tags
- **Levels**: debug, info, warn, error, critical
- **Relationships**:
  - Belongs to User (optional)
  - Belongs to ConversationSession (optional)

## Database Indexes

### Performance Indexes
- `analysis_records`: 
  - Composite index on (symbol, timestamp)
  - GIN index on proposalData (JSON search)
  - GIN index on trackingData (JSON search)
  - Index on sessionId
  - Index on type with trackingData
- `touch_events`: Composite index on (recordId, timestamp)
- `conversation_messages`: 
  - Composite index on (sessionId, timestamp)
  - Index on agentId
  - GIN index on metadata->embedding (for semantic search)
- `pattern_analyses`: 
  - Index on sessionId
  - Composite index on (symbol, interval)
- `system_logs`:
  - Composite index on (timestamp, level)
  - Index on correlationId, sessionId, userId
- `alerts`: Composite index on (userId, symbol)

## Migration Strategy

1. **Prisma Migrations**: Schema changes managed through Prisma CLI
2. **Supabase Migrations**: 
   - RLS policies and security rules
   - Custom functions and triggers
   - Located in `/supabase/migrations/`

### Applied Migrations:
- `20250111000001_enable_rls.sql`: Enables RLS on all tables with user-based access policies
- `20250111000002_create_alerts.sql`: Creates alerts and alert_triggers tables

## Special Database Features

### 1. Row Level Security (RLS)
- All tables have RLS enabled
- Policies ensure users can only access their own data
- Market data and technical indicators have public read access

### 2. Automatic Timestamps
- Custom trigger function `trigger_set_timestamp()` 
- Automatically updates `updatedAt` fields on UPDATE operations

### 3. JSON/JSONB Fields
- Extensive use for flexible data structures:
  - Analysis proposals with ML predictions
  - Chart drawing configurations
  - Alert conditions
  - System log metadata
- GIN indexes for efficient JSON querying

### 4. Decimal Precision
- Price and volume fields use Decimal type for financial accuracy

### 5. UUID Primary Keys
- All tables use UUID v4 for distributed system compatibility

## Seed Data
- Development seed file at `/supabase/seed.sql`
- Includes sample:
  - Users and sessions
  - Market data (BTC/ETH)
  - Analysis records with ML predictions
  - Technical indicators
  - Chart patterns
  - System logs