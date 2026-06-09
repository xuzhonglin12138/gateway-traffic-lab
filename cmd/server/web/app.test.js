const assert = require('assert')

const {
  buildURL,
  createRunConfig,
  getModeDefaults,
  scenarios,
} = require('./app.js')

function test(name, fn) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

test('scenario presets only provide config and do not start automatically', function () {
  const config = createRunConfig({ mode: 'normal', scenario: scenarios.fast })

  assert.equal(config.mode, 'normal')
  assert.equal(config.autoStart, false)
  assert.equal(config.path, '/api/ping')
  assert.equal(config.method, 'GET')
})

test('scenario preset can switch the request mode', function () {
  const config = createRunConfig({ scenario: scenarios.mixed })

  assert.equal(config.mode, 'continuous')
  assert.equal(config.continuous, true)
  assert.equal(config.count, 0)
})

test('echo route keeps selected method and payload query', function () {
  const config = createRunConfig({
    mode: 'normal',
    path: '/api/echo',
    method: 'POST',
    status: 201,
    delayMs: 80,
    payloadBytes: 128,
  })

  const url = buildURL(config, 7)

  assert.equal(url, '/api/echo?status=201&ms=80&payloadBytes=128&request=7')
  assert.equal(config.method, 'POST')
})

test('grouped routes keep the selected path and status parameters', function () {
  const config = createRunConfig({
    mode: 'normal',
    path: '/api/order/detail/99',
    method: 'DELETE',
    status: 502,
    delayMs: 20,
  })

  const url = buildURL(config, 3)

  assert.equal(url, '/api/order/detail/99?status=502&ms=20&request=3')
  assert.equal(config.method, 'DELETE')
})

test('continuous mode is unbounded until stopped', function () {
  const config = createRunConfig({ mode: 'continuous' })

  assert.equal(config.mode, 'continuous')
  assert.equal(config.continuous, true)
  assert.equal(config.count, 0)
  assert.equal(config.intervalMs > 0, true)
})

test('stress mode uses high but bounded defaults', function () {
  const defaults = getModeDefaults('stress')

  assert.equal(defaults.mode, 'stress')
  assert.equal(defaults.continuous, false)
  assert.equal(defaults.count >= 300, true)
  assert.equal(defaults.concurrency >= 20, true)
  assert.equal(defaults.concurrency <= 80, true)
})
