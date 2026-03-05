export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { playerId, userId, password } = await context.request.json();
    const db = context.env.DB;

    // 参加者ログイン（プレイヤーIDのみ）
    if (playerId && !userId) {
      const player = await db
        .prepare(
          "SELECT player_id, player_name FROM players WHERE player_id = ?",
        )
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

      // セッションIDを生成（player_idをBase64エンコード）
      const sessionId = btoa("player:" + player.player_id + ":" + Date.now());

      const response = new Response(
        JSON.stringify({
          success: true,
          type: "player",
          player: {
            playerId: player.player_id,
            playerName: player.player_name,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

      // 本番環境ではSecure; 開発環境ではなし
      const isProduction = new URL(context.request.url).protocol === "https:";
      const secureFlag = isProduction ? "; Secure" : "";
      response.headers.set(
        "Set-Cookie",
        `sessionId=${sessionId}; Path=/; HttpOnly${secureFlag}; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
      );

      return response;
    }

    // 管理者ログイン（ユーザーIDとパスワード）
    if (userId && password) {
      const user = await db
        .prepare("SELECT user_id, user_name, pass FROM users WHERE user_id = ?")
        .bind(userId)
        .first();

      if (!user) {
        return new Response(
          JSON.stringify({ message: "ユーザーが見つかりません" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // パスワードを検証
      if (user.pass !== password) {
        return new Response(
          JSON.stringify({ message: "パスワードが正しくありません" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // セッションIDを生成（user_idをBase64エンコード）
      const sessionId = btoa("admin:" + user.user_id + ":" + Date.now());

      const response = new Response(
        JSON.stringify({
          success: true,
          type: "admin",
          user: { userId: user.user_id, userName: user.user_name },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

      // 本番環境ではSecure; 開発環境ではなし
      const isProduction = new URL(context.request.url).protocol === "https:";
      const secureFlag = isProduction ? "; Secure" : "";
      response.headers.set(
        "Set-Cookie",
        `sessionId=${sessionId}; Path=/; HttpOnly${secureFlag}; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
      );

      return response;
    }

    return new Response(
      JSON.stringify({
        message: "プレイヤーIDまたはユーザーIDとパスワードが必要です",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
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
