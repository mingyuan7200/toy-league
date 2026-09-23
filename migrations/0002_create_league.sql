CREATE TABLE IF NOT EXISTS League (
    id TEXT PRIMARY KEY, current_date TEXT NOT NULL, human_country_id INTEGER NOT NULL REFERENCES Country(id),
    version INTEGER NOT NULL DEFAULT 0, write_token TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE IF NOT EXISTS Tournament (
    uuid TEXT PRIMARY KEY, league_id TEXT NOT NULL REFERENCES League(id), type TEXT NOT NULL,
    starting_year INTEGER NOT NULL, starting_date TEXT NOT NULL, end_date TEXT NOT NULL,
    state TEXT NOT NULL, data_json TEXT NOT NULL, UNIQUE(league_id, type, starting_year)
  );

CREATE VIEW IF NOT EXISTS Game AS SELECT
    json_extract(g.value, '$.id') AS uuid, t.league_id, t.uuid AS tournament_uuid,
    json_extract(g.value, '$.redId') AS red_player, json_extract(g.value, '$.blueId') AS blue_player,
    json_extract(g.value, '$.winnerId') AS winner, json_extract(g.value, '$.redScore') AS red_score,
    json_extract(g.value, '$.blueScore') AS blue_score, json_extract(g.value, '$.date') AS game_date,
    json_extract(g.value, '$.status') AS state, json_extract(g.value, '$.stage') AS stage,
    json_extract(g.value, '$.group') AS group_name, json_extract(g.value, '$.bracket') AS bracket
    FROM Tournament t, json_each(t.data_json, '$.matches') g;

CREATE VIEW IF NOT EXISTS TournamentEntry AS SELECT
    t.uuid AS tournament_uuid, t.league_id, json_extract(e.value, '$.countryId') AS country_id,
    json_extract(e.value, '$.group') AS group_name, json_extract(e.value, '$.startingRank') AS starting_rank,
    json_extract(e.value, '$.wins') AS wins, json_extract(e.value, '$.losses') AS losses,
    json_extract(e.value, '$.history') AS history, json_extract(e.value, '$.finalRank') AS final_rank,
    json_extract(e.value, '$.nextGroup') AS next_group
    FROM Tournament t, json_each(t.data_json, '$.entries') e;
