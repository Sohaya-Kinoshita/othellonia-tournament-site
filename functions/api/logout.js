export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // クッキーからセッションIDを取得
    const cookies = context.request.headers.get("cookie") || "";
    const sessionId = cookies
      .split("; ")
      .find((c) => c.startsWith("sessionId="))
      ?.split("=")[1];

    if (sessionId) {
      const db = context.env.DB;
      // セッションを削除
      await db
        .prepare("DELETE FROM sessions WHERE sessionId = ?")
        .bind(sessionId)
        .run();
    }

    const response = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    // クッキーを削除
    response.headers.set(
      "Set-Cookie",
      "sessionId=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax",
    );

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return new Response(
      JSON.stringify({ message: "ログアウト処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
