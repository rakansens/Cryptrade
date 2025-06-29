# Code Duplication Priority List

**Date**: 2025-06-29  
**Analysis**: Deep code similarity analysis across untouched areas

## 🎯 High Priority Refactoring Opportunities

### 1. **Duplicate Service Files** (CRITICAL)
- **Files**: `semantic-embedding.service.ts` and `semantic-embedding.service.secure.ts`
- **Duplication**: 100% identical functions (calculateSimilarity, getCacheKey, batchGenerateEmbeddings)
- **Impact**: ~200+ lines of exact duplication
- **Solution**: Merge into single service with security flag
- **Effort**: 2-3 hours

### 2. **Database Conversion Utilities** (HIGH)
- **Files**: `db-conversions.ts` and `db-conversions.server.ts`
- **Duplication**: 96% similarity in prepareChartDrawingData, preparePatternAnalysisData
- **Impact**: ~100+ lines of near-identical code
- **Solution**: Create shared conversion base with platform-specific extensions
- **Effort**: 3-4 hours

### 3. **API Route Error Handling** (HIGH)
- **Pattern**: Repeated catch blocks in chart session routes
- **Files**: 13+ similar error handling patterns in API routes
- **Impact**: ~365 lines across API routes
- **Solution**: Create error handling middleware
- **Effort**: 4-6 hours

### 4. **Drawing Event Handlers** (MEDIUM)
- **Files**: `useDrawingEventHandlers.ts` and `useDrawingEventHandlers-refactored.ts`
- **Duplication**: 100% identical toChartDrawingLW functions
- **Impact**: ~50+ lines
- **Solution**: Complete migration to refactored version
- **Effort**: 2-3 hours

### 5. **Log Processing Functions** (LOW)
- **Files**: `app/api/logs/route.ts` and `app/api/logs/stats/route.ts`
- **Duplication**: 100% identical split function
- **Impact**: ~20 lines
- **Solution**: Extract to shared utility
- **Effort**: 1 hour

## 📊 Impact Summary

| Area | Duplicate Pairs | Lines Affected | Priority |
|------|----------------|----------------|----------|
| Services | 8 | ~414 | CRITICAL |
| API Routes | 13 | ~365 | HIGH |
| Utils | 6 | ~283 | HIGH |
| Hooks | 3 | ~78 | MEDIUM |

**Total Estimated Impact**: ~1,140 lines of duplicated code

## 🛠️ Recommended Action Plan

### Week 1: Critical & High Priority
1. **Day 1-2**: Merge duplicate service files
   - Consolidate semantic-embedding services
   - Add comprehensive tests
   - Update all imports

2. **Day 3-4**: Refactor database conversions
   - Create shared base module
   - Implement platform-specific extensions
   - Migrate existing usage

3. **Day 5**: API error handling
   - Create centralized error handler
   - Implement middleware pattern
   - Start migration of high-traffic routes

### Week 2: Medium & Ongoing
1. **Day 1-2**: Complete hook migrations
   - Finish useDrawingEventHandlers migration
   - Remove old implementations
   - Update tests

2. **Day 3-5**: Continue API route refactoring
   - Migrate remaining routes to new patterns
   - Implement request validation middleware
   - Add integration tests

## 🎖️ Success Metrics

1. **Code Reduction**: Target 15-20% reduction in duplicated code
2. **Test Coverage**: Maintain 80%+ coverage
3. **Performance**: No regression in API response times
4. **Developer Experience**: 
   - Easier to add new API routes
   - Consistent error handling
   - Clearer service boundaries

## 🚀 Quick Wins

1. **Immediate**: Delete duplicate files that are 100% identical
2. **This Week**: Extract common utilities from similar functions
3. **Next Sprint**: Implement base classes for repeated patterns

## 📝 Notes

- Focus on exact duplicates first (100% similarity)
- Many duplications are in critical paths (services, API routes)
- Consider using code generation for repetitive patterns
- Document patterns as they're refactored to prevent future duplication