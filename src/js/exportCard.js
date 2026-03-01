/**
 * カードを画像としてエクスポートする汎用関数
 * @param {string} cardId - エクスポートするカードのID
 * @param {string} fileName - 保存するファイル名（拡張子なし）
 * @param {HTMLElement} button - クリックされたボタン要素
 */
async function exportCardAsImage(cardId, fileName, button) {
  const card = document.getElementById(cardId);
  if (!card) {
    console.error(`カードが見つかりません: ${cardId}`);
    alert("カードの取得に失敗しました");
    return;
  }

  const originalText = button.textContent;
  button.textContent = "生成中...";
  button.disabled = true;

  // リンクとボタンを非表示（高さは保持）
  const links = card.querySelectorAll(".player-link");
  const exportButton = card.querySelector(".export-btn");
  links.forEach((link) => link.classList.add("hide-for-export"));
  if (exportButton) {
    exportButton.classList.add("hide-for-export");
  }

  // エクスポート用のスタイルを適用
  card.classList.add("exporting");

  try {
    const canvas = await html2canvas(card, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      useCORS: true,
    });

    canvas.toBlob(function (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // リンクとボタンを再表示
      links.forEach((link) => link.classList.remove("hide-for-export"));
      if (exportButton) {
        exportButton.classList.remove("hide-for-export");
      }
      card.classList.remove("exporting");

      button.textContent = originalText;
      button.disabled = false;
    });
  } catch (error) {
    console.error("画像生成エラー:", error);
    alert("画像の生成に失敗しました");

    // エラー時もリンクとボタンを再表示
    links.forEach((link) => link.classList.remove("hide-for-export"));
    if (exportButton) {
      exportButton.classList.remove("hide-for-export");
    }
    card.classList.remove("exporting");

    button.textContent = originalText;
    button.disabled = false;
  }
}
