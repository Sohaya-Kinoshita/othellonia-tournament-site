export async function onRequest(context) {
  // GETメソッド：マッチ一覧を取得
  if (context.request.method === "GET") {
    try {
      const db = context.env.DB;
      const matches = await db
        .prepare(
          `
          SELECT 
            m.match_id,
            m.team_a_id,
            m.team_b_id,
            ta.team_name as team_a_name,
            tb.team_name as team_b_name,
            m.best_of,
            m.winner_team_id,
            m.admin_user_id
          FROM matches m
          LEFT JOIN teams ta ON m.team_a_id = ta.team_id
          LEFT JOIN teams tb ON m.team_b_id = tb.team_id
          ORDER BY m.match_id
        `,
        )
        .all();

      return new Response(
        JSON.stringify({ success: true, matches: matches.results || [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Matches fetch error:", error);
      return new Response(
        JSON.stringify({ message: "マッチ一覧取得処理でエラーが発生しました" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // POSTメソッド：マッチ作成
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

    // セッションIDをデコード（admin_user_id を抽出）
    let adminUserId = "";
    try {
      const decoded = atob(sessionId);
      const [type, userId] = decoded.split(":");

      if (type !== "admin") {
        return new Response(
          JSON.stringify({ message: "管理者権限が必要です" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      adminUserId = userId;
    } catch (e) {
      return new Response(JSON.stringify({ message: "認証エラー" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // リクエストボディを解析
    const { matchId, teamAId, teamBId } = await context.request.json();

    if (!matchId || !teamAId || !teamBId) {
      return new Response(
        JSON.stringify({
          message: "マッチID、チームA ID、チームB IDが必要です",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // マッチIDが3文字か確認
    if (String(matchId).trim().length !== 3) {
      return new Response(
        JSON.stringify({
          message: "マッチIDは3文字ちょうどで入力してください",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // チームIDが同じでないか確認
    if (teamAId === teamBId) {
      return new Response(
        JSON.stringify({
          message: "チームA と チームB は異なるチームを選択してください",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const db = context.env.DB;

    // マッチが既に存在するか確認
    const existingMatch = await db
      .prepare("SELECT match_id FROM matches WHERE match_id = ?")
      .bind(matchId)
      .first();

    if (existingMatch) {
      return new Response(
        JSON.stringify({ message: "このマッチIDは既に使用されています" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // チームAが存在するか確認
    const teamA = await db
      .prepare("SELECT team_id FROM teams WHERE team_id = ?")
      .bind(teamAId)
      .first();

    if (!teamA) {
      return new Response(
        JSON.stringify({ message: "チームA が見つかりません" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // チームBが存在するか確認
    const teamB = await db
      .prepare("SELECT team_id FROM teams WHERE team_id = ?")
      .bind(teamBId)
      .first();

    if (!teamB) {
      return new Response(
        JSON.stringify({ message: "チームB が見つかりません" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // マッチを作成
    await db
      .prepare(
        `
        INSERT INTO matches (match_id, team_a_id, team_b_id, admin_user_id, best_of)
        VALUES (?, ?, ?, ?, 7)
      `,
      )
      .bind(matchId, teamAId, teamBId, adminUserId)
      .run();

    return new Response(
      JSON.stringify({ success: true, message: "マッチを作成しました" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Match creation error:", error);
    return new Response(
      JSON.stringify({ message: "マッチ作成処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
