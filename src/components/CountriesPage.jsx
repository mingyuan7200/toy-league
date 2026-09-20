import { useCallback, useEffect, useState } from 'react'

export default function CountriesPage({ onExit }) {
  const [state, setState] = useState({ status: 'loading', countries: [], error: '' })

  const loadCountries = useCallback(async () => {
    setState({ status: 'loading', countries: [], error: '' })
    try {
      const response = await fetch('/api/countries', { headers: { accept: 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`)
      if (!Array.isArray(data.countries)) throw new Error('Backend returned an invalid country list.')
      setState({ status: 'ready', countries: data.countries, error: '' })
    } catch (error) {
      setState({ status: 'error', countries: [], error: error.message })
    }
  }, [])

  useEffect(() => {
    loadCountries()
  }, [loadCountries])

  return (
    <main className="screen countries-screen">
      <section className="countries-shell">
        <header className="game-header">
          <button className="back-button" onClick={onExit} aria-label="Back to main menu">←</button>
          <div><p className="eyebrow">Database check</p><h1>Countries</h1></div>
          <div className="header-spacer" aria-hidden="true" />
        </header>

        <div className="countries-summary">
          <div><strong>{state.status === 'ready' ? state.countries.length : '—'}</strong><span>UN entities</span></div>
          <p>193 Member States and 2 non-member observer States, loaded from GPT Sites D1.</p>
        </div>

        {state.status === 'loading' && <p className="countries-status">Loading countries from the backend…</p>}

        {state.status === 'error' && (
          <section className="countries-error" role="alert">
            <h2>Backend unavailable</h2>
            <p>{state.error}</p>
            <button onClick={loadCountries}>Try again</button>
          </section>
        )}

        {state.status === 'ready' && (
          <div className="countries-table-wrap">
            <table>
              <thead><tr><th scope="col">ID</th><th scope="col">Name</th></tr></thead>
              <tbody>
                {state.countries.map((country) => (
                  <tr key={country.id}><td>{country.id}</td><th scope="row">{country.name}</th></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
