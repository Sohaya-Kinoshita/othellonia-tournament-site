// チーム検索用API
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const keyword = url.searchParams.get("keyword") || "";

  // DB接続例（適宜修正）
  const conn = env.DB ? await env.DB.getConnection() : null;
  let teams = [];
  try {
    if (conn) {
      // SQLインジェクション対策でプリペアドステートメントを使う
      const [rows] = await conn.execute(
        "SELECT * FROM teams WHERE name LIKE ? ORDER BY id ASC",
        [`%${keyword}%`],
      );
      teams = rows;
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: "DB error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    if (conn) await conn.close();
  }

  return new Response(JSON.stringify({ teams }), {
    headers: { "Content-Type": "application/json" },
  });
}
