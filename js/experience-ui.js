/* Vision Hub compact mobile navigation and shared page-state sync. */
(() => {
  "use strict";
  const pages = [
    { id: "home", label: "Home", icon: "fa-house" },
    { id: "movies", label: "Movies", icon: "fa-clapperboard" },
    { id: "series", label: "Series", icon: "fa-tv" },
    { id: "watchlist", label: "Saved", icon: "fa-bookmark" },
    { id: "more", label: "More", icon: "fa-grid-2" }
  ];

  function sync(name) {
    document.querySelectorAll(".vh-mobile-dock [data-vh-page]").forEach(button => {
      const active = button.dataset.vhPage === name ||
        (button.dataset.vhPage === "more" && !["home", "movies", "series", "watchlist"].includes(name));
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  function createDock() {
    if (document.querySelector(".vh-mobile-dock")) return;
    const dock = document.createElement("nav");
    dock.className = "vh-mobile-dock";
    dock.setAttribute("aria-label", "Quick navigation");

    for (const item of pages) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.vhPage = item.id;
      button.setAttribute("aria-label", item.label);

      const icon = document.createElement("i");
      icon.className = "fas " + item.icon;
      icon.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.textContent = item.label;

      button.append(icon, label);
      dock.appendChild(button);
    }

    document.body.appendChild(dock);
    dock.addEventListener("click", event => {
      const button = event.target.closest("button[data-vh-page]");
      if (!button) return;
      const page = button.dataset.vhPage;
      if (page === "more") {
        window.toggleMenu?.();
        return;
      }
      window.showPage?.(page);
      sync(page);
    });
  }

  function init() {
    createDock();
    document.addEventListener("visionhub:page-changed", event => sync(event.detail?.name || "home"));
    window.addEventListener("hashchange", () => sync(location.hash.replace(/^#/, "") || "home"));
    sync(location.hash.replace(/^#/, "") || "home");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
