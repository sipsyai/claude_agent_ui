# PostgreSQL High Availability and Replication

**Source:** https://www.postgresql.org/docs/18/high-availability.html
**Downloaded:** 2025-10-31

---

# PostgreSQL High Availability, Load Balancing, and Replication

## Overview

PostgreSQL Chapter 26 addresses how database servers work together to enable failover capabilities and load distribution. The documentation explains that "Database servers can work together to allow a second server to take over quickly if the primary server fails (high availability), or to allow several computers to serve the same data (load balancing)."

## Key Concepts

### Server Roles

The documentation defines several server types:
- **Primary/Master servers**: Systems that can modify data
- **Standby/Secondary servers**: Systems that track changes from the primary
- **Warm standby**: Standbys unavailable until promotion
- **Hot standby**: Standbys accepting read-only queries

### Synchronization Approaches

**Synchronous Replication**: Transactions aren't considered committed until all servers have processed them, guaranteeing no data loss during failover.

**Asynchronous Replication**: Allows delays between commits and propagation to other servers, creating potential data loss risks but minimizing performance impact.

## Covered Topics

The chapter includes sections on:
- **Log-Shipping Standby Servers** (26.2)
- **Streaming Replication** (26.2.5)
- **Replication Slots** (26.2.6)
- **Cascading Replication** (26.2.7)
- **Failover** (26.3)
- **Hot Standby** (26.4)

## Trade-offs

The documentation emphasizes that "there is usually a trade-off between functionality and performance," with synchronous solutions potentially cutting performance significantly over slower networks.
