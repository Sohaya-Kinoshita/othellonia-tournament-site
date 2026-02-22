export async function onRequestPost(context) {
  const request = context.request;
  const db = context.env.DB;

  let loginBody;
  try {
    loginBody = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "JSONが不正です．" }, 400);
  }

  const userId = String(loginBody.userId ?? "").trim();
  const password = String(loginBody.password ?? "");

  if (!userId || !password) {
    return jsonResponse(
      { ok: false, message: "userId と password は必須です．" },
      400,
    );
  }

  const userRow = await db
    .prepare(
      "SELECT userId, passwordHash, role, teamId, isLeader FROM users WHERE userId = ?",
    )
    .bind(userId)
    .first();

  if (!userRow) {
    return jsonResponse(
      { ok: false, message: "IDまたはパスワードが違います．" },
      401,
    );
  }

  const isPasswordCorrect = await verifyPassword(
    password,
    userRow.passwordHash,
  );
  if (!isPasswordCorrect) {
    return jsonResponse(
      { ok: false, message: "IDまたはパスワードが違います．" },
      401,
    );
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  await db
    .prepare(
      "INSERT INTO sessions (sessionId, userId, expiresAt) VALUES (?, ?, ?)",
    )
    .bind(sessionId, userRow.userId, expiresAt)
    .run();

  const cookie = buildSessionCookie(sessionId);

  return jsonResponse(
    {
      ok: true,
      user: {
        userId: userRow.userId,
        role: userRow.role,
        teamId: userRow.teamId,
        isLeader: userRow.isLeader === 1,
      },
    },
    200,
    { "Set-Cookie": cookie },
  );
}

function jsonResponse(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(extraHeaders ?? {}),
    },
  });
}

function buildSessionCookie(sessionId) {
  const maxAgeSeconds = 7 * 24 * 60 * 60;
  return [
    `sessionId=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    "Secure",
  ].join("; ");
}

/**
 * passwordHash の形式：pbkdf2$<saltBase64>$<hashBase64>
 */
async function verifyPassword(password, passwordHash) {
  const parts = String(passwordHash).split("$");
  if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;

  const saltBytes = base64ToBytes(parts[1]);
  const expectedHashBase64 = parts[2];

  const computedHashBase64 = await pbkdf2HashBase64(password, saltBytes);
  return timingSafeEqual(expectedHashBase64, computedHashBase64);
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

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++)
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
