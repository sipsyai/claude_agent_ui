# Project Structure

**Source:** https://docs.strapi.io/cms/project-structure
**Downloaded:** 2025-10-31

---

# Project Structure

The structure of a Strapi project depends on whether the project was created with [TypeScript](/cms/typescript) (which is the default if you used the `--quickstart` option while creating the project) or with vanilla JavaScript.

## TypeScript-based Projects

```
. # root of the application
├──── .strapi # auto-generated folder — do not update manually
│     └──── client # files used by bundlers to render the application
│           ├ index.html
│           └ app.js
├──── .tmp
├──── config # API configurations
│     ├ admin.ts
│     ├ api.ts
│     ├ cron-tasks.ts # optional, only if you created CRON tasks
│     ├ database.ts
│     ├ middlewares.ts
│     ├ plugins.ts
│     └ server.ts
├──── database
│     └──── migrations
├──── dist # build of the backend
│     └──── build # build of the admin panel
├──── node_modules # npm packages used by the project
├──── public # files accessible to the outside world
│     ├──── uploads
│     └ robots.txt
├──── src
│     ├──── admin # admin customization files
│     │     ├──── extensions # optional, files to extend the admin panel
│     │     ├──── app.example.tsx
│     │     ├──── webpack.config.example.js
│     │     ├──── tsconfig.json
│     ├──── api # business logic split into subfolders per API
│     │     └──── (api-name)
│     │           ├──── content-types
│     │           │     └──── (content-type-name)
│     │           │           ├ lifecycles.ts
│     │           │           └ schema.json
│     │           ├──── controllers
│     │           ├──── middlewares
│     │           ├──── policies
│     │           ├──── routes
│     │           ├──── services
│     │           └ index.ts
│     ├──── components
│     │     └──── (category-name)
│     │           ├ (componentA).json
│     │           └ (componentB).json
│     ├──── extensions # files to extend installed plugins
│     │     └──── (plugin-to-be-extended)
│     │           ├──── content-types
│     │           │     └──── (content-type-name)
│     │           │           └ schema.json
│     │           └ strapi-server.js
│     ├──── middlewares
│     │     └──── (middleware-name)
│     │           ├ defaults.json
│     │           └ index.ts
│     ├──── plugins # local plugins files
│     │     └──── (plugin-name)
│     │           ├──── admin
│     │           │     └──── src
│     │           │           └ index.tsx
│     │           │           └ pluginId.ts
│     │           ├──── server
│     │           │     ├──── content-types
│     │           │     ├──── controllers
│     │           │     └──── policies
│     │           ├ package.json
│     │           ├ strapi-admin.js
│     │           └ strapi-server.js
│     ├─── policies
│     └ index.ts # include register(), bootstrap() and destroy() functions
├──── types
│     └──── generated
│           ├ components.d.ts # generated types for your components
│           └ contentTypes.d.ts # generated types for content-types
├ .env
├ .strapi-updater.json # used to track if users need to update their application
├ favicon.png
├ package.json
└ tsconfig.json
```

## JavaScript-based Projects

```
. # root of the application
├──── .strapi # auto-generated folder — do not update manually
│     └──── client # files used by bundlers to render the application
│           ├ index.html
│           └ app.js
├──── .tmp
├──── build # build of the admin panel
├──── config # API configurations
│     ├ admin.js
│     ├ api.js
│     ├ cron-tasks.ts # optional, only if you created CRON tasks
│     ├ database.js
│     ├ middlewares.js
│     ├ plugins.js
│     └ server.js
├──── database
│     └──── migrations
├──── node_modules # npm packages used by the project
├──── public # files accessible to the outside world
│     └──── uploads
├──── src
│     ├──── admin # admin customization files
│           ├──── extensions # optional, files to extend the admin panel
│     │     ├ app.js
│     │     └ webpack.config.js
│     ├──── api # business logic split into subfolders per API
│     │     └──── (api-name)
│     │           ├──── content-types
│     │           │     └──── (content-type-name)
│     │           │           └ lifecycles.js
│     │           │           └ schema.json
│     │           ├──── controllers
│     │           ├──── middlewares
│     │           ├──── policies
│     │           ├──── routes
│     │           ├──── services
│     │           └ index.js
│     ├──── components
│     │     └──── (category-name)
│     │           ├ (componentA).json
│     │           └ (componentB).json
│     ├──── extensions # files to extend installed plugins
│     │     └──── (plugin-to-be-extended)
│     │           ├──── content-types
│     │           │     └──── (content-type-name)
│     │           │           └ schema.json
│     │           └ strapi-server.js
│     ├──── middlewares
│     │     └──── (middleware-name).js
│     ├──── plugins # local plugins files
│     │     └──── (plugin-name)
│     │           ├──── admin
│     │           │     └──── src
│     │           │           └ index.js
│     │           ├──── server
│     │           │     ├──── content-types
│     │           │     ├──── controllers
│     │           │     └──── policies
│     │           ├ package.json
│     │           ├ strapi-admin.js
│     │           └ strapi-server.js
│     ├─── policies
│     └ index.js # include register(), bootstrap() and destroy() functions
├ .env
├ favicon.png
└ package.json
```
