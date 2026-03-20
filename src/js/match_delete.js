// マッチ削除画面用スクリプト

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("deleteMatchSearchForm");
  const matchIdInput = document.getElementById("deleteMatchId");
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
    if (!/^[A-Za-z][0-9]{2}$/.test(matchId)) {
      matchDetailBox.textContent = "";
      return;
    }
    matchDetailBox.textContent = "検索中...";
    // チェックボックス非表示初期化
    document.getElementById("orderConfirmBox").style.display = "none";
    document.getElementById("resultConfirmBox").style.display = "none";
    confirmOrderDelete.checked = false;
    confirmResultDelete.checked = false;
    updateDeleteButtonState();
    try {
      const res = await fetch(
        `/api/matches/detail?matchId=${encodeURIComponent(matchId)}`,
      );
      if (!res.ok) throw new Error("マッチが見つかりません");
      const data = await res.json();
      matchDetailBox.innerHTML = `
        <div><b>マッチID:</b> ${data.match_id}</div>
        <div><b>対戦チーム:</b> ${data.team_a_name} vs ${data.team_b_name}</div>
        <div><b>対戦日:</b> ${data.scheduled_at ? data.scheduled_at : "-"}</div>
        <div><b>オーダー提出:</b> ${data.has_confirmed_order ? "済" : "未"}</div>
        <div><b>状態:</b> ${data.match_status ? data.match_status : "-"}</div>
      `;
      // オーダー確定済みならチェックボックス表示
      if (data.has_confirmed_order) {
        document.getElementById("orderConfirmBox").style.display = "block";
      }
      // 試合終了ならチェックボックス表示
      if (data.is_finished) {
        document.getElementById("resultConfirmBox").style.display = "block";
      }
    } catch (e) {
      matchDetailBox.textContent = "マッチが見つかりません";
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const matchId = matchIdInput.value.trim();
    fetchMatchDetail(matchId);
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorDiv.style.display = "none";
    successDiv.style.display = "none";
    const matchId = matchIdInput.value.trim();
    if (!/^[A-Za-z][0-9]{2}$/.test(matchId)) {
      errorDiv.textContent =
        "マッチIDはアルファベット1文字+数字2桁で入力してください（例: M01, s02）";
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
