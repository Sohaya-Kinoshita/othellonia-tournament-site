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
  const currentPath = location.pathname.split("/").pop() || "index.html";
  const menuItems = navigationMenu.querySelectorAll(".menu-item");

  for (const menuItemElement of menuItems) {
    const href = menuItemElement.getAttribute("href");
    const title = menuItemElement.dataset.title;

    if (href === `./${currentPath}`) {
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

  const loginLink = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");
  const adminLink = document.getElementById("adminLink");
  const teamLink = document.getElementById("teamLink");

  // 初期は両方隠して，状態が取れたら出す
  if (loginLink) loginLink.style.display = "none";
  if (logoutLink) logoutLink.style.display = "none";
  if (adminLink) adminLink.style.display = "none";
  if (teamLink) teamLink.style.display = "none";

  // ログイン状態取得して出し分け
  fetch("/api/me")
    .then((response) => response.json())
    .then((result) => {
      const isLoggedIn = Boolean(result?.isLoggedIn);

      if (loginLink) loginLink.style.display = isLoggedIn ? "none" : "flex";
      if (logoutLink) logoutLink.style.display = isLoggedIn ? "flex" : "none";

      if (adminLink) {
        const isAdmin = result?.user?.role === "admin";
        adminLink.style.display = isLoggedIn && isAdmin ? "flex" : "none";
      }
      if (teamLink) {
        const isTeam = result?.user?.role === "team";
        teamLink.style.display = isLoggedIn && isTeam ? "flex" : "none";
      }
    })
    .catch(() => {
      // 失敗したらログインリンクだけ見せる
      if (loginLink) loginLink.style.display = "flex";
      if (logoutLink) logoutLink.style.display = "none";
    });

  // ログアウト押下
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
