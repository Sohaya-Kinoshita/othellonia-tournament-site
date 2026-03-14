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

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const db = context.env.DB;
    await ensureMatchPlayerStreamPlansTable(db);
    const url = new URL(context.request.url);
    const matchId = (url.searchParams.get("matchId") || "").trim();

    if (!matchId) {
      return new Response(JSON.stringify({ message: "matchId が必要です" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // マッチ情報とチーム情報を取得
    const match = await db
      .prepare(
        `
        SELECT 
          m.match_id,
          m.team_a_id,
          m.team_b_id,
          ta.team_name as team_a_name,
          tb.team_name as team_b_name
        FROM matches m
        LEFT JOIN teams ta ON m.team_a_id = ta.team_id
        LEFT JOIN teams tb ON m.team_b_id = tb.team_id
        WHERE m.match_id = ?
      `,
      )
      .bind(matchId)
      .first();

    if (!match) {
      return new Response(
        JSON.stringify({ message: "マッチが見つかりません" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // ゲーム情報を取得
    const gamesResult = await db
      .prepare(
        `
        SELECT 
          g.game_number,
          g.player_a_id,
          g.player_b_id,
          g.player_a_score,
          g.player_b_score,
          g.winner_team_id,
          g.winner_player_id,
          pa.player_name as player_a_name,
          pa.mirrativ_id as player_a_mirrativ_id,
          COALESCE(spa.stream_status, 'undecided') as player_a_stream_status,
          spa.mirrativ_url as player_a_plan_mirrativ_url,
          COALESCE(
            spa.mirrativ_url,
            CASE
              WHEN pa.mirrativ_id IS NOT NULL
                THEN 'https://www.mirrativ.com/user/' || pa.mirrativ_id
              ELSE NULL
            END
          ) as player_a_mirrativ_url,
          pb.player_name as player_b_name,
          pb.mirrativ_id as player_b_mirrativ_id,
          COALESCE(spb.stream_status, 'undecided') as player_b_stream_status,
          spb.mirrativ_url as player_b_plan_mirrativ_url,
          COALESCE(
            spb.mirrativ_url,
            CASE
              WHEN pb.mirrativ_id IS NOT NULL
                THEN 'https://www.mirrativ.com/user/' || pb.mirrativ_id
              ELSE NULL
            END
          ) as player_b_mirrativ_url
        FROM games g
        LEFT JOIN players pa ON g.player_a_id = pa.player_id
        LEFT JOIN players pb ON g.player_b_id = pb.player_id
        LEFT JOIN match_player_stream_plans spa
          ON spa.match_id = g.match_id
         AND spa.player_id = g.player_a_id
        LEFT JOIN match_player_stream_plans spb
          ON spb.match_id = g.match_id
         AND spb.player_id = g.player_b_id
        WHERE g.match_id = ?
        ORDER BY g.game_number
      `,
      )
      .bind(matchId)
      .all();

    const games = Array.isArray(gamesResult)
      ? gamesResult
      : gamesResult?.results || [];

    const reservesResult = await db
      .prepare(
        `
        SELECT
          r.team_id,
          r.reserve_number,
          r.player_id,
          p.player_name
        FROM reserves r
        LEFT JOIN players p ON r.player_id = p.player_id
        WHERE r.match_id = ?
        ORDER BY r.team_id, r.reserve_number
      `,
      )
      .bind(matchId)
      .all();

    const reserveRows = Array.isArray(reservesResult)
      ? reservesResult
      : reservesResult?.results || [];

    const reservesByTeam = {
      [match.team_a_id]: reserveRows.filter(
        (row) => row.team_id === match.team_a_id,
      ),
      [match.team_b_id]: reserveRows.filter(
        (row) => row.team_id === match.team_b_id,
      ),
    };

    return new Response(
      JSON.stringify({
        success: true,
        match,
        games,
        reservesByTeam,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Match card fetch error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({
        message: "マッチカード取得処理でエラーが発生しました",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
