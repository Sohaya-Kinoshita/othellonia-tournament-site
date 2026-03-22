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
        m.winner_team_id
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
    return new Response(JSON.stringify({ success: true, match }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
