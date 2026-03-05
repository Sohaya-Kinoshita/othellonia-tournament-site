export async function onRequest(context) {
  try {
    // 管理者認証確認
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

    try {
      const decoded = atob(sessionId);
      const [type] = decoded.split(":");

      if (type !== "admin") {
        return new Response(
          JSON.stringify({ message: "管理者権限が必要です" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    } catch (e) {
      return new Response(JSON.stringify({ message: "認証エラー" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = context.env.DB;

    // GETメソッド：特定プレイヤーのチーム一覧を取得
    if (context.request.method === "GET") {
      const url = new URL(context.request.url);
      const playerId = url.searchParams.get("playerId");

      if (!playerId) {
        return new Response(
          JSON.stringify({ message: "プレイヤーIDが必要です" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      try {
        const teamMemberships = await db
          .prepare(`SELECT team_id FROM team_members WHERE player_id = ?`)
          .bind(playerId)
          .all();

        return new Response(
          JSON.stringify({
            success: true,
            teams: teamMemberships.results || [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error("Team members fetch error:", error);
        return new Response(
          JSON.stringify({
            message: "チームメンバー取得処理でエラーが発生しました",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // POSTメソッド：プレイヤーをチームに追加
    if (context.request.method === "POST") {
      const { playerId, teamId } = await context.request.json();

      if (!playerId || !teamId) {
        return new Response(
          JSON.stringify({
            message: "プレイヤーIDとチームIDが必要です",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      try {
        // プレイヤーが存在するか確認
        const player = await db
          .prepare("SELECT player_id FROM players WHERE player_id = ?")
          .bind(playerId)
          .first();

        if (!player) {
          return new Response(
            JSON.stringify({ message: "プレイヤーが見つかりません" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // チームが存在するか確認
        const team = await db
          .prepare("SELECT team_id FROM teams WHERE team_id = ?")
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

        // 既に登録されているか確認
        const existing = await db
          .prepare(
            "SELECT team_id FROM team_members WHERE team_id = ? AND player_id = ?",
          )
          .bind(teamId, playerId)
          .first();

        if (existing) {
          return new Response(
            JSON.stringify({
              message: "このプレイヤーは既にこのチームに登録されています",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // チームメンバーを追加（最大2チームまで）
        const memberCount = await db
          .prepare(
            "SELECT COUNT(*) as count FROM team_members WHERE player_id = ?",
          )
          .bind(playerId)
          .first();

        if (memberCount.count >= 2) {
          return new Response(
            JSON.stringify({
              message: "プレイヤーは最大2つのチームまで登録できます",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // 追加
        await db
          .prepare(
            "INSERT INTO team_members (team_id, player_id) VALUES (?, ?)",
          )
          .bind(teamId, playerId)
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: "チームメンバーを追加しました",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error("Team member add error:", error);
        return new Response(
          JSON.stringify({
            message: "チームメンバー追加処理でエラーが発生しました",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // DELETEメソッド：プレイヤーをチームから削除
    if (context.request.method === "DELETE") {
      const { playerId, teamId } = await context.request.json();

      if (!playerId || !teamId) {
        return new Response(
          JSON.stringify({
            message: "プレイヤーIDとチームIDが必要です",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      try {
        // 削除
        await db
          .prepare(
            "DELETE FROM team_members WHERE team_id = ? AND player_id = ?",
          )
          .bind(teamId, playerId)
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: "チームメンバーを削除しました",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error("Team member delete error:", error);
        return new Response(
          JSON.stringify({
            message: "チームメンバー削除処理でエラーが発生しました",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    return new Response(
      JSON.stringify({
        message: "MethodNotAllowed",
      }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Team members error:", error);
    return new Response(JSON.stringify({ message: "エラーが発生しました" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
