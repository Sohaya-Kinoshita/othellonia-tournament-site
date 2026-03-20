// マッチID検索→編集フォーム表示の流れに対応
document.addEventListener("DOMContentLoaded", function () {
  const matchIdSearchForm = document.getElementById("matchIdSearchForm");
  const searchMatchIdInput = document.getElementById("searchMatchId");
  const searchError = document.getElementById("searchError");
  const editMatchCard = document.getElementById("editMatchCard");
  const matchIdInput = document.getElementById("editMatchId");
  const teamASelect = document.getElementById("editTeamAId");
  const teamBSelect = document.getElementById("editTeamBId");
  const matchDateTimeInput = document.getElementById("editMatchDateTime");
  const orderDeadlineInput = document.getElementById("editOrderDeadline");
  const form = document.getElementById("editMatchForm");

  let allMatches = [];
  let allTeams = [];

  // 初回に全マッチ情報を取得
  fetch("/api/matches")
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        searchError.textContent = "マッチ情報の取得に失敗しました";
        searchError.style.display = "block";
        return;
      }
      allMatches = data.matches;
      // チーム一覧も構築
      const teams = [];
      data.matches.forEach((m) => {
        if (m.team_a_id && !teams.find((t) => t.team_id === m.team_a_id)) {
          teams.push({ team_id: m.team_a_id, team_name: m.team_a_name });
        }
        if (m.team_b_id && !teams.find((t) => t.team_id === m.team_b_id)) {
          teams.push({ team_id: m.team_b_id, team_name: m.team_b_name });
        }
      });
      allTeams = teams;
    });

  matchIdSearchForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const matchId = searchMatchIdInput.value.trim();
    searchError.style.display = "none";
    if (!matchId) {
      searchError.textContent = "マッチIDを入力してください";
      searchError.style.display = "block";
      return;
    }
    const match = allMatches.find((m) => m.match_id === matchId);
    if (!match) {
      searchError.textContent = "指定されたマッチが見つかりません";
      searchError.style.display = "block";
      editMatchCard.classList.add("hidden");
      return;
    }
    // 編集フォームに値をセット
    matchIdInput.value = match.match_id;
    // チームセレクト
    [teamASelect, teamBSelect].forEach((select) => {
      select.innerHTML = "";
      allTeams.forEach((team) => {
        const opt = document.createElement("option");
        opt.value = team.team_id;
        opt.textContent = team.team_name || team.team_id;
        select.appendChild(opt);
      });
    });
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
    editMatchCard.classList.remove("hidden");
  });

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
