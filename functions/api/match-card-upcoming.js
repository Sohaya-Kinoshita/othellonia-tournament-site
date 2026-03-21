// /api/match-card-upcoming - 今後の対戦カード一覧取得API
// scheduled_atが「今（JST）以降」のマッチを全て返す

function getNextJst4amIso() {
  // 現在時刻（UTC）を取得
  const now = new Date();
  // JSTはUTC+9
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // 今日の4:00(JST)
  const jstYear = jstNow.getFullYear();
  const jstMonth = String(jstNow.getMonth() + 1).padStart(2, "0");
  const jstDate = String(jstNow.getDate()).padStart(2, "0");
  const today4 = new Date(`${jstYear}-${jstMonth}-${jstDate}T04:00:00+09:00`);
  let next4;
  if (jstNow < today4) {
    // まだ今日の4時前なら今日の4時
    next4 = today4;
  } else {
    // 今日の4時を過ぎていたら翌日の4時
    next4 = new Date(today4.getTime() + 24 * 60 * 60 * 1000);
  }
  // UTCに変換してYYYY-MM-DD HH:mm:ss形式で返す
  const iso = new Date(next4.getTime() - 9 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  return iso;
}

export async function onRequest(context) {
  try {
    const db = context.env.DB;
    const next4 = getNextJst4amIso();
    // scheduled_atが「次のJST4:00以降」のマッチを取得
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
      .bind(next4)
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
