/**
 * カードを画像としてエクスポートする汎用関数
 * @param {string} cardId - エクスポートするカードのID
 * @param {string} fileName - 保存するファイル名（拡張子なし）
 * @param {HTMLElement} button - クリックされたボタン要素
 */
/**
 * @param {string} cardId - エクスポートするカードのID
 * @param {string} fileName - 保存するファイル名（拡張子なし）
 * @param {HTMLElement} button - クリックされたボタン要素
 * @param {number|{targetWidth?: number, exportMetaText?: string}|null} optionsOrWidth - 幅指定またはオプション
 */
async function exportCardAsImage(
  cardId,
  fileName,
  button,
  optionsOrWidth = null,
) {
  const card = document.getElementById(cardId);
  if (!card) {
    console.error(`カードが見つかりません: ${cardId}`);
    alert("カードの取得に失敗しました");
    return;
  }

  const options =
    typeof optionsOrWidth === "number"
      ? { targetWidth: optionsOrWidth }
      : optionsOrWidth || {};
  const targetWidth = options.targetWidth || null;
  const exportMetaText = options.exportMetaText || "";

  const originalText = button.textContent;
  button.textContent = "生成中...";
  button.disabled = true;

  // リンクとボタンを非表示（高さは保持）

  const links = card.querySelectorAll(".player-link");
  const exportButton = card.querySelector(".export-btn");
  const detailToggleButtons = card.querySelectorAll(".match-detail-toggle-btn");
  const updateButtons = card.querySelectorAll(".update-match-card-btn");

  // 完全非表示用にdisplay:noneを一時適用
  const hiddenElements = [];
  detailToggleButtons.forEach((el) => {
    if (el) {
      hiddenElements.push({ el, prev: el.style.display });
      el.style.display = "none";
    }
  });
  updateButtons.forEach((el) => {
    if (el) {
      hiddenElements.push({ el, prev: el.style.display });
      el.style.display = "none";
    }
  });
  if (exportButton) {
    hiddenElements.push({ el: exportButton, prev: exportButton.style.display });
    exportButton.style.display = "none";
  }
  // 既存のリンク等は従来通り
  links.forEach((link) => link.classList.add("hide-for-export"));

  // エクスポート用のスタイルを適用
  card.classList.add("exporting");

  // 幅を一時的に変更
  const originalWidth = card.style.width;
  const originalMaxWidth = card.style.maxWidth;
  const originalBoxSizing = card.style.boxSizing;
  let exportMetaElement = null;
  let exportBrandHeader = null;
  if (targetWidth) {
    card.style.width = `${targetWidth}px`;
    card.style.maxWidth = `${targetWidth}px`;
    card.style.boxSizing = "border-box";
  }
  exportBrandHeader = document.createElement("div");
  exportBrandHeader.className = "export-brand-header";
  exportBrandHeader.innerHTML = `
    <div class="export-brand-mark">
      <img src="${new URL("./images/oc_mark.png", window.location.href).href}" alt="OC_mark">
    </div>
    <div class="export-brand-title">隊抗戦</div>
  `;
  card.prepend(exportBrandHeader);
  if (exportMetaText) {
    exportMetaElement = document.createElement("div");
    exportMetaElement.textContent = exportMetaText;
    exportMetaElement.style.cssText =
      "font-size: 14px; color: #333; margin-bottom: 10px; text-align: right;";
    if (exportBrandHeader.nextSibling) {
      card.insertBefore(exportMetaElement, exportBrandHeader.nextSibling);
    } else {
      card.appendChild(exportMetaElement);
    }
  }

  try {
    const canvas = await html2canvas(card, {
      backgroundColor: "#ffffff",
      scale: window.devicePixelRatio || 2,
      logging: false,
      useCORS: true,
      width: targetWidth || card.offsetWidth,
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

      // 保存完了メッセージを表示
      alert("保存完了！");

      // リンクとボタンを再表示
      links.forEach((link) => link.classList.remove("hide-for-export"));
      // display:noneを元に戻す
      hiddenElements.forEach(({ el, prev }) => {
        el.style.display = prev;
      });
      card.classList.remove("exporting");
      if (targetWidth) {
        card.style.width = originalWidth;
        card.style.maxWidth = originalMaxWidth;
        card.style.boxSizing = originalBoxSizing;
      }
      if (exportBrandHeader) {
        exportBrandHeader.remove();
      }
      if (exportMetaElement) {
        exportMetaElement.remove();
      }

      button.textContent = originalText;
      button.disabled = false;
    });
  } catch (error) {
    console.error("画像生成エラー:", error);
    alert("画像の生成に失敗しました");

    // エラー時もリンクとボタンを再表示
    links.forEach((link) => link.classList.remove("hide-for-export"));
    hiddenElements.forEach(({ el, prev }) => {
      el.style.display = prev;
    });
    card.classList.remove("exporting");
    if (targetWidth) {
      card.style.width = originalWidth;
      card.style.maxWidth = originalMaxWidth;
      card.style.boxSizing = originalBoxSizing;
    }
    if (exportBrandHeader) {
      exportBrandHeader.remove();
    }
    if (exportMetaElement) {
      exportMetaElement.remove();
    }

    button.textContent = originalText;
    button.disabled = false;
  }
}
