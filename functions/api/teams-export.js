// 新しいチーム出力用API
export async function onRequest(context) {
  if (context.request.method === "GET") {
    try {
      const db = context.env.DB;
      // チームID・チーム名・リーダー・サブリーダーのみを全件返す
      const results = await db
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
        ORDER BY t.team_id
      `,
        )
        .all();
      return new Response(JSON.stringify({ teams: results.results || [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ message: "チーム出力APIでエラーが発生しました" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } else {
    return new Response(JSON.stringify({ message: "GETメソッドのみ対応" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
}
