import { useState } from 'react'
import NumberGame, { createNumberRange } from './components/NumberGame.jsx'

const QUICK_GAME_NUMBERS = createNumberRange(1, 12)

function Menu({ onQuickGame }) {
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
          <button className="menu-button" disabled>Start a league</button>
          <button className="menu-button" disabled>Resume a league</button>
          <button className="menu-button" disabled>Settings</button>
        </nav>
        <p className="coming-soon">More modes coming soon</p>
      </section>
    </main>
  )
}

export default function App() {
  const [screen, setScreen] = useState('menu')

  return screen === 'menu'
    ? <Menu onQuickGame={() => setScreen('game')} />
    : <NumberGame
        numbers={QUICK_GAME_NUMBERS}
        playerName="You"
        opponentName="AI"
        gameLabel="Quick game"
        onExit={() => setScreen('menu')}
      />
}
