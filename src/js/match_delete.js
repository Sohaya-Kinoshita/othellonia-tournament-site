// マッチ削除画面用スクリプト

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("deleteMatchForm");
  const matchIdInput = document.getElementById("deleteMatchId");
  const errorDiv = document.getElementById("deleteError");
  const successDiv = document.getElementById("deleteSuccess");
  const confirmOrderDelete = document.getElementById("confirmOrderDelete");
  const confirmResultDelete = document.getElementById("confirmResultDelete");
  const deleteButton = document.getElementById("deleteButton");

  function updateDeleteButtonState() {
    deleteButton.disabled = !(
      confirmOrderDelete.checked && confirmResultDelete.checked
    );
  }
  confirmOrderDelete.addEventListener("change", updateDeleteButtonState);
  confirmResultDelete.addEventListener("change", updateDeleteButtonState);
  updateDeleteButtonState();

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorDiv.style.display = "none";
    successDiv.style.display = "none";
    const matchId = matchIdInput.value.trim();
    if (!/^[A-Z][0-9]{2}$/.test(matchId)) {
      errorDiv.textContent =
        "マッチIDは大文字アルファベット1文字+数字2桁で入力してください（例: M01, S02）";
      errorDiv.style.display = "block";
