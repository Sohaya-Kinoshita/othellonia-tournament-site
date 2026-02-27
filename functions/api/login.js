export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { playerId } = await context.request.json();

    if (!playerId) {
      return new Response(
        JSON.stringify({ message: "プレイヤーIDが必要です" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // プレイヤーが存在するか確認
    const db = context.env.DB;
    const player = await db
      .prepare("SELECT playerId, playerName FROM players WHERE playerId = ?")
      .bind(playerId)
      .first();

    if (!player) {
      return new Response(
        JSON.stringify({ message: "プレイヤーが見つかりません" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // セッションIDを生成
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString(); // 7日間有効

    // セッションを作成
    await db
      .prepare(
        "INSERT INTO sessions (sessionId, playerId, expiresAt) VALUES (?, ?, ?)",
      )
      .bind(sessionId, playerId, expiresAt)
      .run();

    // クッキーにセッションIDを保存
    const response = new Response(
      JSON.stringify({
        success: true,
        player: { playerId: player.playerId, playerName: player.playerName },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

    response.headers.set(
      "Set-Cookie",
      `sessionId=${sessionId}; Path=/; HttpOnly; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
    );

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ message: "ログイン処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
