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

    try {
      // セッションIDをデコード（Base64）
      const decoded = atob(sessionId);
      const [type, id] = decoded.split(":");

      if (!type || !id) {
        return new Response(JSON.stringify({ isLoggedIn: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const db = context.env.DB;

      // 参加者ログイン情報
      if (type === "player") {
        const player = await db
          .prepare(
            "SELECT player_id, player_name FROM players WHERE player_id = ?",
          )
          .bind(id)
          .first();

        if (!player) {
          return new Response(JSON.stringify({ isLoggedIn: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            isLoggedIn: true,
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
      }

      // 管理者ログイン情報
      if (type === "admin") {
        const user = await db
          .prepare("SELECT user_id, user_name FROM users WHERE user_id = ?")
          .bind(id)
          .first();

        if (!user) {
          return new Response(JSON.stringify({ isLoggedIn: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            isLoggedIn: true,
            type: "admin",
            user: { userId: user.user_id, userName: user.user_name },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify({ isLoggedIn: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (decodeError) {
      // セッションIDのデコード失敗
      return new Response(JSON.stringify({ isLoggedIn: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Me error:", error);
    return new Response(JSON.stringify({ isLoggedIn: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
