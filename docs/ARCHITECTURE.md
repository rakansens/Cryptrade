# Cryptrade Architecture Documentation

## Architecture Decision Records (ADRs)

### ADR-004: Domain Types Source of Truth

**Date:** 2025-01-02  
**Status:** Implemented  
**Epic:** #4 - Type Unification  

#### Context

The codebase had scattered domain type definitions across multiple files, leading to:

- **Type Duplication**: Same types defined in multiple locations (`PriceData`, `MACDData`, `RSIData`)
- **Circular Dependencies**: Risk of import cycles between schema and type files  
- **Maintenance Overhead**: Updates required in multiple files
- **Inconsistency**: Different versions of the same logical type
- **Developer Confusion**: Unclear single source of truth for domain types

**Problem Files:**
- `/lib/schemas/binance.schema.ts` - Zod schemas + z.infer types
- `/lib/indicators/moving-average.ts` - Duplicate `PriceData`, `MovingAverageData`
- `/lib/indicators/bollinger-bands.ts` - Duplicate `PriceData`, `BollingerBandsData`
- `/lib/indicators/macd.ts` - Duplicate `MACDData`
- `/lib/indicators/rsi.ts` - Duplicate `RSIData`

#### Decision

**We consolidate all market domain types and their Zod schemas into a single source of truth at `/types/market.ts`.**

**Core Principles:**
1. **Single Source**: One file for all market-related types and schemas
2. **Schema-First**: All types generated from Zod schemas using `z.infer<>`
3. **Runtime Safety**: Maintain validation while ensuring type safety
4. **No Breaking Changes**: Preserve all existing functionality

#### Implementation

**New Structure:**
```
/types/market.ts (New Unified File)
├── Zod Schemas (BinanceTradeMessageSchema, ProcessedKlineSchema, etc.)
├── Types via z.infer<> (BinanceTradeMessage, ProcessedKline, etc.)
├── Compatibility Types (for lightweight-charts UTCTimestamp)
└── Validation Helpers (validateBinanceKlines, etc.)
```

**12 Consolidated Types:**
1. `ProcessedKline` - OHLCV candlestick data
2. `PriceData` - Full OHLCV price data (primary version)
3. `BinanceTradeMessage` - Real-time trade events
4. `BinanceKlineMessage` - Real-time kline events  
5. `BinanceTicker24hr` - 24h ticker statistics
6. `PriceUpdate` - Price change events
7. `MarketTicker` - Market ticker data
8. `IndicatorOptions` - Technical indicator settings
9. `RSIData` - Relative Strength Index data
10. `MACDData` - MACD indicator data  
11. `MovingAverageData` - Moving average data
12. `BollingerBandsData` - Bollinger Bands data

**Migration Steps:**
1. ✅ Type inventory and duplication analysis
2. ✅ Created `/types/market.ts` with consolidated schemas
3. ✅ Updated all imports to use unified types
4. ✅ Removed duplicate type definitions
5. ✅ Updated tests and fixed import paths
6. ✅ Updated ESLint configuration
7. ✅ Verified no circular dependencies (madge check)

#### Benefits Achieved

**✅ Eliminated Duplication:**
- 5 duplicate `PriceData` definitions → 1 unified definition
- 2 duplicate `MACDData` definitions → 1 unified definition  
- 2 duplicate `RSIData` definitions → 1 unified definition
- 3 indicator files with duplicate types → clean, import-only files

**✅ Improved Consistency:**
- Single schema validation ensures runtime and compile-time consistency
- z.infer<> guarantees types match validation rules
- Unified export through `/types/index.ts`

**✅ Better Developer Experience:**
- Clear import paths: `import { ProcessedKline } from '@/types/market'`
- IDE autocomplete works consistently
- No more "which PriceData should I use?" confusion

**✅ Maintained Performance:**
- Environment-aware validation (strict in dev, fast in production)
- Existing validation functions preserved
- No runtime performance impact

#### Verification

