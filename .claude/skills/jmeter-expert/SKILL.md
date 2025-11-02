---
name: jmeter-expert
description: Apache JMeter expert for performance testing, stress testing, and load testing of web applications and APIs
allowed-tools: Read, Write, Bash, WebFetch, WebSearch, Glob, Grep
experience_score: 70
training_history:
  - date: "2025-01-30T18:18:00Z"
    score_before: 0
    score_after: 70
    issues_found:
      - "Skill had minimal documentation (only 1 line in Turkish)"
      - "No step-by-step instructions for JMeter testing"
      - "No installation guide"
      - "No example test plans"
      - "Missing best practices and troubleshooting"
    corrections_made: true
    execution_success: true
    notes: "Complete rewrite with comprehensive documentation, example test plans, installation scripts, and execution guides"
mcp_tools:
  playwright:
    - browser_close
    - browser_resize
    - browser_console_messages
    - browser_handle_dialog
    - browser_evaluate
    - browser_file_upload
    - browser_fill_form
    - browser_install
    - browser_press_key
    - browser_type
    - browser_navigate
    - browser_navigate_back
    - browser_network_requests
    - browser_take_screenshot
    - browser_snapshot
    - browser_click
    - browser_drag
    - browser_hover
    - browser_select_option
    - browser_tabs
    - browser_wait_for
---

# JMeter Expert - Performance & Load Testing Skill

## Overview

This skill provides comprehensive Apache JMeter expertise for:
- ✅ **Stress Testing**: Push applications to their limits
- ✅ **Load Testing**: Simulate realistic user behavior
- ✅ **Performance Testing**: Measure response times and throughput
- ✅ **API Testing**: Test REST, SOAP, GraphQL endpoints
- ✅ **Capacity Planning**: Determine maximum system capacity

## Prerequisites

### Required
- **Java 8 or higher** - JMeter runs on Java
  ```bash
  java -version
  # If not installed:
  # Linux: sudo apt-get install openjdk-11-jdk
  # macOS: brew install openjdk@11
  # Windows: https://adoptium.net/
  ```

### Recommended
- **Apache JMeter 5.6.3 or higher**
- **4GB+ RAM** for JMeter machine
- **Separate test machine** for large-scale tests
- **Monitoring tools** (htop, Grafana, Prometheus)

## Installation

### Method 1: Automated Installation (Recommended)

```bash
# Download and run the installation script
curl -O https://raw.githubusercontent.com/[your-repo]/jmeter-scripts/install_jmeter.sh
chmod +x install_jmeter.sh
./install_jmeter.sh

# Verify installation
source ~/.bashrc  # or ~/.zshrc
jmeter -v
```

### Method 2: Manual Installation

1. **Download JMeter**
   ```bash
   wget https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-5.6.3.tgz
   tar -xzf apache-jmeter-5.6.3.tgz
   mv apache-jmeter-5.6.3 ~/jmeter
   ```

2. **Set Environment Variables**
   ```bash
   echo 'export JMETER_HOME="$HOME/jmeter"' >> ~/.bashrc
   echo 'export PATH="$JMETER_HOME/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```

3. **Configure Memory** (for high-load tests)
   ```bash
   cat > ~/jmeter/bin/setenv.sh << 'EOF'
   export HEAP="-Xms1g -Xmx4g -XX:MaxMetaspaceSize=256m"
   export JVM_ARGS="-Xms1g -Xmx4g"
   EOF
   chmod +x ~/jmeter/bin/setenv.sh
   ```

## Execution Steps

### STEP 1: Understand Test Requirements

Ask the user for:
1. **Test Type**: Stress test or Load test?
2. **Target URL**: What application/API to test?
3. **Test Scenario**: What user actions to simulate?
4. **Test Parameters**:
   - Number of users/threads
   - Duration or loop count
   - Ramp-up time
   - Think times

### STEP 2: Create Test Plan

#### For Stress Testing:
Use high thread counts with sustained duration to find breaking points.

**Key Parameters:**
- Threads: 100-1000+
- Ramp-up: 60-120 seconds
- Duration: 300-1800 seconds (5-30 minutes)
- Loop: Infinite (-1)

