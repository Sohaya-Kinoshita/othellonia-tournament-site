-- 【1】matchesテーブルのadmin_user_idをcreator_user_idにリネーム
ALTER TABLE matches RENAME COLUMN admin_user_id TO creator_user_id;

-- 【2】match_adminsテーブル新設
CREATE TABLE
IF NOT EXISTS match_admins
(
  match_id CHAR
(3) NOT NULL,
  admin_user_id CHAR
(9) NOT NULL,
  PRIMARY KEY
(match_id, admin_user_id),
  FOREIGN KEY
(match_id) REFERENCES matches
(match_id) ON
DELETE CASCADE ON
UPDATE CASCADE,
  FOREIGN KEY (admin_user_id) REFERENCES users(user_id)
ON
DELETE CASCADE ON
UPDATE CASCADE
);

-- 【3】既存データ移行（全マッチの作成者を管理者として登録）
INSERT OR
IGNORE INTO match_admins (match_id, admin_user_id)
SELECT match_id, creator_user_id
FROM matches;
