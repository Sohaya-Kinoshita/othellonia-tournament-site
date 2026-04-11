// マッチIDでマッチ情報を検索するAPI
// GET /api/match-search?matchId=xxx

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const matchId = (url.searchParams.get("matchId") || "").trim();
    if (!matchId) {
      return new Response(JSON.stringify({ message: "matchIdが必要です" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const db = context.env.DB;
    await ensureOrdersConfirmedAtColumn(db);
    await ensureMatchesStartedAtColumn(db);
    await ensureMatchesStatusColumn(db);
    const matchOwnerColumn = await getMatchOwnerColumn(db);
    const match = await db
      .prepare(
        `
      SELECT 
        m.match_id,
        m.team_a_id,
        m.team_b_id,
        ta.team_name as team_a_name,
        tb.team_name as team_b_name,
        m.best_of,
        m.created_at,
        m.scheduled_at,
        m.order_deadline,
        m.started_at,
        m.status,
        m.winner_team_id,
        m.${matchOwnerColumn} AS creator_user_id,
        m.${matchOwnerColumn} AS admin_user_id,
        (
          SELECT COUNT(*) FROM games g
          WHERE g.match_id = m.match_id
            AND g.winner_player_id IS NOT NULL
        ) AS completed_game_count,
        (
          SELECT COUNT(DISTINCT o.team_id) FROM orders o
          WHERE o.match_id = m.match_id
            AND o.confirmed_at IS NOT NULL
        ) AS confirmed_team_count
      FROM matches m
      LEFT JOIN teams ta ON m.team_a_id = ta.team_id
      LEFT JOIN teams tb ON m.team_b_id = tb.team_id
      WHERE m.match_id = ?
    `,
      )
      .bind(matchId)
      .first();
    if (!match) {
      return new Response(
        JSON.stringify({ message: "マッチが見つかりません" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const hasCompletedGame = Number(match.completed_game_count || 0) > 0;
    const hasBothTeamsConfirmed = Number(match.confirmed_team_count || 0) >= 2;

    const matchStatus = match.status
      ? match.status
      : match.winner_team_id
        ? "finished"
        : match.started_at || hasCompletedGame
          ? "in_progress"
          : hasBothTeamsConfirmed
            ? "confirmed_before_start"
            : "before_order_submission";

    const normalizedMatch = {
      ...match,
      match_status: matchStatus,
      is_finished: matchStatus === "finished",
      has_confirmed_order: hasBothTeamsConfirmed,
    };

    return new Response(
      JSON.stringify({ success: true, match: normalizedMatch }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("match-search error:", error);
    return new Response(
      JSON.stringify({ message: "マッチ検索でエラー", error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function getMatchOwnerColumn(db) {
  const columns = await db.prepare("PRAGMA table_info(matches)").all();
  const columnNames = new Set((columns.results || []).map((col) => col.name));

  if (columnNames.has("creator_user_id")) {
    return "creator_user_id";
  }
  if (columnNames.has("admin_user_id")) {
    return "admin_user_id";
  }

  return "creator_user_id";
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
