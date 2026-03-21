PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE teams
(
  team_id     CHAR
(3)      NOT NULL PRIMARY KEY,
  team_name   VARCHAR
(15)  NOT NULL
);
INSERT INTO "teams" ("team_id","team_name") VALUES('T01','abcdefghij');
INSERT INTO "teams" ("team_id","team_name") VALUES('D01','デベロップチームα');
INSERT INTO "teams" ("team_id","team_name") VALUES('D02','デベロップチームβ');
INSERT INTO "teams" ("team_id","team_name") VALUES('T02','あいうえおかきくけこ');
CREATE TABLE players
(
  player_id   CHAR
(12)     NOT NULL PRIMARY KEY,
  player_name VARCHAR
(10)  NOT NULL,
  mirrativ_id INTEGER
);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('525319946054','Nの人',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('399384565625','愛瑠',109472117);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('579425834608','sumi',145579359);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('584539350335','竪穴式住居CEO',111530314);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010100000001','プレイヤーα1',128597863);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010100000002','プレイヤーα2',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010100000003','プレイヤーα3',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010100000004','プレイヤーα4',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010100000005','プレイヤーα5',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010100000006','プレイヤーα6',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010100000007','プレイヤーα7',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010200000001','プレイヤーβ1',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010200000002','プレイヤーβ2',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010200000003','プレイヤーβ3',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010200000004','プレイヤーβ4',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010200000005','プレイヤーβ5',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010200000006','プレイヤーβ6',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('010200000007','プレイヤーβ7',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('354554709460','よーくん@社不',128597863);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('132593318204','まさやん',3887469);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('374292326954','しの@志天',110728515);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('415732639219','しおから！',123533613);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('519024890341','原子番号35番',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('579974994969','わら',NULL);
INSERT INTO "players" ("player_id","player_name","mirrativ_id") VALUES('615897186814','マツケン382',112052046);
CREATE TABLE team_members
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
INSERT INTO "team_members" ("team_id","player_id") VALUES('T01','579425834608');
INSERT INTO "team_members" ("team_id","player_id") VALUES('T01','399384565625');
INSERT INTO "team_members" ("team_id","player_id") VALUES('T01','584539350335');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D01','010100000001');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D01','010100000002');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D01','010100000003');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D01','010100000004');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D01','010100000005');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D01','010100000006');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D01','010100000007');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D02','010200000001');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D02','010200000002');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D02','010200000003');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D02','010200000004');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D02','010200000005');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D02','010200000006');
INSERT INTO "team_members" ("team_id","player_id") VALUES('D02','010200000007');
INSERT INTO "team_members" ("team_id","player_id") VALUES('T02','374292326954');
INSERT INTO "team_members" ("team_id","player_id") VALUES('T02','525319946054');
INSERT INTO "team_members" ("team_id","player_id") VALUES('T02','579974994969');
INSERT INTO "team_members" ("team_id","player_id") VALUES('T02','615897186814');
INSERT INTO "team_members" ("team_id","player_id") VALUES('T02','519024890341');
INSERT INTO "team_members" ("team_id","player_id") VALUES('T01','132593318204');
INSERT INTO "team_members" ("team_id","player_id") VALUES('T01','415732639219');
CREATE TABLE users
(
  user_id   CHAR
(9)      NOT NULL PRIMARY KEY,
  pass      VARCHAR
(255) NOT NULL,
  user_name VARCHAR
(10)  NOT NULL
);
INSERT INTO "users" ("user_id","pass","user_name") VALUES('admin2601','eR2@Zlubed4a','TREE');
INSERT INTO "users" ("user_id","pass","user_name") VALUES('admin2602','hN4^RNSeP5O1','マツケン382');
INSERT INTO "users" ("user_id","pass","user_name") VALUES('admin2603','nW5@QEZx18E!','しの');
INSERT INTO "users" ("user_id","pass","user_name") VALUES('admin2604','mL4@WReNln7U','Nの人');
INSERT INTO "users" ("user_id","pass","user_name") VALUES('admin2605','hS9&hLPbaday','よーくん');
INSERT INTO "users" ("user_id","pass","user_name") VALUES('admin2606','zL5^%DJqi^Jv','まっこい');
INSERT INTO "users" ("user_id","pass","user_name") VALUES('admin2607','mE3$%r1ripu^','わら');
INSERT INTO "users" ("user_id","pass","user_name") VALUES('admin2608','mC0!YoWR0I6w','原子番号35番');
CREATE TABLE leaders
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
INSERT INTO "leaders" ("leader_id","team_id","player_id","leader_role","pass") VALUES('LT0100001','T01','579425834608','leader','pD1#srMY%R4&');
INSERT INTO "leaders" ("leader_id","team_id","player_id","leader_role","pass") VALUES('LD0100001','D01','010100000001','leader','LD0100001');
INSERT INTO "leaders" ("leader_id","team_id","player_id","leader_role","pass") VALUES('LD0100002','D01','010100000002','subleader','LD0100002');
INSERT INTO "leaders" ("leader_id","team_id","player_id","leader_role","pass") VALUES('LD0200001','D02','010200000001','leader','LD0200001');
INSERT INTO "leaders" ("leader_id","team_id","player_id","leader_role","pass") VALUES('LD0200002','D02','010200000002','subleader','LD0200002');
INSERT INTO "leaders" ("leader_id","team_id","player_id","leader_role","pass") VALUES('LT0200001','T02','615897186814','leader','tC8#jcrxQstz');
CREATE TABLE matches
(
  match_id       CHAR
(3)   NOT NULL PRIMARY KEY,
  team_a_id      CHAR
(3)   NOT NULL,
  team_b_id      CHAR
(3)   NOT NULL,
  creator_user_id  CHAR
(9)   NOT NULL,
  best_of        INTEGER   NOT NULL DEFAULT 5,
  created_at     TEXT      NOT NULL DEFAULT
(datetime
('now')),
  order_deadline TEXT      NOT NULL,
  scheduled_at   TEXT,
  winner_team_id CHAR
(3), started_at TEXT,
  
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
  FOREIGN KEY (creator_user_id)  REFERENCES users(user_id)
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
INSERT INTO "matches" ("match_id","team_a_id","team_b_id","creator_user_id","best_of","created_at","order_deadline","scheduled_at","winner_team_id","started_at") VALUES('D01','D01','D02','admin2601',5,'2026-03-12 01:19:19','2026-03-19 23:59:00',NULL,'D01',NULL);
INSERT INTO "matches" ("match_id","team_a_id","team_b_id","creator_user_id","best_of","created_at","order_deadline","scheduled_at","winner_team_id","started_at") VALUES('D02','D01','D02','admin2601',5,'2026-03-12 02:32:18','2026-03-19 23:59:00','2026-03-31 21:00:00','D02',NULL);
INSERT INTO "matches" ("match_id","team_a_id","team_b_id","creator_user_id","best_of","created_at","order_deadline","scheduled_at","winner_team_id","started_at") VALUES('D03','D01','D02','admin2601',5,'2026-03-12 03:32:27','2026-03-18 23:59:00','2026-03-21 21:30:00','D01','2026-03-17 00:41:53');
INSERT INTO "matches" ("match_id","team_a_id","team_b_id","creator_user_id","best_of","created_at","order_deadline","scheduled_at","winner_team_id","started_at") VALUES('D04','D01','D02','admin2601',5,'2026-03-14 16:43:33','2026-03-11 23:59:00','2026-03-14 20:00:00','D02','2026-03-14 17:09:32');
INSERT INTO "matches" ("match_id","team_a_id","team_b_id","creator_user_id","best_of","created_at","order_deadline","scheduled_at","winner_team_id","started_at") VALUES('M01','T02','T01','admin2601',5,'2026-03-15 22:52:32','2026-03-12 23:59:00','2026-03-15 22:30:00','T01','2026-03-15 23:13:08');
INSERT INTO "matches" ("match_id","team_a_id","team_b_id","creator_user_id","best_of","created_at","order_deadline","scheduled_at","winner_team_id","started_at") VALUES('D05','D01','D02','admin2601',5,'2026-03-17 00:54:50','2026-03-13 23:59:00','2026-03-16 23:00:00','D02','2026-03-17 01:37:31');
INSERT INTO "matches" ("match_id","team_a_id","team_b_id","creator_user_id","best_of","created_at","order_deadline","scheduled_at","winner_team_id","started_at") VALUES('m01','D01','D02','admin2601',5,'2026-03-20 23:43:36','2026-03-17 23:59:00','2026-03-20 23:50:00',NULL,NULL);
INSERT INTO "matches" ("match_id","team_a_id","team_b_id","creator_user_id","best_of","created_at","order_deadline","scheduled_at","winner_team_id","started_at") VALUES('M05','D01','D02','admin2601',5,'2026-03-21 00:53:00','2026-03-19 23:59:00','2026-03-22 20:00:00',NULL,NULL);
CREATE TABLE games
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
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0101','D01',1,'S','010100000001','010200000001',2,1,NULL,'D01','010100000001');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0102','D01',2,'S','010100000002','010200000002',1,2,NULL,'D02','010200000002');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0103','D01',3,'S','010100000003','010200000003',2,1,NULL,'D01','010100000003');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0104','D01',4,'G','010100000004','010200000004',2,1,NULL,'D01','010100000004');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0105','D01',5,'G','010100000005','010200000005',1,2,NULL,'D02','010200000005');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0201','D02',1,'S','010100000007','010200000002',2,1,NULL,'D01','010100000007');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0202','D02',2,'S','010100000006','010200000001',1,2,NULL,'D02','010200000001');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0203','D02',3,'S','010100000005','010200000003',1,2,NULL,'D02','010200000003');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0204','D02',4,'G','010100000004','010200000004',1,2,NULL,'D02','010200000004');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0205','D02',5,'G','010100000003','010200000007',0,0,NULL,'D02','010200000007');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0301','D03',1,'S','010100000001','010200000006',2,0,NULL,'D01','010100000001');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0302','D03',2,'S','010100000002','010200000007',2,0,NULL,'D01','010100000002');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0303','D03',3,'S','010100000003','010200000005',2,0,NULL,'D01','010100000003');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0304','D03',4,'G','010100000004','010200000004',2,0,NULL,'D01','010100000004');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0305','D03',5,'G','010100000005','010200000003',2,0,NULL,'D01','010100000005');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0401','D04',1,'S','010100000001','010200000001',1,2,NULL,'D02','010200000001');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0402','D04',2,'S','010100000002','010200000002',2,0,NULL,'D01','010100000002');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0403','D04',3,'S','010100000003','010200000003',1,2,NULL,'D02','010200000003');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0404','D04',4,'G','010100000004','010200000004',1,2,NULL,'D02','010200000004');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0405','D04',5,'G','010100000005','010200000005',2,0,NULL,'D01','010100000005');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('M0101','M01',1,'S','374292326954','584539350335',2,1,NULL,'T02','374292326954');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('M0102','M01',2,'S','525319946054','415732639219',1,2,NULL,'T01','415732639219');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('M0103','M01',3,'S','519024890341','399384565625',0,0,NULL,'T02','519024890341');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('M0104','M01',4,'G','579974994969','579425834608',0,0,NULL,'T01','579425834608');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('M0105','M01',5,'G','615897186814','132593318204',0,0,NULL,'T01','132593318204');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0501','D05',1,'S','010100000001','010200000001',2,0,NULL,'D01','010100000001');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0502','D05',2,'S','010100000002','010200000002',1,2,NULL,'D02','010200000002');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0503','D05',3,'S','010100000003','010200000006',1,2,NULL,'D02','010200000006');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0504','D05',4,'G','010100000004','010200000004',1,2,NULL,'D02','010200000004');
INSERT INTO "games" ("game_id","match_id","game_number","battle_mode","player_a_id","player_b_id","player_a_score","player_b_score","forfeit_winner","winner_team_id","winner_player_id") VALUES('D0505','D05',5,'G','010100000005','010200000005',2,0,NULL,'D01','010100000005');
CREATE TABLE reserves
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
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D01','D01','010100000006',1);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D02','D02','010200000005',1);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D02','D02','010200000006',2);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D02','D01','010100000002',1);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D02','D01','010100000001',2);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D03','D01','010100000006',1);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D03','D01','010100000007',2);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D04','D01','010100000006',1);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D04','D01','010100000007',2);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D04','D02','010200000006',1);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D04','D02','010200000007',2);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D05','D01','010100000007',1);
INSERT INTO "reserves" ("match_id","team_id","player_id","reserve_number") VALUES('D05','D02','010200000007',1);
CREATE TABLE orders
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
(9)   NOT NULL, confirmed_at TEXT,
  
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
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O001','D01','D01','2026-03-12 01:36:09','LD0100001','2026-03-12 02:06:31');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O002','D01','D01','2026-03-12 01:44:36','LD0100001','2026-03-12 02:06:31');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O003','D01','D01','2026-03-12 01:44:42','LD0100001','2026-03-12 02:06:31');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O004','D01','D01','2026-03-12 01:56:19','LD0100001','2026-03-12 02:06:31');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O005','D01','D01','2026-03-12 01:56:31','LD0100001','2026-03-12 02:06:31');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O006','D01','D02','2026-03-12 01:58:18','LD0200001','2026-03-12 02:06:31');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O007','D02','D02','2026-03-12 02:35:54','LD0200001','2026-03-12 02:49:41');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O008','D02','D01','2026-03-12 02:36:31','LD0100001','2026-03-12 02:49:41');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O009','D03','D01','2026-03-12 03:32:51','LD0100001','2026-03-12 03:34:58');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O010','D03','D02','2026-03-12 03:33:12','LD0200001','2026-03-12 03:34:58');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O011','D04','D01','2026-03-14 16:48:36','LD0100001','2026-03-14 16:49:21');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O012','D04','D02','2026-03-14 16:49:05','LD0200001','2026-03-14 16:49:21');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O013','M01','T02','2026-03-15 22:59:37','LT0200001','2026-03-15 23:02:11');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O014','M01','T01','2026-03-15 23:00:46','LT0100001','2026-03-15 23:02:11');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O015','D05','D01','2026-03-17 01:03:47','LD0100001','2026-03-17 01:37:19');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O016','D05','D01','2026-03-17 01:03:52','LD0100001','2026-03-17 01:37:19');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O017','D05','D02','2026-03-17 01:18:13','LD0200001','2026-03-17 01:37:19');
INSERT INTO "orders" ("order_id","match_id","team_id","submitted_at","submitted_by","confirmed_at") VALUES('O018','D05','D02','2026-03-17 01:36:06','LD0200001','2026-03-17 01:37:19');
CREATE TABLE order_details
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
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O001','D01',1,'010100000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O001','D01',2,'010100000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O001','D01',3,'010100000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O001','D01',4,'010100000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O001','D01',5,'010100000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O002','D01',1,'010100000007');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O002','D01',2,'010100000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O002','D01',3,'010100000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O002','D01',4,'010100000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O002','D01',5,'010100000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O003','D01',1,'010100000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O003','D01',2,'010100000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O003','D01',3,'010100000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O003','D01',4,'010100000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O003','D01',5,'010100000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O004','D01',1,'010100000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O004','D01',2,'010100000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O004','D01',3,'010100000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O004','D01',4,'010100000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O004','D01',5,'010100000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O005','D01',1,'010100000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O005','D01',2,'010100000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O005','D01',3,'010100000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O005','D01',4,'010100000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O005','D01',5,'010100000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O006','D02',1,'010200000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O006','D02',2,'010200000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O006','D02',3,'010200000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O006','D02',4,'010200000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O006','D02',5,'010200000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O007','D02',1,'010200000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O007','D02',2,'010200000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O007','D02',3,'010200000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O007','D02',4,'010200000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O007','D02',5,'010200000007');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O008','D01',1,'010100000007');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O008','D01',2,'010100000006');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O008','D01',3,'010100000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O008','D01',4,'010100000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O008','D01',5,'010100000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O009','D01',1,'010100000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O009','D01',2,'010100000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O009','D01',3,'010100000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O009','D01',4,'010100000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O009','D01',5,'010100000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O010','D02',1,'010200000006');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O010','D02',2,'010200000007');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O010','D02',3,'010200000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O010','D02',4,'010200000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O010','D02',5,'010200000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O011','D01',1,'010100000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O011','D01',2,'010100000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O011','D01',3,'010100000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O011','D01',4,'010100000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O011','D01',5,'010100000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O012','D02',1,'010200000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O012','D02',2,'010200000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O012','D02',3,'010200000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O012','D02',4,'010200000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O012','D02',5,'010200000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O013','T02',1,'374292326954');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O013','T02',2,'525319946054');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O013','T02',3,'519024890341');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O013','T02',4,'579974994969');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O013','T02',5,'615897186814');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O014','T01',1,'584539350335');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O014','T01',2,'415732639219');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O014','T01',3,'399384565625');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O014','T01',4,'579425834608');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O014','T01',5,'132593318204');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O015','D01',1,'010100000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O015','D01',2,'010100000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O015','D01',3,'010100000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O015','D01',4,'010100000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O015','D01',5,'010100000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O016','D01',1,'010100000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O016','D01',2,'010100000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O016','D01',3,'010100000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O016','D01',4,'010100000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O016','D01',5,'010100000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O017','D02',1,'010200000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O017','D02',2,'010200000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O017','D02',3,'010200000003');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O017','D02',4,'010200000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O017','D02',5,'010200000005');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O018','D02',1,'010200000001');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O018','D02',2,'010200000002');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O018','D02',3,'010200000006');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O018','D02',4,'010200000004');
INSERT INTO "order_details" ("order_id","team_id","game_number","player_id") VALUES('O018','D02',5,'010200000005');
CREATE TABLE match_admins (
          match_id CHAR(3) NOT NULL,
          admin_user_id CHAR(9) NOT NULL,
          PRIMARY KEY (match_id, admin_user_id),
          FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY (admin_user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
        );
INSERT INTO "match_admins" ("match_id","admin_user_id") VALUES('M01','admin2601');
INSERT INTO "match_admins" ("match_id","admin_user_id") VALUES('M01','admin2606');
INSERT INTO "match_admins" ("match_id","admin_user_id") VALUES('M01','admin2605');
INSERT INTO "match_admins" ("match_id","admin_user_id") VALUES('D01','admin2601');
INSERT INTO "match_admins" ("match_id","admin_user_id") VALUES('D02','admin2601');
INSERT INTO "match_admins" ("match_id","admin_user_id") VALUES('D03','admin2601');
INSERT INTO "match_admins" ("match_id","admin_user_id") VALUES('D04','admin2601');
INSERT INTO "match_admins" ("match_id","admin_user_id") VALUES('D05','admin2601');
INSERT INTO "match_admins" ("match_id","admin_user_id") VALUES('m01','admin2601');
INSERT INTO "match_admins" ("match_id","admin_user_id") VALUES('M05','admin2601');
CREATE TABLE match_player_stream_plans
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
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D01','010100000001','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D01','010100000002','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D01','010100000003','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D01','010100000004','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D01','010100000005','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D01','010200000001','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D01','010200000002','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D01','010200000003','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D01','010200000004','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D01','010200000005','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D02','010100000003','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D02','010100000004','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D02','010100000005','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D02','010100000006','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D02','010100000007','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D02','010200000001','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D02','010200000002','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D02','010200000003','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D02','010200000004','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D02','010200000007','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D03','010100000001','available',NULL,'2026-03-14 08:08:19');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D03','010100000002','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D03','010100000003','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D03','010100000004','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D03','010100000005','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D03','010200000003','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D03','010200000004','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D03','010200000005','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D03','010200000006','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D03','010200000007','undecided',NULL,'2026-03-14 06:34:04');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('D04','010100000001','available','https://www.mirrativ.com/live/gpSM7BwvEQmgZC7_Yj92nQ','2026-03-14 08:08:52');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('M01','374292326954','available',NULL,'2026-03-15 14:09:09');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('M01','519024890341','unavailable',NULL,'2026-03-15 14:08:51');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('M01','615897186814','available',NULL,'2026-03-15 14:08:09');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('M01','415732639219','available',NULL,'2026-03-15 14:08:24');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('M01','584539350335','available','https://www.mirrativ.com/deep_link_preview?link=https%3A%2F%2Fws9f.adj.st%2Flive%2FqxeIOi5E7DRhQ1Dstm_8Ug%3Fadj_deep_link%3Dmirr%253A%252F%252F%252Flive%252FqxeIOi5E7DRhQ1Dstm_8Ug%253Fwhere%253Dbroadcast_setting%26adj_fallback%3Dhttps%253A%252F%252Fwww.mirrativ.com%252Flive%252FqxeIOi5E7DRhQ1Dstm_8Ug%26adj_og_description%3D%25E9%259B%2591%25E8%25AB%2587%26adj_og_image%3Dhttps%253A%252F%252Fcdn.mirrativ.com%252Fmirrorman-prod%252Fimage%252Fcustom_thumbnail%252F1772a9e495daf99ea34eaf3d841843ec737036d1e68a7bd8215120361d800094_share.jpeg%253F1773584042%26adj_og_title%3D%25E7%25AB%25AA%25E7%25A9%25B4%25F0%259F%2590%25B0%26adj_redirect_macos%3Dhttps%253A%252F%252Fwww.mirrativ.com%252Flive%252FqxeIOi5E7DRhQ1Dstm_8Ug%26adj_t%3D1pkihi8s_1pyfvurh%26where%3Dbroadcast_setting','2026-03-15 14:15:03');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('M01','525319946054','available',NULL,'2026-03-15 14:09:27');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('M01','579425834608','unavailable',NULL,'2026-03-15 14:08:27');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('M01','132593318204','available',NULL,'2026-03-15 14:08:41');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('M01','579974994969','unavailable',NULL,'2026-03-15 14:08:42');
INSERT INTO "match_player_stream_plans" ("match_id","player_id","stream_status","mirrativ_url","updated_at") VALUES('M01','399384565625','undecided',NULL,'2026-03-15 14:15:34');
CREATE INDEX idx_team_members_team_id ON team_members
(team_id);
CREATE INDEX idx_team_members_player_id ON team_members
(player_id);
CREATE INDEX idx_leaders_team_id ON leaders
(team_id);
CREATE INDEX idx_leaders_player_id ON leaders
(player_id);
CREATE INDEX idx_matches_team_a_id ON matches
(team_a_id);
CREATE INDEX idx_matches_team_b_id ON matches
(team_b_id);
CREATE INDEX idx_matches_admin_user_id ON matches
(creator_user_id);
CREATE INDEX idx_matches_scheduled_at ON matches
(scheduled_at);
CREATE INDEX idx_games_match_id ON games
(match_id);
CREATE INDEX idx_games_winner_player_id ON games
(winner_player_id);
CREATE INDEX idx_reserves_match_id ON reserves
(match_id);
CREATE INDEX idx_reserves_team_id ON reserves
(team_id);
CREATE INDEX idx_orders_match_team_time ON orders
(match_id, team_id, submitted_at);
CREATE INDEX idx_order_details_order ON order_details
(order_id);
CREATE INDEX idx_order_details_team_game ON order_details
(team_id, game_number);
