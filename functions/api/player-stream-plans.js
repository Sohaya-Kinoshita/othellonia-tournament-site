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

    const auth = decodePlayerSession(context.request);
    if (!auth.ok) {
      return new Response(JSON.stringify({ message: auth.message }), {
        status: auth.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const playerId = auth.playerId;

    if (context.request.method === "GET") {
      const rows = await db
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
            AND m.scheduled_at IS NOT NULL
          ORDER BY m.scheduled_at, m.match_id
        `,
        )
        .bind(playerId, playerId, playerId, playerId)
        .all();

      return new Response(
        JSON.stringify({ success: true, plans: rows.results || [] }),
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

      const assignment = await db
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
