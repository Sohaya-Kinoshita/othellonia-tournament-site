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
(15)  NOT NULL
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
(team_id)   REFERENCES teams
(team_id)   ON
DELETE RESTRICT ON
UPDATE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
ON
DELETE RESTRICT ON
UPDATE CASCADE
);

-- =========================
-- users（ユーザー，管理者用）
-- =========================
CREATE TABLE
IF NOT EXISTS users
(
  user_id   CHAR
(9)      NOT NULL PRIMARY KEY,
  pass      VARCHAR
(255) NOT NULL,
  user_name VARCHAR
(10)  NOT NULL
);

-- =========================
-- leaders（リーダー・サブリーダー，チーム提出担当用）
-- =========================
CREATE TABLE
IF NOT EXISTS leaders
(
  leader_id    CHAR
(9)       NOT NULL PRIMARY KEY,
  team_id      CHAR
(3)       NOT NULL,
  player_id    CHAR
(12),
  leader_role  VARCHAR
(10)   NOT NULL,
  pass         VARCHAR
(255) NOT NULL,
  
  -- 制約
  CHECK
(leader_role IN
('leader', 'subleader')),
  UNIQUE
(team_id, leader_role),
  
  -- 外部キー
  FOREIGN KEY
(team_id)   REFERENCES teams
(team_id)   ON
DELETE RESTRICT ON
UPDATE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
ON
DELETE
SET NULL
ON
UPDATE CASCADE
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
  best_of        INTEGER   NOT NULL DEFAULT 5,
  created_at     TEXT      NOT NULL DEFAULT
(datetime
('now')),
  order_deadline TEXT      NOT NULL,
  scheduled_at   TEXT,
  winner_team_id CHAR
(3),
  
  -- 制約
  CHECK
(best_of = 5),
  CHECK
(team_a_id <> team_b_id),
  
  -- 外部キー
  FOREIGN KEY
(team_a_id)      REFERENCES teams
(team_id)   ON
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
-- games（ゲーム，1v1×最大5戦）
-- =========================
CREATE TABLE
IF NOT EXISTS games
(
  game_id          CHAR
(4)   NOT NULL PRIMARY KEY,
  match_id         CHAR
(3)   NOT NULL,
  game_number      INTEGER   NOT NULL,
  battle_mode      CHAR
(1)   NOT NULL,
  player_a_id      CHAR
(12)  NOT NULL,
  player_b_id      CHAR
(12)  NOT NULL,
  player_a_score   INTEGER   NOT NULL DEFAULT 0,
  player_b_score   INTEGER   NOT NULL DEFAULT 0,
  forfeit_winner   CHAR
(1),
  winner_team_id   CHAR
(3),
  winner_player_id CHAR
(12),
  
  -- 制約
  CHECK
(1 <= game_number AND game_number <= 5),
  CHECK
(player_a_score >= 0),
  CHECK
(player_b_score >= 0),
  CHECK
(forfeit_winner IN
('A', 'B') OR forfeit_winner IS NULL),
  CHECK
(battle_mode IN
('S', 'G')),
  CHECK
(player_a_id <> player_b_id),
  CHECK
((winner_player_id IS NULL) =
(winner_team_id IS NULL)),
  UNIQUE
(match_id, game_number),
  
  -- 外部キー
  FOREIGN KEY
(match_id)         REFERENCES matches
(match_id)     ON
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
UPDATE CASCADE
);

-- =========================
-- reserves（リザーブ，最大2人）
-- =========================
CREATE TABLE
IF NOT EXISTS reserves
(
  match_id       CHAR
(3)   NOT NULL,
  team_id        CHAR
(3)   NOT NULL,
  player_id      CHAR
(12)  NOT NULL,
  reserve_number INTEGER   NOT NULL,
  
  -- 制約
  CHECK
(reserve_number IN
(1, 2)),
  UNIQUE
(match_id, team_id, reserve_number),
  UNIQUE
(match_id, team_id, player_id),
  PRIMARY KEY
(match_id, team_id, reserve_number),
  
  -- 外部キー
  FOREIGN KEY
(match_id) REFERENCES matches
(match_id)   ON
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
  
  -- 外部キー
  FOREIGN KEY
(match_id)    REFERENCES matches
(match_id)  ON
DELETE CASCADE ON
UPDATE CASCADE,
  FOREIGN KEY (team_id)     REFERENCES teams(team_id)
ON
DELETE RESTRICT ON
UPDATE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES leaders(leader_id)
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
  
  -- 制約
  CHECK
(1 <= game_number AND game_number <= 5),
  PRIMARY KEY
(order_id, game_number),
  
  -- 外部キー
  FOREIGN KEY
(order_id)  REFERENCES orders
(order_id)     ON
DELETE CASCADE ON
UPDATE CASCADE,
  FOREIGN KEY (team_id)   REFERENCES teams(team_id)
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
IF NOT EXISTS idx_leaders_team_id ON leaders
(team_id);
CREATE INDEX
IF NOT EXISTS idx_leaders_player_id ON leaders
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
IF NOT EXISTS idx_matches_scheduled_at ON matches
(scheduled_at);

CREATE INDEX
IF NOT EXISTS idx_games_match_id ON games
(match_id);
CREATE INDEX
IF NOT EXISTS idx_games_winner_player_id ON games
(winner_player_id);

CREATE INDEX
IF NOT EXISTS idx_reserves_match_id ON reserves
(match_id);
CREATE INDEX
IF NOT EXISTS idx_reserves_team_id ON reserves
(team_id);

CREATE INDEX
IF NOT EXISTS idx_orders_match_team_time ON orders
(match_id, team_id, submitted_at);

CREATE INDEX
IF NOT EXISTS idx_order_details_order ON order_details
(order_id);
CREATE INDEX
IF NOT EXISTS idx_order_details_team_game ON order_details
(team_id, game_number);



