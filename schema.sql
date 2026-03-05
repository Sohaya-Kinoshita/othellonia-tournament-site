PRAGMA foreign_keys
= ON;

-- =========================
-- teams（チーム）
-- =========================
CREATE TABLE
IF NOT EXISTS teams
(
  team_id     CHAR
(3)      NOT NULL PRIMARY KEY,
  team_name   VARCHAR
(15)  NOT NULL,
  team_reader CHAR
(12)     NOT NULL
);

-- =========================
-- players（プレイヤー）
-- =========================
CREATE TABLE
IF NOT EXISTS players
(
  player_id   CHAR
(12)     NOT NULL PRIMARY KEY,
  player_name VARCHAR
(10)  NOT NULL,
  mirrativ_id INTEGER
);

-- =========================
-- team_members（チームメンバー，中間テーブル）
-- =========================
CREATE TABLE
IF NOT EXISTS team_members
(
  team_id   CHAR
(3)   NOT NULL,
  player_id CHAR
(12)  NOT NULL,
  PRIMARY KEY
(team_id, player_id),
  FOREIGN KEY
(team_id)  REFERENCES teams
(team_id)   ON
DELETE RESTRICT ON
UPDATE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
ON
DELETE RESTRICT ON
UPDATE CASCADE
);

-- =========================
-- users（ユーザー）
-- =========================
CREATE TABLE
IF NOT EXISTS users
(
  user_id   CHAR
(9)       NOT NULL PRIMARY KEY,
  pass      VARCHAR
(255)  NOT NULL,
  user_name VARCHAR
(10)   NOT NULL
);

-- =========================
-- matches（マッチ）
-- =========================
CREATE TABLE
IF NOT EXISTS matches
(
  match_id       CHAR
(3)   NOT NULL PRIMARY KEY,
  team_a_id      CHAR
(3)   NOT NULL,
  team_b_id      CHAR
(3)   NOT NULL,
  admin_user_id  CHAR
(9)   NOT NULL,
  best_of        INTEGER   NOT NULL DEFAULT 7,
  created_at     TEXT      NOT NULL DEFAULT
(datetime
('now')),
  order_deadline TEXT      NOT NULL DEFAULT
(datetime
(date
('now', '+7 days') || ' 23:59:00')),
  winner_team_id CHAR
(3),

  -- 値チェック
  CHECK
(best_of = 7),
  CHECK
(team_a_id <> team_b_id),

  -- 外部キー
  FOREIGN KEY
(team_a_id)      REFERENCES teams
(team_id) ON
DELETE RESTRICT ON
UPDATE CASCADE,
  FOREIGN KEY (team_b_id)      REFERENCES teams(team_id)
ON
DELETE RESTRICT ON
UPDATE CASCADE,
  FOREIGN KEY (admin_user_id)  REFERENCES users(user_id)
ON
DELETE RESTRICT ON
UPDATE CASCADE,
  FOREIGN KEY (winner_team_id) REFERENCES teams(team_id)
ON
DELETE
SET NULL
ON
UPDATE CASCADE
);

-- =========================
-- games（ゲーム，1v1×最大7戦）
-- =========================
CREATE TABLE
IF NOT EXISTS games
(
  game_id          CHAR
(4)   NOT NULL PRIMARY KEY,
  match_id         CHAR
(3)   NOT NULL,
  game_number      INTEGER   NOT NULL,
  player_a_id      CHAR
(12)  NOT NULL,
  player_b_id      CHAR
(12)  NOT NULL,
  winner_team_id   CHAR
(3),
  winner_player_id CHAR
(12),
  scheduled_at     TEXT,

  -- 値チェック
  CHECK
(1 <= game_number AND game_number <= 7),
  CHECK
(player_a_id <> player_b_id),
  CHECK
((winner_player_id IS NULL) =
(winner_team_id IS NULL)),

  -- 外部キー
  FOREIGN KEY
(match_id)         REFERENCES matches
(match_id) ON
DELETE CASCADE ON
UPDATE CASCADE,
  FOREIGN KEY (player_a_id)      REFERENCES players(player_id)
ON
DELETE RESTRICT ON
UPDATE CASCADE,
  FOREIGN KEY (player_b_id)      REFERENCES players(player_id)
ON
DELETE RESTRICT ON
UPDATE CASCADE,
  FOREIGN KEY (winner_team_id)   REFERENCES teams(team_id)
ON
DELETE
SET NULL
ON
UPDATE CASCADE,
  FOREIGN KEY (winner_player_id) REFERENCES players(player_id)
ON
DELETE
SET NULL
ON
UPDATE CASCADE,

  -- 同一match内の第n戦は1つだけ
  UNIQUE (match_id, game_number)
);

-- =========================
-- orders（オーダー提出ヘッダ）
-- =========================
CREATE TABLE
IF NOT EXISTS orders
(
  order_id      CHAR
(4)   NOT NULL PRIMARY KEY,
  match_id      CHAR
(3)   NOT NULL,
  team_id       CHAR
(3)   NOT NULL,
  submitted_at  TEXT      NOT NULL DEFAULT
(datetime
('now')),
  submitted_by  CHAR
(9)   NOT NULL,

  FOREIGN KEY
(match_id)     REFERENCES matches
(match_id) ON
DELETE CASCADE ON
UPDATE CASCADE,
  FOREIGN KEY (team_id)      REFERENCES teams(team_id)
ON
DELETE RESTRICT ON
UPDATE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(user_id)
ON
DELETE RESTRICT ON
UPDATE CASCADE
);

-- =========================
-- order_details（オーダー提出明細）
-- =========================
CREATE TABLE
IF NOT EXISTS order_details
(
  order_id     CHAR
(4)   NOT NULL,
  team_id      CHAR
(3)   NOT NULL,
  game_number  INTEGER   NOT NULL,
  player_id    CHAR
(12)  NOT NULL,

  PRIMARY KEY
(order_id, game_number),

  CHECK
(1 <= game_number AND game_number <= 7),

  FOREIGN KEY
(order_id) REFERENCES orders
(order_id) ON
DELETE CASCADE ON
UPDATE CASCADE,
  FOREIGN KEY (team_id)  REFERENCES teams(team_id)
ON
DELETE RESTRICT ON
UPDATE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
ON
DELETE RESTRICT ON
UPDATE CASCADE
);

-- 検索を速くするインデックス（任意だが実用上おすすめ）
CREATE INDEX
IF NOT EXISTS idx_team_members_team_id ON team_members
(team_id);
CREATE INDEX
IF NOT EXISTS idx_team_members_player_id ON team_members
(player_id);

CREATE INDEX
IF NOT EXISTS idx_matches_team_a_id ON matches
(team_a_id);
CREATE INDEX
IF NOT EXISTS idx_matches_team_b_id ON matches
(team_b_id);
CREATE INDEX
IF NOT EXISTS idx_matches_admin_user_id ON matches
(admin_user_id);

CREATE INDEX
IF NOT EXISTS idx_games_match_id ON games
(match_id);
CREATE INDEX
IF NOT EXISTS idx_games_scheduled_at ON games
(scheduled_at);
CREATE INDEX
IF NOT EXISTS idx_games_winner_player_id ON games
(winner_player_id);

CREATE INDEX
IF NOT EXISTS idx_orders_match_team_time ON orders
(match_id, team_id, submitted_at);

CREATE INDEX
IF NOT EXISTS idx_order_details_order ON order_details
(order_id);

CREATE INDEX
IF NOT EXISTS idx_order_details_team_game ON order_details
(team_id, game_number);



