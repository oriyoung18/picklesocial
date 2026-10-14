(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  document.documentElement.classList.toggle("picklesocial-standalone", isStandalone());

  // ---------------- Service worker ----------------
  let swRegistration = null;
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", async () => {
      try {
        swRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        swRegistration.update().catch(() => {});

        swRegistration.addEventListener("updatefound", () => {
          const installing = swRegistration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        });
      } catch (err) {
        console.warn("PickleSocial service worker registration failed:", err);
      }
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem("picklesocial-sw-reloading")) return;
      sessionStorage.setItem("picklesocial-sw-reloading", "1");
      location.reload();
    });
  }

  // ---------------- App startup splash ----------------
  function showSplash() {
    if (!isStandalone()) return;
    if (sessionStorage.getItem("picklesocial-splash-shown")) return;
    sessionStorage.setItem("picklesocial-splash-shown", "1");

    const splash = document.createElement("div");
    splash.className = "picklesocial-app-splash";
    splash.innerHTML = `
      <div class="picklesocial-app-splash-icon"><img src="/icon-192.png" alt=""></div>
      <strong>PICKLESOCIAL</strong>
      <span>CHI PHI • RUTGERS</span>
    `;
    document.body.appendChild(splash);
    requestAnimationFrame(() => splash.classList.add("visible"));
    window.setTimeout(() => {
      splash.classList.add("leaving");
      window.setTimeout(() => splash.remove(), 350);
    }, 650);
  }

  // ---------------- Online / offline ----------------
  function ensureOfflineBanner() {
    let el = $("#picklesocialOfflineBanner");
    if (!el) {
      el = document.createElement("div");
      el.id = "picklesocialOfflineBanner";
      el.className = "picklesocial-offline-banner";
      el.innerHTML = `<span>Offline</span> Live rankings, chat, auth, and score submission need a connection.`;
      document.body.appendChild(el);
    }
    el.classList.toggle("show", !navigator.onLine);
  }
  window.addEventListener("online", ensureOfflineBanner);
  window.addEventListener("offline", ensureOfflineBanner);

  // ---------------- Deep-link views ----------------
  function openRequestedView() {
    const view = new URLSearchParams(location.search).get("view");
    if (!view) return;
    let tries = 0;
    const timer = setInterval(() => {
      const target = document.querySelector(`.nav-btn[data-view="${CSS.escape(view)}"]:not(.hidden)`);
      if (target) {
        target.click();
        clearInterval(timer);
        history.replaceState({}, "", location.pathname);
      } else if (++tries > 25) {
        clearInterval(timer);
      }
    }, 120);
  }

  // ---------------- Mobile bottom navigation ----------------
  const primaryItems = [
    ["leaderboard", "⌂", "Home"],
    ["stats", "↗", "Stats"],
    ["submit", "+", "Submit"],
    ["tournaments", "♛", "Bracket"]
  ];

  function navButtonExists(view) {
    const original = document.querySelector(`.nav-btn[data-view="${view}"]`);
    return !!original && !original.classList.contains("hidden");
  }

  function activateView(view) {
    const original = document.querySelector(`.nav-btn[data-view="${view}"]`);
    if (original && !original.classList.contains("hidden")) original.click();
    closeMoreSheet();
  }

  function createBottomNav() {
    if ($("#picklesocialBottomNav")) return;

    const nav = document.createElement("nav");
    nav.id = "picklesocialBottomNav";
    nav.className = "picklesocial-bottom-nav";
    nav.setAttribute("aria-label", "Mobile navigation");
    nav.innerHTML = primaryItems.map(([view, icon, label]) => `
      <button type="button" class="picklesocial-bottom-item" data-picklesocial-view="${view}">
        <span class="picklesocial-bottom-icon">${icon}</span>
        <span>${label}</span>
      </button>
    `).join("") + `
      <button type="button" class="picklesocial-bottom-item" id="picklesocialMoreButton">
        <span class="picklesocial-bottom-icon">•••</span>
        <span>More</span>
      </button>
    `;
    document.body.appendChild(nav);

    nav.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-picklesocial-view]");
      if (btn) activateView(btn.dataset.picklesocialView);
    });
    $("#picklesocialMoreButton", nav)?.addEventListener("click", openMoreSheet);

    syncBottomNav();
  }

  function createMoreSheet() {
    if ($("#picklesocialMoreSheet")) return;
    const overlay = document.createElement("div");
    overlay.id = "picklesocialMoreOverlay";
    overlay.className = "picklesocial-more-overlay";
    overlay.addEventListener("click", closeMoreSheet);

    const sheet = document.createElement("aside");
    sheet.id = "picklesocialMoreSheet";
    sheet.className = "picklesocial-more-sheet";
    sheet.innerHTML = `
      <div class="picklesocial-more-handle"></div>
      <div class="picklesocial-more-head">
        <div>
          <small>PICKLESOCIAL</small>
          <strong>More</strong>
        </div>
        <button type="button" id="picklesocialMoreClose" aria-label="Close">×</button>
      </div>
      <div id="picklesocialMoreLinks" class="picklesocial-more-links"></div>
      <div class="picklesocial-more-install" id="picklesocialInstallArea"></div>
    `;
    document.body.append(overlay, sheet);
    $("#picklesocialMoreClose", sheet)?.addEventListener("click", closeMoreSheet);
  }

  function rebuildMoreLinks() {
    createMoreSheet();
    const host = $("#picklesocialMoreLinks");
    if (!host) return;

    const views = [
      ["leaderboard", "Leaderboard", "Live rankings"],
      ["stats", "Stats", "Head-to-head, chemistry & awards"],
      ["tournaments", "Tournaments", "Brackets & champions"],
      ["challenges", "Challenges", "Schedule a matchup"],
      ["community", "Community", "Chat & announcements"],
      ["submit", "Submit Match", "Send a score"],
      ["my-matches", "My Matches", "Confirmations & history"],
      ["commissioner", "Commissioner", "League controls"]
    ];

    host.innerHTML = views
      .filter(([view]) => navButtonExists(view))
      .map(([view, title, sub]) => `
        <button type="button" data-picklesocial-more-view="${view}">
          <span><strong>${title}</strong><small>${sub}</small></span>
          <b>›</b>
        </button>
      `).join("");

    $$("[data-picklesocial-more-view]", host).forEach((btn) => {
      btn.addEventListener("click", () => activateView(btn.dataset.picklesocialMoreView));
    });

    renderInstallArea();
  }

  function openMoreSheet() {
    rebuildMoreLinks();
    $("#picklesocialMoreOverlay")?.classList.add("open");
    $("#picklesocialMoreSheet")?.classList.add("open");
    document.body.classList.add("picklesocial-sheet-open");
  }

  function closeMoreSheet() {
    $("#picklesocialMoreOverlay")?.classList.remove("open");
    $("#picklesocialMoreSheet")?.classList.remove("open");
    document.body.classList.remove("picklesocial-sheet-open");
  }

  function syncBottomNav() {
    const active = document.querySelector(".nav-btn.active")?.dataset.view;
    $$(".picklesocial-bottom-item[data-picklesocial-view]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.picklesocialView === active);
    });
  }

  const mutationObserver = new MutationObserver(() => {
    syncBottomNav();
    if ($("#picklesocialMoreSheet")?.classList.contains("open")) rebuildMoreLinks();
  });

  // ---------------- Install UI ----------------
  let deferredInstallPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    renderInstallArea();
    maybeShowInstallPill();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    document.documentElement.classList.add("picklesocial-standalone");
    $("#picklesocialInstallPill")?.remove();
    renderInstallArea();
  });

  function renderInstallArea() {
    const area = $("#picklesocialInstallArea");
    if (!area) return;

    if (isStandalone()) {
      area.innerHTML = `<div class="picklesocial-installed-badge">✓ Installed as PickleSocial</div>`;
      return;
    }

    if (deferredInstallPrompt) {
      area.innerHTML = `<button type="button" class="picklesocial-install-primary" id="picklesocialInstallNow">Install PickleSocial</button>`;
      $("#picklesocialInstallNow", area)?.addEventListener("click", installNow);
      return;
    }

    if (isIOS) {
      area.innerHTML = `
        <button type="button" class="picklesocial-install-primary" id="picklesocialIOSInstallHelp">Add PickleSocial to iPhone Home Screen</button>
        <small>Opens like an app with its own icon and no browser bar.</small>
      `;
      $("#picklesocialIOSInstallHelp", area)?.addEventListener("click", showIOSInstallHelp);
      return;
    }

    area.innerHTML = `<small>Use your browser's Install / Add to Home Screen option to install PickleSocial.</small>`;
  }

  async function installNow() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch (_) {}
    deferredInstallPrompt = null;
    renderInstallArea();
    $("#picklesocialInstallPill")?.remove();
  }

  function showIOSInstallHelp() {
    let modal = $("#picklesocialIOSInstallModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "picklesocialIOSInstallModal";
      modal.className = "picklesocial-install-modal";
      modal.innerHTML = `
        <div class="picklesocial-install-card">
          <button type="button" class="picklesocial-install-close" aria-label="Close">×</button>
          <img src="/apple-touch-icon.png" alt="PickleSocial icon">
          <div class="picklesocial-install-kicker">INSTALL PICKLESOCIAL</div>
          <h3>Put PickleSocial on your Home Screen</h3>
          <ol>
            <li>Open PickleSocial in <strong>Safari</strong>.</li>
            <li>Tap the <strong>Share</strong> button.</li>
            <li>Choose <strong>Add to Home Screen</strong>.</li>
            <li>Turn on <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.</li>
          </ol>
          <p>After that, PickleSocial launches from its own icon like an app.</p>
        </div>
      `;
      document.body.appendChild(modal);
      modal.addEventListener("click", (event) => {
        if (event.target === modal || event.target.closest(".picklesocial-install-close")) modal.classList.remove("open");
      });
    }
    modal.classList.add("open");
  }

  function maybeShowInstallPill() {
    if (isStandalone() || $("#picklesocialInstallPill")) return;
    const dismissedAt = Number(localStorage.getItem("picklesocial-install-dismissed") || 0);
    if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    if (!isIOS && !deferredInstallPrompt) return;

    const pill = document.createElement("div");
    pill.id = "picklesocialInstallPill";
    pill.className = "picklesocial-install-pill";
    pill.innerHTML = `
      <img src="/icon-192.png" alt="">
      <span><strong>Install PickleSocial</strong><small>Add it to your Home Screen</small></span>
      <button type="button" class="picklesocial-install-pill-go">Install</button>
      <button type="button" class="picklesocial-install-pill-close" aria-label="Dismiss">×</button>
    `;
    document.body.appendChild(pill);

    $(".picklesocial-install-pill-go", pill)?.addEventListener("click", () => {
      if (deferredInstallPrompt) installNow();
      else showIOSInstallHelp();
    });
    $(".picklesocial-install-pill-close", pill)?.addEventListener("click", () => {
      localStorage.setItem("picklesocial-install-dismissed", String(Date.now()));
      pill.remove();
    });
  }

  // ---------------- App update toast ----------------
  function showUpdateToast() {
    if ($("#picklesocialUpdateToast")) return;
    const toast = document.createElement("div");
    toast.id = "picklesocialUpdateToast";
    toast.className = "picklesocial-update-toast";
    toast.innerHTML = `
      <span><strong>PickleSocial update ready</strong><small>Reload for the newest version.</small></span>
      <button type="button">Update</button>
    `;
    document.body.appendChild(toast);
    $("button", toast)?.addEventListener("click", () => {
      const waiting = swRegistration?.waiting;
      if (waiting) waiting.postMessage("SKIP_WAITING");
      else location.reload();
    });
  }

  // ---------------- Boot ----------------
  function boot() {
    createBottomNav();
    createMoreSheet();
    rebuildMoreLinks();
    ensureOfflineBanner();
    openRequestedView();
    showSplash();
    maybeShowInstallPill();

    const existingNav = $(".nav-tabs");
    if (existingNav) {
      mutationObserver.observe(existingNav, {
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
      });
      existingNav.addEventListener("click", () => setTimeout(syncBottomNav, 0));
    }

    window.matchMedia("(display-mode: standalone)").addEventListener?.("change", () => {
      document.documentElement.classList.toggle("picklesocial-standalone", isStandalone());
      renderInstallArea();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
