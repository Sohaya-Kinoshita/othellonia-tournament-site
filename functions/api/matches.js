export async function onRequest(context) {
  // GETメソッド：マッチ一覧を取得
  if (context.request.method === "GET") {
    try {
      const db = context.env.DB;
      await ensureMatchAdminsTable(db);
      await ensureOrdersConfirmedAtColumn(db);
      await ensureMatchesStartedAtColumn(db);

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
            m.admin_user_id,
            (
              SELECT COUNT(*) FROM games g
              WHERE g.match_id = m.match_id
                AND g.winner_player_id IS NOT NULL
            ) AS completed_game_count,
            (
              SELECT COUNT(*) FROM orders o
              WHERE o.match_id = m.match_id
                AND o.confirmed_at IS NOT NULL
            ) AS confirmed_order_count
          FROM matches m
          LEFT JOIN teams ta ON m.team_a_id = ta.team_id
          LEFT JOIN teams tb ON m.team_b_id = tb.team_id
          ORDER BY m.match_id
        `,
        )
        .all();

      // match_adminsテーブルから管理者情報を取得（エラーハンドリング付き）
      let admins = { results: [] };
      try {
        admins = await db
          .prepare(
            `
              SELECT match_id, admin_user_id
              FROM match_admins
            `,
          )
          .all();
      } catch (adminError) {
        console.warn(
          "match_admins.admin_user_id 取得エラー。user_id で再試行:",
          adminError.message,
        );
        try {
          const legacyAdmins = await db
            .prepare(
              `
                SELECT match_id, user_id AS admin_user_id
                FROM match_admins
              `,
            )
            .all();
          admins = legacyAdmins;
        } catch (legacyAdminError) {
          console.warn(
            "match_adminsテーブルからの取得エラー:",
            legacyAdminError.message,
          );
        }
      }

      const adminMap = new Map();
      for (const row of admins.results || []) {
        const current = adminMap.get(row.match_id) || [];
        current.push(row.admin_user_id);
        adminMap.set(row.match_id, current);
      }

      // admin_user_id を JSON パースして配列に変換
      const processedMatches = matches.results.map((match) => {
        const hasCompletedGame = Number(match.completed_game_count || 0) > 0;
        const matchStatus = match.winner_team_id
          ? "finished"
          : match.started_at || hasCompletedGame
            ? "in_progress"
            : "before";

        // admin_user_idは常に1人分のuser_id（文字列）で返す
        let adminId = "";
        const assignedAdmins = adminMap.get(match.match_id) || [];
        if (assignedAdmins.length > 0) {
          adminId = assignedAdmins[0];
        } else if (match.admin_user_id) {
          // JSON形式や文字列形式のどちらでも対応
          try {
            const parsed = JSON.parse(match.admin_user_id);
            adminId = Array.isArray(parsed) ? parsed[0] || "" : parsed;
          } catch {
            adminId = match.admin_user_id;
          }
        }
        return {
          ...match,
          admin_user_id: adminId,
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

      // セッションIDをデコード（admin_user_id を抽出）
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

      // マッチIDが3文字か確認
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

      // チームIDが同じでないか確認
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

      // マッチが既に存在するか確認
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

      // チームAが存在するか確認
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

      // チームBが存在するか確認
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

      // マッチを作成
      await db
        .prepare(
          `
          INSERT INTO matches (
            match_id,
            team_a_id,
            team_b_id,
            admin_user_id,
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

      let assigned = null;
      try {
        assigned = await db
          .prepare(
            "SELECT 1 FROM match_admins WHERE match_id = ? AND admin_user_id = ? LIMIT 1",
          )
          .bind(matchId, adminUserId)
          .first();
      } catch (assignedError) {
        console.warn(
          "admin_user_idでの権限確認に失敗。user_idで再試行:",
          assignedError.message,
        );
        assigned = await db
          .prepare(
            "SELECT 1 FROM match_admins WHERE match_id = ? AND user_id = ? LIMIT 1",
          )
          .bind(matchId, adminUserId)
          .first();
      }

      let hasLegacyAssignment = false;
      if (!assigned) {
        const legacyOwner = await db
          .prepare("SELECT admin_user_id FROM matches WHERE match_id = ?")
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
      const { matchId, teamAId, teamBId, scheduledAt, orderDeadline } =
        await context.request.json();
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

      await db
        .prepare(updateSql)
        .bind(...updateParams)
        .run();

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
