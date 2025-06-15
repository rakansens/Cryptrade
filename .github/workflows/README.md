# CI/CD Workflows

This directory contains GitHub Actions workflows for the Cryptrade project.

## Workflows Overview

### 1. Main CI Pipeline (`ci.yml`)
- **Trigger**: Push to main branch, pull requests
- **Jobs**:
  - Validate: Environment checks, type checking, linting
  - Test: Runs comprehensive test suite
  - Build: Validates Next.js build

### 2. Test Suite (`test.yml`)
- **Trigger**: Push to main/develop, pull requests, manual dispatch
- **Jobs**:
  - Lint: ESLint, TypeScript, Prettier checks
  - Unit Tests: Sharded across 4 parallel jobs
  - Integration Tests: With PostgreSQL service
  - E2E Tests: Playwright tests across Chrome, Firefox, Safari
  - Performance Tests: Benchmarks (main branch only)
  - Coverage Report: Merged coverage from all test types
  - Security Scan: Trivy vulnerability scanning

### 3. E2E Tests (`ci-e2e.yml`)
- **Trigger**: Push to main/develop/feature branches, pull requests
- **Jobs**:
  - Standard E2E tests with Playwright
  - Chaos tests for stress testing
  - Load tests with k6 (main branch only)

### 4. Type Checking (`type-check.yml`)
- **Trigger**: Push to main/develop, pull requests
- **Matrix**: Node.js 18.x and 20.x
- **Jobs**: Type checking and type coverage analysis

### 5. Documentation (`docs.yml`)
- **Trigger**: Push to main (when lib/types/docs change)
- **Jobs**: Build and deploy TypeDoc API documentation

### 6. Complete Test Suite (`test-all.yml`)
- **Trigger**: Weekly schedule, manual dispatch
- **Jobs**: Validates test structure and runs all test suites

## Test Structure

All tests have been migrated to the `/tests` directory:

```
tests/
├── unit/          # Unit tests for individual components
├── integration/   # Integration tests
├── e2e/          # End-to-end Playwright tests
├── performance/  # Performance benchmarks
└── helpers/      # Shared test utilities
```

## Key Updates (2025-06-15)

1. **Test Directory Migration**: All tests moved from scattered `__tests__` directories to centralized `/tests` structure
2. **Import Path Updates**: All test imports updated to use new structure
3. **Package Manager**: Standardized on npm (removed pnpm references)
4. **Coverage Paths**: Updated to reflect new test structure
5. **Helper Files**: Centralized in `/tests/helpers` directory

## Running Tests Locally

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance

# Validate test imports
npm run test:validate

# Run all tests
npm run test:all
```

## Environment Variables

The CI/CD pipelines use mock environment variables for testing. See individual workflow files for the complete list of required variables.

## Troubleshooting

- If tests fail due to import errors, run `npm run test:validate` to check for import issues
- Old `__tests__` directories should be moved to the `/tests` structure
- Ensure all test helpers are imported from `@/tests/helpers/`