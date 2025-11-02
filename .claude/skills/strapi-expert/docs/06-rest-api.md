# REST API Reference

**Source:** https://docs.strapi.io/cms/api/rest
**Downloaded:** 2025-10-31

---

# REST API Reference

## Overview

The REST API provides access to content-types through automatically generated API endpoints. "The REST API allows accessing the content-types through API endpoints. Strapi automatically creates API endpoints when a content-type is created."

### Prerequisites

All content types are private by default. They must either be made public or queries need authentication with proper permissions. See the Quick Start Guide and Users & Permissions feature documentation for details.

**Important Note:** "By default, the REST API responses only include top-level fields and does not populate any relations, media fields, components, or dynamic zones." Use the `populate` parameter to include related data.

---

## Endpoints

For each Content-Type, the following endpoints are automatically generated:

### Collection Type Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/:pluralApiId` | Get a list of documents |
| POST | `/api/:pluralApiId` | Create a document |
| GET | `/api/:pluralApiId/:documentId` | Get a specific document |
| PUT | `/api/:pluralApiId/:documentId` | Update a document |
| DELETE | `/api/:pluralApiId/:documentId` | Delete a document |

### Single Type Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/:singularApiId` | Get a document |
| PUT | `/api/:singularApiId` | Update/Create a document |
| DELETE | `/api/:singularApiId` | Delete a document |

### Example: Restaurant Content Type

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/restaurants` | Get a list of restaurants |
| POST | `/api/restaurants` | Create a restaurant |
| GET | `/api/restaurants/:documentId` | Get a specific restaurant |
| PUT | `/api/restaurants/:documentId` | Update a restaurant |
| DELETE | `/api/restaurants/:documentId` | Delete a restaurant |

---

## Request/Response Format

### Key Changes in Strapi 5

- Response format is flattened (attributes directly accessible from `data` object)
- Documents accessed by `documentId` instead of `id`

### Standard Response Structure

```json
{
  "data": { /* document(s) */ },
  "meta": { /* pagination, locale, and state info */ },
  "error": { /* optional error information */ }
}
```

---

## Request Examples

### Get Documents (List)

```
GET http://localhost:1337/api/restaurants
```

**Response:**
```json
{
  "data": [
    {
      "id": 2,
      "documentId": "hgv1vny5cebq2l3czil1rpb3",
      "Name": "BMK Paris Bamako",
      "Description": null,
      "createdAt": "2024-03-06T13:42:05.098Z",
      "updatedAt": "2024-03-06T13:42:05.098Z",
      "publishedAt": "2024-03-06T13:42:05.103Z",
      "locale": "en"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 2
    }
  }
}
```

### Get a Document

```
GET http://localhost:1337/api/restaurants/j964065dnjrdr4u89weh79xl
```

**Response:**
```json
{
  "data": {
    "id": 6,
    "documentId": "znrlzntu9ei5onjvwfaalu2v",
    "Name": "Biscotte Restaurant",
    "Description": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "Welcome to Biscotte restaurant!"
          }
        ]
      }
    ],
    "createdAt": "2024-02-27T10:19:04.953Z",
    "updatedAt": "2024-03-05T15:52:05.591Z",
    "publishedAt": "2024-03-05T15:52:05.600Z",
    "locale": "en"
  },
  "meta": {}
}
```

### Create a Document

```
POST http://localhost:1337/api/restaurants
```

**Request Body:**
```json
{
  "data": {
    "Name": "Restaurant D",
    "Description": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ]
  }
}
```

**Response:**
```json
{
  "data": {
    "documentId": "bw64dnu97i56nq85106yt4du",
    "Name": "Restaurant D",
    "Description": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ],
    "createdAt": "2024-03-05T16:44:47.689Z",
    "updatedAt": "2024-03-05T16:44:47.689Z",
    "publishedAt": "2024-03-05T16:44:47.687Z",
    "locale": "en"
  },
  "meta": {}
}
```

### Update a Document

```
PUT http://localhost:1337/api/restaurants/hgv1vny5cebq2l3czil1rpb3
```

**Request Body:**
```json
{
  "data": {
    "Name": "BMK Paris Bamako",
    "Description": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ]
  }
}
```

**Response:**
```json
{
  "data": {
    "id": 9,
    "documentId": "hgv1vny5cebq2l3czil1rpb3",
    "Name": "BMK Paris Bamako",
    "Description": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ],
    "createdAt": "2024-03-06T13:42:05.098Z",
    "updatedAt": "2024-03-06T14:16:56.883Z",
    "publishedAt": "2024-03-06T14:16:56.895Z",
    "locale": "en"
  },
  "meta": {}
}
```

### Delete a Document

```
DELETE http://localhost:1337/api/restaurants/bw64dnu97i56nq85106yt4du
```

**Response:** 204 HTTP status code with no response body.

---

## Notes

- Components do not have API endpoints
- The Upload API is accessible through `/api/upload` endpoints
- Relations can be managed through REST API requests
- Send `null` values to clear fields during updates
- The Internationalization plugin affects endpoint behavior for localized content
