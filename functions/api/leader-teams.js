export async function onRequest(context) {
  // GETメソッド：プレイヤーがリーダーを務めるチーム一覧を取得
  if (context.request.method === "GET") {
    try {
      // リーダー認証確認
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
      let leaderId = "";
      try {
        const decoded = atob(sessionId);
        const [type, id] = decoded.split(":");

        if (type !== "leader") {
          return new Response(
            JSON.stringify({ message: "リーダー権限が必要です" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        leaderId = id;
      } catch (e) {
        return new Response(JSON.stringify({ message: "認証エラー" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const db = context.env.DB;

      // リーダーが担当するチーム一覧を取得
      const leaderTeams = await db
        .prepare(
          `
          SELECT 
            t.team_id,
            t.team_name,
            l.leader_id,
            l.leader_role,
            p.player_id,
            p.player_name,
            COUNT(tm.player_id) AS member_count
          FROM leaders l
          JOIN teams t ON l.team_id = t.team_id
          LEFT JOIN players p ON l.player_id = p.player_id
          LEFT JOIN team_members tm ON t.team_id = tm.team_id
          WHERE l.leader_id = ?
          GROUP BY t.team_id, t.team_name, l.leader_id, l.leader_role, p.player_id, p.player_name
        `,
        )
        .bind(leaderId)
        .all();

      return new Response(
        JSON.stringify({
          success: true,
          teams: leaderTeams.results || [],
          leaderId: leaderId,
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