**Static Analysis:**
- ✅ TypeScript compilation passes
- ✅ ESLint passes (updated rules to allow new structure)
- ✅ Zero circular dependencies (madge verification)

**Testing:**
- ✅ All existing tests pass
- ✅ New unified type tests added
- ✅ Test coverage maintained ≥80%

**Integration:**
- ✅ API routes updated and functional
- ✅ WebSocket connections working
- ✅ Chart indicators rendering correctly
- ✅ Real-time price updates working

#### Impact Assessment

**Before Epic #4:**
```
lib/schemas/binance.schema.ts (298 lines, 12 types + schemas)
lib/indicators/moving-average.ts (duplicate PriceData, MovingAverageData)
lib/indicators/bollinger-bands.ts (duplicate PriceData, BollingerBandsData)  
lib/indicators/macd.ts (duplicate MACDData)
lib/indicators/rsi.ts (duplicate RSIData)
```

**After Epic #4:**
```
types/market.ts (355 lines, ALL market types + schemas + validation)
lib/indicators/*.ts (clean function-only files, import types)
types/__tests__/market.test.ts (comprehensive type validation tests)
```

**Lines of Code Impact:**
- Removed ~50 lines of duplicate type definitions
- Added 355 lines of well-documented unified types
- Net improvement in code organization and maintainability

#### Maintenance Guidelines

**For Future Development:**

1. **New Market Types**: Add to `/types/market.ts` with Zod schema first
2. **Type Changes**: Update schema, type auto-updates via z.infer<>
3. **Validation**: Use existing helpers or extend validation functions
4. **Imports**: Always import from `@/types/market` or `@/types` (re-exported)

**Anti-Patterns to Avoid:**
- ❌ Creating new type files for market domain types
- ❌ Defining types without corresponding Zod schemas
- ❌ Duplicating type definitions in component files
- ❌ Direct imports from removed schema locations

**Monitoring:**
- ESLint rules prevent imports from old locations
- Madge CI check prevents circular dependencies
- TypeScript ensures compile-time type safety

#### References

- Epic #4 Implementation: Type inventory document `/types/market-draft.md`
- Codemod Script: `/tools/codemods/market-types.js`
- Dependency Analysis: `/reports/madge-market.json`
- Test Migration: `/types/__tests__/market.test.ts`

---

*This ADR documents the successful consolidation of market domain types, eliminating duplication and establishing a maintainable single source of truth for the Cryptrade application.*

### ADR-006: Centralized Environment Variable Management

**Date:** 2025-01-06  
**Status:** Implemented  
**Epic:** #5 - Environment Configuration Centralization  

#### Context

The application had scattered and unsafe environment variable access patterns throughout the codebase:

- **Direct process.env Access**: Untyped `process.env.VARIABLE_NAME` usage in 20+ locations
- **No Runtime Validation**: Missing or invalid environment variables caused runtime failures
- **Type Safety Gap**: No compile-time checking for required environment variables
- **Inconsistent Defaults**: Default values scattered across different files
- **Browser/Server Incompatibility**: process.env access issues in client-side code
- **Hidden Dependencies**: Unclear which environment variables each module requires

**Problem Areas:**
- API routes accessing `process.env.OPENAI_API_KEY` without validation
- Client-side components importing server-only environment code
- Test files manually mocking `process.env` with complex setup/teardown
- Logger configuration scattered across multiple files
- Feature flags accessed inconsistently

#### Decision

**We implement a centralized, type-safe environment variable management system at `/config/env.ts` with Zod validation and fail-fast initialization.**

**Core Principles:**
1. **Single Source of Truth**: All environment variables defined in one schema
2. **Type Safety**: Zod schemas with TypeScript inference  
3. **Fail-Fast**: Application exits immediately if required variables are missing
4. **Environment Awareness**: Different validation rules for dev/test/production
5. **Client/Server Safety**: Safe environment access patterns for both contexts

#### Implementation

