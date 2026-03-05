export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const db = context.env.DB;
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
          tb.team_name as team_b_name,
          m.scheduled_at
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
    const games = await db
      .prepare(
        `
        SELECT 
          g.game_number,
          g.player_a_id,
          g.player_b_id,
          pa.player_name as player_a_name,
          pa.mirrativ_id as player_a_mirrativ_id,
          pb.player_name as player_b_name,
          pb.mirrativ_id as player_b_mirrativ_id
        FROM games g
        LEFT JOIN players pa ON g.player_a_id = pa.player_id
        LEFT JOIN players pb ON g.player_b_id = pb.player_id
        WHERE g.match_id = ?
        ORDER BY g.game_number
      `,
      )
      .bind(matchId)
      .all();

    return new Response(
      JSON.stringify({
        success: true,
        match,
        games: games.results || [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Match card fetch error:", error);
    return new Response(
      JSON.stringify({ message: "マッチカード取得処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
