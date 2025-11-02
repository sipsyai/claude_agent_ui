# PostgreSQL Server Configuration

**Source:** https://www.postgresql.org/docs/18/runtime-config.html
**Downloaded:** 2025-10-31

---

# PostgreSQL 18: Server Configuration

## Overview

PostgreSQL provides numerous configuration parameters that regulate database system behavior. This chapter explains how to interact with these parameters and details each one comprehensively.

## Table of Contents

### 19.1 Setting Parameters
- Parameter Names and Values
- Parameter Interaction via Configuration File
- Parameter Interaction via SQL
- Parameter Interaction via Shell
- Managing Configuration File Contents

### 19.2 File Locations

### 19.3 Connections and Authentication
- Connection Settings
- TCP Settings
- Authentication
- SSL

### 19.4 Resource Consumption
- Memory
- Disk
- Kernel Resource Usage
- Background Writer
- I/O
- Worker Processes

### 19.5 Write Ahead Log (WAL)
- Settings
- Checkpoints
- Archiving
- Recovery
- Archive Recovery
- Recovery Target
- WAL Summarization

### 19.6 Replication
- Sending Servers
- Primary Server
- Standby Servers
- Subscribers

### 19.7 Query Planning
- Planner Method Configuration
- Planner Cost Constants
- Genetic Query Optimizer
- Other Planner Options

### 19.8 Error Reporting and Logging
- Where to Log
- When to Log
- What to Log
- CSV-Format Log Output
- JSON-Format Log Output
- Process Title

### 19.9 Run-time Statistics
- Cumulative Query and Index Statistics
- Statistics Monitoring

### 19.10 Vacuuming
- Automatic Vacuuming
- Cost-based Vacuum Delay
- Default Behavior
- Freezing

### 19.11 Client Connection Defaults
- Statement Behavior
- Locale and Formatting
- Shared Library Preloading
- Other Defaults

### 19.12 Lock Management

### 19.13 Version and Platform Compatibility
- Previous PostgreSQL Versions
- Platform and Client Compatibility

### 19.14 Error Handling

### 19.15 Preset Options

### 19.16 Customized Options

### 19.17 Developer Options

### 19.18 Short Options

---

**Note:** For detailed parameter descriptions, default values, and examples, refer to the specific subsections within each category.
