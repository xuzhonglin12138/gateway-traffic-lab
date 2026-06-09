# 网关流量测试工具

这是一个用于 Rainbond 网关监控验证的浏览器流量发生器。浏览器会直接通过网关访问接口，方便在网关监控中观察请求量、状态码、延迟和路径分组数据。

## 支持能力

- 普通请求：低并发、有限次数，用于确认网关采集是否正常。
- 持续请求：按固定间隔持续发送，直到手动停止，用于观察监控曲线。
- 压力测试请求：高并发批量请求，用于观察网关吞吐、延迟和错误率。
- 支持 2xx、4xx、5xx 状态码。
- 支持固定延迟、随机延迟、随机错误率和请求负载大小。
- 支持 `/api/user/setting/*`、`/api/order/detail/*` 等路径分组验证。

## 本地运行

```bash
go test ./...
go run ./cmd/server
```

浏览器打开：

```text
http://127.0.0.1:8080
```

## 构建

```bash
go build -o bin/gateway-traffic-lab ./cmd/server
```

## Docker

```bash
docker build -t gateway-traffic-lab:dev .
docker run --rm -p 8080:8080 gateway-traffic-lab:dev
```

## Rainbond 使用方式

1. 从源码或镜像创建组件。
2. 暴露组件端口 `8080`。
3. 通过 Rainbond 网关访问页面。
4. 选择普通请求、持续请求或压力测试请求。
5. 在网关监控中查看请求量、延迟、状态码和路径分组数据。

注意：不要把请求循环改成后端内部循环。网关监控验证需要浏览器直接通过网关发起每一次请求，否则网关只能看到很少的入口请求。

## 接口列表

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/healthz` | 健康检查 |
| GET | `/api/ping` | 快速 200 响应 |
| GET | `/api/delay?ms=1000` | 固定延迟 |
| GET | `/api/error?status=500&ms=50` | 指定错误状态码 |
| GET | `/api/random?errorRate=25&minMs=50&maxMs=1000` | 随机延迟和错误率 |
| GET/POST | `/api/user/setting/{id}` | 用户设置路径分组 |
| GET/POST | `/api/order/detail/{id}` | 订单详情路径分组 |
| GET/POST | `/api/report/list` | 报表列表路径分组 |
| GET/POST/PUT/DELETE | `/api/echo` | 方法和负载回显 |
| POST | `/api/scenario` | JSON 控制的单次请求 |
