// マッチ編集画面用スクリプト

document.addEventListener("DOMContentLoaded", async function () {
  const matchIdInput = document.getElementById("editMatchId");
  const teamASelect = document.getElementById("editTeamAId");
  const teamBSelect = document.getElementById("editTeamBId");
  const matchDateTimeInput = document.getElementById("editMatchDateTime");
  const orderDeadlineInput = document.getElementById("editOrderDeadline");
  const form = document.getElementById("editMatchForm");

  // URLパラメータからmatchId取得（例: match_edit.html?matchId=M01）
  const urlParams = new URLSearchParams(window.location.search);
  const matchId = urlParams.get("matchId");
  if (!matchId) {
    alert("マッチIDが指定されていません");
    return;
  }

  // マッチ情報取得
  const res = await fetch("/api/matches");
  const data = await res.json();
  if (!data.success) {
    alert("マッチ情報の取得に失敗しました");
    return;
  }
  const match = data.matches.find((m) => m.match_id === matchId);
  if (!match) {
    alert("指定されたマッチが見つかりません");
    return;
  }

  // チーム一覧取得
  const teams = [];
  data.matches.forEach((m) => {
    if (m.team_a_id && !teams.find((t) => t.team_id === m.team_a_id)) {
      teams.push({ team_id: m.team_a_id, team_name: m.team_a_name });
    }
    if (m.team_b_id && !teams.find((t) => t.team_id === m.team_b_id)) {
      teams.push({ team_id: m.team_b_id, team_name: m.team_b_name });
    }
  });
  // セレクトボックスにチームをセット
  [teamASelect, teamBSelect].forEach((select) => {
    select.innerHTML = "";
    teams.forEach((team) => {
      const opt = document.createElement("option");
      opt.value = team.team_id;
      opt.textContent = team.team_name || team.team_id;
      select.appendChild(opt);
    });
  });

  // 値をセット
  matchIdInput.value = match.match_id;
  teamASelect.value = match.team_a_id;
  teamBSelect.value = match.team_b_id;
  matchDateTimeInput.value = match.scheduled_at
    ? match.scheduled_at.replace(" ", "T").slice(0, 16)
    : "";
  orderDeadlineInput.value = match.order_deadline
    ? match.order_deadline.replace(" ", "T").slice(0, 16)
    : "";

  // オーダー確定済みなら提出期限を編集不可に
  if (Number(match.confirmed_order_count) > 0) {
    orderDeadlineInput.disabled = true;
    orderDeadlineInput.title = "オーダー確定後は提出期限を変更できません";
  } else {
    orderDeadlineInput.disabled = false;
    orderDeadlineInput.title = "";
  }

  // 保存処理（PATCHで更新）
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const body = {
      matchId: matchIdInput.value,
      teamAId: teamASelect.value,
      teamBId: teamBSelect.value,
      scheduledAt: matchDateTimeInput.value,
      orderDeadline: orderDeadlineInput.value,
    };
    const res = await fetch("/api/matches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    if (result.success) {
      alert("マッチ情報を更新しました");
      window.location.reload();
    } else {
      alert(result.message || "更新に失敗しました");
    }
  });
});
