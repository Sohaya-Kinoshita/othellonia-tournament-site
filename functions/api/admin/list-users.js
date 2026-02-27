export async function onRequestGet(context) {
  const request = context.request;
  const db = context.env.DB;

  // 1) 管理者チェック
  const currentUser = await readCurrentUserFromSession(request, db);
  if (!currentUser || currentUser.role !== "admin") {
    return jsonResponse(
      { ok: false, message: "管理者のみ実行できます．" },
      403,
    );
  }

  // 2) participants テーブルからすべての参加チームを取得
  const participants = await db
    .prepare(
      "SELECT userId, teamId, isLeader, createdAt FROM participants ORDER BY createdAt DESC",
    )
    .all();

  return jsonResponse(
    {
      ok: true,
      users: participants.results ?? [],
    },
    200,
  );
}

async function readCurrentUserFromSession(request, db) {
  const sessionId = readCookie(request, "sessionId");
  if (!sessionId) return null;

  const sessionRow = await db
    .prepare("SELECT userId, userType, expiresAt FROM sessions WHERE sessionId = ?")
    .bind(sessionId)
    .first();

  if (!sessionRow) return null;

  if (new Date(sessionRow.expiresAt).getTime() < Date.now()) return null;

  const userType = sessionRow.userType;

  if (userType === "admin") {
    const adminRow = await db
      .prepare("SELECT userId FROM admins WHERE userId = ?")
      .bind(sessionRow.userId)
      .first();
    if (!adminRow) return null;
    return {
      userId: adminRow.userId,
      role: "admin",
    };
  } else if (userType === "participant") {
    const participantRow = await db
      .prepare(
        "SELECT userId, teamId, isLeader FROM participants WHERE userId = ?",
      )
      .bind(sessionRow.userId)
      .first();
    if (!participantRow) return null;
    return {
      userId: participantRow.userId,
      role: "team",
      teamId: participantRow.teamId,
      isLeader: participantRow.isLeader === 1,
    };
  }

  return null;
}

function readCookie(request, cookieName) {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (!cookie.startsWith(cookieName + "=")) continue;
    return decodeURIComponent(cookie.substring(cookieName.length + 1));
  }
  return null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
