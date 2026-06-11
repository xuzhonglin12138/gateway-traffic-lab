# Mixed Route Tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the traffic tool into three testing tabs and add one-click mixed multi-route traffic for regex route matching validation.

**Architecture:** Keep the vanilla JavaScript frontend and Go HTTP handler. Add tested pure frontend helpers for tab defaults, target route resolution, mixed route selection, and URL construction; extend the Go handler with generic grouped route families so frontend mixed traffic produces controlled responses.

**Tech Stack:** Go HTTP server, embedded static HTML/CSS/JS, browser Fetch API, Node built-in test runner.

---

### Task 1: Add Mixed Route Frontend Tests

**Files:**
- Modify: `cmd/server/web/app.test.js`
- Modify: `cmd/server/web/app.js`

**Step 1: Write failing tests**

Add tests for:

- `mixedRoutes` contains at least 20 entries.
- `selectRouteForRequest(config, 1)` and following calls cycle through mixed routes for normal mode.
- stress mode mixed route selection always returns an entry from the pool.
- `buildURL` preserves an existing query string, such as `/api/search/users?q=admin`.
- stress defaults allow more request volume than normal defaults.

**Step 2: Run test to verify failure**

Run:

```bash
node --test cmd/server/web/app.test.js
```

Expected: fails because mixed route helpers and exports do not exist yet.

### Task 2: Implement Mixed Route Helpers

**Files:**
- Modify: `cmd/server/web/app.js`

**Step 1: Add route target and mixed route data**

Add route target presets for single-route sending and a `mixedRoutes` array with regex-oriented paths from the design document.

**Step 2: Add helper functions**

Implement:

- `getTabDefaults(mode)`
- `selectRouteForRequest(config, index)`
- `buildURL(config, index)`
- query-preserving URL parameter merging

**Step 3: Run frontend tests**

Run:

```bash
node --test cmd/server/web/app.test.js
```

Expected: pass.

### Task 3: Redesign Controls Around Tabs

**Files:**
- Modify: `cmd/server/web/index.html`
- Modify: `cmd/server/web/styles.css`
- Modify: `cmd/server/web/app.js`

**Step 1: Replace mode cards and scenarios**

Replace the mode cards, quick presets, and mode select with three tabs and route target controls.

**Step 2: Add action buttons**

Add:

- `发送当前路由`
- `混合发送多路由`

Wire both buttons to the same runner, passing `mixed: false` or `mixed: true`.

**Step 3: Tune per-tab defaults**

Normal defaults should be conservative. Stress defaults should use higher count and concurrency. Continuous defaults should use interval and no total count.

**Step 4: Run frontend tests**

Run:

```bash
node --test cmd/server/web/app.test.js
```

Expected: pass.

### Task 4: Extend Backend Route Families

**Files:**
- Modify: `internal/traffic/handler.go`
- Modify: `internal/traffic/handler_test.go`

**Step 1: Write failing Go tests**

Add tests for representative new paths:

- `/api/payment/trade/20260611001`
- `/api/project/alpha/env/prod`
- `/api/version/v2/apps/console`
- `/api/logs/service/worker/errors`
- `/api/files/docs/readme.pdf`
- `/api/search/users?q=admin`

Each should return JSON with controlled status and a non-empty route label.

**Step 2: Run test to verify failure**

Run:

```bash
go test ./internal/traffic
```

Expected: fails because the new families return 404.

**Step 3: Implement grouped family handlers**

Add prefix cases in `ServeHTTP` and route labels for each family.

**Step 4: Run Go tests**

Run:

```bash
go test ./internal/traffic
```

Expected: pass.

### Task 5: Update Documentation And Verify

**Files:**
- Modify: `README.md`

**Step 1: Update README**

Document the three tabs, mixed multi-route sending, regex route pool, and the rule that browser requests must remain client-side.

**Step 2: Run final verification**

Run:

```bash
node --test cmd/server/web/app.test.js
go test ./...
go build ./...
go vet ./...
```

Expected: all pass.

**Step 3: Commit implementation**

Run:

```bash
git add README.md cmd/server/web/app.js cmd/server/web/app.test.js cmd/server/web/index.html cmd/server/web/styles.css internal/traffic/handler.go internal/traffic/handler_test.go
git commit -m "feat: add mixed route testing tabs"
```
