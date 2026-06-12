(function (root) {
  const modeDefaults = {
    normal: {
      mode: 'normal',
      path: '/api/ping',
      method: 'GET',
      count: 20,
      concurrency: 3,
      intervalMs: 0,
      delayMs: 0,
      status: 200,
      errorRate: 0,
      payloadBytes: 0,
      continuous: false,
      autoStart: false,
    },
    continuous: {
      mode: 'continuous',
      path: '/api/random',
      method: 'GET',
      count: 0,
      concurrency: 4,
      intervalMs: 500,
      delayMs: 120,
      status: 200,
      errorRate: 5,
      payloadBytes: 0,
      continuous: true,
      autoStart: false,
    },
    stress: {
      mode: 'stress',
      path: '/api/random',
      method: 'GET',
      count: 500,
      concurrency: 30,
      intervalMs: 0,
      delayMs: 40,
      status: 200,
      errorRate: 10,
      payloadBytes: 128,
      continuous: false,
      autoStart: false,
    },
  }

  const scenarios = {
    fast: {
      mode: 'normal',
      path: '/api/ping',
      method: 'GET',
      count: 20,
      concurrency: 3,
      delayMs: 0,
      status: 200,
      errorRate: 0,
      payloadBytes: 0,
    },
    slow: {
      mode: 'normal',
      path: '/api/delay',
      method: 'GET',
      count: 20,
      concurrency: 4,
      delayMs: 1000,
      status: 200,
      errorRate: 0,
      payloadBytes: 0,
    },
    error: {
      mode: 'normal',
      path: '/api/error',
      method: 'GET',
      count: 30,
      concurrency: 5,
      delayMs: 50,
      status: 500,
      errorRate: 0,
      payloadBytes: 0,
    },
    mixed: {
      mode: 'continuous',
      path: '/api/random',
      method: 'GET',
      count: 0,
      concurrency: 5,
      intervalMs: 400,
      delayMs: 300,
      status: 200,
      errorRate: 25,
      payloadBytes: 0,
    },
    stress: {
      mode: 'stress',
      path: '/api/random',
      method: 'GET',
      count: 800,
      concurrency: 40,
      intervalMs: 0,
      delayMs: 20,
      status: 200,
      errorRate: 8,
      payloadBytes: 256,
    },
  }

  const routeTargets = {
    ping: { path: '/api/ping', method: 'GET', label: '快速成功' },
    random: { path: '/api/random', method: 'GET', label: '随机延迟/错误' },
    error: { path: '/api/error', method: 'GET', label: '指定错误码' },
    user: { path: '/api/user/setting/42', method: 'GET', label: '用户设置分组' },
    order: { path: '/api/order/detail/99', method: 'GET', label: '订单详情分组' },
    report: { path: '/api/report/list', method: 'GET', label: '报表列表分组' },
    echo: { path: '/api/echo', method: 'POST', label: '回显负载' },
  }

  const slaTargets = {
    ok: { path: '/sla/ok', label: '正常', help: '持续返回 200，适合验证 SLA 正常采样。' },
    fail: { path: '/sla/fail', label: '失败', help: '持续返回 500，适合验证失败次数和最近状态。' },
    slow: { path: '/sla/slow?ms=3500', label: '超时', help: '默认延迟 3.5 秒，适合验证插件 3 秒超时策略。' },
    flaky: { path: '/sla/flaky?errorRate=30', label: '波动', help: '按 30% 概率返回 500，适合验证 SLA 低于 99% 的展示。' },
  }

  const mixedRoutes = [
    { path: '/api/ping', method: 'GET', label: '/api/ping' },
    { path: '/api/random', method: 'GET', label: '/api/random' },
    { path: '/api/error', method: 'GET', label: '/api/error' },
    { path: '/api/user/setting/42', method: 'GET', label: '/api/user/setting/*' },
    { path: '/api/user/setting/profile', method: 'GET', label: '/api/user/setting/*' },
    { path: '/api/user/setting/security/mfa', method: 'GET', label: '/api/user/setting/*' },
    { path: '/api/order/detail/99', method: 'GET', label: '/api/order/detail/*' },
    { path: '/api/order/detail/2026/refund', method: 'GET', label: '/api/order/detail/*' },
    { path: '/api/report/list', method: 'GET', label: '/api/report/list' },
    { path: '/api/report/list/monthly', method: 'GET', label: '/api/report/list/*' },
    { path: '/api/payment/trade/20260611001', method: 'GET', label: '/api/payment/trade/*' },
    { path: '/api/payment/refund/20260611001', method: 'GET', label: '/api/payment/refund/*' },
    { path: '/api/project/alpha/env/prod', method: 'GET', label: '/api/project/*/env/*' },
    { path: '/api/project/beta/env/staging', method: 'GET', label: '/api/project/*/env/*' },
    { path: '/api/version/v1/apps/gateway', method: 'GET', label: '/api/version/*/apps/*' },
    { path: '/api/version/v2/apps/console', method: 'GET', label: '/api/version/*/apps/*' },
    { path: '/api/logs/service/api-server', method: 'GET', label: '/api/logs/service/*' },
    { path: '/api/logs/service/worker/errors', method: 'GET', label: '/api/logs/service/*' },
    { path: '/api/files/images/avatar.png', method: 'GET', label: '/api/files/*' },
    { path: '/api/files/docs/readme.pdf', method: 'GET', label: '/api/files/*' },
    { path: '/api/search/users?q=admin', method: 'GET', label: '/api/search/users' },
    { path: '/api/search/orders?state=paid', method: 'GET', label: '/api/search/orders' },
  ]

  const state = {
    running: false,
    stop: false,
    mode: 'normal',
    mixed: false,
    total: 0,
    sent: 0,
    success: 0,
    failed: 0,
    totalMs: 0,
    startedAt: 0,
    rows: [],
  }

  function getModeDefaults(mode) {
    return Object.assign({}, modeDefaults[mode] || modeDefaults.normal)
  }

  function createRunConfig(input) {
    const source = input || {}
    const scenario = source.scenario || {}
    const mode = source.mode || scenario.mode || 'normal'
    const config = Object.assign(getModeDefaults(mode), scenario, source)
    config.mode = source.mode || scenario.mode || mode
    config.continuous = mode === 'continuous'
    config.autoStart = false
    if (config.target && routeTargets[config.target]) {
      config.path = routeTargets[config.target].path
      if (!Object.prototype.hasOwnProperty.call(source, 'method') && !Object.prototype.hasOwnProperty.call(scenario, 'method')) {
        config.method = routeTargets[config.target].method
      }
    }
    config.path = config.path || '/api/ping'
    config.method = config.method || 'GET'
    config.count = config.continuous ? 0 : clampNumber(config.count, 1, 2000)
    config.concurrency = clampNumber(config.concurrency, 1, 80)
    config.intervalMs = clampNumber(config.intervalMs, 0, 10000)
    config.delayMs = clampNumber(config.delayMs, 0, 30000)
    config.status = clampNumber(config.status, 200, 599)
    config.errorRate = clampNumber(config.errorRate, 0, 100)
    config.payloadBytes = clampNumber(config.payloadBytes, 0, 1048576)
    config.mixed = Boolean(config.mixed)
    return config
  }

  function clampNumber(value, min, max) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return min
    return Math.min(max, Math.max(min, parsed))
  }

  function buildURL(config, index) {
    const selected = selectRouteForRequest(config, index)
    const parts = selected.path.split('?')
    const path = parts[0]
    const params = new URLSearchParams(parts[1] || '')

    if (path === '/api/delay') {
      params.set('ms', config.delayMs)
    } else if (path === '/api/error') {
      params.set('status', config.status)
      params.set('ms', config.delayMs)
    } else if (path === '/api/random') {
      params.set('errorRate', config.errorRate)
      params.set('minMs', Math.max(0, Math.floor(config.delayMs / 2)))
      params.set('maxMs', config.delayMs)
    } else if (path === '/api/echo' || isGroupedRoute(path)) {
      params.set('status', config.status)
      params.set('ms', config.delayMs)
    }

    if (config.payloadBytes > 0) {
      params.set('payloadBytes', config.payloadBytes)
    }
    params.set('request', index)
    const query = params.toString()
    return query ? `${path}?${query}` : path
  }

  function isGroupedRoute(path) {
    return path.indexOf('/api/user/setting/') === 0 ||
      path.indexOf('/api/order/detail/') === 0 ||
      path.indexOf('/api/report/list') === 0 ||
      path.indexOf('/api/payment/') === 0 ||
      path.indexOf('/api/project/') === 0 ||
      path.indexOf('/api/version/') === 0 ||
      path.indexOf('/api/logs/') === 0 ||
      path.indexOf('/api/files/') === 0 ||
      path.indexOf('/api/search/') === 0
  }

  function selectRouteForRequest(config, index) {
    if (!config.mixed) {
      return {
        path: config.path,
        method: config.method,
        label: config.path,
      }
    }
    if (config.mode === 'stress') {
      const seed = Math.abs((index * 1103515245 + 12345) % 2147483647)
      return mixedRoutes[seed % mixedRoutes.length]
    }
    return mixedRoutes[(Math.max(1, index) - 1) % mixedRoutes.length]
  }

  function progressPercent(runState) {
    if (runState.total === 0) return runState.running ? 100 : 0
    return Math.min(100, Math.round((runState.sent / runState.total) * 100))
  }

  function initBrowser() {
    const el = id => document.getElementById(id)
    let selectedMode = 'normal'

    function readConfig(mixed) {
      return createRunConfig({
        mode: selectedMode,
        target: el('target').value,
        method: el('method').value,
        count: el('count').value,
        concurrency: el('concurrency').value,
        intervalMs: el('intervalMs').value,
        delayMs: el('delayMs').value,
        status: el('status').value,
        errorRate: el('errorRate').value,
        payloadBytes: el('payloadBytes').value,
        mixed,
      })
    }

    function applyConfig(config) {
      const next = createRunConfig(config)
      selectedMode = next.mode
      el('method').value = next.method
      el('count').value = next.count
      el('concurrency').value = next.concurrency
      el('intervalMs').value = next.intervalMs
      el('delayMs').value = next.delayMs
      el('status').value = next.status
      el('errorRate').value = next.errorRate
      el('payloadBytes').value = next.payloadBytes
      updateModeText(next.mode)
    }

    function applyTargetDefaults(target) {
      const route = routeTargets[target]
      if (!route) return
      el('method').value = route.method
      if (target === 'error') {
        el('status').value = 500
      } else if (Number(el('status').value) >= 400) {
        el('status').value = 200
      }
      if (target === 'echo' && Number(el('payloadBytes').value) === 0) {
        el('payloadBytes').value = 256
      }
    }

    async function sendOne(config, index) {
      const url = buildURL(config, index)
      const selected = selectRouteForRequest(config, index)
      const method = selected.method || config.method
      const options = { method }
      if (method !== 'GET' && method !== 'HEAD') {
        options.headers = { 'Content-Type': 'application/json' }
        options.body = JSON.stringify({
          index,
          payload: 'x'.repeat(Math.min(config.payloadBytes, 4096)),
        })
      }

      const started = performance.now()
      let status = 0
      let serverDelay = 0
      try {
        const response = await fetch(url, options)
        status = response.status
        const data = await response.json().catch(() => ({}))
        serverDelay = Number(data.delay_ms || 0)
      } catch (error) {
        status = 0
      }
      const clientMs = Math.round(performance.now() - started)
      recordResult({ index, method, path: url, status, clientMs, serverDelay, routeLabel: selected.label })
    }

    function recordResult(row) {
      state.sent += 1
      if (row.status >= 200 && row.status < 400) {
        state.success += 1
      } else {
        state.failed += 1
      }
      state.totalMs += row.clientMs
      state.rows.unshift(row)
      state.rows = state.rows.slice(0, 120)
      render()
    }

    async function runTraffic(config) {
      if (state.running) return
      state.running = true
      state.stop = false
      state.mode = config.mode
      state.mixed = config.mixed
      state.total = config.count
      state.sent = 0
      state.success = 0
      state.failed = 0
      state.totalMs = 0
      state.startedAt = Date.now()
      state.rows = []
      render()

      if (config.continuous) {
        await runContinuous(config)
      } else {
        await runBatch(config)
      }

      state.running = false
      render()
    }

    async function runBatch(config) {
      let nextIndex = 1
      const workers = Array.from({ length: config.concurrency }, async () => {
        while (!state.stop && nextIndex <= config.count) {
          const index = nextIndex
          nextIndex += 1
          await sendOne(config, index)
        }
      })
      await Promise.all(workers)
    }

    async function runContinuous(config) {
      let nextIndex = 1
      const workers = Array.from({ length: config.concurrency }, async () => {
        while (!state.stop) {
          const index = nextIndex
          nextIndex += 1
          await sendOne(config, index)
          if (config.intervalMs > 0 && !state.stop) {
            await wait(config.intervalMs)
          }
        }
      })
      await Promise.all(workers)
    }

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    }

    function render() {
      el('sent').textContent = state.sent
      el('success').textContent = state.success
      el('failed').textContent = state.failed
      el('avg').textContent = state.sent === 0 ? '0 ms' : `${Math.round(state.totalMs / state.sent)} ms`
      el('runState').textContent = state.running ? '运行中' : '空闲'
      el('runMode').textContent = state.mixed ? `${modeLabel(state.mode)} · 混合` : modeLabel(state.mode)
      el('elapsed').textContent = state.startedAt ? `${Math.floor((Date.now() - state.startedAt) / 1000)} 秒` : '0 秒'
      el('progressBar').style.width = `${progressPercent(state)}%`
      el('progressText').textContent = state.total === 0 ? '持续请求，手动停止' : `${state.sent}/${state.total}`

      el('logRows').innerHTML = state.rows.map(row => `
        <tr>
          <td>${row.index}</td>
          <td>${row.method}</td>
          <td>${row.path}</td>
          <td>${row.routeLabel || '-'}</td>
          <td class="${row.status >= 200 && row.status < 400 ? 'status-ok' : 'status-error'}">${row.status || '失败'}</td>
          <td>${row.clientMs} ms</td>
          <td>${row.serverDelay} ms</td>
        </tr>
      `).join('')
    }

    function modeLabel(mode) {
      if (mode === 'continuous') return '持续测试'
      if (mode === 'stress') return '压力测试'
      return '普通测试'
    }

    function updateModeText(mode) {
      document.querySelectorAll('.tab').forEach(tab => {
        const active = tab.dataset.mode === mode
        tab.classList.toggle('active', active)
        tab.setAttribute('aria-selected', active ? 'true' : 'false')
      })
      el('modeHelp').textContent = {
        normal: '少量请求验证正则规则是否命中，混合发送会按顺序覆盖所有路由模板。',
        continuous: '持续发送直到点击停止，适合观察网关监控曲线和分组变化。',
        stress: '更高并发和更多请求，混合发送会随机打散路由分布。',
      }[mode]
    }

    function absoluteURL(path) {
      return `${window.location.origin}${path}`
    }

    function selectSLA(name) {
      const target = slaTargets[name] || slaTargets.ok
      document.querySelectorAll('.sla-tabs .tab').forEach(tab => {
        const active = tab.dataset.sla === name
        tab.classList.toggle('active', active)
        tab.setAttribute('aria-selected', active ? 'true' : 'false')
      })
      el('slaURL').textContent = absoluteURL(target.path)
      el('slaHelp').textContent = `${target.help} 插件固定每 10 秒检查一次，3 秒超时，200-399 视为成功。`
    }

    async function probeSLA() {
      const url = el('slaURL').textContent
      const started = performance.now()
      let status = 0
      try {
        const response = await fetch(url)
        status = response.status
      } catch (error) {
        status = 0
      }
      const elapsed = Math.round(performance.now() - started)
      state.rows.unshift({
        index: state.rows.length + 1,
        method: 'GET',
        path: url,
        status,
        clientMs: elapsed,
        serverDelay: 0,
        routeLabel: 'SLA',
      })
      state.rows = state.rows.slice(0, 120)
      render()
    }

    document.querySelectorAll('.tab').forEach(button => {
      button.addEventListener('click', () => {
        if (button.dataset.sla) return
        applyConfig(getModeDefaults(button.dataset.mode))
      })
    })

    document.querySelectorAll('.sla-tabs .tab').forEach(button => {
      button.addEventListener('click', () => {
        selectSLA(button.dataset.sla)
      })
    })

    el('slaProbeBtn').addEventListener('click', probeSLA)

    el('copySlaBtn').addEventListener('click', async () => {
      const text = el('slaURL').textContent
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      }
      el('slaHelp').textContent = `已复制 ${text}。将其填入网关监测应用 SLA 配置即可联动采样。`
    })

    el('target').addEventListener('change', event => {
      applyTargetDefaults(event.target.value)
    })

    el('trafficForm').addEventListener('submit', event => {
      event.preventDefault()
      runTraffic(readConfig(false))
    })

    el('mixedBtn').addEventListener('click', () => {
      runTraffic(readConfig(true))
    })

    el('stopBtn').addEventListener('click', () => {
      state.stop = true
    })

    el('clearBtn').addEventListener('click', () => {
      if (state.running) return
      state.total = 0
      state.sent = 0
      state.success = 0
      state.failed = 0
      state.totalMs = 0
      state.startedAt = 0
      state.rows = []
      render()
    })

    applyConfig(getModeDefaults('normal'))
    selectSLA('ok')
    render()
  }

  const api = {
    buildURL,
    createRunConfig,
    getModeDefaults,
    mixedRoutes,
    routeTargets,
    slaTargets,
    progressPercent,
    scenarios,
    selectRouteForRequest,
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  } else {
    root.GatewayTrafficLab = api
    if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', initBrowser)
    }
  }
})(typeof window !== 'undefined' ? window : global)
