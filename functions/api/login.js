export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { playerId, leaderId, userId, password, captchaToken } =
      await context.request.json();
    const db = context.env.DB;
    const recaptchaSecretKey = context.env.RECAPTCHA_SECRET_KEY;

    // デバッグ：環境変数の確認
    console.log("=== Login Debug Info ===");
    console.log("DB loaded:", !!db);
    console.log("RECAPTCHA_SECRET_KEY loaded:", !!recaptchaSecretKey);
    if (recaptchaSecretKey) {
      console.log("Secret Key (最初の20文字):", recaptchaSecretKey.substring(0, 20) + "...");
    }
    console.log("========================");

    // キャプチャ検証（リーダーと管理者は必須、プレイヤーは任意）
    let captchaValid = true;
    if (leaderId || userId) {
      if (!captchaToken) {
        return new Response(
          JSON.stringify({ message: "キャプチャの検証が必要です" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Google reCAPTCHA v3 検証
      if (recaptchaSecretKey) {
        const captchaResponse = await fetch("https://www.google.com/recaptcha/api/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `secret=${recaptchaSecretKey}&response=${captchaToken}`,
        });

        const captchaData = await captchaResponse.json();
        
        // スコア 0.5 以上で合格（ボットなし）
        if (!captchaData.success || captchaData.score < 0.5) {
          return new Response(
            JSON.stringify({ message: "キャプチャの検証に失敗しました" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    // 参加者ログイン（プレイヤーIDのみ）
    if (playerId && !leaderId && !userId) {
      const player = await db
        .prepare(
          "SELECT player_id, player_name FROM players WHERE player_id = ?",
        )
        .bind(playerId)
        .first();

      if (!player) {
        return new Response(
          JSON.stringify({ message: "プレイヤーが見つかりません" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // セッションIDを生成（player_idをBase64エンコード）
      const sessionId = btoa("player:" + player.player_id + ":" + Date.now());

      const response = new Response(
        JSON.stringify({
          success: true,
          type: "player",
          player: {
            playerId: player.player_id,
            playerName: player.player_name,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

      // 本番環境ではSecure; 開発環境ではなし
      const isProduction = new URL(context.request.url).protocol === "https:";
      const secureFlag = isProduction ? "; Secure" : "";
      response.headers.set(
        "Set-Cookie",
        `sessionId=${sessionId}; Path=/; HttpOnly${secureFlag}; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
      );

      return response;
    }

    // リーダー・サブリーダーログイン（leader_idとpassword）
    if (leaderId && password && !userId) {
      const leader = await db
        .prepare(
          "SELECT leader_id, leader_name, team_id, leader_role, pass FROM leaders WHERE leader_id = ?",
        )
        .bind(leaderId)
        .first();

      if (!leader) {
        return new Response(
          JSON.stringify({ message: "IDまたはパスワードが間違っています。" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // パスワードを検証
      if (leader.pass !== password) {
        return new Response(
          JSON.stringify({ message: "IDまたはパスワードが間違っています。" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // セッションIDを生成（leader_idをBase64エンコード）
      const sessionId = btoa("leader:" + leader.leader_id + ":" + Date.now());

      const response = new Response(
        JSON.stringify({
          success: true,
          type: "leader",
          leader: {
            leaderId: leader.leader_id,
            leaderName: leader.leader_name,
            teamId: leader.team_id,
            leaderRole: leader.leader_role,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

      // 本番環境ではSecure; 開発環境ではなし
      const isProduction = new URL(context.request.url).protocol === "https:";
      const secureFlag = isProduction ? "; Secure" : "";
      response.headers.set(
        "Set-Cookie",
        `sessionId=${sessionId}; Path=/; HttpOnly${secureFlag}; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
      );

      return response;
    }

    // 管理者ログイン（ユーザーIDとパスワード）
    if (userId && password && !leaderId) {
      const user = await db
        .prepare("SELECT user_id, user_name, pass FROM users WHERE user_id = ?")
        .bind(userId)
        .first();

      if (!user) {
        return new Response(
          JSON.stringify({ message: "IDまたはパスワードが間違っています。" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // パスワードを検証
      if (user.pass !== password) {
        return new Response(
          JSON.stringify({ message: "IDまたはパスワードが間違っています。" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // セッションIDを生成（user_idをBase64エンコード）
      const sessionId = btoa("admin:" + user.user_id + ":" + Date.now());

      const response = new Response(
        JSON.stringify({
          success: true,
          type: "admin",
          user: { userId: user.user_id, userName: user.user_name },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

      // 本番環境ではSecure; 開発環境ではなし
      const isProduction = new URL(context.request.url).protocol === "https:";
      const secureFlag = isProduction ? "; Secure" : "";
      response.headers.set(
        "Set-Cookie",
        `sessionId=${sessionId}; Path=/; HttpOnly${secureFlag}; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
      );

      return response;
    }

    return new Response(
      JSON.stringify({
        message: "プレイヤーID、リーダーID、またはユーザーIDとパスワードが必要です",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ message: "ログイン処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
      const player = await db
        .prepare(
          "SELECT player_id, player_name FROM players WHERE player_id = ?",
        )
        .bind(playerId)
        .first();

      if (!player) {
        return new Response(
          JSON.stringify({ message: "プレイヤーが見つかりません" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // セッションIDを生成（player_idをBase64エンコード）
      const sessionId = btoa("player:" + player.player_id + ":" + Date.now());

      const response = new Response(
        JSON.stringify({
          success: true,
          type: "player",
          player: {
            playerId: player.player_id,
            playerName: player.player_name,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

      // 本番環境ではSecure; 開発環境ではなし
      const isProduction = new URL(context.request.url).protocol === "https:";
      const secureFlag = isProduction ? "; Secure" : "";
      response.headers.set(
        "Set-Cookie",
        `sessionId=${sessionId}; Path=/; HttpOnly${secureFlag}; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
      );

      return response;
    }

    // リーダー・サブリーダーログイン（leader_idとpassword）
    if (leaderId && password && !userId) {
      const leader = await db
        .prepare(
          "SELECT leader_id, leader_name, team_id, leader_role, pass FROM leaders WHERE leader_id = ?",
        )
        .bind(leaderId)
        .first();

      if (!leader) {
        return new Response(
          JSON.stringify({ message: "IDまたはパスワードが間違っています。" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // パスワードを検証
      if (leader.pass !== password) {
        return new Response(
          JSON.stringify({ message: "IDまたはパスワードが間違っています。" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // セッションIDを生成（leader_idをBase64エンコード）
      const sessionId = btoa("leader:" + leader.leader_id + ":" + Date.now());

      const response = new Response(
        JSON.stringify({
          success: true,
          type: "leader",
          leader: {
            leaderId: leader.leader_id,
            leaderName: leader.leader_name,
            teamId: leader.team_id,
            leaderRole: leader.leader_role,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

      // 本番環境ではSecure; 開発環境ではなし
      const isProduction = new URL(context.request.url).protocol === "https:";
      const secureFlag = isProduction ? "; Secure" : "";
      response.headers.set(
        "Set-Cookie",
        `sessionId=${sessionId}; Path=/; HttpOnly${secureFlag}; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
      );

      return response;
    }

    // 管理者ログイン（ユーザーIDとパスワード）
    if (userId && password && !leaderId) {
      const user = await db
        .prepare("SELECT user_id, user_name, pass FROM users WHERE user_id = ?")
        .bind(userId)
        .first();

      if (!user) {
        return new Response(
          JSON.stringify({ message: "IDまたはパスワードが間違っています。" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // パスワードを検証
      if (user.pass !== password) {
        return new Response(
          JSON.stringify({ message: "IDまたはパスワードが間違っています。" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // セッションIDを生成（user_idをBase64エンコード）
      const sessionId = btoa("admin:" + user.user_id + ":" + Date.now());

      const response = new Response(
        JSON.stringify({
          success: true,
          type: "admin",
          user: { userId: user.user_id, userName: user.user_name },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

      // 本番環境ではSecure; 開発環境ではなし
      const isProduction = new URL(context.request.url).protocol === "https:";
      const secureFlag = isProduction ? "; Secure" : "";
      response.headers.set(
        "Set-Cookie",
        `sessionId=${sessionId}; Path=/; HttpOnly${secureFlag}; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
      );

      return response;
    }

    return new Response(
      JSON.stringify({
        message:
          "プレイヤーID、リーダーID、またはユーザーIDとパスワードが必要です",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ message: "ログイン処理でエラーが発生しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
