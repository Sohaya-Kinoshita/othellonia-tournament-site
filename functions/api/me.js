export async function onRequestGet(context) {
  const db = context.env.DB;
  const request = context.request;

  const sessionId = readCookie(request, "sessionId");
  if (!sessionId) {
    return jsonResponse({ ok: true, isLoggedIn: false }, 200);
  }

  const sessionRow = await db
    .prepare(
      "SELECT sessionId, userId, userType, expiresAt FROM sessions WHERE sessionId = ?",
    )
    .bind(sessionId)
    .first();

  if (!sessionRow) {
    return jsonResponse({ ok: true, isLoggedIn: false }, 200, {
      "Set-Cookie": clearSessionCookie(),
    });
  }

  if (new Date(sessionRow.expiresAt).getTime() < Date.now()) {
    await db
      .prepare("DELETE FROM sessions WHERE sessionId = ?")
      .bind(sessionId)
      .run();
    return jsonResponse({ ok: true, isLoggedIn: false }, 200, {
      "Set-Cookie": clearSessionCookie(),
    });
  }

  const userType = sessionRow.userType;
  let userRow;

  if (userType === "admin") {
    userRow = await db
      .prepare("SELECT userId FROM admins WHERE userId = ?")
      .bind(sessionRow.userId)
      .first();
  } else if (userType === "participant") {
    userRow = await db
      .prepare(
        "SELECT userId, teamId, isLeader FROM participants WHERE userId = ?",
      )
      .bind(sessionRow.userId)
      .first();
  }

  if (!userRow) {
    return jsonResponse({ ok: true, isLoggedIn: false }, 200, {
      "Set-Cookie": clearSessionCookie(),
    });
  }

  return jsonResponse(
    {
      ok: true,
      isLoggedIn: true,
      user: {
        userId: userRow.userId,
        role: userType === "admin" ? "admin" : "team",
        teamId: userType === "participant" ? userRow.teamId : null,
        isLeader: userType === "participant" ? userRow.isLeader === 1 : false,
      },
    },
    200,
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

function readCookie(request, cookieName) {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (!cookie.startsWith(cookieName + "=")) continue;
    return decodeURIComponent(cookie.substring(cookieName.length + 1));
  }
  return null;
}

function clearSessionCookie() {
  return [
    "sessionId=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Secure",
  ].join("; ");
}
