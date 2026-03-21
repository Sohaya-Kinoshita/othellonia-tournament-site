// マッチ削除API: POST /api/matches/delete
export async function onRequestPost(context) {
  const db = context.env.DB;
  try {
    const { matchId } = await context.request.json();
    if (!/^[A-Za-z][0-9]{2}$/.test(matchId)) {
      return new Response(JSON.stringify({ message: "不正なマッチIDです" }), {
        status: 400,
      });
    }
    // 存在確認
    const match = await db
      .prepare("SELECT * FROM matches WHERE match_id = ? COLLATE binary")
      .bind(matchId)
      .first();
    if (!match) {
      return new Response(
        JSON.stringify({ message: "マッチが見つかりません" }),
        { status: 404 },
      );
    }
    // 削除順序: order_details → games → orders → match_admins → matches
    // 1. order_details（order_idが対象マッチのordersに紐づくもの）
    await db
      .prepare(
        `DELETE FROM order_details WHERE order_id IN (SELECT order_id FROM orders WHERE match_id = ? COLLATE binary)`,
      )
      .bind(matchId)
      .run();
    // 2. games
    await db
      .prepare("DELETE FROM games WHERE match_id = ? COLLATE binary")
      .bind(matchId)
      .run();
    // 3. orders
    await db
      .prepare("DELETE FROM orders WHERE match_id = ? COLLATE binary")
      .bind(matchId)
      .run();
    // 4. match_admins
    await db
      .prepare("DELETE FROM match_admins WHERE match_id = ? COLLATE binary")
      .bind(matchId)
      .run();
    // 5. matches
    await db
      .prepare("DELETE FROM matches WHERE match_id = ? COLLATE binary")
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
  let matchId = searchParams.get("matchId");
  if (!/^[A-Za-z][0-9]{2}$/.test(matchId)) {
    return new Response(JSON.stringify({ message: "不正なマッチIDです" }), {
      status: 400,
    });
  }
  // マッチ詳細＋オーダー確定・試合終了フラグも返す
  const match = await db
    .prepare(
      `
    SELECT m.match_id, m.team_a_id, m.team_b_id, ta.team_name as team_a_name, tb.team_name as team_b_name, m.scheduled_at, m.match_status,
      -- オーダー確定済みフラグ
      EXISTS (SELECT 1 FROM orders o WHERE o.match_id = m.match_id AND o.confirmed_at IS NOT NULL) AS has_confirmed_order,
      -- 試合終了フラグ
      CASE WHEN m.winner_team_id IS NOT NULL THEN 1 ELSE 0 END AS is_finished
    FROM matches m
    LEFT JOIN teams ta ON m.team_a_id = ta.team_id
    LEFT JOIN teams tb ON m.team_b_id = tb.team_id
    WHERE m.match_id = ? COLLATE binary
  `,
    )
    .bind(matchId)
    .first();
  if (!match) {
    return new Response(JSON.stringify({ message: "マッチが見つかりません" }), {
      status: 404,
    });
  }
  // SQLiteのboolean値は0/1なので明示的に変換
  match.has_confirmed_order = !!match.has_confirmed_order;
  match.is_finished = !!match.is_finished;
  return new Response(JSON.stringify(match), { status: 200 });
}
