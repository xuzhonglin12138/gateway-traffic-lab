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

  const state = {
    running: false,
    stop: false,
    mode: 'normal',
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
    config.path = config.path || '/api/ping'
    config.method = config.method || 'GET'
    config.count = config.continuous ? 0 : clampNumber(config.count, 1, 2000)
    config.concurrency = clampNumber(config.concurrency, 1, 80)
    config.intervalMs = clampNumber(config.intervalMs, 0, 10000)
    config.delayMs = clampNumber(config.delayMs, 0, 30000)
    config.status = clampNumber(config.status, 200, 599)
    config.errorRate = clampNumber(config.errorRate, 0, 100)
    config.payloadBytes = clampNumber(config.payloadBytes, 0, 1048576)
    return config
  }

  function clampNumber(value, min, max) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return min
    return Math.min(max, Math.max(min, parsed))
  }

  function buildURL(config, index) {
    const params = new URLSearchParams()
    const path = config.path

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
    return `${path}?${params.toString()}`
  }

  function isGroupedRoute(path) {
    return path.indexOf('/api/user/setting/') === 0 ||
      path.indexOf('/api/order/detail/') === 0 ||
      path === '/api/report/list'
  }

  function progressPercent(runState) {
    if (runState.total === 0) return runState.running ? 100 : 0
    return Math.min(100, Math.round((runState.sent / runState.total) * 100))
  }

  function initBrowser() {
    const el = id => document.getElementById(id)

    function readConfig() {
      return createRunConfig({
        mode: el('mode').value,
        path: el('path').value,
        method: el('method').value,
        count: el('count').value,
        concurrency: el('concurrency').value,
        intervalMs: el('intervalMs').value,
        delayMs: el('delayMs').value,
        status: el('status').value,
        errorRate: el('errorRate').value,
        payloadBytes: el('payloadBytes').value,
      })
    }

    function applyConfig(config) {
      const next = createRunConfig(config)
      el('mode').value = next.mode
      el('path').value = next.path
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

    async function sendOne(config, index) {
      const url = buildURL(config, index)
      const options = { method: config.method }
      if (config.method !== 'GET' && config.method !== 'HEAD') {
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
      recordResult({ index, method: config.method, path: config.path, status, clientMs, serverDelay })
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
      el('runMode').textContent = modeLabel(state.mode)
      el('elapsed').textContent = state.startedAt ? `${Math.floor((Date.now() - state.startedAt) / 1000)} 秒` : '0 秒'
      el('progressBar').style.width = `${progressPercent(state)}%`
      el('progressText').textContent = state.total === 0 ? '持续请求，手动停止' : `${state.sent}/${state.total}`

      el('logRows').innerHTML = state.rows.map(row => `
        <tr>
          <td>${row.index}</td>
          <td>${row.method}</td>
          <td>${row.path}</td>
          <td class="${row.status >= 200 && row.status < 400 ? 'status-ok' : 'status-error'}">${row.status || '失败'}</td>
          <td>${row.clientMs} ms</td>
          <td>${row.serverDelay} ms</td>
        </tr>
      `).join('')
    }

    function modeLabel(mode) {
      if (mode === 'continuous') return '持续请求'
      if (mode === 'stress') return '压力测试请求'
      return '普通请求'
    }

    function updateModeText(mode) {
      document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.toggle('active', card.dataset.mode === mode)
      })
      el('modeHelp').textContent = {
        normal: '适合验证网关路径、状态码和延迟采集。',
        continuous: '会一直发送请求，直到点击停止。',
        stress: '会产生更高并发，请确认测试环境容量后再启动。',
      }[mode]
    }

    document.querySelectorAll('.mode-card').forEach(button => {
      button.addEventListener('click', () => {
        applyConfig(getModeDefaults(button.dataset.mode))
      })
    })

    document.querySelectorAll('.scenario').forEach(button => {
      button.addEventListener('click', () => {
        applyConfig({ scenario: scenarios[button.dataset.scenario] })
      })
    })

    el('mode').addEventListener('change', event => {
      applyConfig(getModeDefaults(event.target.value))
    })

    el('trafficForm').addEventListener('submit', event => {
      event.preventDefault()
      runTraffic(readConfig())
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
    render()
  }

  const api = {
    buildURL,
    createRunConfig,
    getModeDefaults,
    progressPercent,
    scenarios,
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
