PRAGMA foreign_keys
= ON;

CREATE TABLE
IF NOT EXISTS match_player_stream_plans
(
  match_id CHAR
(3) NOT NULL,
  player_id CHAR
(12) NOT NULL,
  stream_status TEXT NOT NULL DEFAULT 'undecided' CHECK
(stream_status IN
('available', 'unavailable', 'undecided')),
  mirrativ_url TEXT,
  updated_at TEXT NOT NULL DEFAULT
(datetime
('now')),
  PRIMARY KEY
(match_id, player_id),
  FOREIGN KEY
(match_id) REFERENCES matches
(match_id) ON
DELETE CASCADE ON
UPDATE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
ON
DELETE CASCADE ON
UPDATE CASCADE
);

INSERT OR
IGNORE INTO match_player_stream_plans
    (
    match_id,
    player_id,
    stream_status,
    mirrativ_url,
    updated_at
    )
SELECT
    gp.match_id,
    gp.player_id,
    'undecided',
    NULL,
    datetime('now')
FROM (
              SELECT DISTINCT g.match_id, g.player_a_id AS player_id
        FROM games g
    UNION
        SELECT DISTINCT g.match_id, g.player_b_id AS player_id
        FROM games g
    ) gp;
