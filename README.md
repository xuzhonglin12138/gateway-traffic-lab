# 网关流量测试工具

这是一个用于 Rainbond 网关监控验证的浏览器流量发生器。浏览器会直接通过网关访问接口，方便在网关监控中观察请求量、状态码、延迟和路径分组数据。

## 支持能力

- 普通测试：低并发、有限次数，用于确认网关采集和正则匹配是否正常。
- 压力测试：更高并发、更多请求，用于观察网关吞吐、延迟、错误率和分组稳定性。
- 持续测试：按固定间隔持续发送，直到手动停止，用于观察监控曲线。
- 支持发送当前路由，也支持一键混合发送多路由请求。
- 支持 2xx、4xx、5xx 状态码。
- 支持固定延迟、随机延迟、随机错误率和请求负载大小。
- 支持 `/api/user/setting/*`、`/api/order/detail/*`、`/api/payment/*`、`/api/project/*`、`/api/version/*`、`/api/logs/*`、`/api/files/*`、`/api/search/*` 等路径分组验证。

## 页面使用方式

页面提供三个 tabs：

- **普通测试**：默认请求数和并发较低，适合先验证正则规则是否命中。
- **压力测试**：默认请求数和并发更高，适合验证高流量下的网关指标。
- **持续测试**：持续发送直到点击停止，适合观察监控曲线。

每个 tab 都可以直接点击：

- **发送当前路由**：只发送目标类型对应的单一路由。
- **混合发送多路由**：自动覆盖多种路由形态，适合验证另一个项目中的正则匹配规则。

混合发送默认覆盖静态路径、数字 ID、slug、嵌套路径、版本路径、文件路径和带查询参数的路径，例如：

```text
/api/ping
/api/user/setting/42
/api/user/setting/security/mfa
/api/order/detail/2026/refund
/api/payment/trade/20260611001
/api/payment/refund/20260611001
/api/project/alpha/env/prod
/api/version/v2/apps/console
/api/logs/service/worker/errors
/api/files/docs/readme.pdf
/api/search/users?q=admin
```

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
4. 选择普通测试、压力测试或持续测试。
5. 点击发送当前路由或混合发送多路由。
6. 在网关监控中查看请求量、延迟、状态码和路径分组数据。

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
| GET/POST | `/api/report/list...` | 报表列表路径分组 |
| GET/POST | `/api/payment/...` | 支付交易/退款路径分组 |
| GET/POST | `/api/project/...` | 项目环境路径分组 |
| GET/POST | `/api/version/...` | 版本应用路径分组 |
| GET/POST | `/api/logs/...` | 服务日志路径分组 |
| GET/POST | `/api/files/...` | 文件路径分组 |
| GET/POST | `/api/search/...` | 搜索路径分组 |
| GET/POST/PUT/DELETE | `/api/echo` | 方法和负载回显 |
| POST | `/api/scenario` | JSON 控制的单次请求 |
