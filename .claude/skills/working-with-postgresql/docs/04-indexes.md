# PostgreSQL Indexes

**Source:** https://www.postgresql.org/docs/18/indexes.html
**Downloaded:** 2025-10-31

---

# PostgreSQL Chapter 11: Indexes

## Overview

"Indexes are a common way to enhance database performance. An index allows the database server to find and retrieve specific rows much faster than it could do without an index."

However, implementing indexes requires careful consideration, as they introduce administrative overhead to database systems.

## Index Types

PostgreSQL supports six primary index structures:

### B-Tree
The default and most commonly used index type for general-purpose indexing across various data types and query patterns.

### Hash
Optimized for simple equality comparisons, though less versatile than B-tree indexes.

### GiST (Generalized Search Tree)
A flexible framework supporting complex data types and specialized search operations beyond standard comparisons.

### SP-GiST (Space-Partitioned Generalized Search Tree)
Designed for space-partitioned data structures, useful for geometric and specialized hierarchical data.

### GIN (Generalized Inverted Index)
Particularly effective for indexing composite values like arrays and full-text search documents.

### BRIN (Block Range Index)
A lightweight indexing method ideal for very large tables with naturally ordered data, minimizing storage overhead.

## Key Topics Covered

The complete chapter addresses multicolumn indexes, ordering optimization, index combining strategies, unique constraints, expression-based indexing, partial indexes, covering indexes, operator classes, collation handling, and usage examination techniques.
