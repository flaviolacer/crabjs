# CrabJS

[![NPM version](https://img.shields.io/npm/v/crabjs)](https://www.npmjs.com/package/crabjs)

CrabJS is a Node.js REST API framework built on top of Express. It uses JSDoc-style annotations to discover controllers and entities, generate routes, expose CRUD endpoints, wire JWT security, and publish Swagger/OpenAPI docs.

The project targets API-first backends with MongoDB as the primary repository driver.

## Highlights

- Annotation-driven routing
- Automatic CRUD controllers from entity definitions
- Entity manager and repository abstraction
- MongoDB type casting and filter translation
- JWT access token and refresh token flow
- Credential validation from config or repository
- Optional route-level auth bypass and scope checks
- Built-in Swagger UI
- CLI to scaffold projects, controllers, and entities
- CommonJS-first package with ESM re-export entrypoint

## Installation

Install as a project dependency:

```bash
npm install crabjs
```

Install the CLI globally if you want the `cjs` command available system-wide:

```bash
npm install -g crabjs
```

## Quick Start

Create a project scaffold:

```bash
cjs init
```

That generates:

- `app.js`
- `crabjs.json`
- `controller/`
- `entity/`

The generated `app.js` starts CrabJS with your project directory:

```js
const Cjs = require("crabjs");
global.cjs = Cjs.start(__dirname);
```

You can also bootstrap manually:

```js
const crabjs = require("crabjs");

const app = crabjs.start(__dirname, {
  noserver: false
});
```

Returned API surface:

```js
app.entityManager
app.repositoryManager
app.app
app.security
app.config
app.i18n
app.utils
app.response(res, data, code)
```

## Project Structure

Typical application layout:

```text
my-api/
├── app.js
├── crabjs.json
├── controller/
│   └── product.js
└── entity/
    └── product.js
```

By default CrabJS loads controllers from `controller/` and entities from `entity/`. User projects can use `.js` or `.cjs`; the framework internals are `.cjs`.

## Controllers

Controllers are discovered from files and mapped using annotations in comment blocks.

Minimal example:

```js
/**
 * @Controller
 * @route('/product')
 */
function ProductController() {
  /**
   * @route('/')
   * @method('GET')
   */
  this.list = function (req, res) {
    res.send("alive");
  };

  /**
   * @route('/:id')
   * @method('GET')
   */
  this.getById = function (req, res) {
    res.send(req.params.id);
  };
}

module.exports = ProductController;
```

Supported controller-level annotations include:

- `@Controller`
- `@route('/base-path')`
- `@entity('EntityName')`
- `@noSecurity`

Supported route-level annotations include:

- `@route('/path')`
- `@method('GET' | 'POST' | 'PUT' | 'DELETE')`
- `@noSecurity`
- `@scope('scopeName')`
- `@scopes('scopeA,scopeB')`
- `@priority`
- `@summary('...')`
- `@description('...')`

Notes:

- Route methods are attached from public members such as `this.list = function (...) {}`.
- Private inner functions are ignored by the annotation parser.
- Arrow functions work.
- `@priority` moves the route earlier in the Express stack for the same HTTP method.

## Entities

Entities define repository metadata and field mapping.

Example:

```js
/**
 * @Entity
 * @RepositoryName('products')
 */
function Product() {
  /**
   * @field
   * @primaryKey
   * @type = objectId
   */
  this._id;

  /** @field */
  this.name;

  /**
   * @field
   * @required
   */
  this.description;

  /**
   * @field
   * @type = float
   */
  this.price;

  /**
   * @field
   * @defaultValue = 'item'
   */
  this.type;
}

module.exports = Product;
```

Useful annotations:

- `@Entity`
- `@RepositoryName('collection_name')`
- `@DbName('repository_name')`
- `@field`
- `@primaryKey`
- `@required`
- `@type = objectId|string|float|int|boolean|date|password`
- `@defaultValue = ...`

`password` fields are hashed before persistence.

## Automatic CRUD Controllers

If a controller declares `@entity`, CrabJS extends it with `ControllerEntityBase` and exposes default REST handlers automatically.

Example:

```js
/**
 * @Controller
 * @route('/products')
 * @entity('product')
 */
function ProductController() {}

module.exports = ProductController;
```

Generated endpoints:

- `GET /products/`
- `GET /products/:filter`
- `POST /products/`
- `PUT /products/`
- `PUT /products/:filter`
- `DELETE /products/:filter`

Behavior:

- `POST` inserts one record or a batch when the request body is an array
- `GET /:filter` resolves the first declared primary key when `:filter` is a string
- `GET /` returns multiple records with pagination metadata
- `PUT /:filter` updates by primary key
- `DELETE /:filter` removes by primary key

You can still add custom routes to the same controller.

## Entity Manager

The entity manager is the main programmatic API for entities:

```js
const product = await cjs.entityManager.newEntity("product", {
  name: "Keyboard",
  description: "Mechanical keyboard",
  price: 99.9
});

await product.save();

const one = await cjs.entityManager.getEntity("product", { name: "Keyboard" });
const many = await cjs.entityManager.getEntities("product", {});
await cjs.entityManager.removeEntities("product", { name: "Keyboard" });
```

Available methods:

```js
await cjs.entityManager.newEntity(name, initData)
await cjs.entityManager.loadEntity(name)
await cjs.entityManager.getEntity(name, filter, options)
await cjs.entityManager.getEntities(name, filter, options)
await cjs.entityManager.saveEntity(entity, filter, data)
await cjs.entityManager.removeEntities(name, filter)
await cjs.entityManager.insertBatch(name, data)
```

Entity instances inherit:

```js
await entity.save(options)
await entity.remove(options)
```

## MongoDB Filters

CrabJS translates API query filters to MongoDB queries in the MongoDB repository driver.

Examples:

```js
{ name: "Ana" }
{ name: { __like: "ana" } }
{ status: { __in: ["draft", "published"] } }
{
  __term: {
    value: "ana teresa",
    fields: "name,description"
  }
}
```

Supported operators documented by the codebase and tests:

- direct equality
- `__like` for regex contains
- `__regex` for explicit regex input
- `__in` for inclusion
- `__term` for multi-field text search

`ControllerEntityBase` also accepts `__options` in query params, for example:

```js
GET /products?__options[rawData]=true
```

## Security

CrabJS ships with JWT middleware enabled by default.

Default routes:

- sign-in: `/auth/signin`
- refresh token: `/auth/token`

Default security flow:

1. Client authenticates with `client_id` and `client_secret`
2. CrabJS returns `access_token` and `refresh_token`
3. Protected routes accept the token through:
   - `Authorization: Bearer <token>`
   - `access_token` header/query/body field

### Config-based credentials

You can define API credentials directly in `crabjs.json`:

```json
{
  "security": {
    "encryption_key": "replace-me",
    "client_id": "my-client",
    "client_secret": "my-secret"
  }
}
```

### Repository-backed credentials

You can store credentials in the built-in security entity `__access_credential` by enabling repository storage:

```json
{
  "security": {
    "security_repository": {
      "token_storage_type": "repository",
      "revoke_token_storage_type": "repository"
    }
  }
}
```

### Auth entity flow

The middleware also supports authenticating application users from an entity through `security.auth_entity`. When enabled, CrabJS validates username/password fields against your repository and can issue JWTs for those users.

### Route bypass and scopes

- `@noSecurity` bypasses auth on a controller or a specific route
- `@scope('admin')` or `@scopes('admin,reporting')` restricts access by token scopes

## Swagger / OpenAPI

Swagger UI is enabled by default.

Default path:

```text
/api-docs/
```

CrabJS builds the document from controller annotations and also includes:

- JWT auth scheme
- token endpoint metadata
- routes generated from `@entity`

You can customize Swagger metadata in `crabjs.json`:

```json
{
  "swagger": {
    "enabled": true,
    "path": "/api-docs/",
    "info": {
      "title": "My API",
      "version": "1.0.0",
      "description": "Internal API"
    }
  }
}
```

## Configuration

CrabJS loads defaults from `defaults.json` and merges overrides from your local `crabjs.json`. Environment variables are loaded with `dotenv-defaults`.

Common settings:

```json
{
  "server_port": 3999,
  "server_https": false,
  "server_timeout": 300000,
  "server_controllers_path": "controller",
  "server_entities_path": "entity",
  "multer_path": "uploads/",
  "multer_inmemory": true,
  "post_max_size": "10mb",
  "application_prefix": "",
  "repository_page_size": 10,
  "swagger": {
    "enabled": true,
    "path": "/api-docs/"
  }
}
```

Repository configuration lives under `repository` in `crabjs.json`. Example MongoDB setup:

```json
{
  "repository": {
    "default": "mongodb",
    "mongodb": {
      "driver": "mongodb",
      "host": "127.0.0.1",
      "port": 27017,
      "default_collection": "my_api"
    }
  }
}
```

## Middleware Hooks

`start()` accepts middleware injection points around the built-in stack:

```js
const app = crabjs.start(__dirname, {
  pre_middlewares: [
    function (req, res, next) { next(); }
  ],
  post_middlewares: [
    function (req, res, next) { next(); }
  ]
});
```

You can also start CrabJS without listening to a port:

```js
const app = crabjs.start(__dirname, { noserver: true });
```

That is useful for tests or for embedding the Express app elsewhere.

## Standard Responses

Success responses:

```json
{
  "content": {}
}
```

Error responses:

```json
{
  "type": "error",
  "error": true,
  "message": "Something went wrong",
  "code": 500
}
```

From application code:

```js
app.response(res, data, 200);
app.response(res, "Invalid payload", 406);
```

## CLI

Available commands:

```bash
cjs init
cjs create controller Product
cjs create entity Product
cjs help
cjs -h
cjs --help
```

The CLI uses Handlebars templates under `templates/` and bootstraps a runnable project.

## Module Format

CrabJS is implemented in CommonJS (`.cjs`) and exposes:

- `index.cjs` for `require(...)`
- `index.mjs` for ESM consumers

Examples:

```js
const crabjs = require("crabjs");
```

```js
import crabjs from "crabjs";

const app = crabjs.start(import.meta.dirname);
```

## Testing

Run the test suite with:

```bash
npm test
```

The current suite covers:

- server startup
- config merge behavior
- annotation routing
- CRUD operations
- MongoDB filter translation
- JWT security flows
- repository-backed credential storage

Some tests require MongoDB running locally on `127.0.0.1:27017`.

## Current Version

Package version in this repository:

```text
2.2.1
```

## License

See the package metadata on npm and the repository for current licensing details.
