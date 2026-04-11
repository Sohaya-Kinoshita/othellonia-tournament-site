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
    await ensureMatchesStatusColumn(db);

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

    const statsRow = await db
      .prepare(
        `
        SELECT
          COUNT(*) AS total_games,
          SUM(CASE WHEN g.winner_player_id = ? THEN 1 ELSE 0 END) AS wins
        FROM games g
        WHERE (g.player_a_id = ? OR g.player_b_id = ?)
          AND g.winner_player_id IS NOT NULL
      `,
      )
      .bind(playerId, playerId, playerId)
      .first();

    const totalGames = Number(statsRow?.total_games || 0);
    const wins = Number(statsRow?.wins || 0);
    const losses = totalGames - wins;
    const winRate =
      totalGames > 0 ? Math.round((wins / totalGames) * 1000) / 10 : null;

    // 対戦相手情報: まず games 作成済みデータを取得
    const opponentsFromGames = await db
      .prepare(
        `
        SELECT
          m.match_id,
          m.scheduled_at,
          g.game_number,
          g.battle_mode,
          CASE
            WHEN g.player_a_id = ? THEN ta.team_name
            ELSE tb.team_name
          END AS my_team_name,
          CASE
            WHEN g.player_a_id = ? THEN tb.team_name
            ELSE ta.team_name
          END AS opponent_team_name,
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
        LEFT JOIN teams ta ON ta.team_id = m.team_a_id
        LEFT JOIN teams tb ON tb.team_id = m.team_b_id
        LEFT JOIN players pa ON pa.player_id = g.player_a_id
        LEFT JOIN players pb ON pb.player_id = g.player_b_id
        WHERE (g.player_a_id = ? OR g.player_b_id = ?)
          AND m.winner_team_id IS NULL
          AND (m.status IS NULL OR m.status <> 'finished')
        ORDER BY m.scheduled_at, m.match_id, g.game_number
      `,
      )
      .bind(playerId, playerId, playerId, playerId, playerId, playerId)
      .all();

    // games 未生成でも、両チーム確定済み order_details から次の対戦相手を取得
    const opponentsFromOrders = await db
      .prepare(
        `
        WITH latest_confirmed_orders AS (
          SELECT o.match_id, o.team_id, o.order_id
          FROM orders o
          INNER JOIN (
            SELECT match_id, team_id, MAX(order_id) AS max_order_id
            FROM orders
            WHERE confirmed_at IS NOT NULL
            GROUP BY match_id, team_id
          ) latest
            ON latest.match_id = o.match_id
           AND latest.team_id = o.team_id
           AND latest.max_order_id = o.order_id
        ),
        confirmed_matches AS (
          SELECT lco.match_id
          FROM latest_confirmed_orders lco
          GROUP BY lco.match_id
          HAVING COUNT(DISTINCT lco.team_id) >= 2
        )
        SELECT
          m.match_id,
          m.scheduled_at,
          my_od.game_number,
          CASE WHEN my_od.game_number <= 3 THEN 'S' ELSE 'G' END AS battle_mode,
          CASE
            WHEN m.team_a_id = my_od.team_id THEN ta.team_name
            ELSE tb.team_name
          END AS my_team_name,
          CASE
            WHEN m.team_a_id = my_od.team_id THEN tb.team_name
            ELSE ta.team_name
          END AS opponent_team_name,
          opp_od.player_id AS opponent_player_id,
          opp_p.player_name AS opponent_player_name
        FROM confirmed_matches cm
        INNER JOIN matches m ON m.match_id = cm.match_id
        INNER JOIN latest_confirmed_orders my_o
          ON my_o.match_id = m.match_id
        INNER JOIN order_details my_od
          ON my_od.order_id = my_o.order_id
        INNER JOIN latest_confirmed_orders opp_o
          ON opp_o.match_id = m.match_id
         AND opp_o.team_id <> my_o.team_id
        INNER JOIN order_details opp_od
          ON opp_od.order_id = opp_o.order_id
         AND opp_od.game_number = my_od.game_number
        LEFT JOIN teams ta ON ta.team_id = m.team_a_id
        LEFT JOIN teams tb ON tb.team_id = m.team_b_id
        LEFT JOIN players opp_p ON opp_p.player_id = opp_od.player_id
        WHERE my_od.player_id = ?
          AND m.winner_team_id IS NULL
          AND (m.status IS NULL OR m.status <> 'finished')
          AND NOT EXISTS (
            SELECT 1
            FROM games g
            WHERE g.match_id = m.match_id
              AND g.game_number = my_od.game_number
              AND (g.player_a_id = ? OR g.player_b_id = ?)
          )
        ORDER BY m.scheduled_at, m.match_id, my_od.game_number
      `,
      )
      .bind(playerId, playerId, playerId)
      .all();

    const opponentMap = new Map();
    [
      ...(opponentsFromGames.results || []),
      ...(opponentsFromOrders.results || []),
    ].forEach((row) => {
      const key = `${row.match_id}:${row.game_number}`;
      if (!opponentMap.has(key)) {
        opponentMap.set(key, row);
      }
    });

    const opponents = Array.from(opponentMap.values()).sort((a, b) => {
      const aTime = a.scheduled_at
        ? Date.parse(String(a.scheduled_at).replace(" ", "T"))
        : Number.MAX_SAFE_INTEGER;
      const bTime = b.scheduled_at
        ? Date.parse(String(b.scheduled_at).replace(" ", "T"))
        : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      if (a.match_id !== b.match_id)
        return String(a.match_id).localeCompare(String(b.match_id));
      return Number(a.game_number || 0) - Number(b.game_number || 0);
    });

    return new Response(
      JSON.stringify({
        success: true,
        player: {
          playerId: player.player_id,
          playerName: player.player_name,
        },
        personalStats: {
          totalGames,
          wins,
          losses,
          winRate,
        },
        teams: teams.results || [],
        opponents,
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

async function ensureMatchesStatusColumn(db) {
  try {
    await db.prepare("ALTER TABLE matches ADD COLUMN status TEXT").run();
  } catch (_error) {
    // 既に存在する場合は何もしない
  }
}
