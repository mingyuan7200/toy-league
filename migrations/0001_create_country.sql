CREATE TABLE IF NOT EXISTS Country (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Rows are seeded idempotently by GET /api/countries from the reviewed,
-- alphabetical 195-entity list in functions/_data/countries.js.
