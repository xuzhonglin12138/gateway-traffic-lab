const scenarios = {
  normal: {
    path: '/api/ping',
    method: 'GET',
    count: 50,
    concurrency: 10,
    delayMs: 0,
    status: 200,
    errorRate: 0,
    payloadBytes: 0,
  },
  slow: {
    path: '/api/delay',
    method: 'GET',
    count: 20,
    concurrency: 5,
    delayMs: 1200,
    status: 200,
    errorRate: 0,
    payloadBytes: 0,
  },
  error: {
    path: '/api/error',
    method: 'GET',
    count: 30,
    concurrency: 8,
    delayMs: 50,
    status: 500,
    errorRate: 0,
    payloadBytes: 0,
  },
  mixed: {
    path: '/api/random',
    method: 'GET',
    count: 100,
    concurrency: 12,
    delayMs: 250,
    status: 200,
    errorRate: 25,
    payloadBytes: 0,
  },
}

const state = {
  running: false,
  stop: false,
  total: 0,
  sent: 0,
  success: 0,
  failed: 0,
  totalMs: 0,
  rows: [],
}

const el = id => document.getElementById(id)

function readConfig() {
  return {
    path: el('path').value,
    method: el('method').value,
    count: clampNumber(el('count').value, 1, 1000),
    concurrency: clampNumber(el('concurrency').value, 1, 50),
    delayMs: clampNumber(el('delayMs').value, 0, 30000),
    status: clampNumber(el('status').value, 200, 599),
    errorRate: clampNumber(el('errorRate').value, 0, 100),
    payloadBytes: clampNumber(el('payloadBytes').value, 0, 1048576),
  }
}

function applyConfig(config) {
  el('path').value = config.path
  el('method').value = config.method
  el('count').value = config.count
  el('concurrency').value = config.concurrency
  el('delayMs').value = config.delayMs
  el('status').value = config.status
  el('errorRate').value = config.errorRate
  el('payloadBytes').value = config.payloadBytes
}

function clampNumber(value, min, max) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return min
  return Math.min(max, Math.max(min, parsed))
}

function buildURL(config, index) {
  const params = new URLSearchParams()
  if (config.path === '/api/delay') {
    params.set('ms', config.delayMs)
  } else if (config.path === '/api/error') {
    params.set('status', config.status)
    params.set('ms', config.delayMs)
  } else if (config.path === '/api/random') {
    params.set('errorRate', config.errorRate)
    params.set('minMs', Math.max(0, Math.floor(config.delayMs / 2)))
    params.set('maxMs', config.delayMs)
  } else {
    params.set('status', config.status)
    params.set('ms', config.delayMs)
  }
  if (config.payloadBytes > 0) {
    params.set('payloadBytes', config.payloadBytes)
  }
  params.set('request', index)
  return `${config.path}?${params.toString()}`
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
  state.rows = state.rows.slice(0, 100)
  render()
}

async function runTraffic(config) {
  if (state.running) return
  state.running = true
  state.stop = false
  state.total = config.count
  state.sent = 0
  state.success = 0
  state.failed = 0
  state.totalMs = 0
  state.rows = []
  render()

  let nextIndex = 1
  const workers = Array.from({ length: config.concurrency }, async () => {
    while (!state.stop && nextIndex <= config.count) {
      const index = nextIndex
      nextIndex += 1
      await sendOne(config, index)
    }
  })

  await Promise.all(workers)
  state.running = false
  render()
}

function render() {
  el('sent').textContent = state.sent
  el('success').textContent = state.success
  el('failed').textContent = state.failed
  el('avg').textContent = state.sent === 0 ? '0 ms' : `${Math.round(state.totalMs / state.sent)} ms`
  el('runState').textContent = state.running ? 'Running' : 'Idle'
  el('progressBar').style.width = state.total === 0 ? '0%' : `${Math.round((state.sent / state.total) * 100)}%`

  el('logRows').innerHTML = state.rows.map(row => `
    <tr>
      <td>${row.index}</td>
      <td>${row.method}</td>
      <td>${row.path}</td>
      <td class="${row.status >= 200 && row.status < 400 ? 'status-ok' : 'status-error'}">${row.status || 'ERR'}</td>
      <td>${row.clientMs} ms</td>
      <td>${row.serverDelay} ms</td>
    </tr>
  `).join('')
}

document.querySelectorAll('.scenario').forEach(button => {
  button.addEventListener('click', () => {
    const config = scenarios[button.dataset.scenario]
    applyConfig(config)
    runTraffic(config)
  })
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
  state.rows = []
  render()
})

render()
