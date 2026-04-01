// 管理者（司会進行者）API
// GET /api/match_admins?matchId=xxx : 指定マッチの管理者一覧取得
// PATCH /api/match_admins         : 指定マッチの管理者一覧を更新

export async function onRequestGet(context) {
  const db = context.env.DB;
  try {
    const auth = getAdminUserIdFromRequest(context.request);
    if (!auth.ok) {
      return new Response(JSON.stringify({ message: auth.message }), {
        status: auth.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(context.request.url);
    const matchId = (url.searchParams.get("matchId") || "").trim();
    if (!matchId) {
      return new Response(JSON.stringify({ message: "matchIdが必要です" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const adminColumn = await getMatchAdminsUserColumn(db);
    const rows = await db
      .prepare(
        `
          SELECT ma.${adminColumn} AS user_id, u.user_name
          FROM match_admins ma
          LEFT JOIN users u ON u.user_id = ma.${adminColumn}
          WHERE ma.match_id = ?
          ORDER BY ma.${adminColumn}
        `,
      )
      .bind(matchId)
      .all();

    return new Response(
      JSON.stringify({
        success: true,
        matchId,
        admins: rows.results || [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ message: e.message || "管理者取得に失敗しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function onRequestPatch(context) {
  const db = context.env.DB;
  try {
    const auth = getAdminUserIdFromRequest(context.request);
    if (!auth.ok) {
      return new Response(JSON.stringify({ message: auth.message }), {
        status: auth.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { matchId, adminUserIds } = await context.request.json();
    if (!matchId || !Array.isArray(adminUserIds)) {
      return new Response(
        JSON.stringify({ message: "matchIdとadminUserIdsが必要です" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const normalizedUserIds = [
      ...new Set(adminUserIds.map((v) => String(v).trim()).filter(Boolean)),
    ];
    const adminColumn = await getMatchAdminsUserColumn(db);

    await db
      .prepare("DELETE FROM match_admins WHERE match_id = ?")
      .bind(matchId)
      .run();

    for (const userId of normalizedUserIds) {
      await db
        .prepare(
          `INSERT INTO match_admins (match_id, ${adminColumn}) VALUES (?, ?)`,
        )
        .bind(matchId, userId)
        .run();
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "管理者を更新しました",
        matchId,
        adminUserIds: normalizedUserIds,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ message: e.message || "管理者更新に失敗しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

function getAdminUserIdFromRequest(request) {
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
    const [type, userId] = decoded.split(":");
    if (type !== "admin") {
      return { ok: false, status: 403, message: "管理者権限が必要です" };
    }
    return { ok: true, userId };
  } catch {
    return { ok: false, status: 401, message: "認証エラー" };
  }
}

async function getMatchAdminsUserColumn(db) {
  const columns = await db.prepare("PRAGMA table_info(match_admins)").all();
  const names = new Set((columns.results || []).map((col) => col.name));

  if (names.has("admin_user_id")) return "admin_user_id";
  if (names.has("user_id")) return "user_id";

  throw new Error("match_adminsテーブルの管理者カラムが見つかりません");
}
