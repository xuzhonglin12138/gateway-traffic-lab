# Mixed Route Tabs Design

## Background

The current page exposes three layers of choice: request mode cards, quick presets, and detailed form fields. This makes the main workflow feel heavier than the task requires. The current sender also targets one route at a time, which is not enough for validating gateway regular-expression route grouping in another project.

## Goals

- Replace the layered selection flow with three direct tabs: normal test, stress test, and continuous test.
- Add a mixed multi-route sender that can exercise many route shapes with one click.
- Expand backend route handling so mixed routes return controlled responses instead of mostly 404.
- Keep every request initiated by the browser so gateway monitoring still observes real ingress traffic.
- Keep advanced configuration available without forcing users to configure every run.

## Interaction Design

The page keeps a two-column layout: controls on the left and results on the right.

The control panel starts with three tabs:

- Normal test: low request count and low concurrency for verifying whether rules match.
- Stress test: high request count and higher concurrency for checking throughput, latency, and grouped metrics under load.
- Continuous test: runs until stopped and uses an interval for monitoring curve validation.

Each tab has its own defaults. The user can immediately click:

- Send current route
- Mixed send multi-route

The current route selector is simplified to a small set of target types, such as fast success, random latency, explicit error, route group, and echo payload. Advanced fields remain visible in a compact section: method, count, concurrency, interval, delay, status, error rate, and payload size.

## Mixed Route Pool

Mixed sending uses a frontend route template pool with paths that exercise common regex matching cases:

- Static paths: `/api/ping`, `/api/report/list`
- Numeric IDs: `/api/user/setting/42`, `/api/order/detail/99`
- Slugs: `/api/user/setting/profile`, `/api/project/alpha/env/prod`
- Nested paths: `/api/user/setting/security/mfa`, `/api/logs/service/worker/errors`
- Versioned paths: `/api/version/v1/apps/gateway`, `/api/version/v2/apps/console`
- File-like paths: `/api/files/images/avatar.png`, `/api/files/docs/readme.pdf`
- Query strings: `/api/search/users?q=admin`, `/api/search/orders?status=paid`
- Business routes: `/api/payment/trade/20260611001`, `/api/payment/refund/20260611001`

Normal and continuous tests cycle through the pool so every route is covered. Stress tests use random route selection to better simulate uneven traffic while still using the same route pool.

## Frontend Design

`cmd/server/web/app.js` owns the route pool and exposes pure helpers for tests:

- normalize tab config
- resolve current route target to a concrete path
- select a mixed route for a request index and tab mode
- build URLs while preserving existing query parameters

Runtime execution uses the same worker model that already exists. The sender receives a `mixed` flag. For single-route mode, it builds every request from the selected target. For mixed mode, it picks a route from the pool per request and records the concrete path and route label in the result table.

## Backend Design

The Go handler keeps existing exact endpoints. It adds generic grouped handlers for the new route families:

- `/api/payment/...`
- `/api/project/...`
- `/api/version/...`
- `/api/logs/...`
- `/api/files/...`
- `/api/search/...`

These handlers accept the same control query parameters as the existing grouped routes: `status`, `ms`, and `payloadBytes`. Responses include `route_label` values suitable for comparing against regex grouping rules.

## Testing

Frontend tests cover:

- mixed route pool contains enough regex-oriented routes
- normal mixed selection cycles deterministically
- stress mixed selection returns valid pool entries
- URL construction preserves route query strings and appends control parameters
- tab defaults provide higher stress request volume and continuous unbounded behavior

Go tests cover:

- new route families return controlled JSON instead of 404
- existing grouped route behavior remains unchanged

Project verification:

- `node --test cmd/server/web/app.test.js`
- `go test ./...`
- `go build ./...`
- `go vet ./...`
