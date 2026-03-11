export async function onRequest(context) {
  if (context.request.method === "GET") {
    return handleGet(context);
  }

  if (context.request.method === "POST") {
    return handlePost(context);
  }

  if (context.request.method === "PATCH") {
    return handlePatch(context);
  }

  return new Response(JSON.stringify({ message: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}

function getSessionIdFromCookie(cookieHeader) {
  return (cookieHeader || "")
    .split("; ")
    .find((c) => c.startsWith("sessionId="))
    ?.split("=")[1];
}

function getNextOrderId(lastOrderNumber) {
  const parsed = Number(lastOrderNumber);
  const next = Number.isFinite(parsed) && parsed > 0 ? parsed + 1 : 1;
  return `O${String(next).padStart(3, "0")}`;
}

async function detectOrderSchema(db) {
  const columns = await db.prepare("PRAGMA table_info(orders)").all();
  const names = new Set((columns.results || []).map((row) => row.name));

  if (names.has("order_id") && names.has("submitted_by")) {
    return "v2";
  }

  if (
    names.has("match_id") &&
    names.has("team_id") &&
    names.has("player_order")
  ) {
    return "legacy";
  }

  return "unknown";
}

async function hasOrdersConfirmedAtColumn(db) {
  const columns = await db.prepare("PRAGMA table_info(orders)").all();
  const names = new Set((columns.results || []).map((row) => row.name));
  return names.has("confirmed_at");
}

async function ensureOrdersConfirmedAtColumn(db) {
  const hasConfirmedAt = await hasOrdersConfirmedAtColumn(db);
  if (hasConfirmedAt) {
    return;
  }

  try {
    await db.prepare("ALTER TABLE orders ADD COLUMN confirmed_at TEXT").run();
  } catch (_error) {
    // 他リクエストと競合して既に追加済みの可能性があるため握りつぶす
  }
}

async function ensureReservesTable(db) {
  await db
    .prepare(
      `
        CREATE TABLE IF NOT EXISTS reserves (
          match_id CHAR(3) NOT NULL,
          team_id CHAR(3) NOT NULL,
          player_id CHAR(12) NOT NULL,
          reserve_number INTEGER NOT NULL,
          CHECK (reserve_number IN (1, 2)),
          UNIQUE (match_id, team_id, reserve_number),
          UNIQUE (match_id, team_id, player_id),
          PRIMARY KEY (match_id, team_id, reserve_number),
          FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE RESTRICT ON UPDATE CASCADE
        )
      `,
    )
    .run();
}

function safeParseOrderJson(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

async function loadReservePlayers(db, matchId, teamId) {
  const reserveRows = await db
    .prepare(
      `
        SELECT reserve_number, player_id
        FROM reserves
        WHERE match_id = ? AND team_id = ?
        ORDER BY reserve_number
      `,
    )
    .bind(matchId, teamId)
    .all();

  return (reserveRows.results || []).map((row) => row.player_id);
}

async function authenticateLeader(db, request, teamId) {
  const sessionId = getSessionIdFromCookie(request.headers.get("cookie"));

  if (!sessionId) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ message: "認証が必要です" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  let leaderId = "";
  try {
    const decoded = atob(sessionId);
    const [type, id] = decoded.split(":");

    if (type !== "leader") {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ message: "リーダー権限が必要です" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        ),
      };
    }

    leaderId = id;
  } catch (error) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ message: "認証エラー" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const teamLeader = await db
    .prepare(
      "SELECT leader_id FROM leaders WHERE leader_id = ? AND team_id = ?",
    )
    .bind(leaderId, teamId)
    .first();

  const team = await db
    .prepare("SELECT team_id FROM teams WHERE team_id = ?")
    .bind(teamId)
    .first();

  if (!team) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ message: "チームが見つかりません" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  if (!teamLeader) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ message: "このチームのリーダーではありません" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  return { ok: true, leaderId };
}

async function authenticateLeaderOrAdmin(db, request, teamId) {
  const sessionId = getSessionIdFromCookie(request.headers.get("cookie"));

  if (!sessionId) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ message: "認証が必要です" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  let type = "";
  let id = "";
  try {
    const decoded = atob(sessionId);
    [type, id] = decoded.split(":");
  } catch (error) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ message: "認証エラー" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  // Admin is allowed to view all orders
  if (type === "admin") {
    return { ok: true, type: "admin" };
  }

  // Otherwise must be team leader
  if (type !== "leader") {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ message: "リーダー権限が必要です" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  const team = await db
    .prepare("SELECT team_id FROM teams WHERE team_id = ?")
    .bind(teamId)
    .first();

  if (!team) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ message: "チームが見つかりません" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  const teamLeader = await db
    .prepare(
      "SELECT leader_id FROM leaders WHERE leader_id = ? AND team_id = ?",
    )
    .bind(id, teamId)
    .first();

  if (!teamLeader) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ message: "このチームのリーダーではありません" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  return { ok: true, type: "leader" };
}

async function handleGet(context) {
  try {
    const db = context.env.DB;
    await ensureReservesTable(db);
    const url = new URL(context.request.url);
    const matchId = (url.searchParams.get("matchId") || "").trim();
    const teamId = (url.searchParams.get("teamId") || "").trim();

    if (!matchId || !teamId) {
      return new Response(
        JSON.stringify({ message: "matchId と teamId が必要です" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const auth = await authenticateLeaderOrAdmin(db, context.request, teamId);
    if (!auth.ok) {
      return auth.response;
    }

    const schemaType = await detectOrderSchema(db);

    if (schemaType === "legacy") {
      const legacyOrder = await db
        .prepare(
          `
            SELECT submitted_at, confirmed_at, player_order
            FROM orders
            WHERE match_id = ? AND team_id = ?
            ORDER BY submitted_at DESC
            LIMIT 1
          `,
        )
        .bind(matchId, teamId)
        .first();

      const reservePlayers = await loadReservePlayers(db, matchId, teamId);

      if (!legacyOrder) {
        return new Response(
          JSON.stringify({
            success: true,
            matchId,
            teamId,
            orderId: null,
            submittedAt: null,
            confirmedAt: null,
            playerOrder: [],
            reservePlayers,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          matchId,
          teamId,
          orderId: null,
          submittedAt: legacyOrder.submitted_at,
          confirmedAt: legacyOrder.confirmed_at,
          playerOrder: safeParseOrderJson(legacyOrder.player_order),
          reservePlayers,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (schemaType !== "v2") {
      return new Response(
        JSON.stringify({ message: "ordersテーブル形式が未対応です" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    await ensureOrdersConfirmedAtColumn(db);

    const latestOrder = await db
      .prepare(
        `
				SELECT order_id, submitted_at, confirmed_at
				FROM orders
				WHERE match_id = ? AND team_id = ?
				ORDER BY submitted_at DESC, order_id DESC
				LIMIT 1
			`,
      )
      .bind(matchId, teamId)
      .first();

    if (!latestOrder) {
      const reservePlayers = await loadReservePlayers(db, matchId, teamId);
      return new Response(
        JSON.stringify({
          success: true,
          matchId,
          teamId,
          orderId: null,
          submittedAt: null,
          confirmedAt: null,
          playerOrder: [],
          reservePlayers,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const details = await db
      .prepare(
        `
				SELECT game_number, player_id
				FROM order_details
				WHERE order_id = ?
				ORDER BY game_number
			`,
      )
      .bind(latestOrder.order_id)
      .all();

    const reservePlayers = await loadReservePlayers(db, matchId, teamId);

    return new Response(
      JSON.stringify({
        success: true,
        matchId,
        teamId,
        orderId: latestOrder.order_id,
        submittedAt: latestOrder.submitted_at,
        confirmedAt: latestOrder.confirmed_at,
        playerOrder: (details.results || []).map((row) => row.player_id),
        reservePlayers,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Order GET error:", error);
    return new Response(
      JSON.stringify({ message: "オーダー情報取得処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function handlePost(context) {
  try {
    const db = context.env.DB;
    await ensureReservesTable(db);
    const { matchId, teamId, playerOrder, reservePlayers } =
      await context.request.json();

    const normalizedReservePlayers = Array.isArray(reservePlayers)
      ? reservePlayers
          .map((playerId) => String(playerId || "").trim())
          .filter((playerId) => playerId && playerId !== "__NONE__")
      : [];

    if (!matchId || !teamId || !Array.isArray(playerOrder)) {
      return new Response(
        JSON.stringify({ message: "matchId, teamId, playerOrder が必要です" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (normalizedReservePlayers.length > 2) {
      return new Response(
        JSON.stringify({ message: "リザーブは最大2名まで指定できます" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (playerOrder.length !== 5) {
      return new Response(
        JSON.stringify({ message: "オーダーは5名分を指定してください" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const uniquePlayers = new Set(playerOrder);
    if (uniquePlayers.size !== playerOrder.length) {
      return new Response(
        JSON.stringify({ message: "同じプレイヤーは重複して指定できません" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const uniqueReserves = new Set(normalizedReservePlayers);
    if (uniqueReserves.size !== normalizedReservePlayers.length) {
      return new Response(
        JSON.stringify({
          message: "リザーブに同じプレイヤーは重複して指定できません",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const overlapWithOrder = normalizedReservePlayers.some((playerId) =>
      uniquePlayers.has(playerId),
    );
    if (overlapWithOrder) {
      return new Response(
        JSON.stringify({ message: "リザーブにオーダー選手は指定できません" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const auth = await authenticateLeader(db, context.request, teamId);
    if (!auth.ok) {
      return auth.response;
    }

    const match = await db
      .prepare(
        `
        SELECT match_id, team_a_id, team_b_id, order_deadline
				FROM matches
				WHERE match_id = ?
			`,
      )
      .bind(matchId)
      .first();

    if (!match) {
      return new Response(
        JSON.stringify({ message: "マッチが見つかりません" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (match.team_a_id !== teamId && match.team_b_id !== teamId) {
      return new Response(
        JSON.stringify({ message: "このチームは対象マッチに参加していません" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (match.order_deadline && new Date(match.order_deadline) < new Date()) {
      return new Response(
        JSON.stringify({ message: "提出期限を過ぎているため提出できません" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    await ensureOrdersConfirmedAtColumn(db);

    const confirmedOrder = await db
      .prepare(
        `
          SELECT 1
          FROM orders
          WHERE match_id = ? AND team_id = ? AND confirmed_at IS NOT NULL
          LIMIT 1
        `,
      )
      .bind(matchId, teamId)
      .first();

    if (confirmedOrder) {
      return new Response(
        JSON.stringify({
          message: "マッチ確定後はオーダーを変更できません",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const placeholders = playerOrder.map(() => "?").join(", ");
    const memberRows = await db
      .prepare(
        `
				SELECT player_id
				FROM team_members
				WHERE team_id = ? AND player_id IN (${placeholders})
			`,
      )
      .bind(teamId, ...playerOrder)
      .all();

    if ((memberRows.results || []).length !== playerOrder.length) {
      return new Response(
        JSON.stringify({ message: "チーム外のプレイヤーが含まれています" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (normalizedReservePlayers.length > 0) {
      const reservePlaceholders = normalizedReservePlayers
        .map(() => "?")
        .join(", ");
      const reserveRows = await db
        .prepare(
          `
          SELECT player_id
          FROM team_members
          WHERE team_id = ? AND player_id IN (${reservePlaceholders})
        `,
        )
        .bind(teamId, ...normalizedReservePlayers)
        .all();

      if (
        (reserveRows.results || []).length !== normalizedReservePlayers.length
      ) {
        return new Response(
          JSON.stringify({
            message: "リザーブにチーム外のプレイヤーが含まれています",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    const schemaType = await detectOrderSchema(db);

    if (schemaType === "legacy") {
      await db
        .prepare(
          `
            INSERT INTO orders (match_id, team_id, player_order, submitted_at)
            VALUES (?, ?, ?, datetime('now', '+9 hours'))
            ON CONFLICT(match_id, team_id) DO UPDATE SET
              player_order = excluded.player_order,
              submitted_at = excluded.submitted_at
          `,
        )
        .bind(matchId, teamId, JSON.stringify(playerOrder))
        .run();

      const reserveStatements = [
        db
          .prepare("DELETE FROM reserves WHERE match_id = ? AND team_id = ?")
          .bind(matchId, teamId),
      ];

      normalizedReservePlayers.forEach((playerId, index) => {
        reserveStatements.push(
          db
            .prepare(
              `
                INSERT INTO reserves (match_id, team_id, player_id, reserve_number)
                VALUES (?, ?, ?, ?)
              `,
            )
            .bind(matchId, teamId, playerId, index + 1),
        );
      });

      await db.batch(reserveStatements);

      return new Response(
        JSON.stringify({
          success: true,
          message: "オーダーを提出しました",
          orderId: null,
          reservePlayers: normalizedReservePlayers,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (schemaType !== "v2") {
      return new Response(
        JSON.stringify({ message: "ordersテーブル形式が未対応です" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const lastOrder = await db
      .prepare(
        `
          SELECT MAX(CAST(SUBSTR(order_id, 2) AS INTEGER)) AS max_order_number
          FROM orders
          WHERE order_id GLOB 'O[0-9]*'
        `,
      )
      .first();

    const nextOrderId = getNextOrderId(lastOrder?.max_order_number);

    const statements = [
      db
        .prepare(
          `
					INSERT INTO orders (order_id, match_id, team_id, submitted_at, submitted_by)
					VALUES (?, ?, ?, datetime('now', '+9 hours'), ?)
				`,
        )
        .bind(nextOrderId, matchId, teamId, auth.leaderId),
    ];

    playerOrder.forEach((playerId, index) => {
      statements.push(
        db
          .prepare(
            `
						INSERT INTO order_details (order_id, team_id, game_number, player_id)
						VALUES (?, ?, ?, ?)
					`,
          )
          .bind(nextOrderId, teamId, index + 1, playerId),
      );
    });

    statements.push(
      db
        .prepare("DELETE FROM reserves WHERE match_id = ? AND team_id = ?")
        .bind(matchId, teamId),
    );

    normalizedReservePlayers.forEach((playerId, index) => {
      statements.push(
        db
          .prepare(
            `
              INSERT INTO reserves (match_id, team_id, player_id, reserve_number)
              VALUES (?, ?, ?, ?)
            `,
          )
          .bind(matchId, teamId, playerId, index + 1),
      );
    });

    await db.batch(statements);

    return new Response(
      JSON.stringify({
        success: true,
        message: "オーダーを提出しました",
        orderId: nextOrderId,
        reservePlayers: normalizedReservePlayers,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Order POST error:", error);
    return new Response(
      JSON.stringify({
        message: "オーダー提出処理でエラーが発生しました",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function handlePatch(context) {
  try {
    const db = context.env.DB;
    const { matchId, teamId } = await context.request.json();

    if (!matchId || !teamId) {
      return new Response(
        JSON.stringify({ message: "matchId と teamId が必要です" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const auth = await authenticateLeaderOrAdmin(db, context.request, teamId);
    if (!auth.ok) {
      return auth.response;
    }

    // Only admin can confirm orders
    if (auth.type !== "admin") {
      return new Response(JSON.stringify({ message: "管理者権限が必要です" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await ensureOrdersConfirmedAtColumn(db);

    const result = await db
      .prepare(
        `
        UPDATE orders
        SET confirmed_at = datetime('now', '+9 hours')
        WHERE match_id = ? AND team_id = ? AND confirmed_at IS NULL
      `,
      )
      .bind(matchId, teamId)
      .run();

    if (result.meta.changes === 0) {
      return new Response(
        JSON.stringify({
          message: "未提出のオーダーを確定することはできません",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get the updated order
    const updatedOrder = await db
      .prepare(
        `
        SELECT submitted_at, confirmed_at
        FROM orders
        WHERE match_id = ? AND team_id = ?
      `,
      )
      .bind(matchId, teamId)
      .first();

    return new Response(
      JSON.stringify({
        success: true,
        message: "オーダーを確定しました",
        matchId,
        teamId,
        submittedAt: updatedOrder.submitted_at,
        confirmedAt: updatedOrder.confirmed_at,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Order PATCH error:", error);
    return new Response(
      JSON.stringify({ message: "オーダー確定処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
