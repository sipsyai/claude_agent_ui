# Document Concept

**Source:** https://docs.strapi.io/cms/api/document
**Downloaded:** 2025-10-31

---

# Document Concept

## Overview

A **document** in Strapi 5 represents an API-only concept describing all content variations for a given entry. Single types contain one unique document, while collection types can contain multiple documents.

## User vs. API Perspective

Within the admin panel, users work with **entries** in the Content Manager without needing to understand the document concept. Users manage entries by locale or draft/published status.

At the API level, however, document fields can contain:
- Different content across locales (English, French, etc.)
- Separate draft and published versions for each locale

The document serves as the container holding all draft and published content across every locale.

## Document Composition

Depending on enabled features:

- **With Internationalization (i18n)**: Documents support multiple locales
- **With Draft & Publish**: Documents maintain both published and draft versions
- **With both features**: Documents can have multiple locales with separate draft/published states

## API Access Methods

### Backend Access
Use the Document Service API to create, retrieve, update, and delete documents from controllers, services, and plugins.

### Frontend Access
Query data using REST API or GraphQL API.

## Default Behavior Difference

A critical distinction exists between APIs:

> "The Document Service API returns the draft version by default, while REST and GraphQL APIs return the published version by default."

This means backend queries prioritize drafts, while frontend requests prioritize published content.
