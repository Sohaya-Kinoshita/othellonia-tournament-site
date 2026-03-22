// 終了した試合のみを返すAPI
// GET /api/finished-matches

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    // winner_team_idがNULLでない＝試合終了
    const result = await db
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
        m.winner_team_id
      FROM matches m
      LEFT JOIN teams ta ON m.team_a_id = ta.team_id
      LEFT JOIN teams tb ON m.team_b_id = tb.team_id
      WHERE m.winner_team_id IS NOT NULL
      ORDER BY m.scheduled_at DESC
    `,
      )
      .all();
    const matches = result.results || [];
    return new Response(JSON.stringify({ success: true, matches }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("finished-matches error:", error);
    return new Response(
      JSON.stringify({
        message: "終了試合一覧取得でエラー",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
