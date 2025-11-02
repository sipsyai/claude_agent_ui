# PostgreSQL Data Types

**Source:** https://www.postgresql.org/docs/18/datatype.html
**Downloaded:** 2025-10-31

---

# PostgreSQL Data Types Overview

PostgreSQL provides "a rich set of native data types available to users." Here are the primary categories:

## Numeric Types
- **Integer**: `smallint`, `integer`, `bigint`
- **Arbitrary Precision**: `numeric`, `decimal`
- **Floating-Point**: `real`, `double precision`
- **Serial**: `smallserial`, `serial`, `bigserial` (autoincrementing)

## Character Types
- `character` / `char` — fixed-length strings
- `character varying` / `varchar` — variable-length strings
- `text` — variable-length character data

## Date/Time Types
- `date` — calendar dates
- `time` — time of day
- `timestamp` — date and time combined
- `interval` — time spans
- Variants with/without timezone support

## Boolean Type
- `boolean` / `bool` — true/false values

## JSON Types
- `json` — textual JSON
- `jsonb` — binary, decomposed JSON

## Arrays
Multi-dimensional arrays of any PostgreSQL data type

## Additional Notable Types
- `uuid` — universally unique identifiers
- `inet`, `cidr` — network addresses
- `bytea` — binary data
- `xml` — XML documents
- Geometric types (points, lines, polygons, circles)
- Range and multirange types