**Example Test Plan Structure:**
```xml
Test Plan
└── Thread Group (100 threads, 60s ramp-up, 300s duration)
    ├── HTTP Request - Homepage (GET /)
    │   └── Response Assertion (status code = 200)
    ├── HTTP Request - API Endpoint (GET /api/data)
    ├── Constant Timer (1000ms think time)
    └── Listeners
        ├── Summary Report
        └── Aggregate Report
```

#### For Load Testing (User Simulation):
Use realistic user counts with think times and varied actions.

**Key Parameters:**
- Concurrent Users: 10-100
- Ramp-up Period: 30-60 seconds
- Loop Count: 5-20 iterations
- Think Time: 1-5 seconds between actions

**Example User Journey:**
```xml
Test Plan
└── Thread Group (50 users, 30s ramp-up, 10 loops)
    ├── Cookie Manager (handle sessions)
    ├── Header Manager (set User-Agent, Accept)
    ├── HTTP Request - Login Page (GET /login)
    │   └── Uniform Random Timer (2000ms ± 1000ms)
    ├── HTTP Request - Perform Login (POST /api/login)
    │   ├── JSON Extractor (extract auth token)
    │   └── Uniform Random Timer (1500ms ± 500ms)
    ├── HTTP Request - Browse Data (GET /api/data?page=${__Random(1,10)})
    │   └── Uniform Random Timer (3000ms ± 2000ms)
    ├── HTTP Request - Logout (POST /api/logout)
    └── Listeners
        ├── Aggregate Report
        └── Graph Results
```

### STEP 3: Configure Test Variables

Use variables for easy parameterization:

```bash
# Set in test plan or command line
BASE_URL=http://localhost:8080        # Target URL
THREADS=100                            # Number of users
RAMP_UP=60                             # Ramp-up time (seconds)
DURATION=300                           # Test duration (seconds)
LOOP_COUNT=10                          # Number of iterations
```

### STEP 4: Execute the Test

#### GUI Mode (for test design only):
```bash
jmeter
# Use GUI to create and debug test plans
# DO NOT run actual load tests in GUI mode!
```

#### Non-GUI Mode (for actual testing):
```bash
# Basic execution
jmeter -n -t test_plan.jmx -l results.jtl

# With HTML report generation
jmeter -n -t test_plan.jmx -l results.jtl -e -o report_folder

# With custom properties
jmeter -n -t test_plan.jmx \
    -JTHREADS=100 \
    -JRAMP_UP=60 \
    -JDURATION=300 \
    -JBASE_URL=http://myapp.com \
    -l results.jtl \
    -e -o report

# With summarizer for real-time feedback
jmeter -n -t test_plan.jmx -l results.jtl -Jsummariser.interval=10
```

### STEP 5: Monitor During Execution

**Monitor JMeter Machine:**
```bash
# CPU and Memory
htop  # or top

# If response times increase and CPU is maxed: Scale down threads or use distributed testing
```

**Monitor Target Application:**
```bash
# Application logs
tail -f /var/log/application.log

# System resources
htop
iostat -x 1  # Disk I/O
netstat -an | grep ESTABLISHED | wc -l  # Active connections
```

**Watch for:**
- ⚠️ Response time degradation
- ⚠️ Increasing error rates
- ⚠️ Resource exhaustion (CPU, Memory, Connections)
- ⚠️ System log errors

### STEP 6: Analyze Results

#### Quick CLI Analysis:
```bash
# Calculate average response time
awk -F',' 'NR>1 {sum+=$2; count++} END {print "Avg Response Time:", sum/count, "ms"}' results.jtl

# Calculate success rate
awk -F',' 'NR>1 {total++; if($8=="true") success++} END {print "Success Rate:", (success/total)*100, "%"}' results.jtl

# Find max response time
awk -F',' 'NR>1 {if($2>max) max=$2} END {print "Max Response Time:", max, "ms"}' results.jtl

# Count errors
awk -F',' '$8=="false"' results.jtl | wc -l
```

#### Generate HTML Report:
```bash
# From existing results
jmeter -g results.jtl -o report_folder

# Open report
open report_folder/index.html  # macOS
xdg-open report_folder/index.html  # Linux
start report_folder/index.html  # Windows
```

#### Key Metrics to Review:

