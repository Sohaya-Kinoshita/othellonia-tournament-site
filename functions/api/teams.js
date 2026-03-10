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
            leader.leader_id,
            leader.leader_name,
            leader.player_id,
            leaderPlayer.player_name,
            subleader.leader_id AS subleader_id,
            subleader.leader_name AS subleader_name,
            subleader.player_id AS subleader_player_id,
            subleaderPlayer.player_name AS subleader_player_name
          FROM teams 
          LEFT JOIN leaders AS leader ON teams.team_id = leader.team_id AND leader.leader_role = 'leader'
          LEFT JOIN players AS leaderPlayer ON leader.player_id = leaderPlayer.player_id
          LEFT JOIN leaders AS subleader ON teams.team_id = subleader.team_id AND subleader.leader_role = 'subleader'
          LEFT JOIN players AS subleaderPlayer ON subleader.player_id = subleaderPlayer.player_id
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

      const {
        teamId,
        teamName,
        leaderName,
        leaderPlayerId,
        subleaderPlayerId,
      } = await context.request.json();

      if (!teamId || !teamName) {
        return new Response(
          JSON.stringify({
            message: "チームID、チーム名が必要です",
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

      // チーム名を更新
      await db
        .prepare("UPDATE teams SET team_name = ? WHERE team_id = ?")
        .bind(teamName, teamId)
        .run();

      // リーダー情報が提供されている場合は更新
      if (leaderName || leaderPlayerId) {
        // 既存のリーダーを取得
        const existingLeader = await db
          .prepare(
            "SELECT leader_id, leader_name, player_id FROM leaders WHERE team_id = ? AND leader_role = ?",
          )
          .bind(teamId, "leader")
          .first();

        if (!existingLeader) {
          return new Response(
            JSON.stringify({ message: "リーダーが見つかりません" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // 更新するフィールドを決定
        const updatedLeaderName = leaderName || existingLeader.leader_name;
        const updatedPlayerId = leaderPlayerId || existingLeader.player_id;

        // プレイヤーIDが変更される場合、存在チェック
        if (leaderPlayerId && leaderPlayerId !== existingLeader.player_id) {
          const normalizedLeaderPlayerId = String(leaderPlayerId || "").trim();
          if (normalizedLeaderPlayerId.length !== 12) {
            return new Response(
              JSON.stringify({
                message:
                  "リーダーのプレイヤーIDは12文字ちょうどで入力してください",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const playerExists = await db
            .prepare("SELECT player_id FROM players WHERE player_id = ?")
            .bind(normalizedLeaderPlayerId)
            .first();

          if (!playerExists) {
            return new Response(
              JSON.stringify({
                message: "指定されたプレイヤーIDが見つかりません",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        }

        let updateQuery = "UPDATE leaders SET leader_name = ?, player_id = ?";
        const updateParams = [updatedLeaderName, updatedPlayerId];

        updateQuery += " WHERE leader_id = ?";
        updateParams.push(existingLeader.leader_id);

        await db
          .prepare(updateQuery)
          .bind(...updateParams)
          .run();
      }

      // サブリーダー情報が提供されている場合は追加/更新
      const shouldHandleSubleader = Boolean(subleaderPlayerId);
      if (shouldHandleSubleader) {
        const existingSubleader = await db
          .prepare(
            "SELECT leader_id, leader_name, player_id FROM leaders WHERE team_id = ? AND leader_role = ?",
          )
          .bind(teamId, "subleader")
          .first();

        const normalizedSubleaderPlayerId = String(
          subleaderPlayerId || "",
        ).trim();
        if (normalizedSubleaderPlayerId.length !== 12) {
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

        const subleaderPlayer = await db
          .prepare(
            "SELECT player_id, player_name FROM players WHERE player_id = ?",
          )
          .bind(normalizedSubleaderPlayerId)
          .first();

        if (!subleaderPlayer) {
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

        const subleaderName = subleaderPlayer.player_name;

        if (!existingSubleader) {
          const subleaderId = `L${teamId}00002`;
          await db
            .prepare(
              "INSERT INTO leaders (leader_id, team_id, player_id, leader_role, pass, leader_name) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(
              subleaderId,
              teamId,
              normalizedSubleaderPlayerId,
              "subleader",
              "",
              subleaderName,
            )
            .run();
        } else {
          await db
            .prepare(
              "UPDATE leaders SET leader_name = ?, player_id = ? WHERE leader_id = ?",
            )
            .bind(
              subleaderName,
              normalizedSubleaderPlayerId,
              existingSubleader.leader_id,
            )
            .run();
        }
      }

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
    const { teamId, teamName, leaderName, leaderPlayerId, subleaderPlayerId } =
      await context.request.json();

    if (!teamId || !teamName || !leaderName || !leaderPlayerId) {
      return new Response(
        JSON.stringify({
          message:
            "チームID、チーム名、リーダー氏名、リーダーのプレイヤーIDが必要です",
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
    let resolvedSubleaderName = null;
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
      .prepare("SELECT player_id FROM players WHERE player_id = ?")
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

      // サブリーダー名はプレイヤーテーブルの名前を使用
      resolvedSubleaderName = existingSubleaderPlayer.player_name;
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
          "INSERT INTO leaders (leader_id, team_id, player_id, leader_role, pass, leader_name) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          leaderId,
          teamId,
          normalizedLeaderPlayerId,
          "leader",
          "",
          leaderName,
        )
        .run();

      if (hasSubleader) {
        await db
          .prepare(
            "INSERT INTO leaders (leader_id, team_id, player_id, leader_role, pass, leader_name) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(
            subleaderId,
            teamId,
            normalizedSubleaderPlayerId,
            "subleader",
            "",
            resolvedSubleaderName,
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
