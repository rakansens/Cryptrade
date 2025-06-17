# CI/CD Setup Documentation

## Overview

This document describes the CI/CD pipeline configuration for the Cryptrade project using GitHub Actions.

## Workflows

### 1. Test CI (`test.yml`)

**Trigger**: On push to main branch and all pull requests

**Purpose**: Run comprehensive test suite with parallel execution

**Key Features**:
- Matrix strategy for Node.js versions (18.x, 20.x)
- Parallel test execution with sharding (3 shards)
- Separate unit and integration test runs
- PostgreSQL service container for database tests
- Code coverage collection and reporting to Codecov
- Performance benchmarks on pull requests

**Jobs**:
1. **test**: Main test execution with matrix strategy
   - Type checking
   - Linting
   - Unit tests (sharded)
   - Integration tests (sharded)
   - Coverage artifact upload

2. **coverage**: Coverage aggregation and reporting
   - Merges coverage from all shards
   - Uploads to Codecov
   - Comments on PRs with coverage delta

3. **performance**: Performance regression testing (PR only)
   - Runs benchmarks
   - Compares with baseline
   - Comments results on PR

### 2. E2E Tests (`e2e.yml`)

**Trigger**: 
- Nightly schedule (2:00 AM UTC)
- Manual workflow dispatch with test suite selection

**Purpose**: Comprehensive end-to-end testing across all browsers

**Key Features**:
- Full browser matrix (Chromium, Firefox, WebKit)
- 5-way sharding for faster execution
- PostgreSQL and Redis service containers
- Test artifact storage (screenshots, traces, videos)
- Performance regression testing with k6
- Failure notifications via email and Slack
- Automatic issue creation for failures

**Jobs**:
1. **e2e-full-suite**: Main E2E test execution
   - Browser matrix testing
   - Parallel execution with sharding
   - Artifact collection on failures

2. **e2e-report**: Test report aggregation
   - Merges all test reports
   - Deploys to GitHub Pages

3. **performance-regression**: Load testing
   - k6 load tests
   - Performance analysis
   - Alerts on regression

4. **notify-failures**: Failure notifications
   - Email notifications
   - Slack alerts
   - GitHub issue creation

## Required Secrets

Configure these secrets in your GitHub repository settings:

1. **CODECOV_TOKEN**: Token for Codecov integration
2. **OPENAI_API_KEY**: OpenAI API key for AI features (optional for tests)
3. **SENTRY_DSN**: Sentry error tracking DSN (optional)
4. **SLACK_WEBHOOK**: Slack webhook URL for notifications
5. **EMAIL_USERNAME**: SMTP username for email notifications
6. **EMAIL_PASSWORD**: SMTP password for email notifications
7. **NOTIFICATION_EMAIL**: Email address to receive notifications

## Branch Protection Rules

Configure these branch protection rules for the `main` branch:

1. **Require status checks to pass**:
   - `test / test (18.x, unit, 1)`
   - `test / test (18.x, unit, 2)`
   - `test / test (18.x, unit, 3)`
   - `test / test (18.x, integration, 1)`
   - `test / test (18.x, integration, 2)`
   - `test / test (18.x, integration, 3)`
   - `test / test (20.x, unit, 1)`
   - `test / test (20.x, unit, 2)`
   - `test / test (20.x, unit, 3)`
   - `test / test (20.x, integration, 1)`
   - `test / test (20.x, integration, 2)`
   - `test / test (20.x, integration, 3)`
   - `coverage`

2. **Require branches to be up to date before merging**

3. **Require code reviews** (at least 1)

4. **Dismiss stale pull request approvals**

5. **Restrict who can push to matching branches** (optional)

## Local Development

### Running Tests Locally

```bash
# Run all tests
npm test

# Run unit tests with coverage
npm run test:unit -- --coverage

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run specific E2E browser tests
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

### Performance Testing

```bash
# Run performance benchmarks
npm run benchmark

# Compare with baseline
npm run benchmark:compare

# Save new baseline
npm run benchmark:baseline
```

## Monitoring and Maintenance

### Coverage Reports

- Coverage reports are automatically uploaded to Codecov
- View detailed coverage at: https://codecov.io/gh/yourusername/cryptrade
- Coverage trends are tracked over time

### E2E Test Reports

- Nightly E2E test reports are published to GitHub Pages
- Access reports at: https://yourusername.github.io/cryptrade/e2e-reports/
- Failed test artifacts (screenshots, traces) are retained for 3 days

### Performance Monitoring

- Performance benchmarks run on every PR
- Baseline metrics are stored and compared
- Regressions automatically fail the build

### Failure Notifications

- Email notifications sent for E2E failures
- Slack alerts for performance regressions
- GitHub issues created for main branch failures

## Troubleshooting

### Common Issues

1. **PostgreSQL connection failures**
   - Ensure DATABASE_URL uses correct host/port
   - Check service container health

2. **Playwright browser installation**
   - Browsers are cached to speed up runs
   - Clear cache if installation issues persist

3. **Coverage merge failures**
   - Ensure all shards complete successfully
   - Check artifact upload/download steps

4. **Performance test flakiness**
   - Adjust k6 thresholds if needed
   - Consider infrastructure variations

## Best Practices

1. **Keep tests fast**
   - Use sharding for parallel execution
   - Mock external dependencies
   - Optimize test data setup

2. **Maintain test stability**
   - Use proper wait conditions in E2E tests
   - Implement retry logic for flaky tests
   - Regular test maintenance

3. **Monitor metrics**
   - Track test execution time trends
   - Monitor coverage trends
   - Review performance baselines regularly

4. **Update dependencies**
   - Keep GitHub Actions up to date
   - Update test framework versions
   - Review and update Node.js versions