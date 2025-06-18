# Store Test Fixes Summary

## Issues Fixed

### 1. Document/Window Not Defined Errors
- Added `@jest-environment jsdom` directive to store tests that use `renderHook` from React Testing Library
- Created `jsdom-environment.js` setup file for DOM-dependent tests
- Fixed tests for: ui-event.store, market.store, analysis-history.store, proposal-approval.store, and others

### 2. Zustand Mocking
- Created comprehensive zustand mock in `__mocks__/zustand.js`
- Created middleware mock in `__mocks__/zustand/middleware.js` with proper CommonJS exports
- Implemented proper persist and subscribeWithSelector middleware mocks
- Added support for both DOM and non-DOM environments

### 3. MSW and Fetch Polyfills
- Added TextEncoder/TextDecoder polyfills for Node.js
- Added ReadableStream, WritableStream, TransformStream polyfills
- Added MessagePort, MessageChannel, BroadcastChannel polyfills
- Integrated undici for fetch API support in Node environment

### 4. Storage Mocking
- Created proper localStorage and sessionStorage mocks with full API support
- Ensured zustand persist middleware works correctly with storage mocks

## Results
- **Before**: Most store tests failing with "document is not defined" errors
- **After**: 286 out of 412 tests passing (69.4% pass rate)
- **Remaining Issues**: 118 tests still failing, likely due to:
  - Specific component/hook integration issues
  - Missing mocks for other dependencies
  - Test-specific logic errors

## Next Steps
To fix the remaining failures:
1. Run individual failing test suites to identify specific errors
2. Add missing mocks for external dependencies
3. Fix test-specific logic issues
4. Update tests to match current implementation

## Files Modified
- `jest.setup.js` - Added polyfills and storage mocks
- `__mocks__/zustand.js` - Complete zustand store mock
- `__mocks__/zustand/middleware.js` - Middleware mocks
- `tests/setup/jsdom-environment.js` - JSDOM setup for tests
- `tests/setup/storage-mock.js` - Storage API mock
- Multiple store test files - Added JSDOM environment directive