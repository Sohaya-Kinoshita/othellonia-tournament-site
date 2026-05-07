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
  // 事前にカード本文内に「対戦日」が含まれているか確認しておく（重複防止）
  const cardTextBefore = card.textContent || "";
  const hasScheduledInCard = /対戦日/.test(cardTextBefore);

  exportBrandHeader = document.createElement("div");
  exportBrandHeader.className = "export-brand-header";
  exportBrandHeader.innerHTML = `
    <div class="export-brand">
      <img src="${new URL("./images/Logo_Title.jpg", window.location.href).href}" alt="Logo_Title" class="export-brand-logo">
    </div>
  `;
  // ロゴの大きさはエクスポート時のみ確実に適用するため、インラインスタイルで設定する
  const headerImg = exportBrandHeader.querySelector(".export-brand-logo");
  if (headerImg) {
    headerImg.style.height = "96px";
    headerImg.style.width = "auto";
    headerImg.setAttribute("loading", "eager");
  }
  card.prepend(exportBrandHeader);

  // ロゴ下に対戦日を追加しない（重複を避けるため）
  // exportMetaText は渡されるが、カード本文に対戦日がある/ないに関わらず
  // ロゴ下には表示しない仕様とする。

  // --- サイトの背景画像をエクスポート画像にも適用 ---
  // body::before などで設定してある背景画像を取得して、
  // エクスポート対象のカード要素に一時的に適用する。
  const originalBg = {
    background: card.style.background || "",
    backgroundImage: card.style.backgroundImage || "",
    backgroundRepeat: card.style.backgroundRepeat || "",
    backgroundPosition: card.style.backgroundPosition || "",
    backgroundSize: card.style.backgroundSize || "",
    backgroundAttachment: card.style.backgroundAttachment || "",
    backgroundColor: card.style.backgroundColor || "",
  };

  try {
    const bodyBefore = window.getComputedStyle(document.body, "::before");
    let bgImage =
      bodyBefore && bodyBefore.backgroundImage
        ? bodyBefore.backgroundImage
        : null;
    const bgRepeat =
      bodyBefore && bodyBefore.backgroundRepeat
        ? bodyBefore.backgroundRepeat
        : "repeat";
    const bgPosition =
      bodyBefore && bodyBefore.backgroundPosition
        ? bodyBefore.backgroundPosition
        : "center";
    const bgSize =
      bodyBefore && bodyBefore.backgroundSize ? bodyBefore.backgroundSize : "";
    const bgAttachment =
      bodyBefore && bodyBefore.backgroundAttachment
        ? bodyBefore.backgroundAttachment
        : "";

    // フォールバック: body 自体に背景がある場合
    if (!bgImage || bgImage === "none") {
      const bodyStyle = window.getComputedStyle(document.body);
      bgImage =
        bodyStyle && bodyStyle.backgroundImage
          ? bodyStyle.backgroundImage
          : null;
    }

    if (bgImage && bgImage !== "none") {
      card.style.backgroundImage = bgImage;
      card.style.backgroundRepeat = bgRepeat;
      card.style.backgroundPosition = bgPosition;
      if (bgSize) card.style.backgroundSize = bgSize;
      if (bgAttachment) card.style.backgroundAttachment = bgAttachment;
      // 背景画像が透けて見えるように、カードの背景色は透明にする
      card.style.backgroundColor = "transparent";
    }
  } catch (e) {
    // 取得に失敗しても処理は続行
    console.warn("背景画像の取得に失敗しました:", e);
  }

  try {
    // 挿入した画像が読み込まれるのを待つ（読み込みが完了していないと小さくレンダリングされる）
    const insertedImg = exportBrandHeader.querySelector(".export-brand-logo");
    if (insertedImg) {
      await new Promise((resolve) => {
        if (insertedImg.complete && insertedImg.naturalWidth > 0)
          return resolve();
        const onLoad = () => {
          insertedImg.removeEventListener("load", onLoad);
          insertedImg.removeEventListener("error", onError);
          resolve();
        };
        const onError = () => {
          insertedImg.removeEventListener("load", onLoad);
          insertedImg.removeEventListener("error", onError);
          // タイムアウトで進める
          resolve();
        };
        insertedImg.addEventListener("load", onLoad);
        insertedImg.addEventListener("error", onError);
        // フェイルセーフ: 2秒後に進める
        setTimeout(resolve, 2000);
      });
    }

    const canvas = await html2canvas(card, {
      backgroundColor: null,
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

      // 保存完了メッセージをボタン下に表示
      let completeMsg = button.parentNode.querySelector(".save-complete-msg");
      if (!completeMsg) {
        completeMsg = document.createElement("div");
        completeMsg.className = "save-complete-msg";
        completeMsg.style.cssText =
          "color: #166534; font-weight: bold; margin-top: 8px; font-size: 15px;";
        button.parentNode.insertBefore(completeMsg, button.nextSibling);
      }
      completeMsg.textContent = "保存完了！";
      setTimeout(() => {
        if (completeMsg) completeMsg.textContent = "";
      }, 3000);

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
      // 背景設定を元に戻す
      try {
        card.style.background = originalBg.background;
        card.style.backgroundImage = originalBg.backgroundImage;
        card.style.backgroundRepeat = originalBg.backgroundRepeat;
        card.style.backgroundPosition = originalBg.backgroundPosition;
        card.style.backgroundSize = originalBg.backgroundSize;
        card.style.backgroundAttachment = originalBg.backgroundAttachment;
        card.style.backgroundColor = originalBg.backgroundColor;
      } catch (e) {
        // ignore
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
    // 背景設定を元に戻す
    try {
      card.style.background = originalBg.background;
      card.style.backgroundImage = originalBg.backgroundImage;
      card.style.backgroundRepeat = originalBg.backgroundRepeat;
      card.style.backgroundPosition = originalBg.backgroundPosition;
      card.style.backgroundSize = originalBg.backgroundSize;
      card.style.backgroundAttachment = originalBg.backgroundAttachment;
      card.style.backgroundColor = originalBg.backgroundColor;
    } catch (e) {
      // ignore
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
