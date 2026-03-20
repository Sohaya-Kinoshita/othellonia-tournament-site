// マッチ削除API: POST /api/matches/delete
export async function onRequestPost(context) {
  const db = context.env.DB;
  try {
    const { matchId } = await context.request.json();
    if (!/^[A-Z][0-9]{2}$/.test(matchId)) {
      return new Response(JSON.stringify({ message: "不正なマッチIDです" }), {
        status: 400,
      });
    }
    // 存在確認
    const match = await db
      .prepare("SELECT * FROM matches WHERE match_id = ?")
      .bind(matchId)
      .first();
    if (!match) {
      return new Response(
        JSON.stringify({ message: "マッチが見つかりません" }),
        { status: 404 },
      );
    }
    // 関連データも削除（games, orders, match_admins など）
    await db
      .prepare("DELETE FROM games WHERE match_id = ?")
      .bind(matchId)
      .run();
    await db
      .prepare("DELETE FROM orders WHERE match_id = ?")
      .bind(matchId)
      .run();
    await db
      .prepare("DELETE FROM match_admins WHERE match_id = ?")
      .bind(matchId)
      .run();
    await db
      .prepare("DELETE FROM matches WHERE match_id = ?")
      .bind(matchId)
      .run();
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(
      JSON.stringify({ message: e.message || "削除に失敗しました" }),
      { status: 500 },
    );
  }
}

// マッチ詳細取得API: GET /api/matches/detail?matchId=...
export async function onRequestGet(context) {
  const db = context.env.DB;
  const { searchParams } = new URL(context.request.url);
  const matchId = searchParams.get("matchId");
  if (!/^[A-Z][0-9]{2}$/.test(matchId)) {
    return new Response(JSON.stringify({ message: "不正なマッチIDです" }), {
      status: 400,
    });
  }
  const match = await db
    .prepare(
      `
    SELECT m.match_id, m.team_a_id, m.team_b_id, ta.team_name as team_a_name, tb.team_name as team_b_name, m.scheduled_at, m.match_status
    FROM matches m
    LEFT JOIN teams ta ON m.team_a_id = ta.team_id
    LEFT JOIN teams tb ON m.team_b_id = tb.team_id
    WHERE m.match_id = ?
  `,
    )
    .bind(matchId)
    .first();
  if (!match) {
    return new Response(JSON.stringify({ message: "マッチが見つかりません" }), {
      status: 404,
    });
  }
  return new Response(JSON.stringify(match), { status: 200 });
}
