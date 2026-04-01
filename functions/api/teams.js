export async function onRequest(context) {
  // GETメソッド：チームIDで検索し、または全件返す
  if (context.request.method === "GET") {
    try {
      const db = context.env.DB;
      const url = new URL(context.request.url);
      const teamId = url.searchParams.get("team_id");
      const deletable = url.searchParams.get("deletable");

      if (teamId) {
        // 1件のみ返す
        const result = await db
          .prepare(
            `
          SELECT 
            t.team_id, 
            t.team_name, 
            lp.player_name AS leader_name, 
            sp.player_name AS subleader_name
          FROM teams t
          LEFT JOIN leaders l ON t.team_id = l.team_id AND l.leader_role = 'leader'
          LEFT JOIN players lp ON l.player_id = lp.player_id
          LEFT JOIN leaders sl ON t.team_id = sl.team_id AND sl.leader_role = 'subleader'
          LEFT JOIN players sp ON sl.player_id = sp.player_id
          WHERE t.team_id = ?
        `,
          )
          .bind(teamId)
          .first();

        if (!result) {
          return new Response(
            JSON.stringify({ message: "該当チームが見つかりません" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({
            team_id: result.team_id,
            team_name: result.team_name,
            leader_name: result.leader_name,
            subleader_name: result.subleader_name,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      } else {
        let results;
        if (deletable === "1") {
          // マッチ未参加チームのみ返す
          results = await db
            .prepare(
              `
              SELECT t.team_id, t.team_name,
                lp.player_name AS leader_name,
                sp.player_name AS subleader_name
              FROM teams t
              LEFT JOIN leaders l ON t.team_id = l.team_id AND l.leader_role = 'leader'
              LEFT JOIN players lp ON l.player_id = lp.player_id
              LEFT JOIN leaders sl ON t.team_id = sl.team_id AND sl.leader_role = 'subleader'
              LEFT JOIN players sp ON sl.player_id = sp.player_id
              WHERE NOT EXISTS (
                SELECT 1 FROM matches m
                WHERE m.team_a_id = t.team_id OR m.team_b_id = t.team_id OR m.winner_team_id = t.team_id
              )
              ORDER BY t.team_id
            `,
            )
            .all();
        } else {
          // 全件返す
          results = await db
            .prepare(
              `
              SELECT t.team_id, t.team_name,
                lp.player_name AS leader_name,
                sp.player_name AS subleader_name
              FROM teams t
              LEFT JOIN leaders l ON t.team_id = l.team_id AND l.leader_role = 'leader'
              LEFT JOIN players lp ON l.player_id = lp.player_id
              LEFT JOIN leaders sl ON t.team_id = sl.team_id AND sl.leader_role = 'subleader'
              LEFT JOIN players sp ON sl.player_id = sp.player_id
              ORDER BY t.team_id
            `,
            )
            .all();
        }
        return new Response(JSON.stringify({ teams: results.results || [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (error) {
      console.error("Team fetch error:", error);
      return new Response(
        JSON.stringify({ message: "チーム取得処理でエラーが発生しました" }),
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

      // leadersテーブルからも削除
      await db
        .prepare("DELETE FROM leaders WHERE team_id = ?")
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
    const { teamId, teamName, leaderPlayerId, subleaderPlayerId } =
      await context.request.json();

    if (!teamId || !teamName || !leaderPlayerId) {
      return new Response(
        JSON.stringify({
          message: "チームID、チーム名、リーダーのプレイヤーIDが必要です",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // リーダーのプレイヤーIDの厳密な12文字チェック
    const normalizedLeaderPlayerId = String(leaderPlayerId || "").trim();
    if (normalizedLeaderPlayerId.length !== 12) {
      return new Response(
        JSON.stringify({
          message: "リーダーのプレイヤーIDは12文字ちょうどで入力してください",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const normalizedSubleaderPlayerId = String(subleaderPlayerId || "").trim();
    const hasSubleader = Boolean(normalizedSubleaderPlayerId);
    if (hasSubleader && normalizedSubleaderPlayerId.length !== 12) {
      return new Response(
        JSON.stringify({
          message:
            "サブリーダーのプレイヤーIDは12文字ちょうどで入力してください",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (
      hasSubleader &&
      normalizedSubleaderPlayerId === normalizedLeaderPlayerId
    ) {
      return new Response(
        JSON.stringify({
          message: "リーダーとサブリーダーに同じプレイヤーIDは設定できません",
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

    // プレイヤーが存在するか確認
    const existingPlayer = await db
      .prepare("SELECT player_id, player_name FROM players WHERE player_id = ?")
      .bind(normalizedLeaderPlayerId)
      .first();

    if (!existingPlayer) {
      return new Response(
        JSON.stringify({ message: "指定されたプレイヤーIDが見つかりません" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (hasSubleader) {
      const existingSubleaderPlayer = await db
        .prepare(
          "SELECT player_id, player_name FROM players WHERE player_id = ?",
        )
        .bind(normalizedSubleaderPlayerId)
        .first();

      if (!existingSubleaderPlayer) {
        return new Response(
          JSON.stringify({
            message: "指定されたサブリーダーのプレイヤーIDが見つかりません",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // leader_idを生成（L + team_id + 00001）
    const leaderId = `L${teamId}00001`;
    const subleaderId = `L${teamId}00002`;

    // トランザクション的にチームとリーダーを作成
    try {
      // チームを作成
      await db
        .prepare("INSERT INTO teams (team_id, team_name) VALUES (?, ?)")
        .bind(teamId, teamName)
        .run();

      // リーダーを作成
      await db
        .prepare(
          "INSERT INTO leaders (leader_id, team_id, player_id, leader_role, pass) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(leaderId, teamId, normalizedLeaderPlayerId, "leader", "")
        .run();

      if (hasSubleader) {
        await db
          .prepare(
            "INSERT INTO leaders (leader_id, team_id, player_id, leader_role, pass) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            subleaderId,
            teamId,
            normalizedSubleaderPlayerId,
            "subleader",
            "",
          )
          .run();
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "チームを作成しました",
          leaderId: leaderId,
          subleaderId: hasSubleader ? subleaderId : null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (dbError) {
      console.error("Database insert error:", dbError);
      // チーム作成に失敗した場合はロールバック相当の処理
      // D1ではトランザクションがサポートされていないため、エラー時に手動でクリーンアップ
      try {
        await db
          .prepare("DELETE FROM leaders WHERE leader_id = ?")
          .bind(subleaderId)
          .run();
        await db
          .prepare("DELETE FROM leaders WHERE leader_id = ?")
          .bind(leaderId)
          .run();
        await db
          .prepare("DELETE FROM teams WHERE team_id = ?")
          .bind(teamId)
          .run();
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }

      return new Response(
        JSON.stringify({ message: "チーム作成処理でエラーが発生しました" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("Team create error:", error);
    return new Response(
      JSON.stringify({ message: "チーム作成処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
