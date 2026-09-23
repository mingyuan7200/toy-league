import { useState } from 'react'
import NumberGame, { createNumberRange } from './components/NumberGame.jsx'
import TotalNumberGame from './components/TotalNumberGame.jsx'
import CountriesPage from './components/CountriesPage.jsx'
import LeaguePage from './components/LeaguePage.jsx'

const QUICK_GAME_NUMBERS = createNumberRange(1, 12)

function Menu({ onQuickGame, onCountries, onLeague }) {
  return (
    <main className="screen menu-screen">
      <section className="menu-card">
        <div className="brand-mark" aria-hidden="true">TL</div>
        <p className="eyebrow">Welcome to</p>
        <h1>Toy League</h1>
        <p className="tagline">Pick your number. Outsmart your rival.</p>

        <nav className="menu-actions" aria-label="Game menu">
          <button className="menu-button primary" onClick={onQuickGame}>
            <span>Quick game</span>
            <span aria-hidden="true">→</span>
          </button>
          <button className="menu-button" onClick={() => onLeague('league-start')}>Start a league</button>
          <button className="menu-button" onClick={() => onLeague('league-resume')}>Resume a league</button>
          <button className="menu-button secondary-action" onClick={onCountries}>
            <span>Countries</span>
            <span aria-hidden="true">→</span>
          </button>
          <button className="menu-button" disabled>Settings</button>
        </nav>
        <p className="coming-soon">More modes coming soon</p>
      </section>
    </main>
  )
}

function QuickGameMenu({ onSelect, onExit }) {
  return (
    <main className="screen menu-screen">
      <section className="menu-card quick-game-menu">
        <button className="back-button picker-back" onClick={onExit} aria-label="Back to main menu">←</button>
        <p className="eyebrow">Quick game</p>
        <h1>Choose a game</h1>
        <p className="tagline">Pick a ruleset and play against the AI.</p>

        <div className="game-picker">
          <button className="game-choice" onClick={() => onSelect('fixed')}>
            <span className="choice-icon" aria-hidden="true">12</span>
            <span><strong>Fixed Number Game</strong><small>Use every number once. Higher number scores.</small></span>
            <b aria-hidden="true">→</b>
          </button>
          <button className="game-choice" onClick={() => onSelect('total')}>
            <span className="choice-icon total-icon" aria-hidden="true">Σ</span>
            <span><strong>Total Number Game</strong><small>Spend a limited supply of stones over 15 rounds.</small></span>
            <b aria-hidden="true">→</b>
          </button>
        </div>
      </section>
    </main>
  )
}

export default function App() {
  const [screen, setScreen] = useState('menu')

  if (screen === 'menu') {
    return <Menu onQuickGame={() => setScreen('quick-games')} onCountries={() => setScreen('countries')} onLeague={setScreen} />
  }
  if (screen.startsWith('league-')) return <LeaguePage startNew={screen === 'league-start'} onExit={() => setScreen('menu')} />
  if (screen === 'countries') return <CountriesPage onExit={() => setScreen('menu')} />
  if (screen === 'quick-games') {
    return <QuickGameMenu onSelect={setScreen} onExit={() => setScreen('menu')} />
  }
  if (screen === 'total') {
    return <TotalNumberGame onExit={() => setScreen('quick-games')} />
  }

  return <NumberGame
        numbers={QUICK_GAME_NUMBERS}
        playerName="You"
        opponentName="AI"
        gameLabel="Fixed Number Game"
        onExit={() => setScreen('quick-games')}
      />
}
