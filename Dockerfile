FROM docker.1ms.run/library/golang:1.23-alpine AS builder

WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
RUN go build -o /out/gateway-traffic-lab ./cmd/server

FROM docker.1ms.run/library/alpine:3.20

RUN adduser -D -H -u 10001 appuser
WORKDIR /app
COPY --from=builder /out/gateway-traffic-lab /app/gateway-traffic-lab

ENV PORT=8080
EXPOSE 8080
USER appuser

CMD ["/app/gateway-traffic-lab"]
