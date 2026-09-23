# League development

Start the full local application:

```sh
npm run db:migrate:local
npm run dev:full
```

Open http://localhost:8788, choose **Start a league**, then **Create league**.
Use **Resume a league** to reopen any existing save. Creating a league never
replaces an older one. China is the only human country.

The calendar starts on 0001-01-01 and has no connection to the real-world clock.
Finish every China game due today, submit its final score, then use **Next day**.
AI games resolve automatically. Standings, schedules, championship scores,
awards, and next-season groups are visible on the league page.

**Next game day** processes each intervening day in order and stops on the next
date with a real game for any country, including AI-only games. Byes and cancelled
games do not count. Tournament creation and progression still run on every day.
Both advance buttons are blocked until China's outstanding games are finished.

The tournament panel automatically focuses on its current stage. Tournament B's
stage-two knockout and the championship appear above collapsed group results.
Stage tabs let you revisit earlier stages. Group 6 has separate winners, losers,
and final/reset bracket views with dates, scores, byes, and feeder-match labels.
Desktop brackets use connected round columns; mobile defaults to one round at
a time, with an optional full bracket. Existing league saves work unchanged.
Tournament A standings mark promotion, relegation, and championship-qualification
boundaries, provisional until the groups finish. Country names include flag emoji.

## Game saves

League games use 15 rounds, red 100 stones, blue 112 stones, and red wins ties.
AI allocations are generated before play using random integer cuts (with
replacement). All remaining stones must be played in the last round.
Unfinished games, including the AI allocation, exist only in browser local
storage. Resume the league and click **Play / resume** to continue after refresh.
Changing browsers or clearing local storage loses that unfinished game. D1 only
receives a completed red/blue score, never individual round records.

This is a personal game: the API validates score shape and game eligibility,
but trusts human-game scores submitted by the frontend. There is no account or
access-control system. Anyone who can reach the API can list and play its leagues.

## Tournament rules

A has a defending champion plus groups of 10/16/20/30/48/70. Group A plays
18 rounds (double round robin, swapping colors in return fixtures), B/C play
15/19 rounds, and D/E/F play 20 randomly chosen complete rounds of a full
round robin. Wins then starting rank determine standings. Group A's winner
challenges the defending champion in best-of-seven. Promotions/relegations are
2/3/4/5/6 across the boundaries. Relegated, retained, then promoted countries
form each new group, preserving their relative finishing order. A defeated
defending champion enters Group A at its top.

B has a defending champion plus groups of 16/32/32/32/32/50. Groups 1–5 use
random pairings within identical W/L histories for 4/5/5/5/5 rounds. Rank by win
count, then lexicographically by history with W ahead of L. Group 6 uses a
64-position double-elimination bracket with 14 randomly assigned first-round
byes, and a grand-final reset if the undefeated finalist loses. The top four
are promoted. Equal elimination-round finishes use a season-specific random
tie order; B has no starting ranks. This tie order cannot affect top-four
membership.

B's fixed challenger bracket is:

```text
(1-1 vs (1-4 vs (1-5 vs (4-1 vs (5-1 vs 6-1)))))
vs
((1-3 vs 2-1) vs (1-2 vs (2-2 vs 3-1)))
```

The challenger plays the defending champion in best-of-seven. Stage-one
results control promotions/relegations (four across each boundary). If the
challenger becomes champion, remove it from its next-season group, put the
defeated champion in Group 1, and cascade extra relegations to fill the vacancy.
Extra relegations select the worst stage-one finisher who would otherwise
remain in each affected group.

Initial group assignments are independently random for A and B, except China
starts A/F-70 and B/6. Random initial champions receive the final spots. Every
later season derives its groups from the previous season. Single-game colors
are random; championship colors alternate after a random first game.

A groups run Jan 1–Oct 31, championship Nov 1–Dec 1. B groups run Jul 1–Feb 28,
challenger bracket Mar 1–Apr 30, championship May 1–Jun 30. Dates are spread
through these windows, avoiding known other-tournament fixtures where possible.
Several games on one day are supported. Championship awards and next-season
placements become final on the fourth win; unused championship games are skipped.

## Backend and database

- `GET /api/league`: saved leagues; add `?id=...` for a league's state.
- `POST /api/league`: `{ "id": "a-new-UUID" }`, creates a league idempotently.
- `POST /api/next-day`: `{ "leagueId": "...", "version": 0 }`.
- `POST /api/next-game-day`: the same body, processing multiple days in one atomic save.
- `POST /api/game-result`: `{ "leagueId": "...", "version": 0, "gameId": "...", "redScore": 8, "blueScore": 7 }`.

Every mutation uses a version check and a transactional D1 batch. Duplicate
identical game submissions succeed without counting twice. Stale mutations
return 409; use Reload before trying again.

Countries are fetched separately from `GET /api/countries` only when first
needed. The frontend cache starts at null, shares an in-flight request, retries
after failures, and is reused by the league and Countries page until a full page
reload. League responses do not contain the static country list. Existing saves
require no migration for this change.

`Country` remains the player registry. `League` stores the date and version.
`Tournament` stores one JSON document per season containing its entries,
bracket dependencies, scheduled matches, and final scores. This deliberately
keeps the season update atomic and avoids thousands of insert statements on
creation. `Game` and `TournamentEntry` are read-only SQL views over these
documents, not separate copies of the records. No `GameRound` table exists.

Example inspection:

```sh
npx wrangler d1 execute DB --local --persist-to .wrangler/state --command "SELECT id, [current_date], version FROM League;"
npx wrangler d1 execute DB --local --persist-to .wrangler/state --command "SELECT type, starting_year, state FROM Tournament;"
npx wrangler d1 execute DB --local --persist-to .wrangler/state --command "SELECT game_date, red_player, blue_player, red_score, blue_score FROM Game WHERE state = 'finished' LIMIT 20;"
```

Migration 0002 creates these tables/views. The API also initializes missing
schema idempotently for hosts that do not automatically run migration files.
Local D1 remains separate from production. GitHub Pages has no backend.

To add a tournament format, extend the pure scheduling functions in
`functions/_league/formats.js` and the orchestration in `engine.js`.
The current JSON persistence is intended for a personal league. A larger
multi-user service should normalize match storage and paginate server responses.

## Verification

```sh
npm test
npm run build
```

The engine tests simulate through 0003-07-01, check calendar arithmetic,
group counts, Swiss histories, double-elimination losses, finals, promotions,
idempotent results, and the human-game day gate.

For a real D1 API smoke test, use an isolated database so test leagues do not
appear in your regular saves. In one terminal:

```sh
npm run build:local
npx wrangler pages dev dist --port 8790 --ip 127.0.0.1 --persist-to .wrangler/league-test
```

In another:

```sh
node tests/league-api.js
```

This creates a test league and verifies database persistence, score validation,
duplicate result retries, and two concurrent next-day requests. Test data stays
under the ignored `.wrangler/league-test` directory.

On a Mac with Google Chrome installed, `node tests/league-browser.js` additionally
tests the mobile layout, playing a round, refreshing and resuming it, completing
15 rounds, saving the result, and advancing the date. It uses a temporary browser
profile and the isolated port-8790 server; it does not use your normal Chrome profile.
