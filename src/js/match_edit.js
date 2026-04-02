// 未開始マッチ一覧表示＋部分一致検索＋編集フォーム表示
document.addEventListener("DOMContentLoaded", function () {
  const unstartedMatchesBox = document.getElementById("unstartedMatchesBox");
  const matchIdSearchForm = document.getElementById("matchIdSearchForm");
  const matchSearchType = document.getElementById("matchSearchType");
  const searchMatchIdInput = document.getElementById("searchMatchId");
  const matchSearchBtn = document.getElementById("matchSearchBtn");
  const matchSearchClearBtn = document.getElementById("matchSearchClearBtn");
  const searchError = document.getElementById("searchError");
  const editMatchCard = document.getElementById("editMatchCard");
  const matchIdInput = document.getElementById("editMatchId");
  const teamASelect = document.getElementById("editTeamAId");
  const teamBSelect = document.getElementById("editTeamBId");
  const matchDateTimeInput = document.getElementById("editMatchDateTime");
  const orderDeadlineInput = document.getElementById("editOrderDeadline");
  const editErrorMsg = document.getElementById("editErrorMsg");
  const editSaveBtn = document.getElementById("editSaveBtn");
  const form = document.getElementById("editMatchForm");

  let allTeams = [];
  let unstartedMatches = [];

  function setSearchError(message) {
    if (message) {
      searchError.textContent = message;
      searchError.classList.remove("hidden");
      return;
    }
    searchError.textContent = "";
    searchError.classList.add("hidden");
  }

  function toDateTimeLocalValue(value) {
    if (!value) return "";
    return String(value).replace(" ", "T").slice(0, 16);
  }

  function setTeamSelectOptions() {
    [teamASelect, teamBSelect].forEach((select) => {
      select.innerHTML = "";
      allTeams.forEach((team) => {
        const opt = document.createElement("option");
        opt.value = team.team_id;
        opt.textContent = team.team_name || team.team_id;
        select.appendChild(opt);
      });
    });
  }

  function applyEditLockState(match) {
    const isFinished = !!match.winner_team_id;
    [teamASelect, teamBSelect, matchDateTimeInput, orderDeadlineInput].forEach(
      (element) => {
        element.disabled = isFinished;
        element.title = isFinished ? "試合終了後は編集できません" : "";
        element.style.backgroundColor = isFinished ? "#eee" : "";
      },
    );

    editSaveBtn.disabled = isFinished;
    if (isFinished) {
      editErrorMsg.textContent = "マッチが確定しているので、更新できません。";
      editErrorMsg.classList.remove("hidden");
      return;
    }
    editErrorMsg.textContent = "";
    editErrorMsg.classList.add("hidden");
  }

  function openEditor(match) {
    matchIdInput.value = match.match_id;
    matchIdInput.readOnly = true;
    matchIdInput.style.backgroundColor = "#eee";

    setTeamSelectOptions();
    teamASelect.value = match.team_a_id || "";
    teamBSelect.value = match.team_b_id || "";
    matchDateTimeInput.value = toDateTimeLocalValue(match.scheduled_at);
    orderDeadlineInput.value = toDateTimeLocalValue(match.order_deadline);

    applyEditLockState(match);
    editMatchCard.classList.remove("hidden");
  }

  function renderUnstartedMatches(matches) {
    if (!unstartedMatchesBox) return;
    if (!matches.length) {
      unstartedMatchesBox.innerHTML =
        "<div>条件に一致する未開始マッチはありません</div>";
      return;
    }

    let html =
      '<div class="table-wrap"><table><thead><tr><th>ID</th><th>チームA</th><th>チームB</th><th>日時</th><th>操作</th></tr></thead><tbody>';
    for (const match of matches) {
      html += `<tr><td>${match.match_id}</td><td>${match.team_a_name || match.team_a_id}</td><td>${match.team_b_name || match.team_b_id}</td><td>${toDateTimeLocalValue(match.scheduled_at).replace("T", " ")}</td><td><button type="button" class="btn edit-btn" data-match-id="${match.match_id}">編集</button></td></tr>`;
    }
    html += "</tbody></table></div>";
    unstartedMatchesBox.innerHTML = html;

    unstartedMatchesBox.querySelectorAll(".edit-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const targetMatchId = this.getAttribute("data-match-id");
        const target = unstartedMatches.find(
          (m) => m.match_id === targetMatchId,
        );
        if (target) {
          openEditor(target);
        }
      });
    });
  }

  function filterAndRenderMatches(keyword) {
    const q = (keyword || "").trim().toLowerCase();
    if (!q) {
      renderUnstartedMatches(unstartedMatches);
      return;
    }

    const selectedType = matchSearchType ? matchSearchType.value : "team_name";
    const filtered = unstartedMatches.filter((m) => {
      const id = String(m.match_id || "").toLowerCase();
      const teamA = String(m.team_a_name || m.team_a_id || "").toLowerCase();
      const teamB = String(m.team_b_name || m.team_b_id || "").toLowerCase();

      if (selectedType === "match_id") {
        return id.includes(q);
      }
      return teamA.includes(q) || teamB.includes(q);
    });
    renderUnstartedMatches(filtered);
  }

  Promise.all([fetch("/api/teams"), fetch("/api/matches")])
    .then(async ([teamsRes, matchesRes]) => {
      if (!teamsRes.ok || !matchesRes.ok) {
        throw new Error("データ取得失敗");
      }

      const teamsData = await teamsRes.json();
      const matchesData = await matchesRes.json();

      if (!Array.isArray(teamsData.teams) || !matchesData.success) {
        throw new Error("データ形式エラー");
      }

      allTeams = teamsData.teams;
      unstartedMatches = (matchesData.matches || []).filter(
        (m) => m.match_status === "before",
      );
      renderUnstartedMatches(unstartedMatches);
      setSearchError("");
    })
    .catch(() => {
      setSearchError("マッチ情報の取得に失敗しました");
      unstartedMatchesBox.innerHTML =
        "<div>未開始マッチ一覧を読み込めませんでした</div>";
    });

  matchIdSearchForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (matchSearchBtn) {
      matchSearchBtn.click();
    }
  });

  if (matchSearchBtn) {
    matchSearchBtn.addEventListener("click", function () {
      setSearchError("");
      filterAndRenderMatches(searchMatchIdInput.value);
    });
  }

  if (matchSearchClearBtn) {
    matchSearchClearBtn.addEventListener("click", function () {
      searchMatchIdInput.value = "";
      if (matchSearchType) {
        matchSearchType.value = "team_name";
      }
      setSearchError("");
      renderUnstartedMatches(unstartedMatches);
      editMatchCard.classList.add("hidden");
    });
  }

  searchMatchIdInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (matchSearchBtn) {
        matchSearchBtn.click();
      }
    }
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
