# Document Service API

**Source:** https://docs.strapi.io/cms/api/document-service
**Downloaded:** 2025-10-31

---

# Document Service API

The Document Service API is built on top of the Query Engine API and is used to perform CRUD (create, retrieve, update, and delete) operations on documents.

## Overview

In Strapi 5, documents are uniquely identified by their `documentId` at the API level. This is a 24-character alphanumeric string that serves as a unique and persistent identifier for a content entry, independent of its physical records.

The Document Service API also supports:
- Counting documents
- Publishing, unpublishing, and discarding drafts (if Draft & Publish is enabled)

## Available Methods

### findOne()

Find a document matching the passed `documentId` and parameters.

**Syntax:** `findOne(parameters: Params) => Document`

| Parameter | Description | Default | Type |
|-----------|-------------|---------|------|
| `documentId` | Document id | - | ID |
| `locale` | Locale of the document to find | Default locale | String or undefined |
| `status` | Publication status ('published' or 'draft') | 'draft' | String |
| `fields` | Select fields to return | All fields | Object |
| `populate` | Populate results with additional fields | null | Object |

**Example:**

```javascript
await strapi.documents('api::restaurant.restaurant').findOne({
  documentId: 'a1b2c3d4e5f6g7h8i9j0klm'
})
```

### findFirst()

Find the first document matching the parameters.

**Syntax:** `findFirst(parameters: Params) => Document`

**Example:**

```javascript
await strapi.documents('api::restaurant.restaurant').findFirst()
```

### findMany()

Find documents matching the parameters.

**Syntax:** `findMany(parameters: Params) => Document[]`

**Example:**

```javascript
await strapi.documents('api::restaurant.restaurant').findMany({
  filters: {
    name: {
      $startsWith: 'Pizzeria'
    }
  }
})
```

### create()

Creates a drafted document and returns it. Pass fields in a `data` object.

**Syntax:** `create(parameters: Params) => Document`

**Example:**

```javascript
await strapi.documents('api::restaurant.restaurant').create({
  data: {
    name: 'Restaurant B'
  }
})
```

### update()

Updates document versions and returns them.

**Syntax:** `update(parameters: Params) => Promise<Document>`

**Example:**

```javascript
await strapi.documents('api::restaurant.restaurant').update({
  documentId: 'a1b2c3d4e5f6g7h8i9j0klm',
  data: { name: "New restaurant name" }
})
```

### delete()

Deletes one document, or a specific locale of it.

**Syntax:** `delete(parameters: Params): Promise<{ documentId: ID, entries: Number }>`

**Example:**

```javascript
await strapi.documents('api::restaurant.restaurant').delete({
  documentId: 'a1b2c3d4e5f6g7h8i9j0klm'
})
```

### publish()

Publishes one or multiple locales of a document. Only available if Draft & Publish is enabled.

**Syntax:** `publish(parameters: Params): Promise<{ documentId: ID, entries: Number }>`

**Example:**

```javascript
await strapi.documents('api::restaurant.restaurant').publish({
  documentId: 'a1b2c3d4e5f6g7h8i9j0klm'
})
```

### unpublish()

Unpublishes one or all locale versions of a document. Only available if Draft & Publish is enabled.

**Syntax:** `unpublish(parameters: Params): Promise<{ documentId: ID, entries: Number }>`

**Example:**

```javascript
await strapi.documents('api::restaurant.restaurant').unpublish({
  documentId: 'a1b2c3d4e5f6g7h8i9j0klm'
})
```

### discardDraft()

Discards draft data and overrides it with the published version. Only available if Draft & Publish is enabled.

**Syntax:** `discardDraft(parameters: Params): Promise<{ documentId: ID, entries: Number }>`

**Example:**

```javascript
strapi.documents.discardDraft({
  documentId: 'a1b2c3d4e5f6g7h8i9j0klm'
})
```

### count()

Count the number of documents that match the provided parameters.

**Syntax:** `count(parameters: Params) => number`

**Example:**

```javascript
await strapi.documents('api::restaurant.restaurant').count()

// Count published documents
strapi.documents('api::restaurant.restaurant').count({ status: 'published' })

// Count with filters
strapi.documents('api::restaurant.restaurant').count({
  filters: { name: { $startsWith: "Pizzeria" }}
})
```

## Key Notes

- Published versions are read-only; update the draft version first, then publish
- Repeatable components should not be updated with the Document Service API
- The Entity Service API is deprecated in Strapi 5
