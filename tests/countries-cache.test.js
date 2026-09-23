import test from 'node:test'
import assert from 'node:assert/strict'
import { cachedCountries, loadCountries } from '../src/data/countries.js'

test('country cache starts null, shares in-flight requests, retries failures and reuses success', async () => {
  const originalFetch = globalThis.fetch
  let requests = 0
  const countries = [{ id: 1, name: 'Afghanistan' }]
  globalThis.fetch = async () => {
    requests++
    if (requests === 1) throw new Error('Offline')
    return { ok: true, json: async () => ({ countries }) }
  }
  try {
    assert.equal(cachedCountries(), null)
    const first = loadCountries()
    assert.equal(loadCountries(), first)
    await assert.rejects(first, /Offline/)
    assert.equal(cachedCountries(), null)
    const retry = loadCountries()
    assert.equal(loadCountries(), retry)
    assert.deepEqual(await retry, countries)
    assert.equal(cachedCountries(), countries)
    assert.equal(await loadCountries(), countries)
    assert.equal(requests, 2)
  } finally { globalThis.fetch = originalFetch }
})
