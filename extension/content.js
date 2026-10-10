// Injected on demand: shows the toast and copies the code. Guarded so re-injection is harmless.
(function () {
  if (window.__originToast) return;
  window.__originToast = true;
  var api = typeof browser !== "undefined" ? browser : chrome;

  function copy(text) {
    var done = false;
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.documentElement.appendChild(ta);
      ta.select();
      done = document.execCommand("copy");
      ta.remove();
    } catch (e) {}
    if (!done && navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
  }

  function toast(html, isError) {
    var host = document.createElement("div");
    host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647";
    var root = host.attachShadow({ mode: "closed" });
    root.innerHTML =
      '<style>.t{font:500 14px/1.4 Inter,ui-sans-serif,system-ui,sans-serif;background:#0A0A0A;color:#F9FAFB;border:1px solid ' +
      (isError ? "#7F1D1D" : "#1F2937") +
      ";border-left:3px solid " + (isError ? "#EF4444" : "#6366F1") +
      ";border-radius:10px;padding:12px 16px;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:320px;opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s}" +
      ".t.in{opacity:1;transform:none}.c{font-family:'JetBrains Mono',ui-monospace,monospace;color:#818CF8;letter-spacing:.08em;font-weight:600}</style>" +
      '<div class="t">' + html + "</div>";
    document.documentElement.appendChild(host);
    var el = root.querySelector(".t");
    requestAnimationFrame(function () { el.classList.add("in"); });
    setTimeout(function () { el.classList.remove("in"); setTimeout(function () { host.remove(); }, 300); }, 4000);
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }

  api.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.kind === "origin-sent") {
      copy(msg.code);
      toast('Copied! Code: <span class="c">' + esc(msg.code) + "</span>");
    } else if (msg && msg.kind === "origin-error") {
      toast(esc(msg.message), true);
    }
  });
})();
