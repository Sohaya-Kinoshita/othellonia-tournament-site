// 管理者（司会進行者）更新API: PATCH /api/match_admins
export async function onRequestPatch(context) {
  const db = context.env.DB;
  try {
    // 認証（管理者のみ許可）
    const cookies = context.request.headers.get("cookie") || "";
    const sessionId = cookies
      .split("; ")
      .find((c) => c.startsWith("sessionId="))
      ?.split("=")[1];
    if (!sessionId) {
      return new Response(JSON.stringify({ message: "認証が必要です" }), {
        status: 401,
      });
    }
    let adminUserId = "";
    try {
      const decoded = atob(sessionId);
      const [type, userId] = decoded.split(":");
      if (type !== "admin") {
        return new Response(
          JSON.stringify({ message: "管理者権限が必要です" }),
          { status: 403 },
        );
      }
      adminUserId = userId;
    } catch (e) {
      return new Response(JSON.stringify({ message: "認証エラー" }), {
        status: 401,
      });
    }

    // リクエストボディ
    const { matchId, adminUserIds } = await context.request.json();
    if (!matchId || !Array.isArray(adminUserIds)) {
      return new Response(
        JSON.stringify({ message: "matchIdとadminUserIdsが必要です" }),
        { status: 400 },
      );
    }

    // 既存の管理者を全削除
    await db
      .prepare("DELETE FROM match_admins WHERE match_id = ?")
      .bind(matchId)
      .run();
    // 新しい管理者を追加
    for (const userId of adminUserIds) {
      await db
        .prepare(
          "INSERT INTO match_admins (match_id, admin_user_id) VALUES (?, ?)",
        )
        .bind(matchId, userId)
        .run();
    }

    return new Response(
      JSON.stringify({ success: true, message: "管理者を更新しました" }),
      { status: 200 },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ message: e.message || "管理者更新に失敗しました" }),
      { status: 500 },
    );
  }
}
