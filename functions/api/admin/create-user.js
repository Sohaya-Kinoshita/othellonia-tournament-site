export async function onRequestPost(context) {
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

  // 2) 入力を読む
  let requestBody;
  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "JSONが不正です．" }, 400);
  }

  const userId = String(requestBody.userId ?? "").trim();
  const password = String(requestBody.password ?? "");
  const role = String(requestBody.role ?? "team");
  const teamId =
    requestBody.teamId == null ? null : String(requestBody.teamId).trim();
  const isLeader = Boolean(requestBody.isLeader ?? false);

  if (!userId || !password) {
    return jsonResponse(
      { ok: false, message: "userId と password は必須です．" },
      400,
    );
  }

  if (role !== "admin" && role !== "team") {
    return jsonResponse(
      { ok: false, message: "role は admin または team です．" },
      400,
    );
  }

  if (role === "team" && !teamId) {
    return jsonResponse(
      { ok: false, message: "team の場合は teamId が必須です．" },
      400,
    );
  }

  // 3) 既に存在するか確認
  const existingUser = await db
    .prepare("SELECT userId FROM users WHERE userId = ?")
    .bind(userId)
    .first();

  if (existingUser) {
    return jsonResponse(
      { ok: false, message: "その userId は既に使われています．" },
      409,
    );
  }

  // 4) パスワードをハッシュ化して登録
  const passwordHash = await createPasswordHash(password);

  await db
    .prepare(
      "INSERT INTO users (userId, passwordHash, role, teamId, isLeader) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(
      userId,
      passwordHash,
      role,
      role === "team" ? teamId : null,
      isLeader ? 1 : 0,
    )
    .run();

  return jsonResponse(
    {
      ok: true,
      createdUser: {
        userId,
        role,
        teamId: role === "team" ? teamId : null,
        isLeader,
      },
    },
    200,
  );
}

async function readCurrentUserFromSession(request, db) {
  const sessionId = readCookie(request, "sessionId");
  if (!sessionId) return null;

  const sessionRow = await db
    .prepare(
      "SELECT userId, userType, expiresAt FROM sessions WHERE sessionId = ?",
    )
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

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * passwordHash の形式：pbkdf2$<saltBase64>$<hashBase64>
 */
async function createPasswordHash(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hashBase64 = await pbkdf2HashBase64(password, saltBytes);
  return `pbkdf2$${bytesToBase64(saltBytes)}$${hashBase64}`;
}

async function pbkdf2HashBase64(password, saltBytes) {
  const encoder = new TextEncoder();
  const passwordKeyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const iterations = 100_000;
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    passwordKeyMaterial,
    256,
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
