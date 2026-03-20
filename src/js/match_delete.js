// マッチ削除画面用スクリプト

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("deleteMatchForm");
  const matchIdInput = document.getElementById("deleteMatchId");
  const errorDiv = document.getElementById("deleteError");
  const successDiv = document.getElementById("deleteSuccess");
  const confirmOrderDelete = document.getElementById("confirmOrderDelete");
  const confirmResultDelete = document.getElementById("confirmResultDelete");
  const deleteButton = document.getElementById("deleteButton");
  const matchDetailBox = document.getElementById("matchDetailBox");

  function updateDeleteButtonState() {
    deleteButton.disabled = !(
      confirmOrderDelete.checked && confirmResultDelete.checked
    );
  }
  confirmOrderDelete.addEventListener("change", updateDeleteButtonState);
  confirmResultDelete.addEventListener("change", updateDeleteButtonState);
  updateDeleteButtonState();

  async function fetchMatchDetail(matchId) {
    if (!/^[A-Z][0-9]{2}$/.test(matchId)) {
      matchDetailBox.textContent = "";
      return;
    }
    matchDetailBox.textContent = "検索中...";
    try {
      const res = await fetch(
        `/api/matches/detail?matchId=${encodeURIComponent(matchId)}`,
      );
      if (!res.ok) throw new Error("マッチが見つかりません");
      const data = await res.json();
      // 例: data = { match_id, team_a_name, team_b_name, scheduled_at, match_status, ... }
      matchDetailBox.innerHTML = `
        <div><b>マッチID:</b> ${data.match_id}</div>
        <div><b>チームA:</b> ${data.team_a_name}</div>
        <div><b>チームB:</b> ${data.team_b_name}</div>
        <div><b>日程:</b> ${data.scheduled_at ? data.scheduled_at : "-"}</div>
        <div><b>状態:</b> ${data.match_status ? data.match_status : "-"}</div>
      `;
    } catch (e) {
      matchDetailBox.textContent = "マッチが見つかりません";
    }
  }

  matchIdInput.addEventListener("input", function () {
    const matchId = matchIdInput.value.trim();
    fetchMatchDetail(matchId);
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorDiv.style.display = "none";
    successDiv.style.display = "none";
    const matchId = matchIdInput.value.trim();
    if (!/^[A-Z][0-9]{2}$/.test(matchId)) {
      errorDiv.textContent =
        "マッチIDは大文字アルファベット1文字+数字2桁で入力してください（例: M01, S02）";
      errorDiv.style.display = "block";
      return;
    }
    deleteButton.disabled = true;
    try {
      const res = await fetch("/api/matches/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "削除に失敗しました");
      }
      successDiv.textContent = "マッチ「" + matchId + "」を削除しました。";
      successDiv.style.display = "block";
      form.reset();
      updateDeleteButtonState();
    } catch (err) {
      errorDiv.textContent = err.message || "削除に失敗しました";
      errorDiv.style.display = "block";
    } finally {
      deleteButton.disabled = false;
    }
  });
});
