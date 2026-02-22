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
      if (menuTitle && title) menuTitle.textContent = `現在：${title}`;
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
}

async function setupLayout() {
  await loadPartial("headerSlot", "./partials/header.fragment");
  await loadPartial("footerSlot", "./partials/footer.fragment");
  setupMenu();
}

setupLayout();
