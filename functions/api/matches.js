export async function onRequest(context) {
  // GETメソッド：マッチ一覧を取得
  if (context.request.method === "GET") {
    try {
      const db = context.env.DB;
      await ensureMatchAdminsTable(db);
      await ensureOrdersConfirmedAtColumn(db);
      await ensureMatchesStartedAtColumn(db);
      const matchOwnerColumn = await getMatchOwnerColumn(db);
      const matchOwnerSelect = matchOwnerColumn
        ? `m.${matchOwnerColumn}`
        : "NULL";

      const matches = await db
        .prepare(
          `
          SELECT 
            m.match_id,
            m.team_a_id,
            m.team_b_id,
            ta.team_name as team_a_name,
            tb.team_name as team_b_name,
            m.best_of,
            m.created_at,
            m.scheduled_at,
            m.order_deadline,
            m.started_at,
            m.winner_team_id,
            ${matchOwnerSelect} AS admin_user_id,
            (
              SELECT COUNT(*) FROM games g
              WHERE g.match_id = m.match_id
                AND g.winner_player_id IS NOT NULL
            ) AS completed_game_count,
            (
              SELECT COUNT(DISTINCT o.team_id) FROM orders o
              WHERE o.match_id = m.match_id
                AND o.confirmed_at IS NOT NULL
            ) AS confirmed_team_count
          FROM matches m
          LEFT JOIN teams ta ON m.team_a_id = ta.team_id
          LEFT JOIN teams tb ON m.team_b_id = tb.team_id
          ORDER BY m.match_id
        `,
        )
        .all();

      let admins = { results: [] };
      const adminColumn = await getMatchAdminsUserColumn(db);
      admins = await db
        .prepare(
          `
            SELECT match_id, ${adminColumn} AS admin_user_id
            FROM match_admins
          `,
        )
        .all();

      const adminMap = new Map();
      for (const row of admins.results || []) {
        const current = adminMap.get(row.match_id) || [];
        current.push(row.admin_user_id);
        adminMap.set(row.match_id, current);
      }

      const processedMatches = (matches.results || []).map((match) => {
        const hasCompletedGame = Number(match.completed_game_count || 0) > 0;
        const hasBothTeamsConfirmed =
          Number(match.confirmed_team_count || 0) >= 2;
        const matchStatus = match.winner_team_id
          ? "finished"
          : match.started_at || hasCompletedGame
            ? "in_progress"
            : hasBothTeamsConfirmed
              ? "confirmed_before_start"
              : "before_order_submission";

        const assignedAdmins = adminMap.get(match.match_id) || [];
        let fallbackAdminIds = [];
        if (assignedAdmins.length === 0 && match.admin_user_id) {
          try {
            const parsed = JSON.parse(match.admin_user_id);
            fallbackAdminIds = Array.isArray(parsed)
              ? parsed.filter(Boolean)
              : parsed
                ? [parsed]
                : [];
          } catch {
            fallbackAdminIds = String(match.admin_user_id)
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
          }
        }

        const adminUserIds =
          assignedAdmins.length > 0 ? assignedAdmins : fallbackAdminIds;

        return {
          ...match,
          admin_user_id: adminUserIds[0] || "",
          admin_user_ids: adminUserIds,
          match_status: matchStatus,
        };
      });

      return new Response(
        JSON.stringify({ success: true, matches: processedMatches }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Matches fetch error:", error);
      return new Response(
        JSON.stringify({
          message: "マッチ一覧取得処理でエラーが発生しました",
          error: error.message,
          stack: error.stack,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // POSTメソッド：マッチ作成
  if (context.request.method === "POST") {
    try {
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

      let adminUserId = "";
      try {
        const decoded = atob(sessionId);
        const [type, userId] = decoded.split(":");

        if (type !== "admin") {
          return new Response(
            JSON.stringify({ message: "管理者権限が必要です" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        adminUserId = userId;
      } catch {
        return new Response(JSON.stringify({ message: "認証エラー" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { matchId, teamAId, teamBId, scheduledAt } =
        await context.request.json();

      if (!matchId || !teamAId || !teamBId || !scheduledAt) {
        return new Response(
          JSON.stringify({
            message: "マッチID、チームA ID、チームB ID、対戦開始日時が必要です",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const normalizedScheduledAt = String(scheduledAt).trim();
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalizedScheduledAt)) {
        return new Response(
          JSON.stringify({ message: "対戦開始日時の形式が正しくありません" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const scheduledAtForDb = `${normalizedScheduledAt.replace("T", " ")}:00`;

      if (String(matchId).trim().length !== 3) {
        return new Response(
          JSON.stringify({
            message: "マッチIDは3文字ちょうどで入力してください",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (teamAId === teamBId) {
        return new Response(
          JSON.stringify({
            message: "チームA と チームB は異なるチームを選択してください",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const db = context.env.DB;
      await ensureMatchesStartedAtColumn(db);
      await ensureMatchAdminsTable(db);
      const matchOwnerColumn = await getMatchOwnerColumn(db);

      if (!matchOwnerColumn) {
        return new Response(
          JSON.stringify({
            message: "matchesテーブルの作成者カラムが見つかりません",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const existingMatch = await db
        .prepare("SELECT match_id FROM matches WHERE match_id = ?")
        .bind(matchId)
        .first();

      if (existingMatch) {
        return new Response(
          JSON.stringify({ message: "このマッチIDは既に使用されています" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const teamA = await db
        .prepare("SELECT team_id FROM teams WHERE team_id = ?")
        .bind(teamAId)
        .first();
      if (!teamA) {
        return new Response(
          JSON.stringify({ message: "チームA が見つかりません" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const teamB = await db
        .prepare("SELECT team_id FROM teams WHERE team_id = ?")
        .bind(teamBId)
        .first();
      if (!teamB) {
        return new Response(
          JSON.stringify({ message: "チームB が見つかりません" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      await db
        .prepare(
          `
          INSERT INTO matches (
            match_id,
            team_a_id,
            team_b_id,
            ${matchOwnerColumn},
            best_of,
            created_at,
            scheduled_at,
            order_deadline
          )
          VALUES (?, ?, ?, ?, 5, datetime('now', '+9 hours'), ?, datetime(date(?, '-3 days') || ' 23:59:00'))
        `,
        )
        .bind(
          matchId,
          teamAId,
          teamBId,
          adminUserId,
          scheduledAtForDb,
          scheduledAtForDb,
        )
        .run();

      const adminCol = await getMatchAdminsUserColumn(db);
      await db
        .prepare(
          `INSERT OR IGNORE INTO match_admins (match_id, ${adminCol}) VALUES (?, ?)`,
        )
        .bind(matchId, adminUserId)
        .run();

      return new Response(
        JSON.stringify({ success: true, message: "マッチを作成しました" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Match creation error:", error);
      return new Response(
        JSON.stringify({
          message: "マッチ作成処理でエラーが発生しました",
          error: error.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // PUTメソッド：マッチの確定（勝者設定）
  if (context.request.method === "PUT") {
    try {
      // 管理者認証確認
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

      // セッションIDをデコード
      let adminUserId = "";
      try {
        const decoded = atob(sessionId);
        const [type, userId] = decoded.split(":");

        if (type !== "admin") {
          return new Response(
            JSON.stringify({ message: "管理者権限が必要です" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        adminUserId = userId;
      } catch (e) {
        return new Response(JSON.stringify({ message: "認証エラー" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // リクエストボディを解析
      const { matchId, winnerTeamId } = await context.request.json();

      if (!matchId) {
        return new Response(JSON.stringify({ message: "マッチIDが必要です" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const db = context.env.DB;
      const matchOwnerColumn = await getMatchOwnerColumn(db);

      // マッチが存在するか確認
      const existingMatch = await db
        .prepare("SELECT match_id FROM matches WHERE match_id = ?")
        .bind(matchId)
        .first();

      if (!existingMatch) {
        return new Response(
          JSON.stringify({ message: "マッチが見つかりません" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      await ensureMatchAdminsTable(db);
      const adminCol = await getMatchAdminsUserColumn(db);

      const assigned = await db
        .prepare(
          `SELECT 1 FROM match_admins WHERE match_id = ? AND ${adminCol} = ? LIMIT 1`,
        )
        .bind(matchId, adminUserId)
        .first();

      let hasLegacyAssignment = false;
      if (!assigned && matchOwnerColumn) {
        const legacyOwner = await db
          .prepare(
            `SELECT ${matchOwnerColumn} AS admin_user_id FROM matches WHERE match_id = ?`,
          )
          .bind(matchId)
          .first();
        hasLegacyAssignment = legacyOwner?.admin_user_id === adminUserId;
      }

      if (!assigned && !hasLegacyAssignment) {
        return new Response(
          JSON.stringify({
            message:
              "この試合の更新権限がありません（管理する試合の決定で付与してください）",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // 勝者を更新
      await db
        .prepare("UPDATE matches SET winner_team_id = ? WHERE match_id = ?")
        .bind(winnerTeamId || null, matchId)
        .run();

      return new Response(
        JSON.stringify({ success: true, message: "マッチを確定しました" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Match update error:", error);
      return new Response(
        JSON.stringify({ message: "マッチ確定処理でエラーが発生しました" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // PATCHメソッド：マッチ情報の編集
  if (context.request.method === "PATCH") {
    try {
      // 管理者認証確認
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

      // セッションIDをデコード
      let adminUserId = "";
      try {
        const decoded = atob(sessionId);
        const [type, userId] = decoded.split(":");
        if (type !== "admin") {
          return new Response(
            JSON.stringify({ message: "管理者権限が必要です" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        adminUserId = userId;
      } catch (e) {
        return new Response(JSON.stringify({ message: "認証エラー" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // リクエストボディを解析
      const requestBody = await context.request.json();
      const {
        matchId,
        teamAId,
        teamBId,
        scheduledAt,
        orderDeadline,
        confirmMatch,
        action,
      } = requestBody;

      // PATCH action=start: 試合開始（games生成 + started_at更新）
      if (action === "start") {
        if (!matchId) {
          return new Response(
            JSON.stringify({ message: "マッチIDが必要です" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const db = context.env.DB;
        await ensureMatchesStartedAtColumn(db);
        await ensureOrdersConfirmedAtColumn(db);

        const match = await db
          .prepare(
            "SELECT match_id, team_a_id, team_b_id, started_at, winner_team_id FROM matches WHERE match_id = ?",
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

        if (match.winner_team_id) {
          return new Response(
            JSON.stringify({ message: "このマッチは既に確定済みです" }),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const confirmedOrderA = await db
          .prepare(
            `
              SELECT 1
              FROM orders
              WHERE match_id = ? AND team_id = ? AND confirmed_at IS NOT NULL
              LIMIT 1
            `,
          )
          .bind(matchId, match.team_a_id)
          .first();

        const confirmedOrderB = await db
          .prepare(
            `
              SELECT 1
              FROM orders
              WHERE match_id = ? AND team_id = ? AND confirmed_at IS NOT NULL
              LIMIT 1
            `,
          )
          .bind(matchId, match.team_b_id)
          .first();

        if (!confirmedOrderA || !confirmedOrderB) {
          const submittedOrderA = await db
            .prepare(
              `
                SELECT 1
                FROM orders
                WHERE match_id = ? AND team_id = ?
                LIMIT 1
              `,
            )
            .bind(matchId, match.team_a_id)
            .first();

          const submittedOrderB = await db
            .prepare(
              `
                SELECT 1
                FROM orders
                WHERE match_id = ? AND team_id = ?
                LIMIT 1
              `,
            )
            .bind(matchId, match.team_b_id)
            .first();

          if (!submittedOrderA || !submittedOrderB) {
            return new Response(
              JSON.stringify({
                message:
                  "オーダーが未確定のため開始できません。先に両チームのオーダーを確定してください。",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // 旧データ互換: confirmed_at が未設定でも提出済みなら開始時に確定扱いへ補正
          await db
            .prepare(
              `
                UPDATE orders
                SET confirmed_at = datetime('now', '+9 hours')
                WHERE match_id = ? AND confirmed_at IS NULL
              `,
            )
            .bind(matchId)
            .run();
        }

        const existingGames = await db
          .prepare("SELECT COUNT(*) AS count FROM games WHERE match_id = ?")
          .bind(matchId)
          .first();
        const existingGamesCount = Number(existingGames?.count || 0);

        if (existingGamesCount === 0) {
          const schemaType = await detectOrderSchema(db);
          const teamAPlayers = await getLatestOrderPlayers(
            db,
            schemaType,
            matchId,
            match.team_a_id,
          );
          const teamBPlayers = await getLatestOrderPlayers(
            db,
            schemaType,
            matchId,
            match.team_b_id,
          );

          if (
            !Array.isArray(teamAPlayers) ||
            !Array.isArray(teamBPlayers) ||
            teamAPlayers.length < 5 ||
            teamBPlayers.length < 5
          ) {
            return new Response(
              JSON.stringify({
                message:
                  "オーダー詳細が不足しているため開始できません。オーダー内容を確認してください。",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          for (let i = 0; i < 5; i += 1) {
            const gameNumber = i + 1;
            const gameId = `${matchId}${gameNumber}`;
            const battleMode = gameNumber <= 3 ? "S" : "G";

            await db
              .prepare(
                `
                  INSERT INTO games (
                    game_id,
                    match_id,
                    game_number,
                    battle_mode,
                    player_a_id,
                    player_b_id,
                    player_a_score,
                    player_b_score,
                    winner_team_id,
                    winner_player_id
                  )
                  VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL, NULL)
                `,
              )
              .bind(
                gameId,
                matchId,
                gameNumber,
                battleMode,
                teamAPlayers[i],
                teamBPlayers[i],
              )
              .run();
          }
        }

        if (!match.started_at) {
          await db
            .prepare(
              "UPDATE matches SET started_at = datetime('now', '+9 hours') WHERE match_id = ?",
            )
            .bind(matchId)
            .run();
        }

        const startedAt = await db
          .prepare("SELECT started_at FROM matches WHERE match_id = ?")
          .bind(matchId)
          .first();

        return new Response(
          JSON.stringify({
            success: true,
            message: "試合を開始しました",
            matchId,
            startedAt: startedAt?.started_at || null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (!matchId || !teamAId || !teamBId || !scheduledAt) {
        return new Response(
          JSON.stringify({
            message: "マッチID、チームA ID、チームB ID、試合日時が必要です",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const db = context.env.DB;
      await ensureMatchesStartedAtColumn(db);

      // マッチが存在するか確認
      const match = await db
        .prepare("SELECT * FROM matches WHERE match_id = ?")
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

      if (match.started_at) {
        return new Response(
          JSON.stringify({
            message: "このマッチは確定済みのため更新できません",
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // オーダー確定済みかどうか判定
      const confirmedOrders = await db
        .prepare(
          "SELECT COUNT(*) as count FROM orders WHERE match_id = ? AND confirmed_at IS NOT NULL",
        )
        .bind(matchId)
        .first();
      const isOrderConfirmed = Number(confirmedOrders?.count || 0) > 0;

      // 日時フォーマット
      const scheduledAtForDb = scheduledAt.replace("T", " ") + ":00";
      let orderDeadlineForDb = orderDeadline
        ? orderDeadline.replace("T", " ") + ":00"
        : null;

      // オーダー確定済みならorder_deadlineは更新不可
      let updateSql =
        "UPDATE matches SET team_a_id = ?, team_b_id = ?, scheduled_at = ? WHERE match_id = ?";
      let updateParams = [teamAId, teamBId, scheduledAtForDb, matchId];
      if (!isOrderConfirmed && orderDeadlineForDb) {
        updateSql =
          "UPDATE matches SET team_a_id = ?, team_b_id = ?, scheduled_at = ?, order_deadline = ? WHERE match_id = ?";
        updateParams = [
          teamAId,
          teamBId,
          scheduledAtForDb,
          orderDeadlineForDb,
          matchId,
        ];
      }

      if (confirmMatch) {
        updateSql = `${updateSql.replace(
          " WHERE match_id = ?",
          ", started_at = datetime('now', '+9 hours') WHERE match_id = ?",
        )}`;
        updateParams = [...updateParams.slice(0, -1), matchId];
      }

      await db
        .prepare(updateSql)
        .bind(...updateParams)
        .run();

      // マッチ確定時に、両チームのオーダーも確定状態に設定
      if (confirmMatch) {
        await ensureOrdersConfirmedAtColumn(db);
        await db
          .prepare(
            `UPDATE orders
             SET confirmed_at = datetime('now', '+9 hours')
             WHERE match_id = ? AND confirmed_at IS NULL`,
          )
          .bind(matchId)
          .run();
      }

      return new Response(
        JSON.stringify({ success: true, message: "マッチ情報を更新しました" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Match update error:", error);
      return new Response(
        JSON.stringify({ message: "マッチ情報更新処理でエラーが発生しました" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  return new Response(JSON.stringify({ message: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
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

async function ensureOrdersConfirmedAtColumn(db) {
  try {
    await db.prepare("ALTER TABLE orders ADD COLUMN confirmed_at TEXT").run();
  } catch (_error) {
    // 既に存在する場合は何もしない
  }
}

async function ensureMatchesStartedAtColumn(db) {
  try {
    await db.prepare("ALTER TABLE matches ADD COLUMN started_at TEXT").run();
  } catch (_error) {
    // 既に存在する場合は何もしない
  }
}

async function getMatchOwnerColumn(db) {
  const columns = await db.prepare("PRAGMA table_info(matches)").all();
  const columnNames = new Set((columns.results || []).map((col) => col.name));

  if (columnNames.has("admin_user_id")) {
    return "admin_user_id";
  }
  if (columnNames.has("creator_user_id")) {
    return "creator_user_id";
  }

  return null;
}

async function getLatestOrderPlayers(db, schemaType, matchId, teamId) {
  if (schemaType === "legacy") {
    const order = await db
      .prepare(
        "SELECT player_order FROM orders WHERE match_id = ? AND team_id = ? ORDER BY submitted_at DESC LIMIT 1",
      )
      .bind(matchId, teamId)
      .first();

    if (!order || !order.player_order) {
      return null;
    }

    try {
      const parsed = JSON.parse(order.player_order);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_e) {
      return null;
    }
  }

  if (schemaType === "v2") {
    const latestOrder = await db
      .prepare(
        `
          SELECT order_id
          FROM orders
          WHERE match_id = ? AND team_id = ?
          ORDER BY submitted_at DESC, order_id DESC
          LIMIT 1
        `,
      )
      .bind(matchId, teamId)
      .first();

    if (!latestOrder || !latestOrder.order_id) {
      return null;
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

    return (details.results || []).map((row) => row.player_id);
  }

  return null;
}

async function ensureMatchAdminsTable(db) {
  try {
    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS match_admins (
          match_id CHAR(3) NOT NULL,
          admin_user_id CHAR(9) NOT NULL,
          PRIMARY KEY (match_id, admin_user_id),
          FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY (admin_user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
      `,
      )
      .run();
  } catch (error) {
    console.warn(
      "match_adminsテーブル作成エラー（既存の可能性）:",
      error.message,
    );
  }
}

async function getMatchAdminsUserColumn(db) {
  const columns = await db.prepare("PRAGMA table_info(match_admins)").all();
  const names = new Set((columns.results || []).map((col) => col.name));

  if (names.has("admin_user_id")) return "admin_user_id";
  if (names.has("user_id")) return "user_id";

  throw new Error("match_adminsテーブルの管理者カラムが見つかりません");
}
