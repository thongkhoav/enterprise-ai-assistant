/*
 * DocAnswer widget: adds the assistant to any web page with one script tag.
 *
 *   <script src="https://your-docanswer-host/widget.js"
 *           data-name="Ask Acme" data-context="benefits" defer></script>
 *
 * data-name     label on the launcher and in the panel header (default "Ask Acme")
 * data-context  page topic for the starter questions: "benefits", "it" or empty
 *
 * The page can also call window.DocAnswer.open("question") to open the panel and ask.
 *
 * Loaded by a tag manager or as a module, where the script tag cannot be found, set
 * window.DocAnswerConfig = { host: "https://your-docanswer-host", name, context } first.
 */
(function () {
  if (window.DocAnswer) return;

  var config = window.DocAnswerConfig || {};
  var script = document.currentScript || document.querySelector('script[src*="widget.js"]');
  var data = (script && script.dataset) || {};
  var host = config.host || (script && script.src);
  if (!host) {
    console.warn("DocAnswer widget: set window.DocAnswerConfig.host to load it.");
    return;
  }
  var origin = new URL(host, window.location.href).origin;
  var name = config.name || data.name || "Ask Acme";
  var context = config.context || data.context || "";
  var OPEN_KEY = "docanswer-widget-open";
  // Set while a request waits for a person, so every page loads the panel in the background.
  var WATCH_KEY = "docanswer-widget-watch";
  // A reply arrived but the panel was not opened yet; the dot survives page loads.
  var UNREAD_KEY = "docanswer-widget-unread";

  var css = [
    ".dqa-launcher{position:fixed;right:24px;bottom:24px;z-index:2147483000;display:flex;",
    "align-items:center;gap:8px;height:52px;padding:0 20px 0 16px;border:0;border-radius:999px;",
    "background:linear-gradient(135deg,#6366f1,#8b5cf6 55%,#ec4899);color:#fff;cursor:pointer;",
    "font:600 15px/1 Inter,system-ui,-apple-system,sans-serif;",
    "box-shadow:0 12px 30px rgba(79,70,229,.35);transition:transform .2s,box-shadow .2s}",
    ".dqa-launcher:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(79,70,229,.45)}",
    ".dqa-launcher svg{width:20px;height:20px}",
    ".dqa-launcher.dqa-open{width:52px;padding:0;justify-content:center}",
    ".dqa-launcher.dqa-open .dqa-label{display:none}",
    ".dqa-dot{position:absolute;top:2px;right:2px;width:12px;height:12px;border:2px solid #fff;",
    "border-radius:50%;background:#ef4444;display:none}",
    ".dqa-launcher.dqa-unread .dqa-dot{display:block}",
    ".dqa-panel{position:fixed;right:24px;bottom:90px;z-index:2147483000;width:420px;",
    "height:min(700px,calc(100vh - 120px));border-radius:18px;overflow:hidden;background:#f6f7fb;",
    "box-shadow:0 24px 70px rgba(15,23,42,.28),0 0 0 1px rgba(15,23,42,.06);opacity:0;",
    "transform:translateY(16px) scale(.98);transform-origin:bottom right;pointer-events:none;",
    "transition:opacity .22s ease,transform .22s ease}",
    ".dqa-panel.dqa-open{opacity:1;transform:none;pointer-events:auto}",
    ".dqa-panel iframe{width:100%;height:100%;border:0;display:block}",
    "@media (max-width:520px){.dqa-panel{inset:0;width:auto;height:auto;border-radius:0}",
    ".dqa-launcher.dqa-open{display:none}}",
  ].join("");

  var sparkles =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.94 15.5A2 2 0 0 ' +
    "0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 " +
    "0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 " +
    '6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4M22 5h-4"/></svg>';
  var close =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "dqa-launcher";
  launcher.setAttribute("aria-label", "Open " + name);
  launcher.innerHTML = sparkles + '<span class="dqa-label">' + name + '</span><i class="dqa-dot"></i>';

  var panel = document.createElement("div");
  panel.className = "dqa-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", name);

  var iframe = null;
  var ready = false;
  var pending = [];

  function load() {
    if (iframe) return;
    iframe = document.createElement("iframe");
    iframe.title = name;
    iframe.allow = "clipboard-write";
    iframe.src =
      origin +
      "/embed.html?name=" +
      encodeURIComponent(name) +
      "&context=" +
      encodeURIComponent(context);
    panel.appendChild(iframe);
  }

  function store(key, on) {
    try {
      sessionStorage.setItem(key, on ? "1" : "");
    } catch (error) {
      // Storage blocked: the panel just forgets this on the next page.
    }
  }

  function stored(key) {
    try {
      return sessionStorage.getItem(key) === "1";
    } catch (error) {
      return false;
    }
  }

  function showUnread(on) {
    launcher.classList.toggle("dqa-unread", on);
    store(UNREAD_KEY, on);
  }

  function open(question) {
    load();
    panel.classList.add("dqa-open");
    launcher.classList.add("dqa-open");
    showUnread(false);
    launcher.innerHTML = close + '<i class="dqa-dot"></i>';
    launcher.setAttribute("aria-label", "Close " + name);
    store(OPEN_KEY, true);
    if (question) ask(question);
  }

  function hide() {
    panel.classList.remove("dqa-open");
    launcher.classList.remove("dqa-open");
    launcher.innerHTML =
      sparkles + '<span class="dqa-label">' + name + '</span><i class="dqa-dot"></i>';
    launcher.setAttribute("aria-label", "Open " + name);
    store(OPEN_KEY, false);
  }

  function ask(question) {
    if (!ready) {
      pending.push(question);
      return;
    }
    iframe.contentWindow.postMessage({ type: "docanswer:ask", text: question }, origin);
  }

  launcher.addEventListener("click", function () {
    if (panel.classList.contains("dqa-open")) hide();
    else open();
  });

  window.addEventListener("message", function (event) {
    if (!iframe || event.source !== iframe.contentWindow || event.origin !== origin) return;
    var type = event.data && event.data.type;
    if (type === "docanswer:close") hide();
    if (type === "docanswer:unread" && !panel.classList.contains("dqa-open")) showUnread(true);
    if (type === "docanswer:watch") store(WATCH_KEY, Boolean(event.data.on));
    if (type === "docanswer:ready") {
      ready = true;
      pending.splice(0).forEach(ask);
    }
  });

  function mount() {
    document.body.appendChild(panel);
    document.body.appendChild(launcher);
    // Keep the panel open across page loads. While a request waits for a person, load it in
    // the background anyway, so the reply can raise the dot on whatever page is open.
    if (stored(UNREAD_KEY)) launcher.classList.add("dqa-unread");
    if (stored(OPEN_KEY)) open();
    else if (stored(WATCH_KEY)) load();
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  window.DocAnswer = { open: open, close: hide };
})();