**New Architecture:**
```
/config/env.ts (Centralized Configuration)
├── EnvSchema (Zod validation schema)
├── Env (TypeScript type via z.infer<>)
├── loadEnv() (Singleton initialization with caching)
├── Utility Functions (isDevelopment, isProduction, hasRedis, etc.)
└── Cache Management (_resetEnvCache for testing)

/config/testing/setupEnvMock.ts (Test Utilities)
├── mockEnv() (Clean environment mocking API)
├── createTestEnv() (Default test environment)
└── resetEnvCache() (Test isolation helpers)
```

**16 Managed Environment Variables:**
1. `NODE_ENV` - Application environment (development/test/production)
2. `OPENAI_API_KEY` - OpenAI API access (required)
3. `PORT` - Server port (default: 3000)
4. `LOG_LEVEL` - Logging verbosity (debug/info/warn/error)
5. `LOG_TRANSPORT` - Logging destination (console/noop/sentry/multi)
6. `DISABLE_CONSOLE_LOGS` - Console logging control
7. `ENABLE_SENTRY` - Error tracking toggle
8. `FORCE_VALIDATION` - Development validation override
9. `ALLOWED_ORIGINS` - CORS origins configuration
10. `UPSTASH_REDIS_REST_URL` - Redis database URL
11. `UPSTASH_REDIS_REST_TOKEN` - Redis authentication
12. `KV_REST_API_URL` - Vercel KV database URL  
13. `KV_REST_API_TOKEN` - Vercel KV authentication
14. `NEXT_PUBLIC_BASE_URL` - Application base URL
15. `VERCEL_URL` - Vercel deployment URL
16. `USE_NEW_WS_MANAGER` - WebSocket implementation feature flag

**Migration Process:**
1. ✅ Created centralized schema with Zod validation
2. ✅ Implemented singleton pattern with caching
3. ✅ Built test utilities for clean environment mocking  
4. ✅ Automated migration of 8 files using JSCodeshift codemod
5. ✅ Updated 20+ process.env usages to use centralized system
6. ✅ Fixed browser/server compatibility issues
7. ✅ Configured ESLint rules to prevent direct process.env access
8. ✅ Added CI validation gate

#### Benefits Achieved

**✅ Type Safety Implemented:**
```typescript
// Before: Unsafe, untyped access
const apiKey = process.env.OPENAI_API_KEY; // string | undefined

// After: Type-safe with validation  
import { env } from '@/config/env';
const apiKey = env.OPENAI_API_KEY; // string (guaranteed)
```

**✅ Fail-Fast Validation:**
- Application exits immediately with detailed error messages for missing variables
- Production environments enforce stricter validation rules
- Development includes helpful setup guidance

**✅ Improved Developer Experience:**
```typescript
// Utility functions for common patterns
if (isDevelopment()) { /* dev-only code */ }
if (hasRedis()) { /* Redis-dependent features */ }
const port = getPort(); // Always returns valid number
```

**✅ Clean Test Environment:**
```typescript
// Before: Manual process.env manipulation
beforeEach(() => {
  const originalEnv = { ...process.env };
  process.env.OPENAI_API_KEY = 'test-key';
  // Complex cleanup logic...
});

// After: Clean utility API
beforeEach(() => {
  restoreEnv = mockEnv({ OPENAI_API_KEY: 'test-key' });
});
afterEach(() => restoreEnv());
```

**✅ Browser/Server Compatibility:**
- Safe environment access patterns prevent client-side errors
- Environment-aware code loading (server vs. browser detection)
- Minimal environment creation for client-side contexts

#### Configuration Schema

**Required Variables:**
- `OPENAI_API_KEY` - Must be non-empty string in all environments

**Optional Variables with Defaults:**
- `NODE_ENV` → 'development'
- `PORT` → 3000  
- `LOG_TRANSPORT` → 'console'

**Production-Specific Validation:**
```typescript
EnvSchema.refine((data) => {
  if (data.NODE_ENV === 'production') {
    if (!data.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required in production');
    }
  }
  return true;
});
```

