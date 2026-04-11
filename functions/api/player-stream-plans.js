async function ensureMatchPlayerStreamPlansTable(db) {
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS match_player_stream_plans (
        match_id CHAR(3) NOT NULL,
        player_id CHAR(12) NOT NULL,
        stream_status TEXT NOT NULL DEFAULT 'undecided' CHECK(stream_status IN ('available', 'unavailable', 'undecided')),
        mirrativ_url TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (match_id, player_id),
        FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `,
    )
    .run();
}

async function ensureMatchesStatusColumn(db) {
  try {
    await db.prepare("ALTER TABLE matches ADD COLUMN status TEXT").run();
  } catch (_error) {
    // 既に存在する場合は何もしない
  }
}

function decodePlayerSession(request) {
  const cookies = request.headers.get("cookie") || "";
  const sessionId = cookies
    .split("; ")
    .find((c) => c.startsWith("sessionId="))
    ?.split("=")[1];

  if (!sessionId) {
    return { ok: false, status: 401, message: "認証が必要です" };
  }

  try {
    const decoded = atob(sessionId);
    const [type, playerId] = decoded.split(":");
    if (type !== "player" || !playerId) {
      return { ok: false, status: 403, message: "プレイヤー権限が必要です" };
    }
    return { ok: true, playerId };
  } catch (_error) {
    return { ok: false, status: 401, message: "認証エラー" };
  }
}

function isValidStreamStatus(value) {
  return ["available", "unavailable", "undecided"].includes(value);
}

export async function onRequest(context) {
  try {
    const db = context.env.DB;
    await ensureMatchPlayerStreamPlansTable(db);
    await ensureMatchesStatusColumn(db);

    const auth = decodePlayerSession(context.request);
    if (!auth.ok) {
      return new Response(JSON.stringify({ message: auth.message }), {
        status: auth.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const playerId = auth.playerId;

    if (context.request.method === "GET") {
      const playerRow = await db
        .prepare("SELECT mirrativ_id FROM players WHERE player_id = ?")
        .bind(playerId)
        .first();
      const myMirrativId = playerRow?.mirrativ_id || null;

      const rowsFromGames = await db
        .prepare(
          `
          SELECT DISTINCT
            m.match_id,
            m.scheduled_at,
            ta.team_name AS team_a_name,
            tb.team_name AS team_b_name,
            CASE
              WHEN g.player_a_id = ? THEN pb.player_name
              ELSE pa.player_name
            END AS opponent_player_name,
            COALESCE(sp.stream_status, 'undecided') AS stream_status,
            sp.mirrativ_url,
            sp.updated_at
          FROM games g
          INNER JOIN matches m ON m.match_id = g.match_id
          LEFT JOIN teams ta ON ta.team_id = m.team_a_id
          LEFT JOIN teams tb ON tb.team_id = m.team_b_id
          LEFT JOIN players pa ON pa.player_id = g.player_a_id
          LEFT JOIN players pb ON pb.player_id = g.player_b_id
          LEFT JOIN match_player_stream_plans sp
            ON sp.match_id = m.match_id
           AND sp.player_id = ?
          WHERE (g.player_a_id = ? OR g.player_b_id = ?)
            AND m.winner_team_id IS NULL
            AND (m.status IS NULL OR m.status <> 'finished')
            AND m.scheduled_at IS NOT NULL
          ORDER BY m.scheduled_at, m.match_id
        `,
        )
        .bind(playerId, playerId, playerId, playerId)
        .all();

      const rowsFromOrders = await db
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
          SELECT DISTINCT
            m.match_id,
            m.scheduled_at,
            ta.team_name AS team_a_name,
            tb.team_name AS team_b_name,
            opp_p.player_name AS opponent_player_name,
            COALESCE(sp.stream_status, 'undecided') AS stream_status,
            sp.mirrativ_url,
            sp.updated_at
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
          LEFT JOIN players opp_p ON opp_p.player_id = opp_od.player_id
          LEFT JOIN teams ta ON ta.team_id = m.team_a_id
          LEFT JOIN teams tb ON tb.team_id = m.team_b_id
          LEFT JOIN match_player_stream_plans sp
            ON sp.match_id = m.match_id
           AND sp.player_id = ?
          WHERE my_od.player_id = ?
            AND m.winner_team_id IS NULL
            AND (m.status IS NULL OR m.status <> 'finished')
            AND m.scheduled_at IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
              FROM games g
              WHERE g.match_id = m.match_id
                AND (g.player_a_id = ? OR g.player_b_id = ?)
            )
          ORDER BY m.scheduled_at, m.match_id
        `,
        )
        .bind(playerId, playerId, playerId, playerId)
        .all();

      const rowMap = new Map();
      [
        ...(rowsFromGames.results || []),
        ...(rowsFromOrders.results || []),
      ].forEach((row) => {
        if (!rowMap.has(row.match_id)) {
          rowMap.set(row.match_id, row);
        }
      });

      const rows = Array.from(rowMap.values()).sort((a, b) => {
        const aTime = a.scheduled_at
          ? Date.parse(String(a.scheduled_at).replace(" ", "T"))
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.scheduled_at
          ? Date.parse(String(b.scheduled_at).replace(" ", "T"))
          : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return String(a.match_id).localeCompare(String(b.match_id));
      });

      return new Response(
        JSON.stringify({
          success: true,
          plans: rows,
          mirrativId: myMirrativId,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (context.request.method === "PUT") {
      const body = await context.request.json();
      const matchId = String(body.matchId || "").trim();
      const streamStatus = String(body.streamStatus || "").trim();
      const mirrativUrl = String(body.mirrativUrl || "").trim();

      if (!matchId) {
        return new Response(JSON.stringify({ message: "matchId が必要です" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!isValidStreamStatus(streamStatus)) {
        return new Response(
          JSON.stringify({ message: "streamStatus が不正です" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      let assignment = await db
        .prepare(
          `
          SELECT 1
          FROM games
          WHERE match_id = ?
            AND (player_a_id = ? OR player_b_id = ?)
          LIMIT 1
        `,
        )
        .bind(matchId, playerId, playerId)
        .first();

      if (!assignment) {
        assignment = await db
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
            )
            SELECT 1
            FROM latest_confirmed_orders lco
            INNER JOIN order_details od ON od.order_id = lco.order_id
            WHERE lco.match_id = ?
              AND od.player_id = ?
            LIMIT 1
          `,
          )
          .bind(matchId, playerId)
          .first();
      }

      if (!assignment) {
        return new Response(
          JSON.stringify({ message: "このマッチの登録権限がありません" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const normalizedUrl =
        streamStatus === "available" && mirrativUrl ? mirrativUrl : null;

      await db
        .prepare(
          `
          INSERT INTO match_player_stream_plans (
            match_id,
            player_id,
            stream_status,
            mirrativ_url,
            updated_at
          )
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(match_id, player_id)
          DO UPDATE SET
            stream_status = excluded.stream_status,
            mirrativ_url = excluded.mirrativ_url,
            updated_at = datetime('now')
        `,
        )
        .bind(matchId, playerId, streamStatus, normalizedUrl)
        .run();

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Player stream plans error:", error);
    return new Response(
      JSON.stringify({ message: "配信予定の処理に失敗しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
