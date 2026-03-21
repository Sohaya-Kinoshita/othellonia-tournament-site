// /api/match-card-today - 本日の対戦カード一覧取得API
// JSTの4:00～翌日4:00を「本日」とみなす

function getJstDateRange() {
  // 現在時刻（UTC）を取得
  const now = new Date();
  // JSTはUTC+9
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // 今日の4:00(JST)を算出
  const jstYear = jstNow.getFullYear();
  const jstMonth = String(jstNow.getMonth() + 1).padStart(2, "0");
  const jstDate = String(jstNow.getDate()).padStart(2, "0");
  const today4 = `${jstYear}-${jstMonth}-${jstDate} 04:00:00`;
  // 翌日4:00(JST)
  const nextDay = new Date(jstNow.getTime() + 24 * 60 * 60 * 1000);
  const nextYear = nextDay.getFullYear();
  const nextMonth = String(nextDay.getMonth() + 1).padStart(2, "0");
  const nextDate = String(nextDay.getDate()).padStart(2, "0");
  const tomorrow4 = `${nextYear}-${nextMonth}-${nextDate} 04:00:00`;
  // UTCに変換
  const today4utc = new Date(`${today4} GMT+0900`)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  const tomorrow4utc = new Date(`${tomorrow4} GMT+0900`)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  return { start: today4utc, end: tomorrow4utc };
}

export async function onRequest(context) {
  try {
    const db = context.env.DB;
    const { start, end } = getJstDateRange();
    // scheduled_atが本日範囲のマッチを取得
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
      WHERE m.scheduled_at >= ? AND m.scheduled_at < ?
      ORDER BY m.scheduled_at
    `,
      )
      .bind(start, end)
      .all();
    const matches = matchesResult.results || [];
    return new Response(JSON.stringify({ success: true, matches }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("match-card-today error:", error);
    return new Response(
      JSON.stringify({
        message: "本日の対戦カード取得でエラー",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
