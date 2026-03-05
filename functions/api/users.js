export async function onRequest(context) {
  // GETメソッド：ユーザー一覧を取得
  if (context.request.method === "GET") {
    try {
      const db = context.env.DB;
      const users = await db
        .prepare(
          `
          SELECT 
            user_id,
            user_name
          FROM users
          ORDER BY user_id
        `,
        )
        .all();

      return new Response(
        JSON.stringify({ success: true, users: users.results || [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Users fetch error:", error);
      return new Response(
        JSON.stringify({ message: "ユーザー一覧取得処理でエラーが発生しました" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  return new Response(JSON.stringify({ message: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
