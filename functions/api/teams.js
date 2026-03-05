export async function onRequest(context) {
  // GETメソッド：チーム一覧を取得
  if (context.request.method === "GET") {
    try {
      const db = context.env.DB;
      const teams = await db
        .prepare(
          `
          SELECT 
            teams.team_id, 
            teams.team_name, 
            teams.team_reader,
            players.player_name
          FROM teams 
          LEFT JOIN players ON teams.team_reader = players.player_id 
          ORDER BY teams.team_id
        `,
        )
        .all();

      return new Response(
        JSON.stringify({ success: true, teams: teams.results || [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Teams fetch error:", error);
      return new Response(
        JSON.stringify({ message: "チーム一覧取得処理でエラーが発生しました" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // PUTメソッド：チーム情報を更新
  if (context.request.method === "PUT") {
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

      const { teamId, teamName, teamReader } = await context.request.json();

      if (!teamId || !teamName || !teamReader) {
        return new Response(
          JSON.stringify({
            message: "チームID、チーム名、チームリーダーIDが必要です",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // チームリーダーIDの厳密な12文字チェック
      const normalizedTeamReader = String(teamReader || "").trim();
      if (normalizedTeamReader.length !== 12) {
        return new Response(
          JSON.stringify({
            message: "チームリーダーIDは12文字ちょうどで入力してください",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const db = context.env.DB;

      // チームが存在するか確認
      const existingTeam = await db
        .prepare("SELECT team_id FROM teams WHERE team_id = ?")
        .bind(teamId)
        .first();

      if (!existingTeam) {
        return new Response(
          JSON.stringify({ message: "チームが見つかりません" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // チームを更新
      await db
        .prepare(
          "UPDATE teams SET team_name = ?, team_reader = ? WHERE team_id = ?",
        )
        .bind(teamName, normalizedTeamReader, teamId)
        .run();

      return new Response(
        JSON.stringify({ success: true, message: "チームを更新しました" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Team update error:", error);
      return new Response(
        JSON.stringify({ message: "チーム更新処理でエラーが発生しました" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // DELETEメソッド：チームを削除
  if (context.request.method === "DELETE") {
    try {
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

      const { teamId } = await context.request.json();
      const normalizedTeamId = String(teamId || "").trim();

      if (!normalizedTeamId) {
        return new Response(JSON.stringify({ message: "チームIDが必要です" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const db = context.env.DB;
      const existingTeam = await db
        .prepare("SELECT team_id FROM teams WHERE team_id = ?")
        .bind(normalizedTeamId)
        .first();

      if (!existingTeam) {
        return new Response(
          JSON.stringify({ message: "チームが見つかりません" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const relatedMatches = await db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM matches
           WHERE team_a_id = ? OR team_b_id = ? OR winner_team_id = ?`,
        )
        .bind(normalizedTeamId, normalizedTeamId, normalizedTeamId)
        .first();

      if ((relatedMatches?.count || 0) > 0) {
        return new Response(
          JSON.stringify({
            message: "試合データで使用中のため、このチームは削除できません",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      await db
        .prepare("DELETE FROM team_members WHERE team_id = ?")
        .bind(normalizedTeamId)
        .run();

      await db
        .prepare("DELETE FROM teams WHERE team_id = ?")
        .bind(normalizedTeamId)
        .run();

      return new Response(
        JSON.stringify({ success: true, message: "チームを削除しました" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Team delete error:", error);
      return new Response(
        JSON.stringify({ message: "チーム削除処理でエラーが発生しました" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // POSTメソッド：チーム作成（既存の処理）
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

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

    // セッションIDをデコード
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

    // リクエストボディを解析
    const { teamId, teamName, teamReader } = await context.request.json();

    if (!teamId || !teamName || !teamReader) {
      return new Response(
        JSON.stringify({
          message: "チームID、チーム名、チームリーダーIDが必要です",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // チームリーダーIDの厳密な12文字チェック
    const normalizedTeamReader = String(teamReader || "").trim();
    if (normalizedTeamReader.length !== 12) {
      return new Response(
        JSON.stringify({
          message: "チームリーダーIDは12文字ちょうどで入力してください",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const db = context.env.DB;

    // チームが既に存在するか確認
    const existingTeam = await db
      .prepare("SELECT team_id FROM teams WHERE team_id = ?")
      .bind(teamId)
      .first();

    if (existingTeam) {
      return new Response(
        JSON.stringify({ message: "このチームIDは既に存在します" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // チームを作成
    await db
      .prepare(
        "INSERT INTO teams (team_id, team_name, team_reader) VALUES (?, ?, ?)",
      )
      .bind(teamId, teamName, normalizedTeamReader)
      .run();

    return new Response(
      JSON.stringify({ success: true, message: "チームを作成しました" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Team creation error:", error);
    return new Response(
      JSON.stringify({ message: "チーム作成処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
