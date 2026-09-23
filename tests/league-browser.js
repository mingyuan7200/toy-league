// Optional macOS Chrome smoke test against the isolated Wrangler server on 8790.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
import { webcrypto } from 'node:crypto'
import { newLeague, nextDay, pendingGames, submitResult } from '../functions/_league/engine.js'
import { publicLeague } from '../functions/_league/store.js'
import { COUNTRY_NAMES } from '../functions/_data/countries.js'

globalThis.crypto ??= webcrypto

const profile = await mkdtemp(join(tmpdir(), 'toy-league-browser-'))
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })
let socket
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Chrome did not start: ${output}`)), 20000)
    chrome.on('error', reject)
    chrome.stderr.on('data', chunk => {
      output += chunk.toString()
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
  })
  socket = new WebSocket(endpoint)
  await new Promise((resolve, reject) => { socket.on('open', resolve); socket.on('error', reject) })
  let sequence = 0
  const pending = new Map(), errors = []
  let countryRequests = 0
  socket.on('message', raw => {
    const data = JSON.parse(raw)
    if (data.method === 'Network.requestWillBeSent' && data.params.request.url.endsWith('/api/countries')) countryRequests++
    if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails)
    if (!data.id) return
    const { resolve, reject, timer } = pending.get(data.id)
    pending.delete(data.id); clearTimeout(timer)
    if (data.error) reject(new Error(JSON.stringify(data.error))); else resolve(data.result)
  })
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => reject(new Error(`Timed out: ${method}`)), 20000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const command = (method, params) => send(method, params, sessionId)
  await command('Page.enable')
  await command('Runtime.enable')
  await command('Network.enable')
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  async function waitFor(expression) {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(`Boolean(${expression})`)) return
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error(`Page did not reach: ${expression}\n${await evaluate('document.body.innerText')}`)
  }
  const clickText = label => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)})?.click()`)
  await command('Page.navigate', { url: 'http://127.0.0.1:8790/' })
  await waitFor("document.body.innerText.includes('Start a league')")
  await clickText('Start a league')
  await waitFor("document.body.innerText.includes('Create league')")
  await clickText('Create league')
  await waitFor("document.querySelector('.league-calendar') && document.body.innerText.includes('Play / resume')")
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, 'Mobile league page must not overflow horizontally')
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Next day')).disabled"), true)
  await clickText('Play / resume')
  await waitFor("document.querySelector('#stone-amount')")
  await evaluate("Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(document.querySelector('#stone-amount'),'3'); document.querySelector('#stone-amount').dispatchEvent(new Event('input',{bubbles:true}));")
  await evaluate("document.querySelector('.stone-controls').requestSubmit()")
  await waitFor("document.querySelectorAll('.round-history tbody tr').length === 1")
  assert.equal(countryRequests, 1, 'Load countries once when first needed')
  await command('Page.reload')
  await waitFor("document.body.innerText.includes('Resume a league')")
  await clickText('Resume a league')
  await waitFor("document.querySelector('.league-save')")
  await evaluate("document.querySelector('.league-save').click()")
  await waitFor("document.body.innerText.includes('Play / resume')")
  await clickText('Play / resume')
  await waitFor("document.querySelectorAll('.round-history tbody tr').length === 1")
  for (let round = 1; round < 15; round++) {
    await evaluate("{ const input=document.querySelector('#stone-amount'); if(!input.disabled){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'0'); input.dispatchEvent(new Event('input',{bubbles:true}));} }")
    await evaluate("document.querySelector('.stone-controls').requestSubmit()")
    await waitFor(`document.querySelectorAll('.round-history tbody tr').length === ${round + 1}`)
  }
  await clickText('Save result and return to league')
  await waitFor("document.querySelector('.league-calendar') && !document.body.innerText.includes('Play / resume')")
  await clickText('Next day →')
  await waitFor("document.querySelector('.league-calendar strong')?.textContent === '0001-01-02'")
  await clickText('Next game day →')
  await waitFor("document.querySelector('.league-calendar strong')?.textContent > '0001-01-02'")
  assert.equal(countryRequests, 2, 'One country request per full-page load, not per league response')
  // Use simulated fixtures only in this browser to inspect later stages without
  // advancing or editing any user's persisted league.
  const countries = COUNTRY_NAMES.map((name, index) => ({ id: index + 1, name }))
  const fixture = newLeague(countries)
  const advanceTo = date => {
    while (fixture.date < date) {
      while (pendingGames(fixture).length) submitResult(fixture, pendingGames(fixture)[0].id, 8, 7)
      nextDay(fixture)
    }
    return publicLeague(fixture, countries)
  }
  const groupFixture = advanceTo('0001-07-02')
  const challengerFixture = advanceTo('0002-03-01')
  const championshipFixture = advanceTo('0002-05-01')
  await evaluate(`window.bracketFixture = ${JSON.stringify(groupFixture)}; window.fetch = async () => new Response(JSON.stringify(window.bracketFixture), { headers: { 'content-type': 'application/json' } });`)
  await clickText('Reload')
  await waitFor("document.querySelector('.double-elimination')")
  await clickText('Losers bracket')
  await waitFor("document.querySelector('.tournament-bracket h3')?.textContent === 'Losers bracket'")
  assert.equal(await evaluate("document.querySelector('.bracket-mobile-controls select').options.length"), 10)
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true)
  await clickText('Next →')
  assert.equal(await evaluate("document.querySelector('.bracket-mobile-controls select').value"), '1')
  await clickText('Final / reset')
  await waitFor("document.querySelector('.tournament-bracket h3')?.textContent === 'Group 6 final / reset'")
  assert.equal(await evaluate("document.querySelector('.bracket-mobile-controls select').options.length"), 2)
  await evaluate(`window.bracketFixture = ${JSON.stringify(challengerFixture)}`)
  await clickText('Reload')
  const bId = challengerFixture.tournaments.find(t => t.type === 'B').id
  await waitFor("document.querySelector('.league-calendar strong')?.textContent === '0002-03-01'")
  await evaluate(`document.querySelector('#league-tournament').value = ${JSON.stringify(bId)}; document.querySelector('#league-tournament').dispatchEvent(new Event('change', { bubbles: true }));`)
  await waitFor("document.querySelector('.stage-tabs button[aria-pressed=true]')?.textContent.includes('Stage 2')")
  assert.equal(await evaluate("document.querySelector('.past-group-results').open"), false)
  assert.equal(await evaluate("document.querySelector('.league-panel > .tournament-bracket').querySelectorAll('.bracket-scroll .bracket-match').length"), 10)
  assert.equal(await evaluate("document.querySelector('.league-panel > .tournament-bracket').querySelectorAll('.bracket-canvas path').length"), 9)
  await evaluate("document.querySelector('.tournament-bracket').scrollIntoView()")
  const mobileImage = await command('Page.captureScreenshot', { format: 'png' })
  await writeFile('.wrangler/bracket-mobile.png', Buffer.from(mobileImage.data, 'base64'))
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await evaluate("document.querySelector('.tournament-bracket').scrollIntoView()")
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true)
  const desktopImage = await command('Page.captureScreenshot', { format: 'png' })
  await writeFile('.wrangler/bracket-desktop.png', Buffer.from(desktopImage.data, 'base64'))
  await evaluate(`window.bracketFixture = ${JSON.stringify(championshipFixture)}`)
  await clickText('Reload')
  await waitFor("document.querySelector('.championship-panel')")
  assert.equal(await evaluate("document.querySelectorAll('.championship-game').length"), 7)
  const aId = championshipFixture.tournaments.find(t => t.type === 'A' && t.year === 2).id
  await evaluate(`document.querySelector('#league-tournament').value = ${JSON.stringify(aId)}; document.querySelector('#league-tournament').dispatchEvent(new Event('change', { bubbles: true }));`)
  await waitFor("document.querySelector('#league-group')")
  await evaluate("document.querySelector('#league-group').value = 'D'; document.querySelector('#league-group').dispatchEvent(new Event('change', { bubbles: true }));")
  await waitFor("document.querySelector('.boundary-promote')?.textContent.includes('Top 4')")
  assert.ok(await evaluate("document.querySelector('.boundary-relegate').textContent.includes('Bottom 5')"))
  assert.ok(await evaluate("document.body.innerText.includes('🇨🇳')"))
  assert.deepEqual(errors, [], 'No uncaught browser errors')
  console.log('PASS: mobile layout; create league; next-day disabled; play round; reload/resume local game; complete 15 rounds; save to D1; next day.')
  console.log('PASS: winners/losers/reset round navigation; automatic stage 2 and championship focus; ten connected knockout games; A promotion/relegation lines; flags; desktop/mobile containment.')
} finally {
  socket?.close()
  chrome.kill()
}
