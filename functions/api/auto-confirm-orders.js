export async function onRequest(context) {
  // Cron trigger からのリクエストのみを許可
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const db = context.env.DB;

    // 現在時刻（JST）を取得
    const now = new Date();
    const nowJST = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");

    // 期限を過ぎ、まだ確定していないオーダーをすべて取得
    const expiredOrders = await db
      .prepare(
        `
        SELECT DISTINCT m.match_id, m.team_a_id, m.team_b_id
        FROM matches m
        WHERE m.order_deadline < ?
          AND (
            SELECT COUNT(*) FROM orders o
            WHERE o.match_id = m.match_id
              AND o.confirmed_at IS NULL
          ) > 0
      `,
      )
      .bind(nowJST)
      .all();

    if (!expiredOrders.results || expiredOrders.results.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "確定対象のオーダーはありません",
          count: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 各マッチについて、未確定のオーダーを確定
    const statements = [];
    let confirmedCount = 0;

    for (const match of expiredOrders.results) {
      // Team A のオーダーが未確定か確認
      const orderA = await db
        .prepare(
          "SELECT confirmed_at FROM orders WHERE match_id = ? AND team_id = ? LIMIT 1",
        )
        .bind(match.match_id, match.team_a_id)
        .first();

      if (orderA && orderA.confirmed_at === null) {
        statements.push(
          db
            .prepare(
              "UPDATE orders SET confirmed_at = datetime('now', '+9 hours') WHERE match_id = ? AND team_id = ?",
            )
            .bind(match.match_id, match.team_a_id),
        );
        confirmedCount++;
      }

      // Team B のオーダーが未確定か確認
      const orderB = await db
        .prepare(
          "SELECT confirmed_at FROM orders WHERE match_id = ? AND team_id = ? LIMIT 1",
        )
        .bind(match.match_id, match.team_b_id)
        .first();

      if (orderB && orderB.confirmed_at === null) {
        statements.push(
          db
            .prepare(
              "UPDATE orders SET confirmed_at = datetime('now', '+9 hours') WHERE match_id = ? AND team_id = ?",
            )
            .bind(match.match_id, match.team_b_id),
        );
        confirmedCount++;
      }
    }

    if (statements.length > 0) {
      await db.batch(statements);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${confirmedCount}件のオーダーを自動確定しました`,
        count: confirmedCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Auto-confirm orders error:", error);
    return new Response(
      JSON.stringify({ message: "オーダー自動確定処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
