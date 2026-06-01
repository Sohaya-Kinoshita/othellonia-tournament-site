function extractMirrativId(url) {
  if (!url) return null;

  const decoded = decodeURIComponent(String(url));
  const match = decoded.match(/user\/(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  return null;
}

async function assertAdmin(context) {
  const cookies = context.request.headers.get("cookie") || "";
  const sessionId = cookies
    .split("; ")
    .find((c) => c.startsWith("sessionId="))
    ?.split("=")[1];

  if (!sessionId) {
    return new Response(JSON.stringify({ message: "認証が必要です" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const decoded = atob(sessionId);
    const [type] = decoded.split(":");
    if (type !== "admin") {
      return new Response(JSON.stringify({ message: "管理者権限が必要です" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ message: "認証エラー" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

async function rollbackIfNeeded(db) {
  try {
    await db.exec("ROLLBACK");
  } catch (_error) {
    // ignore rollback errors
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authResponse = await assertAdmin(context);
  if (authResponse) {
    return authResponse;
  }

  try {
    const body = await context.request.json();
    const rawEntries = Array.isArray(body.entries) ? body.entries : [];

    if (rawEntries.length === 0) {
      return new Response(JSON.stringify({ message: "登録対象がありません" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = context.env.DB;
    const results = {
      added: [],
      skipped: [],
      failed: [],
    };

    for (const rawEntry of rawEntries) {
      const playerId = String(rawEntry.playerId || "").trim();
      const playerName = String(rawEntry.playerName || "").trim();
      const rawMirrativUrl = String(rawEntry.mirrativUrl || "").trim();
      const rowLabel = rawEntry.rowNumber
        ? `行 ${rawEntry.rowNumber}`
        : playerId || playerName || "未指定";

      if (!playerId) {
        results.failed.push({
          rowNumber: rawEntry.rowNumber ?? null,
          rowLabel,
          reason: "プレイヤーIDが必要です",
        });
        continue;
      }

      if (!/^\d{12}$/.test(playerId)) {
        results.failed.push({
          rowNumber: rawEntry.rowNumber ?? null,
          rowLabel,
          reason: "プレイヤーIDは半角数字12桁で入力してください",
        });
        continue;
      }

      if (!playerName) {
        results.failed.push({
          rowNumber: rawEntry.rowNumber ?? null,
          rowLabel,
          reason: "プレイヤーネームが必要です",
        });
        continue;
      }

      if (playerName.length > 8) {
        results.failed.push({
          rowNumber: rawEntry.rowNumber ?? null,
          rowLabel,
          reason: "プレイヤーネームは8文字以内で入力してください",
        });
        continue;
      }

      const normalizedMirrativId = rawMirrativUrl
        ? extractMirrativId(rawMirrativUrl)
        : null;
      if (rawMirrativUrl && normalizedMirrativId === null) {
        results.failed.push({
          rowNumber: rawEntry.rowNumber ?? null,
          rowLabel,
          reason: "Mirrativ URL からプレイヤーIDを取得できませんでした",
        });
        continue;
      }

      const existingPlayer = await db
        .prepare("SELECT player_id FROM players WHERE player_id = ?")
        .bind(playerId)
        .first();

      if (existingPlayer) {
        results.skipped.push({
          rowNumber: rawEntry.rowNumber ?? null,
          playerId,
          reason: "既に存在します",
        });
        continue;
      }

      try {
        await db
          .prepare(
            "INSERT INTO players (player_id, player_name, mirrativ_id) VALUES (?, ?, ?)",
          )
          .bind(playerId, playerName, normalizedMirrativId)
          .run();
        results.added.push({
          rowNumber: rawEntry.rowNumber ?? null,
          playerId,
        });
      } catch (error) {
        const errorMessage = String(error?.message || "");
        if (
          errorMessage.includes("SQLITE_CONSTRAINT_PRIMARYKEY") ||
          errorMessage.includes("UNIQUE constraint failed: players.player_id")
        ) {
          results.skipped.push({
            rowNumber: rawEntry.rowNumber ?? null,
            playerId,
            reason: "既に存在します",
          });
        } else if (errorMessage.includes("FOREIGN KEY constraint failed")) {
          results.failed.push({
            rowNumber: rawEntry.rowNumber ?? null,
            rowLabel,
            reason: "プレイヤー登録に失敗しました",
          });
        } else {
          results.failed.push({
            rowNumber: rawEntry.rowNumber ?? null,
            rowLabel,
            reason: "プレイヤー作成処理でエラーが発生しました",
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "プレイヤーの一括作成が完了しました",
        summary: {
          requested: rawEntries.length,
          added: results.added.length,
          skipped: results.skipped.length,
          failed: results.failed.length,
        },
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Player bulk creation error:", error);
    return new Response(
      JSON.stringify({
        message: "プレイヤー一括作成処理でエラーが発生しました",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
