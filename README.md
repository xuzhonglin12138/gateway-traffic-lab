# Gateway Traffic Lab

Click-driven traffic generator for testing Rainbond gateway monitoring.

## What It Tests

- Request count through the real Rainbond gateway.
- 2xx, 4xx, and 5xx status codes.
- Controlled upstream response latency.
- Internal route grouping such as `/api/user/setting/*` and `/api/order/detail/*`.
- Browser-side batch traffic with configurable count and concurrency.

## Run Locally

```bash
go test ./...
go run ./cmd/server
```

Open `http://127.0.0.1:8080`.

## Build

```bash
go build -o bin/gateway-traffic-lab ./cmd/server
```

## Docker

```bash
docker build -t gateway-traffic-lab:dev .
docker run --rm -p 8080:8080 gateway-traffic-lab:dev
```

## Rainbond Usage

1. Create a new application/component from this directory or image.
2. Expose port `8080` through the Rainbond gateway.
3. Open the gateway URL and click the traffic scenario buttons.
4. In the gateway monitoring plugin, sync Route-level `http-logger` for this application.
5. Watch the monitoring UI for request count, latency, errors, and internal route data.

The browser sends each request through the gateway. Avoid replacing this with a backend loop when validating request counts, because a backend loop would only create one gateway request.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/healthz` | Health check |
| GET | `/api/ping` | Fast 200 response |
| GET | `/api/delay?ms=1000` | Fixed latency |
| GET | `/api/error?status=500&ms=50` | Controlled error status |
| GET | `/api/random?errorRate=25&minMs=50&maxMs=1000` | Random latency and error rate |
| GET/POST | `/api/user/setting/{id}` | Internal route grouping test |
| GET/POST | `/api/order/detail/{id}` | Internal route grouping test |
| GET/POST | `/api/report/list` | Internal route test |
| GET/POST/PUT/DELETE | `/api/echo` | Method and payload test |
| POST | `/api/scenario` | JSON-controlled single request |