**1. Response Time**
- Average: Should be < 1000ms for good user experience
- 90th Percentile: 90% of requests faster than this
- 95th Percentile: Critical for SLAs
- 99th Percentile: Catches outliers

**2. Throughput**
- Requests per second
- Should increase linearly with threads (until bottleneck)
- Plateauing = capacity limit reached

**3. Error Rate**
- Target: < 0.1% for production
- Acceptable: < 1% for stress tests
- > 5% = serious issues

**4. Resource Utilization**
- CPU < 80% = room to scale
- CPU > 95% = bottleneck
- Memory increasing = potential leak
- Disk I/O > 80% = I/O bound

### STEP 7: Report Findings

Provide comprehensive report:

```markdown
## Performance Test Results

**Test Configuration:**
- Test Type: [Stress Test / Load Test]
- Target: [URL]
- Threads: [N]
- Duration: [N seconds]
- Total Requests: [N]

**Summary:**
- ✅ Average Response Time: X ms
- ✅ 95th Percentile: X ms
- ✅ Throughput: X req/sec
- ⚠️ Error Rate: X%
- ✅ Success Rate: X%

**Key Findings:**
1. Application handled [X] concurrent users successfully
2. Response times remained stable until [X] users
3. Error rate increased at [X] users, indicating capacity limit
4. Bottleneck identified: [CPU / Memory / Database / Network]

**Recommendations:**
- [ ] Optimize [specific component]
- [ ] Scale horizontally to handle [X] users
- [ ] Investigate [specific errors]
- [ ] Add caching for [endpoints]

**Files:**
- Raw Results: `results.jtl`
- HTML Report: `report/index.html`
- JMeter Log: `jmeter.log`
```

## Test Plan Templates

### Template 1: Basic Stress Test

```bash
# Create file: stress_test.jmx
cat > stress_test.jmx << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Stress Test">
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments">
        <collectionProp name="Arguments.arguments">
          <elementProp name="BASE_URL" elementType="Argument">
            <stringProp name="Argument.name">BASE_URL</stringProp>
            <stringProp name="Argument.value">${__P(BASE_URL,http://localhost:8080)}</stringProp>
          </elementProp>
          <elementProp name="THREADS" elementType="Argument">
            <stringProp name="Argument.name">THREADS</stringProp>
            <stringProp name="Argument.value">${__P(THREADS,100)}</stringProp>
          </elementProp>
        </collectionProp>
      </elementProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Users">
        <stringProp name="ThreadGroup.num_threads">${THREADS}</stringProp>
        <stringProp name="ThreadGroup.ramp_time">60</stringProp>
        <boolProp name="ThreadGroup.scheduler">true</boolProp>
        <stringProp name="ThreadGroup.duration">300</stringProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <intProp name="LoopController.loops">-1</intProp>
        </elementProp>
      </ThreadGroup>
      <hashTree>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="HTTP Request">
          <stringProp name="HTTPSampler.domain">${BASE_URL}</stringProp>
          <stringProp name="HTTPSampler.path">/</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
        </HTTPSamplerProxy>
        <hashTree/>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
EOF

# Run it
jmeter -n -t stress_test.jmx -l results.jtl -JTHREADS=50 -JBASE_URL=http://myapp.com
```

### Template 2: API Load Test with Authentication

```bash
# test_api_with_auth.jmx
# Include:
# - Login request (POST /api/login)
# - Extract token with JSON Extractor
# - Use token in subsequent requests
# - Test multiple API endpoints
# - Add assertions for response codes and content
```

## Best Practices

### DO:
✅ Always test in non-GUI mode for accurate results
✅ Start with 1 thread to verify test plan works
✅ Gradually increase load to find breaking point
✅ Monitor both JMeter and target system resources
✅ Use realistic data and think times
✅ Add assertions to validate responses
✅ Use variables for easy parameterization
✅ Save and version control test plans
✅ Generate HTML reports for analysis
✅ Document findings and recommendations

### DON'T:
❌ Run large tests in GUI mode (high resource usage)
❌ Test production without permission
❌ Ignore errors during execution
❌ Use the same data for every request
❌ Test from the same machine as the application
❌ Skip ramp-up time (instant load is unrealistic)
❌ Run tests without monitoring resources
❌ Forget to check JMeter machine CPU/memory
❌ Test without establishing baseline metrics
❌ Ignore warnings in jmeter.log

