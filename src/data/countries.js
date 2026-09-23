// Shared by the league and Countries page. Cache lasts until the page reloads.
let countries = null
let pending = null

export const cachedCountries = () => countries

export function loadCountries() {
  if (countries !== null) return Promise.resolve(countries)
  if (pending) return pending
  pending = (async () => {
    try {
      const response = await fetch('/api/countries', { headers: { accept: 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`)
      if (!Array.isArray(data.countries) || !data.countries.length) throw new Error('Backend returned an invalid country list.')
      countries = data.countries
      return countries
    } finally {
      pending = null // Failed requests can be retried; concurrent requests share one promise.
    }
  })()
  return pending
}
