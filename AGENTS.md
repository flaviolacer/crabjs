# AGENTS.md — CrabJS

## What This Is

CrabJS is a Node.js REST API framework built on Express. It uses JSDoc-style annotations to auto-generate routes, CRUD operations, Swagger docs, and security middleware. The primary database backend is MongoDB.

- **Version:** 2.1.9 (check `package.json`)
- **Module format:** CommonJS (`.cjs`) everywhere; `index.mjs` re-exports for ESM consumers
- **Entry points:** `index.cjs` / `index.mjs`

---

## Architecture at a Glance

```
User project
  └── crabjs.start(__dirname, options)
        ├── core.cjs          → Initializes Express + middleware
        ├── router-manager    → Parses @annotations → Express routes + Swagger
        ├── entity-manager    → Entity factory, CRUD helpers
        ├── repository-manager→ Connection pool, driver dispatch
        │     └── mongodb.cjs → MongoDB-specific type-casting & filtering
        └── security.cjs      → OAuth2 / JWT middleware
```

---

## Key Files

| File | Role |
|------|------|
| `index.cjs` | Export: `cjs.start(appDir, opts)` |
| `base/core.cjs` | Express setup, middleware (CORS, body-parser, multer, security) |
| `base/annotation.cjs` | Parses `/** @tag value */` blocks from JS comments |
| `base/router-manager.cjs` | Scans controller files → creates Express routes, injects security |
| `base/entity-manager.cjs` | Creates/loads entities, delegates CRUD to repository-manager |
| `base/repository-manager.cjs` | Connection pooling, driver abstraction |
| `base/repository-drivers/mongodb.cjs` | All MongoDB logic: type casting, filter translation, CRUD |
| `base/controller-base.cjs` | Base class for user-defined controllers |
| `base/controller-entity-base.cjs` | Auto `__get/__post/__put/__delete` handlers |
| `base/entity-base.cjs` | Base class: `entity.save()`, `entity.remove()` |
| `base/security.cjs` | OAuth2 token issuance, JWT validation, revocation |
| `base/swagger.cjs` | Generates OpenAPI spec from controller annotations |
| `base/utils.cjs` | `response()`, UID generation, route helpers |
| `base/log.cjs` | Leveled logger (info / warn / error) |
| `defaults.json` | All default config values (port, paths, security, swagger) |
| `cli/run.cjs` | CLI entry (`cjs init`, `cjs create <name>`) |
| `base/cli-base.cjs` | CLI logic using Handlebars templates in `templates/` |

**System entities** (auto-created, prefixed `__`):
- `base/entity/__access_credential.cjs` — stored credentials
- `base/entity/__access_storage.cjs` — active tokens
- `base/entity/__revoked_storage.cjs` — revoked tokens

---

## Annotations Reference

### Controller annotations
```js
/**
 * @Controller
 * @route /path
 * @method GET | POST | PUT | DELETE
 * @entity EntityName        ← enables auto-CRUD
 * @noSecurity               ← skip auth
 * @scope scopeName          ← require scope
 * @priority 1               ← route priority
 */
```

### Entity annotations
```js
/**
 * @Entity
 * @RepositoryName collection_name
 * @DbName database_name
 */
// Field:
/**
 * @field
 * @primaryKey
 * @required
 * @type objectId | string | float | int | boolean | date
 * @defaultValue value
 */
```

---

## Public API

```js
const cjs = require('crabjs');
const app = cjs.start(__dirname, { noserver: false });

// Returned object
app.entityManager    // entity factory & CRUD
app.repositoryManager
app.app              // Express instance
app.security
app.config
app.i18n
app.utils
app.response(res, data, code)  // standard JSON response
```

### EntityManager
```js
await cjs.entityManager.newEntity(name, initData)
await cjs.entityManager.loadEntity(name)
await cjs.entityManager.getEntity(name, filter)
await cjs.entityManager.getEntities(name, filter)
await cjs.entityManager.saveEntity(entity, filter, data)
await cjs.entityManager.removeEntities(name, filter)
await cjs.entityManager.insertBatch(name, data)
```

### Response format
```js
// Success
{ content: data }
// Error
{ type: "error", error: true, message: "", code: 500 }
```

---

## MongoDB Filter Syntax

Translated from request query params to MongoDB queries inside `base/repository-drivers/mongodb.cjs`:

| Filter syntax | Meaning |
|---|---|
| `{field: value}` | Equality |
| `{field: {__like: 'val'}}` | Regex contains |
| `{field: {__in: [a, b]}}` | Array inclusion |
| `{__term: {value: 'q', fields: 'f1,f2'}}` | Full-text across fields |

---

## Configuration

**`defaults.json`** — shipped defaults. Overridden by project's `crabjs.json`.

Key defaults:
```json
{
  "server_port": 3999,
  "server_controllers_path": "controller",
  "server_entities_path": "entity",
  "multer_path": "uploads/",
  "repository_page_size": 10,
  "security.jwt.token_expires": 300,
  "security.jwt.refresh_token.token_expires": 18000
}
```

Environment variables loaded via `dotenv-defaults` (`.env` file).

---

## Tests

```bash
npm test          # mocha --slow 1000
```

Test entry: `test/test.cjs` → loads all `test/test_files/*.test.cjs`.

| Test file | What it covers |
|---|---|
| `core.test.cjs` | Server startup |
| `config.test.cjs` | Config loading/merging |
| `mongodb_filter.test.cjs` | Query filter translation |
| `repository.test.cjs` | CRUD operations |
| `route.test.cjs` | Annotation parsing, route creation |
| `security.test.cjs` | OAuth2 / JWT flows |
| `security_repository.test.cjs` | Credential entity storage |

Fixtures live in `test/data/` (entities, controllers, configs).

---

## CI/CD

`.github/workflows/npm-publish.yml`: on release → Node 20.x + MongoDB 7.0 → `npm test` → publish to npm with provenance.

---

## Conventions

- **Files:** `.cjs` extension; system internals prefixed `__`
- **Classes:** PascalCase; inherit via `extend()` helper from `base/helper.cjs`
- **Variables:** camelCase; DB fields often snake_case
- **Private:** prefix `_` or use `let` (annotation parser ignores non-`function` declarations)
- **Async:** Promise-based; `.catch().then()` chains
- **Errors:** `base/error.cjs` — `new CrabError(code, message)`; codes in `base/constants.cjs`
- **Logging:** `base/log.cjs` — never `console.log` in framework code

---

## CLI

```bash
cjs init              # scaffold new project
cjs create <name>     # create controller + entity pair
cjs --help
```

Templates in `templates/`; rendered with Handlebars.

---

## Out of Scope / What Not to Change

- `base/entity/__*.cjs` — system entities; changes affect auth for all users
- `defaults.json` — defaults must stay backward compatible
- Annotation parser is intentionally lenient; do not add strict validation