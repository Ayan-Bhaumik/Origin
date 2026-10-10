var TIMERS = [
  [600, "10 min"], [1800, "30 min"], [3600, "1 hr · Auto"], [7200, "2 hr"],
  [10800, "3 hr"], [21600, "6 hr"], [43200, "12 hr"], [86400, "24 hr"],
];
var timer = 3600;
var lastCode = null;
var $ = function (id) { return document.getElementById(id); };

function remaining(iso) {
  var s = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
  if (s >= 3600) return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m left";
  if (s >= 60) return Math.floor(s / 60) + "m left";
  return s + "s left";
}
function copyText(t) { return navigator.clipboard.writeText(t).catch(function () {}); }
function busy(btn, on, label) { btn.setAttribute("aria-busy", on ? "true" : "false"); btn.textContent = label; }
function showErr(el, msg) { el.textContent = msg; el.hidden = !msg; }

// Tabs
function selectTab(name) {
  ["send", "retrieve"].forEach(function (n) {
    $("tab-" + n).classList.toggle("active", n === name);
    $("tab-" + n).setAttribute("aria-selected", String(n === name));
    $("panel-" + n).hidden = n !== name;
  });
  (name === "send" ? $("text") : $("code")).focus();
}
$("tab-send").onclick = function () { selectTab("send"); };
$("tab-retrieve").onclick = function () { selectTab("retrieve"); };

// Timer chips
TIMERS.forEach(function (t) {
  var b = document.createElement("button");
  b.className = "chip" + (t[0] === timer ? " active" : "");
  b.textContent = t[1];
  b.onclick = function () {
    timer = t[0];
    Array.prototype.forEach.call($("chips").children, function (c) { c.classList.remove("active"); });
    b.classList.add("active");
  };
  $("chips").appendChild(b);
});

// Recent
async function renderRecent() {
  var list = await getHistory();
  var ul = $("recent");
  ul.textContent = "";
  $("recent-wrap").hidden = list.length === 0;
  list.forEach(function (e) {
    var li = document.createElement("li");
    var ico = document.createElement("span"); ico.className = "ico"; ico.textContent = e.type === "image" ? "▣" : e.type === "file" ? "▤" : "¶";
    var c = document.createElement("span"); c.className = "c"; c.textContent = e.code;
    var left = document.createElement("span"); left.className = "left"; left.textContent = remaining(e.expiresAt);
    var b = document.createElement("button"); b.textContent = "Copy";
    b.onclick = function () { copyText(e.code); b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1200); };
    li.append(ico, c, left, b);
    ul.appendChild(li);
  });
}

// Send
async function doSend() {
  var text = $("text").value;
  if (!text.trim()) { showErr($("send-error"), "Type or paste something first."); return; }
  showErr($("send-error"), "");
  busy($("send"), true, "Sending…");
  try {
    var r = await sendClip({ type: "text", content: text, timer: timer });
    await addHistory({ code: r.code, type: "text", expiresAt: r.expiresAt, createdAt: new Date().toISOString() });
    lastCode = r.code;
    $("done-code").textContent = r.code;
    await copyText(r.code);
    $("send-form").hidden = true;
    $("send-done").hidden = false;
    renderRecent();
  } catch (e) {
    showErr($("send-error"), e.message);
  } finally {
    busy($("send"), false, "Send");
  }
}
$("send").onclick = doSend;
$("text").addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") doSend(); });
$("copy-code").onclick = function () { copyText(lastCode); $("copy-code").textContent = "Copied"; setTimeout(function () { $("copy-code").textContent = "Copy Code"; }, 1200); };
$("open-link").onclick = function () { ext.tabs.create({ url: ORIGIN_URL + "/r/" + lastCode }); };
$("send-another").onclick = function () { $("text").value = ""; $("send-done").hidden = true; $("send-form").hidden = false; $("text").focus(); };

// Retrieve
function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
async function doRetrieve() {
  var code = $("code").value.trim();
  if (!code) { showErr($("retrieve-error"), "Enter a code."); return; }
  var pin = $("pin").hidden ? "" : $("pin").value.trim();
  showErr($("retrieve-error"), "");
  $("result").hidden = true;
  busy($("retrieve"), true, "Retrieving…");
  try {
    var r = await getClip(code, pin);
    $("pin").hidden = true; $("pin").value = "";
    var box = $("result"); box.textContent = "";
    if (r.type === "text") {
      box.appendChild(el("div", "text-box", r.content || ""));
      var b = el("button", "secondary", "Copy");
      b.style.width = "100%"; b.style.marginTop = "8px";
      b.onclick = function () { copyText(r.content || ""); b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1200); };
      box.appendChild(b);
    } else {
      if (r.type === "image" && r.fileUrl) { var img = el("img", "thumb"); img.src = r.fileUrl; img.alt = r.fileName || "Image"; box.appendChild(img); }
      if (r.type === "file") box.appendChild(el("div", "text-box", r.fileName || "File"));
      var d = el("button", "secondary", "Download");
      d.style.width = "100%"; d.style.marginTop = "8px";
      d.onclick = async function () {
        try {
          var blob = await (await fetch(r.fileUrl)).blob();
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob); a.download = r.fileName || "download"; a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        } catch (e) { ext.tabs.create({ url: r.fileUrl }); }
      };
      box.appendChild(d);
    }
    box.appendChild(el("p", "meta", r.burned ? "This clip has now been deleted." : remaining(r.expiresAt)));
    box.hidden = false;
  } catch (e) {
    if (e.code === "pin_required" || e.code === "wrong_pin") {
      $("pin").hidden = false; $("pin").focus();
      showErr($("retrieve-error"), e.code === "wrong_pin" ? "Wrong PIN. " + e.remaining + " attempts remaining." : "This clip needs a PIN.");
    } else if (e.code === "not_found") showErr($("retrieve-error"), "Not found or expired.");
    else if (e.code === "rate_limited") showErr($("retrieve-error"), "Too many tries. Wait a minute and try again.");
    else showErr($("retrieve-error"), e.message);
  } finally {
    busy($("retrieve"), false, "Retrieve");
  }
}
$("retrieve").onclick = doRetrieve;
$("code").addEventListener("input", function () { $("pin").hidden = true; $("pin").value = ""; });
$("code").addEventListener("keydown", function (e) { if (e.key === "Enter") doRetrieve(); });
$("pin").addEventListener("keydown", function (e) { if (e.key === "Enter") doRetrieve(); });

renderRecent();
$("text").focus();
