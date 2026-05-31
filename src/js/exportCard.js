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

  const restoreButtonState = () => {
    button.textContent = originalText;
    button.disabled = false;
  };

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
  const exportTarget = card.classList.contains("match-card")
    ? card
    : card.querySelector(".match-card") || card;
  exportTarget.classList.add("exporting");

  // 幅を一時的に変更
  const originalWidth = card.style.width;
  const originalMaxWidth = card.style.maxWidth;
  const originalBoxSizing = card.style.boxSizing;
  const exportTeamElements = [];
  let exportMetaElement = null;
  let exportBrandHeader = null;
  if (targetWidth) {
    card.style.width = `${targetWidth}px`;
    card.style.maxWidth = `${targetWidth}px`;
    card.style.boxSizing = "border-box";
  }
  const teamAElement = card.querySelector(".teams-container > .team-a");
  const teamBElement = card.querySelector(".teams-container > .team-b");
  if (teamAElement) {
    exportTeamElements.push({
      el: teamAElement,
      background: teamAElement.style.background,
      backgroundColor: teamAElement.style.backgroundColor,
      border: teamAElement.style.border,
      borderColor: teamAElement.style.borderColor,
    });
  }
  if (teamBElement) {
    exportTeamElements.push({
      el: teamBElement,
      background: teamBElement.style.background,
      backgroundColor: teamBElement.style.backgroundColor,
      border: teamBElement.style.border,
      borderColor: teamBElement.style.borderColor,
    });
  }
  // 事前にカード本文内に「対戦日」が含まれているか確認しておく（重複防止）
  const cardTextBefore = card.textContent || "";
  const hasScheduledInCard = /対戦日/.test(cardTextBefore);

  exportBrandHeader = document.createElement("div");
  exportBrandHeader.className = "export-brand-header";
  exportBrandHeader.innerHTML = `
    <div class="export-brand">
      <img src="${new URL("./images/Logo_Title.jpg", window.location.href).href}" alt="隊抗戦" class="export-brand-title-img">
    </div>
  `;
  const headerImages = exportBrandHeader.querySelectorAll("img");
  headerImages.forEach((img) => {
    img.setAttribute("loading", "eager");
  });
  card.prepend(exportBrandHeader);
  console.debug("exportCard: inserted exportBrandHeader into", cardId);

  // ロゴ下に対戦日を追加しない（重複を避けるため）。
  // エクスポート対象カードの外側にある「対戦日」表示を一時的に非表示にする。
  const hiddenExternalDateElements = [];
  try {
    const host = card.closest(".card") || document.body;
    const candidates = host.querySelectorAll("div, p, span");
    candidates.forEach((el) => {
      if (!el || card.contains(el)) return;
      const text = (el.textContent || "").trim();
      if (!text) return;
      if (/^対戦日/.test(text) || text.includes("対戦日:")) {
        hiddenExternalDateElements.push({ el, prev: el.style.display });
        el.style.display = "none";
      }
    });
  } catch (e) {
    // ignore
  }
  if (hiddenExternalDateElements.length)
    console.debug(
      "exportCard: hid external date elements",
      hiddenExternalDateElements,
    );

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
    computedBackgroundColor: window.getComputedStyle(card).backgroundColor,
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

    // フォールバック: CSS の背景が取得できない場合は既定の背景画像を使う
    if (!bgImage || bgImage === "none") {
      const fallbackUrl = new URL("./images/背景2.png", window.location.href)
        .href;
      bgImage = `url("${fallbackUrl}")`;
    }

    if (bgImage && bgImage !== "none") {
      card.style.backgroundImage = bgImage;
      card.style.backgroundRepeat = bgRepeat;
      card.style.backgroundPosition = bgPosition;
      if (bgSize) {
        card.style.backgroundSize = bgSize;
      } else {
        card.style.backgroundSize = "auto";
      }
      if (bgAttachment) card.style.backgroundAttachment = bgAttachment;
    }
    card.style.backgroundColor =
      originalBg.computedBackgroundColor || "#ffffff";
  } catch (e) {
    // 取得に失敗しても処理は続行
    console.warn("背景画像の取得に失敗しました:", e);
  }

  try {
    // 挿入した画像が読み込まれるのを待つ（読み込みが完了していないと小さくレンダリングされる）
    const insertedImages = exportBrandHeader.querySelectorAll("img");
    await Promise.all(
      Array.from(insertedImages).map(
        (insertedImg) =>
          new Promise((resolve) => {
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
          }),
      ),
    );

    console.debug("exportCard: calling html2canvas", {
      targetWidth: targetWidth || card.offsetWidth,
    });
    // ensure style/layout changes are applied before rendering
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const canvas = await html2canvas(card, {
      backgroundColor: originalBg.computedBackgroundColor || "#ffffff",
      scale: window.devicePixelRatio || 2,
      logging: false,
      useCORS: true,
      width: targetWidth || card.offsetWidth,
    });
    console.debug("exportCard: html2canvas finished");

    if (!canvas.width || !canvas.height) {
      throw new Error("描画結果が空です");
    }

    const blob = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/png");
    });
    if (!blob) {
      throw new Error("画像データの生成に失敗しました");
    }

    const suggestedFileName = `${fileName}_${new Date().toISOString().slice(0, 10)}.png`;
    if (window.showSaveFilePicker) {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: suggestedFileName,
        types: [
          {
            description: "PNG画像",
            accept: { "image/png": [".png"] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

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
  } catch (error) {
    console.error("画像生成エラー:", error);
    alert("画像の生成に失敗しました");
  } finally {
    links.forEach((link) => link.classList.remove("hide-for-export"));
    hiddenElements.forEach(({ el, prev }) => {
      el.style.display = prev;
    });
    try {
      hiddenExternalDateElements.forEach(({ el, prev }) => {
        el.style.display = prev;
      });
    } catch (e) {
      // ignore
    }
    exportTarget.classList.remove("exporting");
    if (targetWidth) {
      card.style.width = originalWidth;
      card.style.maxWidth = originalMaxWidth;
      card.style.boxSizing = originalBoxSizing;
    }
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
    exportTeamElements.forEach(
      ({ el, background, backgroundColor, border, borderColor }) => {
        el.style.background = background;
        el.style.backgroundColor = backgroundColor;
        el.style.border = border;
        el.style.borderColor = borderColor;
      },
    );

    restoreButtonState();
  }
}
