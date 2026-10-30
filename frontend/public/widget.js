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
 */
(function () {
  if (window.DocAnswer) return;

  var script = document.currentScript;
  var origin = new URL(script.src).origin;
  var name = script.dataset.name || "Ask Acme";
  var context = script.dataset.context || "";
  var OPEN_KEY = "docanswer-widget-open";

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

  function remember(open) {
    try {
      sessionStorage.setItem(OPEN_KEY, open ? "1" : "");
    } catch (error) {
      // Storage blocked: the panel just starts closed on the next page.
    }
  }

  function open(question) {
    load();
    panel.classList.add("dqa-open");
    launcher.classList.add("dqa-open");
    launcher.classList.remove("dqa-unread");
    launcher.innerHTML = close + '<i class="dqa-dot"></i>';
    launcher.setAttribute("aria-label", "Close " + name);
    remember(true);
    if (question) ask(question);
  }

  function hide() {
    panel.classList.remove("dqa-open");
    launcher.classList.remove("dqa-open");
    launcher.innerHTML =
      sparkles + '<span class="dqa-label">' + name + '</span><i class="dqa-dot"></i>';
    launcher.setAttribute("aria-label", "Open " + name);
    remember(false);
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
    if (type === "docanswer:unread" && !panel.classList.contains("dqa-open")) {
      launcher.classList.add("dqa-unread");
    }
    if (type === "docanswer:ready") {
      ready = true;
      pending.splice(0).forEach(ask);
    }
  });

  function mount() {
    document.body.appendChild(panel);
    document.body.appendChild(launcher);
    // Keep the panel open across page loads, and load it early so replies can raise the dot.
    var wasOpen = false;
    try {
      wasOpen = sessionStorage.getItem(OPEN_KEY) === "1";
    } catch (error) {
      wasOpen = false;
    }
    if (wasOpen) open();
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  window.DocAnswer = { open: open, close: hide };
})();
