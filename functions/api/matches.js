export async function onRequest(context) {
  // GETメソッド：マッチ一覧を取得
  if (context.request.method === "GET") {
    try {
      const db = context.env.DB;
      await ensureMatchAdminsTable(db);

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
            m.order_deadline,
            m.winner_team_id,
            m.admin_user_id
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
          "match_adminsテーブルからの取得エラー:",
          adminError.message,
        );
      }

      const adminMap = new Map();
      for (const row of admins.results || []) {
        const current = adminMap.get(row.match_id) || [];
        current.push(row.admin_user_id);
        adminMap.set(row.match_id, current);
      }

      // admin_user_id を JSON パースして配列に変換
      const processedMatches = matches.results.map((match) => {
        const assignedAdmins = adminMap.get(match.match_id) || [];
        if (assignedAdmins.length > 0) {
          return { ...match, admin_user_id: assignedAdmins };
        }

        try {
          // JSON パースを試みる（JSON 形式の場合）
          const adminUserIds = match.admin_user_id
            ? JSON.parse(match.admin_user_id)
            : [];
          return {
            ...match,
            admin_user_id: Array.isArray(adminUserIds)
              ? adminUserIds
              : [adminUserIds],
          };
        } catch (e) {
          // パース失敗時は元の値を配列化
          return {
            ...match,
            admin_user_id: match.admin_user_id ? [match.admin_user_id] : [],
          };
        }
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
      const { matchId, teamAId, teamBId } = await context.request.json();

      if (!matchId || !teamAId || !teamBId) {
        return new Response(
          JSON.stringify({
            message: "マッチID、チームA ID、チームB IDが必要です",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

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
            order_deadline
          )
          VALUES (?, ?, ?, ?, 7, datetime('now', '+9 hours'), datetime(date('now', '+9 hours', '+7 days') || ' 23:59:00'))
        `,
        )
        .bind(matchId, teamAId, teamBId, adminUserId)
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
        JSON.stringify({ message: "マッチ作成処理でエラーが発生しました" }),
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

      const assigned = await db
        .prepare(
          "SELECT 1 FROM match_admins WHERE match_id = ? AND user_id = ? LIMIT 1",
        )
        .bind(matchId, adminUserId)
        .first();

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

  // PATCHメソッド：マッチのゲーム初期化
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
      try {
        const decoded = atob(sessionId);
        const [type] = decoded.split(":");

        if (type !== "admin") {
          return new Response(
            JSON.stringify({ message: "管理者権限が必要です" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      } catch (e) {
        return new Response(JSON.stringify({ message: "認証エラー" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // リクエストボディを解析
      const { matchId, adminUserId, adminUserIds } =
        await context.request.json();

      if (!matchId) {
        return new Response(JSON.stringify({ message: "マッチIDが必要です" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const db = context.env.DB;

      // adminUserId または adminUserIds が指定されている場合は、管理者の更新のみを行う
      if (adminUserId || adminUserIds) {
        // 複数のユーザーIDを配列で受け取る（後方互換性のため adminUserId もサポート）
        const rawUserIds =
          adminUserIds && Array.isArray(adminUserIds)
            ? adminUserIds
            : adminUserId
              ? [adminUserId]
              : [];

        const userIds = [
          ...new Set(rawUserIds.map((id) => String(id).trim()).filter(Boolean)),
        ];

        if (userIds.length === 0) {
          return new Response(
            JSON.stringify({ message: "最低1人の管理者を指定してください" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // すべてのユーザーが存在するか確認
        for (const userId of userIds) {
          const user = await db
            .prepare("SELECT user_id FROM users WHERE user_id = ?")
            .bind(userId)
            .first();

          if (!user) {
            return new Response(
              JSON.stringify({
                message: `ユーザー「${userId}」が見つかりません`,
              }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        }

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

        const statements = [
          db
            .prepare("DELETE FROM match_admins WHERE match_id = ?")
            .bind(matchId),
        ];

        for (const userId of userIds) {
          statements.push(
            db
              .prepare(
                "INSERT INTO match_admins (match_id, user_id) VALUES (?, ?)",
              )
              .bind(matchId, userId),
          );
        }

        statements.push(
          db
            .prepare("UPDATE matches SET admin_user_id = ? WHERE match_id = ?")
            .bind(userIds[0], matchId),
        );

        await db.batch(statements);

        return new Response(
          JSON.stringify({
            success: true,
            message: "マッチの管理者を更新しました",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // マッチが存在するか確認
      const match = await db
        .prepare(
          "SELECT match_id, team_a_id, team_b_id FROM matches WHERE match_id = ?",
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

      // オーダーが両チーム提出されているか確認
      const orderA = await db
        .prepare(
          "SELECT COUNT(*) as count FROM orders WHERE match_id = ? AND team_id = ? AND submitted_at IS NOT NULL",
        )
        .bind(matchId, match.team_a_id)
        .first();

      const orderB = await db
        .prepare(
          "SELECT COUNT(*) as count FROM orders WHERE match_id = ? AND team_id = ? AND submitted_at IS NOT NULL",
        )
        .bind(matchId, match.team_b_id)
        .first();

      if (
        Number(orderA?.count || 0) === 0 ||
        Number(orderB?.count || 0) === 0
      ) {
        return new Response(
          JSON.stringify({ message: "両チームのオーダーが未提出です" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const schemaType = await detectOrderSchema(db);
      if (schemaType === "unknown") {
        return new Response(
          JSON.stringify({ message: "ordersテーブル形式が未対応です" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // オーダーを取得（legacy/v2 両対応）
      const playersA = await getLatestOrderPlayers(
        db,
        schemaType,
        matchId,
        match.team_a_id,
      );
      const playersB = await getLatestOrderPlayers(
        db,
        schemaType,
        matchId,
        match.team_b_id,
      );

      if (!playersA || !playersB) {
        return new Response(
          JSON.stringify({ message: "オーダーの取得に失敗しました" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (playersA.length !== 7 || playersB.length !== 7) {
        return new Response(
          JSON.stringify({
            message: "オーダーが不正です（7名である必要があります）",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // 既存ゲームを削除
      await db
        .prepare("DELETE FROM games WHERE match_id = ?")
        .bind(matchId)
        .run();

      // 新しいゲームレコードを作成
      const statements = [];
      for (let i = 0; i < 7; i++) {
        const gameId = `${matchId}${String(i + 1).padStart(2, "0")}`;
        statements.push(
          db
            .prepare(
              `
              INSERT INTO games (game_id, match_id, game_number, player_a_id, player_b_id)
              VALUES (?, ?, ?, ?, ?)
            `,
            )
            .bind(gameId, matchId, i + 1, playersA[i], playersB[i]),
        );
      }

      await db.batch(statements);

      // orders の confirmed_at 更新は、現行DBスキーマ不整合時に失敗する可能性があるため
      // ゲーム初期化完了を優先してベストエフォートで実行する
      let confirmedUpdated = true;
      try {
        await db
          .prepare(
            "UPDATE orders SET confirmed_at = datetime('now', '+9 hours') WHERE match_id = ? AND team_id = ?",
          )
          .bind(matchId, match.team_a_id)
          .run();

        await db
          .prepare(
            "UPDATE orders SET confirmed_at = datetime('now', '+9 hours') WHERE match_id = ? AND team_id = ?",
          )
          .bind(matchId, match.team_b_id)
          .run();
      } catch (confirmError) {
        confirmedUpdated = false;
        console.warn("confirmed_at update skipped:", confirmError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: confirmedUpdated
            ? "マッチのゲームを初期化しました"
            : "マッチのゲームを初期化しました（確定時刻の更新はスキップされました）",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Match game initialization error:", error);
      return new Response(
        JSON.stringify({ message: "ゲーム初期化処理でエラーが発生しました" }),
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
