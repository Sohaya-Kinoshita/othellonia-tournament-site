// /api/match-card-upcoming - 今後の対戦カード一覧取得API
// scheduled_atが「翌日4:00(JST)以降」のマッチを全て返す

function getTomorrowJst4amIso() {
  // 現在時刻（UTC）を取得
  const now = new Date();
  // JSTはUTC+9
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // 今日の4:00(JST)
  const jstYear = jstNow.getFullYear();
  const jstMonth = String(jstNow.getMonth() + 1).padStart(2, "0");
  const jstDate = String(jstNow.getDate()).padStart(2, "0");
  const today4 = `${jstYear}-${jstMonth}-${jstDate} 04:00:00`;
  // 翌日の4:00(JST)
  const nextDay = new Date(jstNow.getTime() + 24 * 60 * 60 * 1000);
  const nextYear = nextDay.getFullYear();
  const nextMonth = String(nextDay.getMonth() + 1).padStart(2, "0");
  const nextDate = String(nextDay.getDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDate} 04:00:00`;
}

export async function onRequest(context) {
  try {
    const db = context.env.DB;
    await ensureOrdersConfirmedAtColumn(db);
    await ensureMatchesStartedAtColumn(db);
    await ensureMatchesStatusColumn(db);
    const next4 = getTomorrowJst4amIso();
    // scheduled_atが「翌日JST4:00以降」のマッチを取得
    const matchesResult = await db
      .prepare(
        `
      SELECT 
        m.match_id,
        m.team_a_id,
        m.team_b_id,
        ta.team_name as team_a_name,
        tb.team_name as team_b_name,
        m.scheduled_at,
        m.started_at,
        m.winner_team_id,
        m.status,
        (
          SELECT COUNT(*) FROM games g
          WHERE g.match_id = m.match_id
            AND g.winner_player_id IS NOT NULL
        ) AS completed_game_count,
        (
          SELECT COUNT(DISTINCT o.team_id) FROM orders o
          WHERE o.match_id = m.match_id
            AND o.confirmed_at IS NOT NULL
        ) AS confirmed_team_count,
        (
          SELECT COUNT(DISTINCT o.team_id) FROM orders o
          WHERE o.match_id = m.match_id
        ) AS submitted_team_count
      FROM matches m
      LEFT JOIN teams ta ON m.team_a_id = ta.team_id
      LEFT JOIN teams tb ON m.team_b_id = tb.team_id
      WHERE m.scheduled_at >= ?
      ORDER BY m.scheduled_at
    `,
      )
      .bind(next4)
      .all();
    const matches = (matchesResult.results || []).map((match) => {
      const hasCompletedGame = Number(match.completed_game_count || 0) > 0;
      const hasBothTeamsConfirmed =
        Number(match.confirmed_team_count || 0) >= 2;
      const hasBothTeamsSubmitted =
        Number(match.submitted_team_count || 0) >= 2;

      const matchStatus = match.status
        ? match.status
        : match.winner_team_id
          ? "finished"
          : match.started_at || hasCompletedGame
            ? "in_progress"
            : hasBothTeamsConfirmed || hasBothTeamsSubmitted
              ? "confirmed_before_start"
              : "before_order_submission";

      return {
        ...match,
        match_status: matchStatus,
      };
    });
    return new Response(JSON.stringify({ success: true, matches }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("match-card-upcoming error:", error);
    return new Response(
      JSON.stringify({
        message: "今後の対戦カード取得でエラー",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function ensureOrdersConfirmedAtColumn(db) {
  try {
    await db.prepare("ALTER TABLE orders ADD COLUMN confirmed_at TEXT").run();
  } catch (_error) {
    // 既に存在する場合は何もしない
  }
}

async function ensureMatchesStartedAtColumn(db) {
  try {
    await db.prepare("ALTER TABLE matches ADD COLUMN started_at TEXT").run();
  } catch (_error) {
    // 既に存在する場合は何もしない
  }
}

async function ensureMatchesStatusColumn(db) {
  try {
    await db.prepare("ALTER TABLE matches ADD COLUMN status TEXT").run();
  } catch (_error) {
    // 既に存在する場合は何もしない
  }
}
