# PostgreSQL Initialization Scripts

This directory contains SQL scripts that are automatically executed when the PostgreSQL container is first initialized.

## Usage

Place `.sql` or `.sh` files in this directory to have them executed during the initial database setup. Scripts are executed in alphabetical order.

## Common Use Cases

- Creating additional databases
- Setting up users and permissions
- Loading initial schema
- Seeding test data

## Notes

- Scripts are only run on first initialization (when the data directory is empty)
- The scripts run as the PostgreSQL superuser
- Use `\c database_name` to switch databases within scripts

## Example

```sql
-- 01-create-extensions.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```
