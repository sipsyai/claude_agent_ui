# PostgreSQL Client Authentication

**Source:** https://www.postgresql.org/docs/18/client-authentication.html
**Downloaded:** 2025-10-31

---

# PostgreSQL Client Authentication

## Overview

PostgreSQL Chapter 20 covers client authentication, the process by which "the database server establishes the identity of the client" and determines connection permissions. Authentication methods vary based on client host address, database, and user.

## Key Concepts

**Database Users vs. OS Users**
PostgreSQL database user names are logically separate from operating system user names. While local servers might align these identities, remote servers often have database users without corresponding OS accounts.

**Authentication vs. Authorization**
Authentication establishes client identity, while Chapter 21 addresses privilege management through database roles.

## Authentication Methods

PostgreSQL supports multiple authentication approaches:

- **Trust** - Assumes requestor identity without verification
- **Password** - Standard password-based authentication
- **MD5** - Legacy hashed password method
- **SCRAM** - Secure challenge-response authentication mechanism
- **Peer** - Uses OS-level authentication
- **Ident** - Queries ident server for client identity
- **GSSAPI, SSPI, LDAP, RADIUS, Certificate, PAM, BSD, OAuth** - Enterprise and specialized methods

## Configuration

The `pg_hba.conf` file controls which authentication method applies to specific connection scenarios, enabling administrators to enforce appropriate security policies per context.
