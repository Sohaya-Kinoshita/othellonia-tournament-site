// /api/match-card-upcoming - 今後の対戦カード一覧取得API
// scheduled_atが「今（JST）以降」のマッチを全て返す

function getJstNowIso() {
  // 現在時刻（UTC）を取得
  const now = new Date();
  // JSTはUTC+9
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // YYYY-MM-DD HH:mm:ss 形式
  const year = jstNow.getFullYear();
  const month = String(jstNow.getMonth() + 1).padStart(2, "0");
  const date = String(jstNow.getDate()).padStart(2, "0");
  const hour = String(jstNow.getHours()).padStart(2, "0");
  const min = String(jstNow.getMinutes()).padStart(2, "0");
  const sec = String(jstNow.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${date} ${hour}:${min}:${sec}`;
}

export async function onRequest(context) {
  try {
    const db = context.env.DB;
    const nowJst = getJstNowIso();
    // scheduled_atが今以降のマッチを取得
    const matchesResult = await db
      .prepare(
        `
      SELECT 
        m.match_id,
        m.team_a_id,
        m.team_b_id,
        ta.team_name as team_a_name,
        tb.team_name as team_b_name,
        m.scheduled_at
      FROM matches m
      LEFT JOIN teams ta ON m.team_a_id = ta.team_id
      LEFT JOIN teams tb ON m.team_b_id = tb.team_id
      WHERE m.scheduled_at >= ?
      ORDER BY m.scheduled_at
    `,
      )
      .bind(nowJst)
      .all();
    const matches = matchesResult.results || [];
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
