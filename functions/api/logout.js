export async function onRequestPost(context) {
  const db = context.env.DB;
  const request = context.request;

  const sessionId = readCookie(request, "sessionId");
  if (sessionId) {
    await db
      .prepare("DELETE FROM sessions WHERE sessionId = ?")
      .bind(sessionId)
      .run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": clearSessionCookie(),
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
