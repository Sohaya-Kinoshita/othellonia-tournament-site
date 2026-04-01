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

  let allTeams = [];

  // 初回に全チーム一覧のみ取得
  fetch("/api/teams")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      if (!Array.isArray(data.teams)) {
        searchError.textContent = "チーム情報の取得に失敗しました";
        searchError.style.display = "block";
        return;
      }
      allTeams = data.teams;
    })
    .catch(() => {
      searchError.textContent = "チーム情報の取得に失敗しました";
      searchError.style.display = "block";
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
    if (!/^[A-Z][0-9]{2}$/.test(matchId)) {
      searchError.textContent =
        "マッチIDは大文字アルファベット1文字+数字2桁で入力してください（例: M01, S02）";
      searchError.style.display = "block";
      return;
    }
    fetch(`/api/match-search?matchId=${encodeURIComponent(matchId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          searchError.textContent =
            data.message || "指定されたマッチが見つかりません";
          searchError.style.display = "block";
          editMatchCard.classList.add("hidden");
          return;
        }
        const match = data.match;
        // 編集フォームに値をセット
        matchIdInput.value = match.match_id;
        // マッチIDは常に編集不可（readonly）なので灰色背景に
        matchIdInput.readOnly = true;
        matchIdInput.style.backgroundColor = "#eee";
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
        // 試合終了済みならチームA/B・試合日時・提出期限すべて編集不可
        if (match.winner_team_id) {
          teamASelect.disabled = true;
          teamASelect.title = "試合終了後は編集できません";
          teamASelect.style.backgroundColor = "#eee";
          teamBSelect.disabled = true;
          teamBSelect.title = "試合終了後は編集できません";
          teamBSelect.style.backgroundColor = "#eee";
          matchDateTimeInput.disabled = true;
          matchDateTimeInput.title = "試合終了後は編集できません";
          matchDateTimeInput.style.backgroundColor = "#eee";
          orderDeadlineInput.disabled = true;
          orderDeadlineInput.title = "試合終了後は編集できません";
          orderDeadlineInput.style.backgroundColor = "#eee";
          // 保存ボタン無効化＆エラー文表示
          document.getElementById("editSaveBtn").disabled = true;
          const errMsg = document.getElementById("editErrorMsg");
          errMsg.textContent = "マッチが確定しているので、更新できません。";
          errMsg.style.display = "block";
        } else {
          orderDeadlineInput.disabled = false;
          orderDeadlineInput.title = "";
          orderDeadlineInput.style.backgroundColor = "";
          teamASelect.disabled = false;
          teamASelect.title = "";
          teamASelect.style.backgroundColor = "";
          teamBSelect.disabled = false;
          teamBSelect.title = "";
          teamBSelect.style.backgroundColor = "";
          matchDateTimeInput.disabled = false;
          matchDateTimeInput.title = "";
          matchDateTimeInput.style.backgroundColor = "";
          // 保存ボタン有効化＆エラー文非表示
          document.getElementById("editSaveBtn").disabled = false;
          const errMsg = document.getElementById("editErrorMsg");
          errMsg.textContent = "";
          errMsg.style.display = "none";
        }
        editMatchCard.classList.remove("hidden");
      })
      .catch((err) => {
        searchError.textContent = "検索中にエラーが発生しました";
        searchError.style.display = "block";
        editMatchCard.classList.add("hidden");
      });
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
