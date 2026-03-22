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
    await db
      .prepare(
        `DELETE FROM order_details WHERE order_id IN (SELECT order_id FROM orders WHERE match_id = ? COLLATE binary)`,
      )
      .bind(matchId)
      .run();
    await db
      .prepare("DELETE FROM games WHERE match_id = ? COLLATE binary")
      .bind(matchId)
      .run();
    await db
      .prepare("DELETE FROM orders WHERE match_id = ? COLLATE binary")
      .bind(matchId)
      .run();
    await db
      .prepare("DELETE FROM match_admins WHERE match_id = ? COLLATE binary")
      .bind(matchId)
      .run();
    await db
      .prepare("DELETE FROM matches WHERE match_id = ? COLLATE binary")
      .bind(matchId)
      .run();
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ message: e.message || "削除に失敗しました" }),
      { status: 500 },
    );
  }
}
