// /api/games - ゲーム結果の取得・更新

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
    "Access-Control-Allow-Credentials": "true",
  };

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 認証チェック
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionIdMatch = cookieHeader.match(/sessionId=([^;]+)/);
  if (!sessionIdMatch) {
    return new Response(JSON.stringify({ error: "未認証です" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sessionId = decodeURIComponent(sessionIdMatch[1]);
  let decodedSessionId;
  try {
    decodedSessionId = atob(sessionId);
  } catch {
    return new Response(JSON.stringify({ error: "セッションIDが無効です" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const [userType, userId] = decodedSessionId.split(":");
  if (userType !== "admin") {
    return new Response(JSON.stringify({ error: "管理者権限が必要です" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (method === "GET") {
      return await handleGet(env, url, corsHeaders, userId);
    } else if (method === "PUT") {
      return await handlePut(env, request, corsHeaders, userId);
    } else {
      return new Response(
        JSON.stringify({ error: "メソッドが許可されていません" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("エラー:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
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

async function ensureMatchesStatusColumn(db) {
  try {
    await db.prepare("ALTER TABLE matches ADD COLUMN status TEXT").run();
  } catch (_error) {
    // 既に存在する場合は何もしない
  }
}

// GET: 指定されたマッチのゲーム一覧を取得
async function handleGet(env, url, corsHeaders, adminUserId) {
  const matchId = url.searchParams.get("match_id");

  if (!matchId) {
    return new Response(JSON.stringify({ error: "match_idが必要です" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // match_adminsテーブルの確認
  await ensureMatchAdminsTable(env);
  const adminCol = await getMatchAdminsUserColumn(env.DB);
  const matchOwnerColumn = await getMatchOwnerColumn(env.DB);

  // 権限チェック：このマッチに対する権限があるか確認
  let authCheck = null;

  authCheck = await env.DB.prepare(
    `
      SELECT 1 FROM match_admins
      WHERE match_id = ? AND ${adminCol} = ?
      LIMIT 1
    `,
  )
    .bind(matchId, adminUserId)
    .first();

  if (!authCheck && matchOwnerColumn) {
    authCheck = await env.DB.prepare(
      `
        SELECT 1 FROM matches
        WHERE match_id = ? AND ${matchOwnerColumn} = ?
        LIMIT 1
      `,
    )
      .bind(matchId, adminUserId)
      .first();
  }

  if (!authCheck) {
    console.log(
      `match_id=${matchId} は担当未割当ですが、管理者のため閲覧を許可します`,
    );
  }

  // マッチ情報とゲーム一覧を取得
  await ensureMatchesStartedAtColumn(env.DB);
  await ensureMatchesStatusColumn(env.DB);

  const match = await env.DB.prepare(
    `
    SELECT 
      m.match_id,
      m.team_a_id,
      m.team_b_id,
      m.best_of,
      m.scheduled_at,
      m.started_at,
      m.winner_team_id,
      ta.team_name as team_a_name,
      tb.team_name as team_b_name
    FROM matches m
    LEFT JOIN teams ta ON m.team_a_id = ta.team_id
    LEFT JOIN teams tb ON m.team_b_id = tb.team_id
    WHERE m.match_id = ?
  `,
  )
    .bind(matchId)
    .first();

  if (!match) {
    return new Response(JSON.stringify({ error: "マッチが見つかりません" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await ensureOrdersConfirmedAtColumn(env.DB);

  const confirmedOrderA = await env.DB.prepare(
    `
      SELECT 1
      FROM orders
      WHERE match_id = ? AND team_id = ? AND confirmed_at IS NOT NULL
      LIMIT 1
    `,
  )
    .bind(matchId, match.team_a_id)
    .first();

  const confirmedOrderB = await env.DB.prepare(
    `
      SELECT 1
      FROM orders
      WHERE match_id = ? AND team_id = ? AND confirmed_at IS NOT NULL
      LIMIT 1
    `,
  )
    .bind(matchId, match.team_b_id)
    .first();

  const hasConfirmedOrders = Boolean(confirmedOrderA && confirmedOrderB);
  const isMatchConfirmed = Boolean(hasConfirmedOrders || match.started_at);
  const isMatchStarted = Boolean(match.started_at);

  if (isMatchConfirmed && isMatchStarted) {
    await ensureGamesInitialized(
      env.DB,
      matchId,
      match.team_a_id,
      match.team_b_id,
    );
  }

  // ゲーム一覧を取得
  let gamesResult;
  try {
    // BO3スコアカラムを含めて取得
    gamesResult = await env.DB.prepare(
      `
      SELECT 
        g.game_id,
        g.game_number,
        g.player_a_id,
        g.player_b_id,
        g.winner_team_id,
        g.winner_player_id,
        g.player_a_score,
        g.player_b_score,
          g.forfeit_winner,
        pa.player_name as player_a_name,
        pb.player_name as player_b_name
      FROM games g
      LEFT JOIN players pa ON g.player_a_id = pa.player_id
      LEFT JOIN players pb ON g.player_b_id = pb.player_id
      WHERE g.match_id = ?
      ORDER BY g.game_number
    `,
    )
      .bind(matchId)
      .all();
  } catch (error) {
    console.warn(
      "BO3スコアカラムがない可能性があります。基本情報のみ取得します:",
      error.message,
    );
    // BO3スコアカラムがない場合は、基本情報のみ取得
    gamesResult = await env.DB.prepare(
      `
      SELECT 
        g.game_id,
        g.game_number,
        g.player_a_id,
        g.player_b_id,
        g.winner_team_id,
        g.winner_player_id,
        0 as player_a_score,
        0 as player_b_score,
        NULL as forfeit_winner,
        pa.player_name as player_a_name,
        pb.player_name as player_b_name
      FROM games g
      LEFT JOIN players pa ON g.player_a_id = pa.player_id
      LEFT JOIN players pb ON g.player_b_id = pb.player_id
      WHERE g.match_id = ?
      ORDER BY g.game_number
    `,
    )
      .bind(matchId)
      .all();
  }

  const games = gamesResult.results || [];

  // 各チームの勝利数を計算
  const teamAWins = games.filter(
    (g) => g.winner_team_id === match.team_a_id,
  ).length;
  const teamBWins = games.filter(
    (g) => g.winner_team_id === match.team_b_id,
  ).length;

  return new Response(
    JSON.stringify({
      match,
      games,
      teamAWins,
      teamBWins,
      isMatchConfirmed,
      isMatchStarted,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// PUT: ゲーム結果を更新
async function handlePut(env, request, corsHeaders, adminUserId) {
  const body = await request.json();
  const { match_id, game_results, confirmed } = body;

  if (!match_id || !game_results || !Array.isArray(game_results)) {
    return new Response(JSON.stringify({ error: "不正なリクエストです" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // match_adminsテーブルの確認
  await ensureMatchAdminsTable(env);
  const adminCol = await getMatchAdminsUserColumn(env.DB);
  const matchOwnerColumn = await getMatchOwnerColumn(env.DB);

  // 権限チェック
  let authCheck = null;

  authCheck = await env.DB.prepare(
    `
      SELECT 1 FROM match_admins
      WHERE match_id = ? AND ${adminCol} = ?
      LIMIT 1
    `,
  )
    .bind(match_id, adminUserId)
    .first();

  if (!authCheck && matchOwnerColumn) {
    authCheck = await env.DB.prepare(
      `
        SELECT 1 FROM matches
        WHERE match_id = ? AND ${matchOwnerColumn} = ?
        LIMIT 1
      `,
    )
      .bind(match_id, adminUserId)
      .first();
  }

  if (!authCheck) {
    console.log(
      `match_id=${match_id} は担当未割当ですが、管理者のため更新を許可します`,
    );
  }

  await ensureMatchesStartedAtColumn(env.DB);
  await ensureMatchesStatusColumn(env.DB);

  const match = await env.DB.prepare(
    `
      SELECT team_a_id, team_b_id, started_at, winner_team_id
      FROM matches
      WHERE match_id = ?
    `,
  )
    .bind(match_id)
    .first();

  if (!match) {
    return new Response(JSON.stringify({ error: "マッチが見つかりません" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!match.started_at) {
    return new Response(
      JSON.stringify({
        error:
          "このマッチはまだ開始されていないため、試合結果を入力できません。先に『試合を開始する』を実行してください。",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (match.winner_team_id) {
    return new Response(
      JSON.stringify({
        error: "この試合は既に確定済みのため、結果を変更できません。",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  await ensureOrdersConfirmedAtColumn(env.DB);

  // 不戦勝保存時の整合性をサーバー側で担保するため、ゲームの選手情報を取得
  const gameRows = await env.DB.prepare(
    `
      SELECT game_id, player_a_id, player_b_id, winner_player_id
      FROM games
      WHERE match_id = ?
    `,
  )
    .bind(match_id)
    .all();
  const gameInfoMap = new Map(
    (gameRows.results || []).map((g) => [g.game_id, g]),
  );

  const confirmedOrderA = await env.DB.prepare(
    `
      SELECT 1
      FROM orders
      WHERE match_id = ? AND team_id = ? AND confirmed_at IS NOT NULL
      LIMIT 1
    `,
  )
    .bind(match_id, match.team_a_id)
    .first();

  const confirmedOrderB = await env.DB.prepare(
    `
      SELECT 1
      FROM orders
      WHERE match_id = ? AND team_id = ? AND confirmed_at IS NOT NULL
      LIMIT 1
    `,
  )
    .bind(match_id, match.team_b_id)
    .first();

  const hasConfirmedOrders = Boolean(confirmedOrderA && confirmedOrderB);

  if (!hasConfirmedOrders && !match.started_at) {
    return new Response(
      JSON.stringify({
        error:
          "このマッチは未確定のため試合結果を入力できません。先にオーダーの確定でマッチを確定してください。",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  await ensureGamesInitialized(
    env.DB,
    match_id,
    match.team_a_id,
    match.team_b_id,
  );

  const existingGamesCount = await env.DB.prepare(
    `
      SELECT COUNT(*) AS count
      FROM games
      WHERE match_id = ?
    `,
  )
    .bind(match_id)
    .first();

  if (Number(existingGamesCount?.count || 0) === 0) {
    return new Response(
      JSON.stringify({
        error:
          "ゲーム情報を初期化できませんでした。オーダー内容を確認してください。",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // トランザクション内で更新
  try {
    // gamesテーブルに必要カラムを追加（存在しない場合）
    const ensureColumn = async (sql, name) => {
      try {
        await env.DB.prepare(sql).run();
      } catch (alterError) {
        console.log(`${name}カラムは既に存在するか追加不要です`);
      }
    };

    await ensureColumn(
      `ALTER TABLE games ADD COLUMN player_a_score INTEGER DEFAULT 0`,
      "player_a_score",
    );
    await ensureColumn(
      `ALTER TABLE games ADD COLUMN player_b_score INTEGER DEFAULT 0`,
      "player_b_score",
    );
    await ensureColumn(
      `ALTER TABLE games ADD COLUMN forfeit_winner TEXT`,
      "forfeit_winner",
    );

    // 各ゲームの結果を更新
    for (const result of game_results) {
      const {
        game_id,
        winner_player_id,
        winner_team_id,
        player_a_score,
        player_b_score,
        forfeit_winner,
      } = result;

      const gameInfo = gameInfoMap.get(game_id);
      if (gameInfo?.winner_player_id) {
        // 既に勝敗確定済みのゲームは上書きしない
        continue;
      }

      let resolvedWinnerPlayerId = winner_player_id || null;
      let resolvedWinnerTeamId = winner_team_id || null;
      let resolvedPlayerAScore = Number(player_a_score || 0);
      let resolvedPlayerBScore = Number(player_b_score || 0);
      let resolvedForfeitWinner = forfeit_winner || null;

      if (resolvedForfeitWinner === "a" && gameInfo) {
        resolvedWinnerPlayerId = gameInfo.player_a_id || null;
        resolvedWinnerTeamId = match.team_a_id || null;
        resolvedPlayerAScore = 2;
        resolvedPlayerBScore = 0;
      } else if (resolvedForfeitWinner === "b" && gameInfo) {
        resolvedWinnerPlayerId = gameInfo.player_b_id || null;
        resolvedWinnerTeamId = match.team_b_id || null;
        resolvedPlayerAScore = 0;
        resolvedPlayerBScore = 2;
      }

      // BO3スコアと勝者を更新
      try {
        await env.DB.prepare(
          `
          UPDATE games 
          SET winner_player_id = ?, winner_team_id = ?, player_a_score = ?, player_b_score = ?, forfeit_winner = ?
          WHERE game_id = ?
        `,
        )
          .bind(
            resolvedWinnerPlayerId,
            resolvedWinnerTeamId,
            resolvedPlayerAScore,
            resolvedPlayerBScore,
            resolvedForfeitWinner,
            game_id,
          )
          .run();
      } catch (updateError) {
        console.warn(
          "BO3スコアカラムがない可能性があります。基本情報のみ更新します:",
          updateError.message,
        );
        // BO3スコアカラムがない場合は、勝者情報のみ更新
        await env.DB.prepare(
          `
          UPDATE games 
          SET winner_player_id = ?, winner_team_id = ?
          WHERE game_id = ?
        `,
        )
          .bind(resolvedWinnerPlayerId, resolvedWinnerTeamId, game_id)
          .run();
      }
    }

    // 確定の場合、マッチの勝者も更新
    if (confirmed) {
      const matchInfo = await env.DB.prepare(
        `
          SELECT team_a_id, team_b_id
          FROM matches
          WHERE match_id = ?
        `,
      )
        .bind(match_id)
        .first();

      if (!matchInfo) {
        return new Response(
          JSON.stringify({ error: "マッチが見つかりません" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 現在の勝利数を集計
      const gamesResult = await env.DB.prepare(
        `
        SELECT winner_team_id
        FROM games
        WHERE match_id = ? AND winner_team_id IS NOT NULL
      `,
      )
        .bind(match_id)
        .all();

      const games = gamesResult.results || [];
      const winCounts = {};

      games.forEach((g) => {
        winCounts[g.winner_team_id] = (winCounts[g.winner_team_id] || 0) + 1;
      });

      // 勝者を決定（最も勝利数が多いチーム）
      let winnerTeamId = null;
      let maxWins = 0;

      for (const [teamId, wins] of Object.entries(winCounts)) {
        if (wins > maxWins) {
          maxWins = wins;
          winnerTeamId = teamId;
        }
      }

      const teamAWins = Number(winCounts[matchInfo.team_a_id] || 0);
      const teamBWins = Number(winCounts[matchInfo.team_b_id] || 0);

      if (teamAWins === teamBWins) {
        return new Response(
          JSON.stringify({
            error: "引き分け状態のため確定できません。勝敗を入力してください。",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (Math.max(teamAWins, teamBWins) < 3) {
        return new Response(
          JSON.stringify({
            error: "勝者が確定していないため確定できません（3勝が必要です）。",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // マッチの勝者を更新
      if (winnerTeamId) {
        await env.DB.prepare(
          `
          UPDATE matches 
          SET winner_team_id = ?, status = 'finished'
          WHERE match_id = ?
        `,
        )
          .bind(winnerTeamId, match_id)
          .run();
      } else {
        return new Response(
          JSON.stringify({
            error: "勝者チームを判定できないため確定できません。",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: confirmed ? "結果を確定しました" : "一時保存しました",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("更新エラー:", error);
    return new Response(
      JSON.stringify({ error: "更新に失敗しました: " + error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

// match_adminsテーブルの存在確認・作成
async function ensureMatchAdminsTable(env) {
  try {
    await env.DB.prepare(
      `
      CREATE TABLE IF NOT EXISTS match_admins (
        match_id CHAR(3) NOT NULL,
        admin_user_id CHAR(9) NOT NULL,
        PRIMARY KEY (match_id, admin_user_id),
        FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (admin_user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `,
    ).run();
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

  if (names.has("admin_user_id")) {
    return "admin_user_id";
  }
  if (names.has("user_id")) {
    return "user_id";
  }

  throw new Error("match_adminsテーブルの管理者カラムが見つかりません");
}

async function getMatchOwnerColumn(db) {
  const columns = await db.prepare("PRAGMA table_info(matches)").all();
  const names = new Set((columns.results || []).map((col) => col.name));

  if (names.has("admin_user_id")) {
    return "admin_user_id";
  }
  if (names.has("creator_user_id")) {
    return "creator_user_id";
  }

  return null;
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

function safeParseOrderJson(playerOrder) {
  try {
    const parsed = JSON.parse(playerOrder);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

async function getLatestOrderPlayers(db, schemaType, matchId, teamId) {
  if (schemaType === "legacy") {
    const order = await db
      .prepare(
        `
          SELECT player_order
          FROM orders
          WHERE match_id = ? AND team_id = ?
          ORDER BY submitted_at DESC
          LIMIT 1
        `,
      )
      .bind(matchId, teamId)
      .first();

    if (!order) {
      return null;
    }

    return safeParseOrderJson(order.player_order);
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

async function ensureGamesInitialized(db, matchId, teamAId, teamBId) {
  const existing = await db
    .prepare("SELECT COUNT(*) AS count FROM games WHERE match_id = ?")
    .bind(matchId)
    .first();

  if (Number(existing?.count || 0) > 0) {
    return;
  }

  const schemaType = await detectOrderSchema(db);
  const teamAPlayers = await getLatestOrderPlayers(
    db,
    schemaType,
    matchId,
    teamAId,
  );
  const teamBPlayers = await getLatestOrderPlayers(
    db,
    schemaType,
    matchId,
    teamBId,
  );

  if (
    !Array.isArray(teamAPlayers) ||
    !Array.isArray(teamBPlayers) ||
    teamAPlayers.length < 5 ||
    teamBPlayers.length < 5
  ) {
    return;
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
