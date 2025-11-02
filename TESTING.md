# Testing & Validation Guide

## Overview

This document provides comprehensive testing and validation procedures for Claude Agent UI. The testing suite includes End-to-End (E2E) tests, performance benchmarks, and security audits.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Suite Overview](#test-suite-overview)
3. [E2E Testing](#e2e-testing)
4. [Performance Benchmarking](#performance-benchmarking)
5. [Security Audit](#security-audit)
6. [CI/CD Integration](#cicd-integration)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Run All Tests

```bash
# Run complete test suite (E2E + Performance + Security)
bash tests/run-all-tests.sh
```

### Run Individual Test Suites

```bash
# E2E tests only
bash tests/e2e/test-runner.sh

# Performance benchmarks only
bash tests/performance/benchmark.sh

# Security audit only
bash tests/security/security-audit.sh
```

---

## Test Suite Overview

### Test Structure

```
tests/
├── run-all-tests.sh           # Master test runner
├── e2e/
│   └── test-runner.sh         # End-to-end functional tests
├── performance/
│   ├── benchmark.sh           # Performance benchmarks
│   └── results/               # Performance test results
├── security/
│   ├── security-audit.sh      # Security audit
│   └── results/               # Security audit results
└── results/                   # Master test results
```

### Test Categories

| Category    | Purpose                               | Duration | Critical |
|-------------|---------------------------------------|----------|----------|
| E2E         | Functional testing of all services    | ~2 min   | ✅ Yes   |
| Performance | Load testing and benchmarking         | ~5 min   | ⚠️  Medium|
| Security    | Security compliance and vulnerabilities| ~1 min   | ✅ Yes   |

---

## E2E Testing

### What It Tests

The E2E test suite validates:

1. **Database Layer**
   - PostgreSQL connectivity
   - Database schema integrity
   - Table existence and structure

2. **Strapi CMS**
   - Health check endpoint
   - API accessibility
   - Content type endpoints (agents, skills, etc.)
   - Admin panel accessibility

3. **Express Backend**
   - Health check endpoint
   - Manager routes (CRUD operations)
   - Execution routes (task management)
   - SSE (Server-Sent Events) endpoint

4. **Frontend**
   - Static asset serving
   - SPA routing
   - API proxy functionality

5. **Integration**
   - Cross-service communication
   - Data flow between services
   - Nginx reverse proxy

6. **Docker Infrastructure**
   - Container health status
   - Service orchestration
   - Dependency management

### Running E2E Tests

```bash
# Standard run
bash tests/e2e/test-runner.sh

# Verbose output
bash -x tests/e2e/test-runner.sh

# Save results
bash tests/e2e/test-runner.sh | tee e2e-results.log
```

### Expected Results

```
============================================================
Claude Agent UI - E2E Test Suite
============================================================

=== Database Tests ===
Test 1: PostgreSQL is running ... PASSED
Test 2: Database exists ... PASSED
Test 3: Agent table exists ... PASSED
Test 4: Skill table exists ... PASSED

=== Strapi CMS Tests ===
Test 5: Strapi health check ... PASSED
Test 6: Strapi API root accessible ... PASSED
...

Total Tests:  30
Passed Tests: 30
Failed Tests: 0

✅ All tests passed!
```

### Customization

Edit `tests/e2e/test-runner.sh` to:
- Add new test cases
- Modify service URLs
- Adjust timeout values
- Add custom validation logic

---

## Performance Benchmarking

### What It Tests

The performance benchmark suite measures:

1. **Request Throughput**
   - Requests per second (RPS)
   - Concurrent user handling
   - Response times

2. **System Resources**
   - CPU usage under load
   - Memory consumption
   - Network I/O

3. **Database Performance**
   - Connection pool efficiency
   - Cache hit ratios
   - Query performance

4. **Response Time Percentiles**
   - p50 (median)
   - p95 (95th percentile)
   - p99 (99th percentile)

### Running Performance Tests

```bash
# Standard benchmark
bash tests/performance/benchmark.sh

# Custom configuration
CONCURRENT_USERS=20 DURATION=120 bash tests/performance/benchmark.sh
```

### Configuration

Edit `tests/performance/benchmark.sh` to adjust:

```bash
DURATION=60              # Test duration in seconds
CONCURRENT_USERS=10      # Concurrent users
REQUESTS_PER_SECOND=5    # Target RPS
```

### Interpreting Results

Results are saved to `tests/performance/results/benchmark_TIMESTAMP.txt`:

```
============================================================
STRAPI API BENCHMARK - /api/agents
============================================================

Requests per second:    150.23 [#/sec] (mean)
Time per request:       66.561 [ms] (mean)
Transfer rate:          234.56 [Kbytes/sec]
Failed requests:        0

Response Time Percentiles:
  p50: 45ms
  p95: 120ms
  p99: 180ms
```

### Performance Targets

| Metric                  | Target    | Acceptable | Action Required |
|-------------------------|-----------|------------|-----------------|
| Requests/sec (Strapi)   | > 100     | > 50       | < 50            |
| Requests/sec (Express)  | > 200     | > 100      | < 100           |
| Response Time p95       | < 200ms   | < 500ms    | > 500ms         |
| Failed Requests         | 0%        | < 1%       | > 1%            |
| Memory Usage (Total)    | < 2GB     | < 3GB      | > 3GB           |

---

## Security Audit

### What It Tests

The security audit checks:

1. **Environment & Secrets**
   - Environment file security
   - Password strength
   - Secret management
   - No default credentials

2. **Docker Security**
   - Non-root container users
   - No privileged containers
   - Resource limits
   - Health checks

3. **Network Security**
   - CORS configuration
   - Port exposure
   - Rate limiting
   - Security headers

4. **Application Security**
   - HTTPS configuration
   - Production mode
   - Debug mode disabled
   - Error handling

5. **File Permissions**
   - Sensitive file permissions
   - Script executability
   - Backup directory security

6. **Dependencies**
   - Known vulnerabilities (npm audit)
   - Package integrity
   - Version pinning

7. **Database Security**
   - SSL configuration
   - User credentials
   - Backup procedures

### Running Security Audit

```bash
# Standard audit
bash tests/security/security-audit.sh

# Detailed report
bash tests/security/security-audit.sh | tee security-report.log
```

### Expected Output

```
============================================================
Claude Agent UI - Security Audit
============================================================

=== Environment & Secrets ===
Check 1: Environment file exists ... PASS
Check 2: Environment file not in git ... PASS
Check 3: PostgreSQL password is set ... PASS
Check 4: Anthropic API key is set ... PASS
...

Total Checks:   45
Passed:         42
Failed:         1
Warnings:       2

⚠️  2 warnings detected. Review recommended.
```

### Security Levels

| Level    | Description                        | Action            |
|----------|------------------------------------|-------------------|
| CRITICAL | Immediate security risk            | Fix immediately   |
| HIGH     | Significant vulnerability          | Fix within 24h    |
| MEDIUM   | Potential security concern         | Fix within 1 week |
| LOW      | Best practice recommendation       | Address as needed |

### Remediation

Review the generated report in `tests/security/results/security_audit_TIMESTAMP.txt` for:
- Failed checks with severity levels
- Specific remediation steps
- Additional security information

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Start Docker Compose
        run: docker-compose up -d

      - name: Wait for services
        run: sleep 30

      - name: Run E2E Tests
        run: bash tests/e2e/test-runner.sh

      - name: Run Security Audit
        run: bash tests/security/security-audit.sh

      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: tests/results/
```

### Pre-Commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
echo "Running security audit..."
bash tests/security/security-audit.sh
```

### Automated Testing Schedule

```bash
# Add to crontab for daily testing
0 2 * * * cd /path/to/project && bash tests/run-all-tests.sh
```

---

## Troubleshooting

### Common Issues

#### Services Not Running

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs

# Restart services
docker-compose restart
```

#### Failed E2E Tests

```bash
# Check service health
curl http://localhost:1337/_health
curl http://localhost:3001/health

# Check logs for errors
docker-compose logs strapi | tail -50
docker-compose logs express | tail -50
```

#### Performance Issues

```bash
# Check resource usage
docker stats

# Check for memory limits
docker-compose config | grep memory

# Increase resources if needed
```

#### Security Audit Failures

Review the specific failed check:
- CRITICAL: Fix immediately before deployment
- HIGH: Address within 24 hours
- MEDIUM: Plan fix in next sprint
- LOW: Add to backlog

### Test Debugging

Enable verbose mode:

```bash
# Bash debug mode
bash -x tests/e2e/test-runner.sh

# Docker Compose debug
COMPOSE_LOG_LEVEL=DEBUG docker-compose up

# Application debug logs
LOG_LEVEL=debug docker-compose up
```

### Getting Help

If tests fail unexpectedly:

1. Check service logs: `docker-compose logs`
2. Verify environment variables: `docker-compose config`
3. Review test output for specific failures
4. Check resource availability: `docker stats`
5. Consult this documentation

---

## Test Reports

All test runs generate timestamped reports in:

```
tests/
├── results/
│   └── test_run_TIMESTAMP.log
├── e2e/
│   └── (inline results)
├── performance/results/
│   ├── benchmark_TIMESTAMP.txt
│   └── *.tsv (raw data)
└── security/results/
    └── security_audit_TIMESTAMP.txt
```

### Report Retention

- Keep last 30 days of test results
- Archive older results to cold storage
- Review trends over time

---

## Best Practices

1. **Run tests before every deployment**
2. **Review security audit weekly**
3. **Monitor performance trends**
4. **Keep test infrastructure up to date**
5. **Document any test customizations**
6. **Integrate tests into CI/CD pipeline**
7. **Address failures immediately**
8. **Maintain test coverage > 80%**

---

## Next Steps

After validating all tests pass:

1. Deploy to staging environment
2. Run tests against staging
3. Perform user acceptance testing
4. Deploy to production
5. Monitor production metrics
6. Schedule regular test runs

---

**Last Updated:** 2025-10-31
**Maintained By:** Claude Agent UI Team
