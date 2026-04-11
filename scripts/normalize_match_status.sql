-- normalize_match_status.sql
--
-- Matchesテーブルのstatus値を以下の4つに正規化します:
--   'before_order_submission', 'confirmed_before_start', 'in_progress', 'finished'
--
-- 実行例 (SQLite):
--   sqlite3 path/to/your.db < scripts/normalize_match_status.sql
--
BEGIN TRANSACTION;

-- 1) 勝者が決まっているものは finished
UPDATE matches
SET status = 'finished'
WHERE winner_team_id IS NOT NULL;

-- 2) started_at が設定されていて勝者が未設定のものは in_progress
UPDATE matches
SET status = 'in_progress'
WHERE winner_team_id IS NULL
    AND started_at IS NOT NULL;

-- 3) 両チームのオーダーが確定していて開始していないものは confirmed_before_start
UPDATE matches
SET status = 'confirmed_before_start'
WHERE winner_team_id IS NULL
    AND started_at IS NULL
    AND (
    SELECT COUNT(DISTINCT team_id)
    FROM orders
    WHERE match_id = matches.match_id
        AND confirmed_at IS NOT NULL
  ) >= 2;

-- 4) 上記に該当せず、status が NULL/空/不正な値のものは before_order_submission に
UPDATE matches
SET status = 'before_order_submission'
WHERE status IS NULL
    OR TRIM(status) = ''
    OR status NOT IN ('before_order_submission','confirmed_before_start','in_progress','finished');

COMMIT;
