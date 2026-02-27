export async function onRequest(context) {
  try {
    // クッキーからセッションIDを取得
    const cookies = context.request.headers.get("cookie") || "";
    const sessionId = cookies
      .split("; ")
      .find((c) => c.startsWith("sessionId="))
      ?.split("=")[1];

    if (!sessionId) {
      return new Response(JSON.stringify({ isLoggedIn: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = context.env.DB;

    // セッションが有効か確認
    const session = await db
      .prepare("SELECT playerId, expiresAt FROM sessions WHERE sessionId = ?")
      .bind(sessionId)
      .first();

    if (!session) {
      return new Response(JSON.stringify({ isLoggedIn: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // セッションの有効期限をチェック
    if (new Date(session.expiresAt) < new Date()) {
      // 期限切れのセッションを削除
      await db
        .prepare("DELETE FROM sessions WHERE sessionId = ?")
        .bind(sessionId)
        .run();

      return new Response(JSON.stringify({ isLoggedIn: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // プレイヤー情報を取得
    const player = await db
      .prepare(
        "SELECT playerId, playerName, teamId1, teamId2, wins, matches FROM players WHERE playerId = ?",
      )
      .bind(session.playerId)
      .first();

    return new Response(
      JSON.stringify({
        isLoggedIn: true,
        player,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Me error:", error);
    return new Response(JSON.stringify({ isLoggedIn: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
