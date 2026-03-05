export async function onRequest(context) {
  // GETメソッド：チーム詳細情報とメンバー一覧を取得
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

      // クエリパラメータからteamIdを取得
      const url = new URL(context.request.url);
      const teamId = url.searchParams.get("teamId");

      if (!teamId) {
        return new Response(JSON.stringify({ message: "チームIDが必要です" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const db = context.env.DB;

      // チーム情報を取得
      const team = await db
        .prepare("SELECT * FROM teams WHERE team_id = ?")
        .bind(teamId)
        .first();

      if (!team) {
        return new Response(
          JSON.stringify({ message: "チームが見つかりません" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // プレイヤーがこのチームのリーダーか確認
      if (team.team_reader !== playerId) {
        return new Response(
          JSON.stringify({ message: "このチームのリーダーではありません" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // メンバー一覧を取得
      const members = await db
        .prepare(
          `
          SELECT 
            p.player_id,
            p.player_name
          FROM team_members tm
          JOIN players p ON tm.player_id = p.player_id
          WHERE tm.team_id = ?
          ORDER BY p.player_id
        `,
        )
        .bind(teamId)
        .all();

      // チームに関連するマッチ一覧を取得
      const matches = await db
        .prepare(
          `
          SELECT 
            m.match_id,
            m.team_a_id,
            m.team_b_id,
            ta.team_name as team_a_name,
            tb.team_name as team_b_name,
            m.best_of,
            m.winner_team_id
          FROM matches m
          LEFT JOIN teams ta ON m.team_a_id = ta.team_id
          LEFT JOIN teams tb ON m.team_b_id = tb.team_id
          WHERE m.team_a_id = ? OR m.team_b_id = ?
          ORDER BY m.match_id
        `,
        )
        .bind(teamId, teamId)
        .all();

      return new Response(
        JSON.stringify({
          success: true,
          team: team,
          members: members.results || [],
          matches: matches.results || [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Team detail fetch error:", error);
      return new Response(
        JSON.stringify({
          message: "チーム詳細情報取得処理でエラーが発生しました",
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
