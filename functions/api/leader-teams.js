export async function onRequest(context) {
  // GETメソッド：プレイヤーがリーダーを務めるチーム一覧を取得
  if (context.request.method === "GET") {
    try {
      // プレイヤー認証確認
      const cookies = context.request.headers.get("cookie") || "";
      const sessionId = cookies
        .split("; ")
        .find((c) => c.startsWith("sessionId="))
        ?.split("=")[1];

      if (!sessionId) {
        return new Response(JSON.stringify({ message: "認証が必要です" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // セッションIDをデコード
      let playerId = "";
      try {
        const decoded = atob(sessionId);
        const [type, id] = decoded.split(":");

        if (type !== "player") {
          return new Response(
            JSON.stringify({ message: "プレイヤー権限が必要です" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        playerId = id;
      } catch (e) {
        return new Response(JSON.stringify({ message: "認証エラー" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const db = context.env.DB;

      // プレイヤーがリーダーを務めるチーム一覧を取得
      const leaderTeams = await db
        .prepare(
          `
          SELECT 
            t.team_id,
            t.team_name,
            t.team_reader,
            p.player_name,
            COUNT(tm.player_id) as member_count
          FROM teams t
          LEFT JOIN players p ON t.team_reader = p.player_id
          LEFT JOIN team_members tm ON t.team_id = tm.team_id
          WHERE t.team_reader = ?
          GROUP BY t.team_id
        `,
        )
        .bind(playerId)
        .all();

      return new Response(
        JSON.stringify({
          success: true,
          teams: leaderTeams.results || [],
          playerId: playerId,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Leader teams fetch error:", error);
      return new Response(
        JSON.stringify({
          message: "リーダーチーム一覧取得処理でエラーが発生しました",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  return new Response(JSON.stringify({ message: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
