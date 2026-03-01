async function loadPartial(containerId, partialPath) {
  const containerElement = document.getElementById(containerId);
  if (!containerElement) return;

  const response = await fetch(partialPath, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Failed to load: ${partialPath}`);
  containerElement.innerHTML = await response.text();
}

function setupMenu() {
  const menuToggleButton = document.getElementById("menuToggle");
  const navigationMenu = document.getElementById("navMenu");
  const menuOverlay = document.getElementById("menuOverlay");
  const menuTitle = document.getElementById("menuTitle");

  if (!menuToggleButton || !navigationMenu || !menuOverlay) return;

  function openMenu() {
    navigationMenu.classList.add("active");
    menuOverlay.classList.add("active");
    document.body.classList.add("no-scroll");
    menuToggleButton.setAttribute("aria-expanded", "true");
    menuToggleButton.setAttribute("aria-label", "メニューを閉じる");
  }

  function closeMenu() {
    navigationMenu.classList.remove("active");
    menuOverlay.classList.remove("active");
    document.body.classList.remove("no-scroll");
    menuToggleButton.setAttribute("aria-expanded", "false");
    menuToggleButton.setAttribute("aria-label", "メニューを開く");
  }

  function toggleMenu() {
    const isOpen = menuToggleButton.getAttribute("aria-expanded") === "true";
    if (isOpen) closeMenu();
    else openMenu();
  }

  // 現在ページの自動判定
  let currentPath = location.pathname.split("/").pop() || "";
  // ルートパスや空の場合は index.html に統一
  if (!currentPath || currentPath === "") {
    currentPath = "index.html";
  }
  const menuItems = navigationMenu.querySelectorAll(".menu-item");

  for (const menuItemElement of menuItems) {
    const href = menuItemElement.getAttribute("href");

    // hrefから./を削除して、.htmlも削除
    const hrefName = href.replace(/^\.\//, "").replace(/\.html$/, "");
    // currentPathから.htmlを削除
    const currentPageName = currentPath.replace(/\.html$/, "");

    if (hrefName === currentPageName) {
      menuItemElement.classList.add("is-current");
      menuItemElement.setAttribute("aria-current", "page");
    }
  }

  menuToggleButton.addEventListener("click", toggleMenu);
  menuOverlay.addEventListener("click", closeMenu);

  navigationMenu.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  // ログイン状態確認
  const loginLink = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");
  const playerStatusDisplay = document.getElementById("playerStatusDisplay");
  const playerNameDisplay = document.getElementById("playerNameDisplay");

  fetch("/api/me")
    .then((response) => response.json())
    .then((result) => {
      if (result.isLoggedIn) {
        if (loginLink) loginLink.style.display = "none";
        if (logoutLink) logoutLink.style.display = "flex";
        if (playerStatusDisplay && playerNameDisplay) {
          playerStatusDisplay.style.setProperty("display", "flex", "important");
          playerNameDisplay.textContent =
            result.player.playerName || "ユーザー";
        }
      } else {
        if (loginLink) loginLink.style.display = "flex";
        if (logoutLink) logoutLink.style.display = "none";
        if (playerStatusDisplay)
          playerStatusDisplay.style.setProperty("display", "none", "important");
      }
    })
    .catch(() => {
      if (loginLink) loginLink.style.display = "flex";
      if (logoutLink) logoutLink.style.display = "none";
      if (playerStatusDisplay)
        playerStatusDisplay.style.setProperty("display", "none", "important");
    });

  // ログアウト処理
  if (logoutLink) {
    logoutLink.addEventListener("click", async (event) => {
      event.preventDefault();
      await fetch("/api/logout", { method: "POST" }).catch(() => null);
      location.href = "./index.html";
    });
  }
}

async function setupLayout() {
  await loadPartial("headerSlot", "./partials/header.fragment");
  await loadPartial("footerSlot", "./partials/footer.fragment");
  setupMenu();
}

setupLayout();
