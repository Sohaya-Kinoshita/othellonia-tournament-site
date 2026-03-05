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
            COALESCE(GROUP_CONCAT(teams.team_name, ' / '), '') AS team_names
          FROM players
          LEFT JOIN team_members ON players.player_id = team_members.player_id
          LEFT JOIN teams ON team_members.team_id = teams.team_id
          GROUP BY players.player_id, players.player_name
          ORDER BY players.player_id
          `,
        )
        .all();

      return new Response(
        JSON.stringify({ success: true, players: players.results || [] }),
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
    const { playerId, playerName } = await context.request.json();
    const normalizedPlayerId = String(playerId || "").trim();
    const normalizedPlayerName = String(playerName || "").trim();

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
      .prepare("INSERT INTO players (player_id, player_name) VALUES (?, ?)")
      .bind(normalizedPlayerId, normalizedPlayerName)
      .run();

    return new Response(
      JSON.stringify({ success: true, message: "参加者を作成しました" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Player creation error:", error);
    return new Response(
      JSON.stringify({ message: "参加者作成処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
