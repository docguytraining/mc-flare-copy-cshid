//
// copy-csh - Version 2.0.0
// MadCap Flare Copy CSHID
//
// Copyright 2025
// All Rights Reserved.
//
// Dual-licensed under the MIT and GNU GPL licenses
//
// Author: Paul Pehrson (paul@docguytraining.com)
// Created with AI assistance (ChatGPT) for optimization, security, and best practices.
// Final version reviewed and refined by the author.
//
// Created: March 14, 2025
// Last Updated: November 13, 2025
//
// Public Repo: https://github.com/docguytraining/mc-flare-copy-cshid
//
// Description:
// This script, when linked to a Topic Toolbar button in MadCap Flare output,
// uses the current URL and the Alias.xml file to see if there is an existing CSHID
// for the current topic. If there is, it will attempt to copy the link, using the CSHID,
// to the clipboard. If there isn't, it will attempt to copy a clean link (with no
// URL parameters) to the clipboard. If copying to the clipboard fails, it will show a
// small modal window with the URL so it can be easily copied.
//
// Version History:
// 2.0  (2025-11-13) - Inline settings coherence + logLevel adoption; minor fixes; optional Alias cache TTL,
//        Resilient base discovery + CSH lookup, improved toast location, clipboard hardening.
// 1.0  (2025-03-14) - Initial release.
//
// Dependencies:
// - None (Vanilla JavaScript, no jQuery required)
// - Works with MadCap Flare v20+
//
// Usage:
// 1. Copy this script to your Flare project.
// 2. Add a new button to the Topic Toolbar with the name CopyURL.
// 3. Set the icon for the button to an icon of your choosing.
// 4. You do not need to call this using the Event setting in Flare. It uses an event handler
//    to watch for clicks to the button.
// 5. Modify your masterpage to include a link to this script like this:
//    <script src="../path/to/copy-csh.js"></script>
// 6. When you build your project, and click the button, the clipboard will have a URL
//    with the CSHID, if available, and if not, a URL stripped of query parameters.
//
// ----------
// Settings (inline-only):
// Optional inline settings override. DISABLED by default (auto-discovery).
// Set useCustomSettings to true and update values to force absolute path settings.
// ----------
window.CopyCSH = window.CopyCSH || {
  // Set to true to force these values; set to false (or remove) for auto-discovery.
  useCustomSettings: false,
  // Base path where Default.* lives (trailing slash optional). "/" means site root.
  basePath: "/",
  // Alias path; if left default, it will follow basePath (i.e., <base>/Data/Alias.xml).
  aliasPath: "/Data/Alias.xml",
  // Default extension for Default.* if Alias link does not specify one.
  defaultExt: "htm",
  // Optional UX/logging overrides:
  logLevel: 1,                 // 0=off, 1=basic, 2=debug
  buttonSelector: ".copy-url-button",
  toastDuration: 1500          // ms
};

// Keep aliasPath coherent with basePath when alias looks default.
(function syncAliasToBase(){
  const cfg = window.CopyCSH || {};
  const aliasLooksDefault = !cfg.aliasPath || cfg.aliasPath === "/Data/Alias.xml";
  if (aliasLooksDefault) {
    const base = typeof cfg.basePath === "string" ? cfg.basePath : "/";
    window.CopyCSH.aliasPath = (base === "/" ? "/Data/Alias.xml" : base.replace(/\/+$/,"") + "/Data/Alias.xml");
  }
})();

// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Adopt inline logLevel if provided
  const cfgInlineOnce = getInlineConfig();
  let logLevel = Number((cfgInlineOnce && typeof cfgInlineOnce.logLevel === "number") ? cfgInlineOnce.logLevel : (window.CopyCSH?.logLevel ?? 1));
  const buttonSelector = window.CopyCSH?.buttonSelector || ".copy-url-button";
  const toastDuration = Number(window.CopyCSH?.toastDuration ?? 1500);

  function log(level, ...args) { if (logLevel >= level) console.log(...args); }
  function warn(...args) { console.warn(...args); }
  function error(...args) { console.error(...args); }

  log(1, "copy-csh v2.0.1 loaded.");

  // =============== Utilities ===============
  function splitPath(pathname) { return pathname.split("/").filter(Boolean); }
  function joinPath(parts) { return "/" + parts.join("/"); }
  function hasFileExt(seg) { return /\.[a-z0-9]+$/i.test(seg || ""); }
  function stripLeadingSlash(s) { return (s || "").replace(/^\/+/, ""); }
  function stripUrlVariables(url) { return url.split("?")[0].split("#")[0]; }
  function joinBase(basePath, rest) {
    const base = basePath === "/" ? "" : basePath.replace(/\/+$/,"");
    const tail = (rest || "").startsWith("/") ? rest : "/" + (rest || "");
    return base + tail;
  }
  function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
  async function withTimeout(promise, ms, abortController) {
    const t = setTimeout(() => abortController.abort(), ms);
    try { return await promise; } finally { clearTimeout(t); }
  }

  // =============== Config helpers (inline only) ===============
  function getInlineConfig() {
    const raw = window.CopyCSH || {};
    return {
      useCustomSettings: !!raw.useCustomSettings,
      basePath: typeof raw.basePath === "string" ? raw.basePath : undefined,
      aliasPath: typeof raw.aliasPath === "string" ? raw.aliasPath : undefined,
      defaultExt: typeof raw.defaultExt === "string" ? raw.defaultExt.toLowerCase() : "htm",
      logLevel: typeof raw.logLevel === "number" ? raw.logLevel : undefined,
      buttonSelector: typeof raw.buttonSelector === "string" ? raw.buttonSelector : undefined,
      toastDuration: typeof raw.toastDuration === "number" ? raw.toastDuration : undefined
    };
  }

  function finalizeFromBaseAndAlias(basePath, aliasPath) {
    const p = window.location.pathname;
    const base = basePath === "/" ? "/" : basePath.replace(/\/+$/,"");
    const alias = aliasPath.startsWith("/") ? aliasPath : "/" + aliasPath;
    const prefix = (base === "/" ? "/" : base + "/");
    const targetRelative = p.startsWith(prefix) ? p.slice(prefix.length) : p.replace(/^\//,"");
    return { basePath: base, aliasPath: alias, targetRelative };
  }

  // =============== Auto-discovery (fallback if inline disabled) ===============
  function candidateBases(pathname) {
    const parts = splitPath(pathname);
    const out = new Set();

    // Prefer "/Docs/<ver>/TopNav" anywhere in the path
    const m = pathname.match(/(\/Docs\/[^/]+\/TopNav)(?=\/)/i);
    if (m) out.add(m[1]);

    // If under ".../Content/...": everything before "Content"
    const contentIdx = parts.lastIndexOf("Content");
    if (contentIdx !== -1) out.add(joinPath(parts.slice(0, contentIdx)));

    // Walk up a few ancestors (covers no-Content builds and arbitrary nests)
    const MAX_UP = 6;
    for (let i = parts.length; i > 0 && parts.length - i <= MAX_UP; i--) {
      const seg = parts[i - 1] || "";
      if (hasFileExt(seg)) {
        if (i - 1 > 0) out.add(joinPath(parts.slice(0, i - 1)));
      } else {
        out.add(joinPath(parts.slice(0, i)));
      }
    }

    // Site root last
    out.add("/");
    return Array.from(out);
  }

  async function probeBaseForAliasXml(base) {
    const url = window.location.origin + joinBase(base, "Data/Alias.xml");
    const ac = new AbortController();
    try {
      const resp = await withTimeout(fetch(url, {
        mode: "same-origin",
        credentials: "same-origin",
        cache: "no-store",
        signal: ac.signal
      }), 2000, ac);
      return resp && resp.ok ? { ok: true, base, aliasUrl: url } : { ok: false };
    } catch {
      return { ok: false };
    }
  }

  async function discoverFlareContextAutoprobe() {
    const p = window.location.pathname;
    const candidates = candidateBases(p);
    log(2, "Probe candidates:", candidates);

    let basePath = null;
    let aliasPath = null;

    for (const base of candidates) {
      const res = await probeBaseForAliasXml(base);
      if (res.ok) {
        basePath = res.base;
        aliasPath = res.aliasUrl.replace(window.location.origin, "");
        break;
      }
      await sleep(30);
    }

    if (!basePath) {
      const parts = splitPath(p);
      const contentIdx = parts.lastIndexOf("Content");
      if (contentIdx !== -1) basePath = joinPath(parts.slice(0, contentIdx));
      else basePath = hasFileExt(parts[parts.length - 1]) ? joinPath(parts.slice(0, -1)) : joinPath(parts);
      aliasPath = joinBase(basePath, "Data/Alias.xml");
      warn("Alias.xml probe failed; using heuristic base:", basePath, "aliasPath:", aliasPath);
    }

    const prefix = basePath.replace(/\/+$/, "") + "/";
    const targetRelative = p.startsWith(prefix) ? p.slice(prefix.length) : p.replace(/^\//,"");

    log(1, "Determined basePath:", basePath);
    log(1, "Determined aliasPath:", aliasPath);
    log(1, "Determined targetRelative:", targetRelative);

    return { basePath, aliasPath, targetRelative };
  }

  // =============== Unified discovery (inline override OR auto) ===============
  async function discoverFlareContextWithInline() {
    const cfg = getInlineConfig();
    if (cfg.useCustomSettings && (cfg.basePath || cfg.aliasPath)) {
      const base = cfg.basePath || "/";
      const alias = cfg.aliasPath || (base === "/" ? "/Data/Alias.xml" : base.replace(/\/+$/,"") + "/Data/Alias.xml");
      const ctx = finalizeFromBaseAndAlias(base, alias);
      ctx._defaultExt = cfg.defaultExt || "htm";
      // adopt potential runtime change to log level, selector, duration
      if (typeof cfg.logLevel === "number") logLevel = cfg.logLevel;
      if (typeof cfg.toastDuration === "number") { /* already read at load; keep if needed */ }
      log(1, "Using inline settings:", { basePath: ctx.basePath, aliasPath: ctx.aliasPath, defaultExt: ctx._defaultExt });
      return ctx;
    }
    // fallback to auto-discovery
    const ctx = await discoverFlareContextAutoprobe();
    ctx._defaultExt = "htm";
    return ctx;
  }

  // =============== Alias.xml match (with simple cache + optional TTL) ===============
  let aliasCache = null;
  const TEN_MIN = 10 * 60 * 1000;

  async function getCshId(aliasPath, targetRelative) {
    // Cache hit
    if (aliasCache?.index && (Date.now() - aliasCache.ts) <= TEN_MIN) {
      const contentPrefixLen = "content/".length;
      const rel = (targetRelative || "").trim().toLowerCase();
      const relNoContent = rel.startsWith("content/") ? rel.slice(contentPrefixLen) : rel;
      const relFile = rel.split("/").pop();
      const hit = aliasCache.index.full[rel]
        || aliasCache.index.noContent[relNoContent]
        || aliasCache.index.file[relFile];
      if (hit) {
        log(1, "CSH (cached) match:", hit);
        return { cshId: hit.cshId, correctExtension: hit.ext };
      }
    }

    try {
      const xmlUrl = window.location.origin + aliasPath;
      log(1, "Fetching Alias.xml from:", xmlUrl);

      const ac = new AbortController();
      const response = await Promise.race([
        fetch(xmlUrl, {
          cache: "no-store",
          mode: "same-origin",
          credentials: "same-origin",
          signal: ac.signal
        }),
        (async () => { await sleep(4000); ac.abort(); })()
      ]);
      if (!response || !response.ok) throw new Error("Failed to fetch XML");

      const xmlText = await response.text();
      if (xmlText.length > 2_000_000) throw new Error("Alias.xml too large");
      log(2, "Alias.xml bytes:", xmlText.length);

      const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");
      const maps = xmlDoc.getElementsByTagName("Map");

      // Build/refresh indices
      aliasCache = { maps: [], index: { full: {}, noContent: {}, file: {} }, ts: Date.now() };
      const contentPrefixLen = "content/".length;

      for (let map of maps) {
        let link = (map.getAttribute("Link") || "").trim().toLowerCase();
        if (!link) continue;
        const linkNoContent = link.startsWith("content/") ? link.slice(contentPrefixLen) : link;
        const linkFile = link.split("/").pop();
        const cshId = map.getAttribute("ResolvedId");
        const rawExt = (link.split(".").pop() || "htm").toLowerCase().replace(/[^a-z0-9]/g,"");
        const allowed = new Set(["htm","html","php"]);
        const ext = allowed.has(rawExt) ? rawExt : "htm";
        const entry = { link, cshId, ext };
        aliasCache.index.full[link] = entry;
        aliasCache.index.noContent[linkNoContent] = entry;
        aliasCache.index.file[linkFile] = entry;
      }

      const rel = (targetRelative || "").trim().toLowerCase();
      const relNoContent = rel.startsWith("content/") ? rel.slice(contentPrefixLen) : rel;
      const relFile = rel.split("/").pop();

      const hit = aliasCache.index.full[rel]
        || aliasCache.index.noContent[relNoContent]
        || aliasCache.index.file[relFile];

      if (hit) {
        log(1, "CSH match:", hit);
        return { cshId: hit.cshId, correctExtension: hit.ext };
      }

      warn("No match found in Alias.xml for:", targetRelative);
      return null;
    } catch (err) {
      error("Error fetching/parsing Alias.xml:", err);
      return null;
    }
  }

  // =============== UI: toast and dialog ===============
  function showToast(message, event = null) {
    const toast = document.createElement("div");
    toast.innerText = message;
    toast.style.position = "fixed";
    toast.style.background = "black";
    toast.style.color = "white";
    toast.style.padding = "8px 12px";
    toast.style.borderRadius = "5px";
    toast.style.opacity = "0.95";
    toast.style.transition = "opacity 0.5s ease-in-out";
    toast.style.zIndex = "2000";
    toast.style.fontSize = "13px";
    toast.style.pointerEvents = "none";
    toast.setAttribute("role", "status");

    // Default: bottom-right
    let x = window.innerWidth - 160;
    let y = window.innerHeight - 80;

    // Prefer near click or button
    if (event && typeof event.clientX === "number" && typeof event.clientY === "number") {
      x = event.clientX + 15;
      y = event.clientY + 20;
    } else {
      const btn = document.querySelector(buttonSelector);
      if (btn) {
        const rect = btn.getBoundingClientRect();
        x = rect.right - 40;
        y = rect.bottom + 10;
      }
    }

    // Clamp
    x = Math.min(Math.max(10, x), window.innerWidth - 200);
    y = Math.min(Math.max(10, y), window.innerHeight - 60);

    toast.style.left = `${x}px`;
    toast.style.top = `${y}px`;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => document.body.removeChild(toast), 500);
    }, toastDuration);
  }

  function showManualCopyDialog(text, event = null) {
    const existing = document.getElementById("copy-cshid-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "copy-cshid-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Copy URL dialog");
    Object.assign(modal.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "#ffffff",
      color: "#222",
      padding: "14px 16px",
      border: "1px solid #444",
      borderRadius: "6px",
      boxShadow: "0 4px 14px rgba(0,0,0,.35)",
      zIndex: "3000",
      width: "320px",
      fontFamily: "Arial, sans-serif",
      fontSize: "13px"
    });

    const label = document.createElement("div");
    label.textContent = "Copy URL manually:";
    label.style.marginBottom = "6px";
    label.style.fontWeight = "600";

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    Object.assign(textArea.style, {
      width: "100%",
      height: "90px",
      resize: "none",
      fontSize: "12px",
      padding: "6px",
      boxSizing: "border-box"
    });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.marginTop = "10px";
    actions.style.justifyContent = "flex-end";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Close";

    [copyBtn, closeButton].forEach(btn => {
      Object.assign(btn.style, {
        cursor: "pointer",
        padding: "5px 10px",
        borderRadius: "4px",
        border: "1px solid #555",
        background: "#f3f3f3"
      });
    });

    copyBtn.addEventListener("click", () => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showToast("Copied!", event);
          modal.remove();
        }).catch(() => {
          textArea.select();
          showToast("Select & copy.", event);
        });
      } else {
        textArea.select();
        showToast("Select & copy.", event);
      }
    });

    closeButton.addEventListener("click", () => modal.remove());
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") modal.remove();
    });

    actions.appendChild(copyBtn);
    actions.appendChild(closeButton);
    modal.appendChild(label);
    modal.appendChild(textArea);
    modal.appendChild(actions);
    document.body.appendChild(modal);
    textArea.focus();
    textArea.select();

    if (event && typeof event.clientX === "number" && typeof event.clientY === "number") {
      modal.style.top = `${Math.max(20, Math.min(window.innerHeight - 200, event.clientY + 20))}px`;
      modal.style.left = `${Math.max(20, Math.min(window.innerWidth - 340, event.clientX + 20))}px`;
      modal.style.transform = "none";
    }
  }

  // =============== Clipboard + main flow ===============
  function copyToClipboard(text, event) {
    if (!(event?.isTrusted)) {
      warn("Blocked non-trusted invocation of copy action.");
      return;
    }
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast("Copied to clipboard!", event))
        .catch(() => showManualCopyDialog(text, event));
    } else {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        if (document.execCommand) ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) showToast("Copied to clipboard!", event);
        else throw new Error("execCommand copy failed");
      } catch {
        showManualCopyDialog(text, event);
      }
    }
  }

  async function handleCopyUrlClick(event) {
    if (!(event?.isTrusted)) { warn("Blocked synthetic click."); return; }
    log(1, "Copy URL button clicked.");

    const { basePath, aliasPath, targetRelative, _defaultExt } = await discoverFlareContextWithInline();
    log(1, "Context:", { basePath, aliasPath, targetRelative });

    const result = await getCshId(aliasPath, targetRelative);

    let finalUrl;
    if (result) {
      const ext = result.correctExtension || _defaultExt || "htm";
      finalUrl = `${window.location.origin}${joinBase(basePath, `Default.${ext}`)}#cshid=${result.cshId}`;
      log(1, "CSH URL:", finalUrl);
    } else {
      finalUrl = stripUrlVariables(window.location.href);
      warn("No CSH ID; using fallback:", finalUrl);
    }

    copyToClipboard(finalUrl, event);
  }

  // =============== Button wiring ===============
  function attachButtonListener() {
    const button = document.querySelector(buttonSelector);
    if (button) {
      button.removeEventListener("click", handleCopyUrlClick);
      button.addEventListener("click", (e) => handleCopyUrlClick(e));
      log(1, "Listener attached to", buttonSelector);
    } else {
      const observer = new MutationObserver(() => {
        const newButton = document.querySelector(buttonSelector);
        if (newButton) {
          observer.disconnect();
          attachButtonListener();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      log(1, "Watching for dynamically inserted", buttonSelector);
    }
  }

  attachButtonListener();

  // ---------- inner helpers (defined after first use for clarity) ----------
  async function discoverFlareContextWithInline() {
    const cfg = getInlineConfig();
    if (cfg.useCustomSettings && (cfg.basePath || cfg.aliasPath)) {
      const base = cfg.basePath || "/";
      const alias = cfg.aliasPath || (base === "/" ? "/Data/Alias.xml" : base.replace(/\/+$/,"") + "/Data/Alias.xml");
      const ctx = finalizeFromBaseAndAlias(base, alias);
      ctx._defaultExt = cfg.defaultExt || "htm";
      if (typeof cfg.logLevel === "number") logLevel = cfg.logLevel;
      log(1, "Using inline settings:", { basePath: ctx.basePath, aliasPath: ctx.aliasPath, defaultExt: ctx._defaultExt });
      return ctx;
    }
    const ctx = await discoverFlareContextAutoprobe();
    ctx._defaultExt = "htm";
    return ctx;
  }
});
