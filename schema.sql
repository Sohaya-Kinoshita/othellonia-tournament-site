-- チーム
CREATE TABLE
IF NOT EXISTS teams
(
  teamId TEXT PRIMARY KEY,
  teamName TEXT NOT NULL,
  leaderId TEXT NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  matches INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT datetime
('now')
);

-- プレイヤー（参加者）
CREATE TABLE
IF NOT EXISTS players
(
  playerId TEXT PRIMARY KEY CHECK
(length
(playerId) = 12),
  playerName TEXT NOT NULL,
  teamId1 TEXT,
  teamId2 TEXT,
  wins INTEGER NOT NULL DEFAULT 0,
  matches INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT datetime
('now'),
  FOREIGN KEY
(teamId1) REFERENCES teams
(teamId) ON
DELETE
SET NULL
,
  FOREIGN KEY
(teamId2) REFERENCES teams
(teamId) ON
DELETE
SET NULL
);

-- プレイヤーのインデックス
CREATE INDEX
IF NOT EXISTS idx_players_teamId1 ON players
(teamId1);
CREATE INDEX
IF NOT EXISTS idx_players_teamId2 ON players
(teamId2);

-- セッション
CREATE TABLE
IF NOT EXISTS sessions
(
  sessionId TEXT PRIMARY KEY,
  playerId TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT datetime
('now'),
  FOREIGN KEY
(playerId) REFERENCES players
(playerId) ON
DELETE CASCADE
);

CREATE INDEX
IF NOT EXISTS idx_sessions_playerId ON sessions
(playerId);
CREATE INDEX
IF NOT EXISTS idx_sessions_expiresAt ON sessions
(expiresAt);

