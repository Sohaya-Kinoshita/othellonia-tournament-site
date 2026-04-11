// /api/match-card-detail - マッチ詳細＋ゲーム情報を返すAPI
// ?matchId=xxx で指定

export async function onRequest(context) {
  try {
    const db = context.env.DB;
    await ensureOrdersConfirmedAtColumn(db);
    await ensureMatchesStartedAtColumn(db);
    await ensureMatchesStatusColumn(db);
    const url = new URL(context.request.url);
    const matchId = (url.searchParams.get("matchId") || "").trim();
    if (!matchId) {
      return new Response(JSON.stringify({ message: "matchId が必要です" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    // マッチ情報
    const match = await db
      .prepare(
        `
      SELECT 
        m.match_id,
        m.team_a_id,
        m.team_b_id,
        ta.team_name as team_a_name,
        tb.team_name as team_b_name,
        m.scheduled_at,
        m.started_at,
        m.winner_team_id,
        m.status,
        (
          SELECT COUNT(*) FROM games g
          WHERE g.match_id = m.match_id
            AND g.winner_player_id IS NOT NULL
        ) AS completed_game_count,
        (
          SELECT COUNT(DISTINCT o.team_id) FROM orders o
          WHERE o.match_id = m.match_id
            AND o.confirmed_at IS NOT NULL
        ) AS confirmed_team_count,
        (
          SELECT COUNT(DISTINCT o.team_id) FROM orders o
          WHERE o.match_id = m.match_id
        ) AS submitted_team_count
      FROM matches m
      LEFT JOIN teams ta ON m.team_a_id = ta.team_id
      LEFT JOIN teams tb ON m.team_b_id = tb.team_id
      WHERE m.match_id = ?
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

    const hasCompletedGame = Number(match.completed_game_count || 0) > 0;
    const hasBothTeamsConfirmed = Number(match.confirmed_team_count || 0) >= 2;
    const hasBothTeamsSubmitted = Number(match.submitted_team_count || 0) >= 2;
    const matchStatus = match.status
      ? match.status
      : match.winner_team_id
        ? "finished"
        : match.started_at || hasCompletedGame
          ? "in_progress"
          : hasBothTeamsConfirmed || hasBothTeamsSubmitted
            ? "confirmed_before_start"
            : "before_order_submission";

    match.match_status = matchStatus;
    // ゲーム情報
    const gamesResult = await db
      .prepare(
        `
      SELECT 
        g.game_number,
        g.player_a_id,
        g.player_b_id,
        g.player_a_score,
        g.player_b_score,
        g.winner_team_id,
        g.winner_player_id,
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
    let games = gamesResult.results || [];

    // gamesが未生成でも、両チームの確定済みオーダーから対戦カードを組み立てる
    if (games.length === 0) {
      const teamAOrder = await db
        .prepare(
          `
          SELECT order_id
          FROM orders
          WHERE match_id = ? AND team_id = ? AND confirmed_at IS NOT NULL
          ORDER BY submitted_at DESC, order_id DESC
          LIMIT 1
        `,
        )
        .bind(matchId, match.team_a_id)
        .first();

      const teamBOrder = await db
        .prepare(
          `
          SELECT order_id
          FROM orders
          WHERE match_id = ? AND team_id = ? AND confirmed_at IS NOT NULL
          ORDER BY submitted_at DESC, order_id DESC
          LIMIT 1
        `,
        )
        .bind(matchId, match.team_b_id)
        .first();

      if (teamAOrder && teamBOrder) {
        const teamADetailsResult = await db
          .prepare(
            `
            SELECT od.game_number, od.player_id, p.player_name
            FROM order_details od
            LEFT JOIN players p ON od.player_id = p.player_id
            WHERE od.order_id = ?
            ORDER BY od.game_number
          `,
          )
          .bind(teamAOrder.order_id)
          .all();

        const teamBDetailsResult = await db
          .prepare(
            `
            SELECT od.game_number, od.player_id, p.player_name
            FROM order_details od
            LEFT JOIN players p ON od.player_id = p.player_id
            WHERE od.order_id = ?
            ORDER BY od.game_number
          `,
          )
          .bind(teamBOrder.order_id)
          .all();

        const teamAByGame = new Map(
          (teamADetailsResult.results || []).map((row) => [
            Number(row.game_number),
            row,
          ]),
        );
        const teamBByGame = new Map(
          (teamBDetailsResult.results || []).map((row) => [
            Number(row.game_number),
            row,
          ]),
        );

        games = Array.from({ length: 5 }, (_, index) => {
          const gameNumber = index + 1;
          const teamAPlayer = teamAByGame.get(gameNumber) || {};
          const teamBPlayer = teamBByGame.get(gameNumber) || {};
          return {
            game_number: gameNumber,
            player_a_id: teamAPlayer.player_id || null,
            player_b_id: teamBPlayer.player_id || null,
            player_a_score: 0,
            player_b_score: 0,
            winner_team_id: null,
            winner_player_id: null,
            player_a_name: teamAPlayer.player_name || null,
            player_b_name: teamBPlayer.player_name || null,
          };
        }).filter((game) => game.player_a_id && game.player_b_id);
      }
    }

    const reservesResult = await db
      .prepare(
        `
        SELECT r.team_id, r.reserve_number, r.player_id, p.player_name
        FROM reserves r
        LEFT JOIN players p ON r.player_id = p.player_id
        WHERE r.match_id = ?
        ORDER BY r.team_id, r.reserve_number
      `,
      )
      .bind(matchId)
      .all();

    const reservesByTeam = {};
    (reservesResult.results || []).forEach((row) => {
      if (!reservesByTeam[row.team_id]) {
        reservesByTeam[row.team_id] = [];
      }
      reservesByTeam[row.team_id].push({
        reserve_number: row.reserve_number,
        player_id: row.player_id,
        player_name: row.player_name,
      });
    });

    return new Response(
      JSON.stringify({ success: true, match, games, reservesByTeam }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("match-card-detail error:", error);
    return new Response(
      JSON.stringify({
        message: "対戦カード詳細取得でエラー",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
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
