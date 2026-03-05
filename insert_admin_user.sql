-- 既存のユーザーをすべて削除
DELETE FROM users;

-- 新しい管理者ユーザーを追加
INSERT INTO users (user_id, pass, user_name)
VALUES ('admin2601', 'eY5f8Bnd', '管理者ユーザー');
