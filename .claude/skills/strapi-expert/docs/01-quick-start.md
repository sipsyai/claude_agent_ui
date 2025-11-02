# Quick Start Guide - Strapi 5

**Source:** https://docs.strapi.io/cms/quick-start
**Downloaded:** 2025-10-31

---

# Quick Start Guide - Strapi 5 Documentation

## Quick Start Guide

Strapi offers significant flexibility for both rapid prototyping and deeper exploration. This tutorial guides you through building a project and content structure from scratch, then deploying to Strapi Cloud.

**Estimated completion time: 5-10 minutes**

## Prerequisites

Before installing Strapi, ensure you have:

- **Node.js**: Only Active LTS or Maintenance LTS versions supported (currently `v20` and `v22`)
- **Package manager**: npm (v6+), yarn, or pnpm
- **Python**: Required for SQLite database
- **Git**: Installed and configured
- **GitHub account**: Needed for Strapi Cloud deployment

## Part A: Create a New Project with Strapi

### Step 1: Run Installation Script and Create Strapi Cloud Account

1. Run the installation command:
   ```bash
   npx create-strapi@latest my-strapi-project
   ```

2. When prompted, select "Login/Sign up" to create a Strapi Cloud account
3. A 30-day Growth plan trial activates automatically
4. Confirm the verification code in the browser tab
5. Authenticate with GitHub
6. Return to terminal and press Enter to accept default answers

Your project builds locally with a `.strapi-cloud.json` file linking to Strapi servers.

### Step 2: Register First Local Administrator User

Once installation completes:

```bash
cd my-strapi-project && npm run develop
```

Your browser automatically opens the admin panel at `http://localhost:1337/admin`. Complete the form to create your administrator account.

## Part B: Build Content Structure with Content-Type Builder

### Step 1: Create "Restaurant" Collection Type

1. Click "Create your first Content type" or navigate to Content-Type Builder
2. Select "Create new collection type"
3. Enter `Restaurant` as display name
4. Add Text field named `Name`
5. In Advanced Settings: check "Required field" and "Unique field"
6. Add Rich text (Blocks) field named `Description`
7. Click "Save" and wait for restart

### Step 2: Create "Category" Collection Type

1. Go to Content-Type Builder
2. Create new collection type named `Category`
3. Add Text field `Name` with Required and Unique settings
4. Add Relation field with many-to-many relationship
5. Configure as "Categories has and belongs to many Restaurants"
6. Click "Save"

## Part C: Deploy to Strapi Cloud

To deploy your project:

1. Stop the local server (Ctrl-C)
2. In your project folder, run:
   ```bash
   npm run strapi deploy
   ```
   or
   ```bash
   yarn strapi deploy
   ```

3. Answer terminal prompts:
   - Project name (press Enter for default)
   - Select recommended Node.js version
   - Choose closest region

Within moments, your project deploys to Strapi Cloud. Click the provided link or visit your dashboard to access your deployed project.

## Part D: Add Content to Strapi Cloud Project

### Step 1: Log in to Cloud Admin Panel

1. From Strapi Cloud dashboard, click `my-strapi-project`
2. Click "Visit app"
3. Create first administrator account for this Cloud project

**Note**: Cloud and local databases are separate. Local users don't transfer automatically.

### Step 2: Create Restaurant Entry

1. Navigate to Content Manager > Collection types - Restaurant
2. Click "Create new entry"
3. Enter restaurant name (e.g., `Biscotte Restaurant`)
4. Add description in Description field
5. Click "Save"

### Step 3: Add Categories

1. Go to Content Manager > Collection types - Category
2. Create two entries:
   - `French Food`
   - `Brunch`
3. Return to Restaurant entry and assign "French Food" category
4. Save the changes

### Step 4: Set Roles & Permissions

1. Click Settings > Users & Permissions Plugin > Roles
2. Click "Public" role
3. Under Permissions:
   - Find "Restaurant" and check "find" and "findOne"
   - Find "Category" and check "find" and "findOne"
4. Click "Save"

### Step 5: Publish Content

For each entry (Brunch, French Food, Biscotte Restaurant):
1. Open the entry
2. Click "Publish"
3. Confirm in the popup

### Step 6: Use the API

Access your content via API at `/api/restaurants` (e.g., `https://my-strapi-project.strapiapp.com/api/restaurants`)

Expected response includes restaurant data with metadata and pagination information.

## What to Do Next?

- Learn Strapi's REST API for content queries
- Explore additional features in the Features section
- Read Cloud documentation
- Customize backend and admin panel for advanced use cases
- Use the data management system to transfer data between projects

---

**Tags**: guides, Content-type Builder, collection type, Content Manager, Strapi Cloud
