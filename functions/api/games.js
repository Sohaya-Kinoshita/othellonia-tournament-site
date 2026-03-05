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

  // 権限チェック：このマッチに対する権限があるか確認
  let authCheck = null;

  // まず新しいカラム名（admin_user_id）で試す
  try {
    authCheck = await env.DB.prepare(
      `
      SELECT 1 FROM match_admins 
      WHERE match_id = ? AND admin_user_id = ?
      UNION
      SELECT 1 FROM matches 
      WHERE match_id = ? AND admin_user_id = ?
    `,
    )
      .bind(matchId, adminUserId, matchId, adminUserId)
      .first();
  } catch (error) {
    console.warn(
      "admin_user_idカラムでのチェックに失敗、user_idで再試行:",
      error.message,
    );

    // 古いカラム名（user_id）で試す
    try {
      authCheck = await env.DB.prepare(
        `
        SELECT 1 FROM match_admins 
        WHERE match_id = ? AND user_id = ?
        UNION
        SELECT 1 FROM matches 
        WHERE match_id = ? AND admin_user_id = ?
      `,
      )
        .bind(matchId, adminUserId, matchId, adminUserId)
        .first();
    } catch (error2) {
      console.error("権限チェックに失敗:", error2.message);
      // match_adminsテーブルを使わず、matchesテーブルのみでチェック
      authCheck = await env.DB.prepare(
        `
        SELECT 1 FROM matches 
        WHERE match_id = ? AND admin_user_id = ?
      `,
      )
        .bind(matchId, adminUserId)
        .first();
    }
  }

  if (!authCheck) {
    console.log(
      `match_id=${matchId} は担当未割当ですが、管理者のため閲覧を許可します`,
    );
  }

  // マッチ情報とゲーム一覧を取得
  const match = await env.DB.prepare(
    `
    SELECT 
      m.match_id,
      m.team_a_id,
      m.team_b_id,
      m.best_of,
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

  // 権限チェック
  let authCheck = null;

  // まず新しいカラム名（admin_user_id）で試す
  try {
    authCheck = await env.DB.prepare(
      `
      SELECT 1 FROM match_admins 
      WHERE match_id = ? AND admin_user_id = ?
      UNION
      SELECT 1 FROM matches 
      WHERE match_id = ? AND admin_user_id = ?
    `,
    )
      .bind(match_id, adminUserId, match_id, adminUserId)
      .first();
  } catch (error) {
    console.warn(
      "admin_user_idカラムでのチェックに失敗、user_idで再試行:",
      error.message,
    );

    // 古いカラム名（user_id）で試す
    try {
      authCheck = await env.DB.prepare(
        `
        SELECT 1 FROM match_admins 
        WHERE match_id = ? AND user_id = ?
        UNION
        SELECT 1 FROM matches 
        WHERE match_id = ? AND admin_user_id = ?
      `,
      )
        .bind(match_id, adminUserId, match_id, adminUserId)
        .first();
    } catch (error2) {
      console.error("権限チェックに失敗:", error2.message);
      // match_adminsテーブルを使わず、matchesテーブルのみでチェック
      authCheck = await env.DB.prepare(
        `
        SELECT 1 FROM matches 
        WHERE match_id = ? AND admin_user_id = ?
      `,
      )
        .bind(match_id, adminUserId)
        .first();
    }
  }

  if (!authCheck) {
    console.log(
      `match_id=${match_id} は担当未割当ですが、管理者のため更新を許可します`,
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
            winner_player_id || null,
            winner_team_id || null,
            player_a_score || 0,
            player_b_score || 0,
            forfeit_winner || null,
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
          .bind(winner_player_id || null, winner_team_id || null, game_id)
          .run();
      }
    }

    // 確定の場合、マッチの勝者も更新
    if (confirmed) {
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

      // マッチの勝者を更新
      if (winnerTeamId) {
        await env.DB.prepare(
          `
          UPDATE matches 
          SET winner_team_id = ?
          WHERE match_id = ?
        `,
        )
          .bind(winnerTeamId, match_id)
          .run();
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
