export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

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

    let type;
    let playerId;
    try {
      const decoded = atob(sessionId);
      [type, playerId] = decoded.split(":");
    } catch (_e) {
      return new Response(JSON.stringify({ message: "認証エラー" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (type !== "player" || !playerId) {
      return new Response(
        JSON.stringify({ message: "プレイヤー権限が必要です" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const db = context.env.DB;

    const player = await db
      .prepare("SELECT player_id, player_name FROM players WHERE player_id = ?")
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

    const teams = await db
      .prepare(
        `
        SELECT DISTINCT t.team_id, t.team_name
        FROM teams t
        INNER JOIN team_members tm ON t.team_id = tm.team_id
        WHERE tm.player_id = ?
        ORDER BY t.team_id
      `,
      )
      .bind(playerId)
      .all();

    // 確定済み対戦（games作成済み）から、プレイヤー本人の対戦相手を取得
    const opponents = await db
      .prepare(
        `
        SELECT
          m.match_id,
          m.scheduled_at,
          g.game_number,
          CASE
            WHEN g.player_a_id = ? THEN g.player_b_id
            ELSE g.player_a_id
          END AS opponent_player_id,
          CASE
            WHEN g.player_a_id = ? THEN pb.player_name
            ELSE pa.player_name
          END AS opponent_player_name
        FROM games g
        INNER JOIN matches m ON m.match_id = g.match_id
        LEFT JOIN players pa ON pa.player_id = g.player_a_id
        LEFT JOIN players pb ON pb.player_id = g.player_b_id
        WHERE g.player_a_id = ? OR g.player_b_id = ?
        ORDER BY m.scheduled_at DESC, m.match_id, g.game_number
      `,
      )
      .bind(playerId, playerId, playerId, playerId)
      .all();

    return new Response(
      JSON.stringify({
        success: true,
        player: {
          playerId: player.player_id,
          playerName: player.player_name,
        },
        teams: teams.results || [],
        opponents: opponents.results || [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Player teams error:", error);
    return new Response(
      JSON.stringify({ message: "所属チーム情報の取得に失敗しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