#### Usage Examples

**Basic Environment Access:**
```typescript
import { env, isDevelopment, hasRedis } from '@/config/env';

// Type-safe access
const apiKey = env.OPENAI_API_KEY; // string
const port = env.PORT; // number  

// Utility functions
if (isDevelopment()) {
  console.log('Development mode features enabled');
}

if (hasRedis()) {
  // Initialize Redis connection
}
```

**Test Environment Setup:**
```typescript
import { mockEnv, createTestEnv } from '@/config/testing/setupEnvMock';

describe('API Tests', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = mockEnv(createTestEnv({
      OPENAI_API_KEY: 'sk-test-key-12345',
      LOG_TRANSPORT: 'noop'
    }));
  });

  afterEach(() => restoreEnv());
});
```

#### ESLint Integration

**Enforcement Rules:**
```json
{
  "no-restricted-syntax": [
    "error", 
    {
      "selector": "MemberExpression[object.name='process'][property.name='env']",
      "message": "環境変数は '@/config/env' から型安全に取得してください。"
    }
  ]
}
```

**Exceptions for Safe Usage:**
- Test files and testing utilities
- Logger and WebSocket migration files (temporary browser compatibility)
- Setup and configuration files

#### Performance Impact

**Initialization Cost:**
- Single schema validation on first access (cached thereafter)
- ~1-2ms overhead in development, negligible in production
- Browser environment uses minimal fallback configuration

**Memory Usage:**
- Singleton pattern prevents duplicate validation
- Cached environment object reused across modules
- No observable memory impact

#### Error Handling

**Development Environment:**
```
🚨 [Environment] Validation failed!
📋 Missing or invalid environment variables:
   ❌ OPENAI_API_KEY: Required
   ❌ PORT: Expected number, received string

💡 Please check your environment configuration and try again.
📚 See docs/ARCHITECTURE.md for environment setup guide.
```

**Production Environment:**
- Immediate process exit (process.exit(1))
- Detailed error logging for debugging
- No sensitive information exposed in error messages

#### CI/CD Integration

**Validation Gate:**
```yaml
- name: Validate Environment Configuration
  run: node -e "require('./config/env')"
  env:
    NODE_ENV: test
    OPENAI_API_KEY: sk-dummy-key-for-ci-validation
```

**Benefits:**
- Catches configuration issues before deployment
- Validates environment schema in CI pipeline  
- Ensures all required variables are documented

#### Migration Statistics

**Files Updated:** 8 files with automated codemod
**Process.env Usages Migrated:** 20+ direct usages converted
**Test Files Simplified:** 3 test files with cleaner mocking patterns
**ESLint Violations:** Zero remaining direct process.env access
**Test Coverage:** 13/13 environment configuration tests passing

#### Maintenance Guidelines

**Adding New Environment Variables:**
1. Add to `EnvSchema` in `/config/env.ts` with appropriate validation
2. Update type exports (automatic via z.infer<>)
3. Add default values for optional variables
4. Update test utilities if needed
5. Update CI environment configuration

**Modifying Existing Variables:**
1. Update schema validation rules
2. Test with various environment configurations
3. Update documentation and examples
4. Consider backward compatibility impact

**Anti-Patterns to Avoid:**
- ❌ Direct `process.env` access outside approved files
- ❌ Missing validation for new required variables
- ❌ Bypassing the centralized configuration system
- ❌ Environment-specific code without proper guards

#### References

- Implementation Guide: `/config/env.ts`
- Test Utilities: `/config/testing/setupEnvMock.ts`
- Migration Codemod: `/tools/codemods/env-migration.js`
- ESLint Configuration: `.eslintrc.json`
- CI Configuration: `.github/workflows/ci.yml`

---

*This ADR documents the implementation of type-safe, centralized environment variable management, eliminating runtime configuration errors and improving developer experience across the Cryptrade application.*