function extractMirrativId(url) {
  if (!url) return null;

  // URLデコード
  const decoded = decodeURIComponent(url);

  // user/数字 のパターンで数字を抽出
  const match = decoded.match(/user\/(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  return null;
}

export async function onRequest(context) {
  if (context.request.method === "GET") {
    try {
      const db = context.env.DB;
      const players = await db
        .prepare(
          `
          SELECT
            players.player_id,
            players.player_name,
            players.mirrativ_id,
            COALESCE(GROUP_CONCAT(teams.team_name, ' / '), '') AS team_names
          FROM players
          LEFT JOIN team_members ON players.player_id = team_members.player_id
          LEFT JOIN teams ON team_members.team_id = teams.team_id
          GROUP BY players.player_id, players.player_name
          ORDER BY players.player_id
          `,
        )
        .all();

      const playersWithUrls = (players.results || []).map((player) => ({
        ...player,
        mirrativ_url: player.mirrativ_id
          ? `https://www.mirrativ.com/user/${player.mirrativ_id}`
          : null,
      }));

      return new Response(
        JSON.stringify({ success: true, players: playersWithUrls }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Players fetch error:", error);
      return new Response(
        JSON.stringify({
          message: "プレイヤー一覧取得処理でエラーが発生しました",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  if (context.request.method === "PUT") {
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

      const { playerId, playerName, mirrativUrl } =
        await context.request.json();
      const normalizedPlayerId = String(playerId || "").trim();
      const normalizedPlayerName = String(playerName || "").trim();
      const rawMirrativUrl = String(mirrativUrl || "").trim();
      const normalizedMirrativId = rawMirrativUrl
        ? extractMirrativId(rawMirrativUrl)
        : null;

      if (!normalizedPlayerId) {
        return new Response(
          JSON.stringify({ message: "プレイヤーIDが必要です" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (normalizedPlayerId.length !== 12) {
        return new Response(
          JSON.stringify({
            message: "プレイヤーIDは12文字ちょうどで入力してください",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (normalizedPlayerName && normalizedPlayerName.length > 10) {
        return new Response(
          JSON.stringify({
            message: "プレイヤー名は10文字以下で入力してください",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const db = context.env.DB;
      const existingPlayer = await db
        .prepare("SELECT player_id FROM players WHERE player_id = ?")
        .bind(normalizedPlayerId)
        .first();

      if (!existingPlayer) {
        return new Response(
          JSON.stringify({ message: "プレイヤーが見つかりません" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (normalizedPlayerName) {
        await db
          .prepare("UPDATE players SET player_name = ? WHERE player_id = ?")
          .bind(normalizedPlayerName, normalizedPlayerId)
          .run();
      }

      await db
        .prepare("UPDATE players SET mirrativ_id = ? WHERE player_id = ?")
        .bind(normalizedMirrativId, normalizedPlayerId)
        .run();

      return new Response(
        JSON.stringify({
          success: true,
          message: "プレイヤー名を更新しました",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Player update error:", error);
      return new Response(
        JSON.stringify({ message: "プレイヤー更新処理でエラーが発生しました" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

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

      const { playerId } = await context.request.json();
      const normalizedPlayerId = String(playerId || "").trim();

      if (!normalizedPlayerId) {
        return new Response(
          JSON.stringify({ message: "プレイヤーIDが必要です" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const db = context.env.DB;
      const existingPlayer = await db
        .prepare("SELECT player_id FROM players WHERE player_id = ?")
        .bind(normalizedPlayerId)
        .first();

      if (!existingPlayer) {
        return new Response(
          JSON.stringify({ message: "プレイヤーが見つかりません" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const leaderTeams = await db
        .prepare(
          "SELECT team_id, team_name FROM teams WHERE team_reader = ? ORDER BY team_id",
        )
        .bind(normalizedPlayerId)
        .all();

      const leaderTeamList = leaderTeams.results || [];
      if (leaderTeamList.length > 0) {
        const teamLabels = leaderTeamList
          .map((team) => `${team.team_id}-${team.team_name}`)
          .join(" / ");
        return new Response(
          JSON.stringify({
            message: `チームリーダーに設定されているため削除できません（${teamLabels}）`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      await db
        .prepare("DELETE FROM team_members WHERE player_id = ?")
        .bind(normalizedPlayerId)
        .run();

      await db
        .prepare("DELETE FROM players WHERE player_id = ?")
        .bind(normalizedPlayerId)
        .run();

      return new Response(
        JSON.stringify({ success: true, message: "プレイヤーを削除しました" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Player delete error:", error);
      return new Response(
        JSON.stringify({ message: "プレイヤー削除処理でエラーが発生しました" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

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
    const { playerId, playerName, mirrativUrl } = await context.request.json();
    const normalizedPlayerId = String(playerId || "").trim();
    const normalizedPlayerName = String(playerName || "").trim();
    const rawMirrativUrl = String(mirrativUrl || "").trim();
    const normalizedMirrativId = rawMirrativUrl
      ? extractMirrativId(rawMirrativUrl)
      : null;

    if (!normalizedPlayerId || !normalizedPlayerName) {
      return new Response(
        JSON.stringify({ message: "プレイヤーID、プレイヤー名が必要です" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (normalizedPlayerId.length !== 12) {
      return new Response(
        JSON.stringify({
          message: "プレイヤーIDは12文字ちょうどで入力してください",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const db = context.env.DB;

    // プレイヤーが既に存在するか確認
    const existingPlayer = await db
      .prepare("SELECT player_id FROM players WHERE player_id = ?")
      .bind(normalizedPlayerId)
      .first();

    if (existingPlayer) {
      return new Response(
        JSON.stringify({ message: "このプレイヤーIDは既に存在します" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // プレイヤーを作成
    await db
      .prepare(
        "INSERT INTO players (player_id, player_name, mirrativ_id) VALUES (?, ?, ?)",
      )
      .bind(normalizedPlayerId, normalizedPlayerName, normalizedMirrativId)
      .run();

    return new Response(
      JSON.stringify({ success: true, message: "プレイヤーを作成しました" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Player creation error:", error);
    return new Response(
      JSON.stringify({ message: "プレイヤー作成処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