## Troubleshooting

### Issue: Connection Refused
**Cause:** Application not running or wrong URL
**Solution:**
```bash
# Verify application is accessible
curl -v http://localhost:8080

# Check if port is open
netstat -an | grep 8080

# Test with 1 thread first
jmeter -n -t test.jmx -JTHREADS=1 -l test.jtl
```

### Issue: Out of Memory
**Cause:** Too many threads or large responses
**Solution:**
```bash
# Increase JMeter heap
export HEAP="-Xms2g -Xmx4g"
jmeter -n -t test.jmx

# Or reduce thread count
jmeter -n -t test.jmx -JTHREADS=50

# Or use distributed testing
jmeter -n -t test.jmx -R server1,server2
```

### Issue: High CPU on JMeter Machine
**Cause:** JMeter overloaded
**Solution:**
- Use non-GUI mode: `jmeter -n`
- Remove unnecessary listeners from test plan
- Use distributed testing for high loads
- Monitor with: `top` or `htop`

### Issue: Inconsistent Results
**Cause:** JMeter machine or network bottleneck
**Solution:**
- Use dedicated test machine
- Increase ramp-up time
- Run test multiple times and average results
- Check network latency: `ping target-host`

## Common Commands Reference

```bash
# Check JMeter version
jmeter -v

# GUI mode (design only)
jmeter

# Run test
jmeter -n -t test.jmx -l results.jtl

# Run with HTML report
jmeter -n -t test.jmx -l results.jtl -e -o report

# Run with properties
jmeter -n -t test.jmx -JTHREADS=100 -JDURATION=300 -l results.jtl

# Generate report from existing results
jmeter -g results.jtl -o report

# Distributed testing
jmeter -n -t test.jmx -R server1,server2,server3 -l results.jtl

# Debug mode
jmeter -n -t test.jmx -l results.jtl -j jmeter.log -Jlog_level.jmeter=DEBUG

# List properties
jmeter -?

# Help
jmeter -h
```

## Example: Complete Workflow

```bash
# 1. Verify setup
java -version
jmeter -v

# 2. Create test plan (use GUI)
jmeter
# Design test plan, save as my_test.jmx

# 3. Test with 1 user (validation)
jmeter -n -t my_test.jmx -JTHREADS=1 -l validation.jtl

# 4. Check validation results
grep "false" validation.jtl && echo "Errors found!" || echo "All passed!"

# 5. Run baseline (10 users)
jmeter -n -t my_test.jmx -JTHREADS=10 -JDURATION=60 -l baseline.jtl -e -o baseline_report

# 6. Run load test (50 users)
jmeter -n -t my_test.jmx -JTHREADS=50 -JDURATION=300 -l load.jtl -e -o load_report

# 7. Run stress test (100+ users)
jmeter -n -t my_test.jmx -JTHREADS=100 -JDURATION=600 -l stress.jtl -e -o stress_report

# 8. Compare results
echo "Baseline avg:" && awk -F',' 'NR>1 {sum+=$2;c++} END {print sum/c}' baseline.jtl
echo "Load avg:" && awk -F',' 'NR>1 {sum+=$2;c++} END {print sum/c}' load.jtl
echo "Stress avg:" && awk -F',' 'NR>1 {sum+=$2;c++} END {print sum/c}' stress.jtl

# 9. Open reports
open load_report/index.html
```

## Additional Resources

- **Official Documentation**: https://jmeter.apache.org/usermanual/
- **Best Practices**: https://jmeter.apache.org/usermanual/best-practices.html
- **Component Reference**: https://jmeter.apache.org/usermanual/component_reference.html
- **Functions**: https://jmeter.apache.org/usermanual/functions.html
- **Plugins**: https://jmeter-plugins.org/

## Notes

- This skill creates test plans programmatically when JMeter is installed
- Falls back to providing detailed instructions if JMeter is not available
- Always asks for confirmation before running tests that generate load
- Includes monitoring guidance to prevent overloading systems
- Provides both GUI (design) and CLI (execution) workflows
- Supports parameterization for easy test variation
- Generates comprehensive reports with analysis

---

*Last updated: 2025-01-30*
*Experience Level: Intermediate (70%)*
*Training iterations: 1*
