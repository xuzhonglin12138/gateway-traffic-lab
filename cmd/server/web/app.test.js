const assert = require('assert')

const {
  buildURL,
  createRunConfig,
  getModeDefaults,
  mixedRoutes,
  scenarios,
  selectRouteForRequest,
  slaTargets,
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

test('mixed route pool covers regex-oriented route shapes', function () {
  assert.equal(mixedRoutes.length >= 20, true)
  assert.equal(mixedRoutes.some(route => route.path === '/api/user/setting/security/mfa'), true)
  assert.equal(mixedRoutes.some(route => route.path === '/api/files/docs/readme.pdf'), true)
  assert.equal(mixedRoutes.some(route => route.path === '/api/search/users?q=admin'), true)
})

test('normal mixed route selection cycles through the route pool', function () {
  const config = createRunConfig({ mode: 'normal', mixed: true })

  assert.equal(selectRouteForRequest(config, 1).path, mixedRoutes[0].path)
  assert.equal(selectRouteForRequest(config, 2).path, mixedRoutes[1].path)
  assert.equal(selectRouteForRequest(config, mixedRoutes.length + 1).path, mixedRoutes[0].path)
})

test('stress mixed route selection returns entries from the route pool', function () {
  const config = createRunConfig({ mode: 'stress', mixed: true })
  const selected = selectRouteForRequest(config, 11)

  assert.equal(mixedRoutes.some(route => route.path === selected.path), true)
})

test('buildURL preserves existing query strings when adding control parameters', function () {
  const config = createRunConfig({
    mode: 'normal',
    path: '/api/search/users?q=admin',
    method: 'GET',
    delayMs: 30,
    status: 202,
  })

  const url = buildURL(config, 4)

  assert.equal(url, '/api/search/users?q=admin&status=202&ms=30&request=4')
})

test('route target defaults select the target method when method is omitted', function () {
  const config = createRunConfig({ mode: 'normal', target: 'echo' })

  assert.equal(config.path, '/api/echo')
  assert.equal(config.method, 'POST')
})

test('mixed search order route keeps business query and control status separately', function () {
  const config = createRunConfig({
    mode: 'normal',
    path: '/api/search/orders?state=paid',
    method: 'GET',
    status: 208,
  })

  const url = buildURL(config, 5)

  assert.equal(url, '/api/search/orders?state=paid&status=208&ms=0&request=5')
})

test('stress defaults allow more request volume than normal defaults', function () {
  const normal = getModeDefaults('normal')
  const stress = getModeDefaults('stress')

  assert.equal(stress.count > normal.count, true)
  assert.equal(stress.concurrency > normal.concurrency, true)
})

test('sla targets expose stable health check paths', function () {
  assert.equal(slaTargets.ok.path, '/sla/ok')
  assert.equal(slaTargets.fail.path, '/sla/fail')
  assert.equal(slaTargets.slow.path.includes('/sla/slow'), true)
  assert.equal(slaTargets.flaky.path.includes('/sla/flaky'), true)
})
