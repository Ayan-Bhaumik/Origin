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

// Send mode: text or files
var mode = "text";
var picked = [];
var LIM = { count: 20, image: 10 * 1024 * 1024, file: 25 * 1024 * 1024, total: 100 * 1024 * 1024 };
function fmt(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"; }
function setMode(m) {
  mode = m;
  $("mode-text").classList.toggle("active", m === "text");
  $("mode-files").classList.toggle("active", m === "files");
  $("text-wrap").hidden = m !== "text";
  $("files-wrap").hidden = m !== "files";
  showErr($("send-error"), "");
}
$("mode-text").onclick = function () { setMode("text"); $("text").focus(); };
$("mode-files").onclick = function () { setMode("files"); };
function isImg(f) { return (f.type || "").startsWith("image/"); }
function addFiles(list) {
  var msg = "";
  Array.prototype.forEach.call(list, function (f) {
    if (picked.length >= LIM.count) { msg = "Up to 20 per clip."; return; }
    if (f.size > (isImg(f) ? LIM.image : LIM.file)) { msg = f.name + " is too large (" + (isImg(f) ? "10" : "25") + " MB max)."; return; }
    var total = picked.reduce(function (a, x) { return a + x.size; }, 0);
    if (total + f.size > LIM.total) { msg = "100 MB total per clip."; return; }
    picked.push(f);
  });
  showErr($("send-error"), msg);
  renderFiles();
}
function renderFiles() {
  var ul = $("file-list"); ul.textContent = "";
  picked.forEach(function (f, i) {
    var li = document.createElement("li");
    li.append(el("span", "ico", isImg(f) ? "▣" : "▤"), el("span", "n", f.name), el("span", "s", fmt(f.size)));
    var x = el("button", null, "✕"); x.title = "Remove";
    x.onclick = function () { picked.splice(i, 1); renderFiles(); };
    li.appendChild(x); ul.appendChild(li);
  });
  ul.hidden = !picked.length;
  var total = picked.reduce(function (a, x) { return a + x.size; }, 0);
  $("counter").hidden = !picked.length;
  $("counter").textContent = picked.length + "/20 · " + fmt(total) + " / 100 MB total";
}
$("drop").onclick = function () { $("picker").click(); };
$("drop").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("picker").click(); } };
$("picker").onchange = function () { addFiles($("picker").files); $("picker").value = ""; };
["dragenter", "dragover"].forEach(function (t) { $("drop").addEventListener(t, function (e) { e.preventDefault(); $("drop").classList.add("over"); }); });
["dragleave", "drop"].forEach(function (t) { $("drop").addEventListener(t, function (e) { e.preventDefault(); $("drop").classList.remove("over"); }); });
$("drop").addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files.length) { setMode("files"); addFiles(e.dataTransfer.files); } });
document.addEventListener("paste", function (e) {
  var fs = e.clipboardData && e.clipboardData.files;
  if (fs && fs.length) { e.preventDefault(); setMode("files"); addFiles(fs); }
});

// Current tab link
$("use-tab").onclick = async function () {
  try {
    var tabs = await ext.tabs.query({ active: true, currentWindow: true });
    var t = tabs && tabs[0];
    if (!t || !t.url || !/^https?:/i.test(t.url)) { showErr($("send-error"), "This page's link can't be sent."); return; }
    var v = $("text").value.trim();
    $("text").value = (v ? v + "\n" : "") + (t.title ? t.title + "\n" : "") + t.url;
    $("text").focus();
  } catch (e) { showErr($("send-error"), "Couldn't read this page's link."); }
};

function renderQR(text) {
  var q = qrcode(0, "M"); q.addData(text); q.make();
  $("qr").innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

async function doSend() {
  var body, type;
  if (mode === "text") {
    var text = $("text").value;
    if (!text.trim()) { showErr($("send-error"), "Type or paste something first."); return; }
    body = { type: "text", content: text, timer: timer }; type = "text";
  } else {
    if (!picked.length) { showErr($("send-error"), "Choose at least one image or file."); return; }
    type = picked.every(isImg) ? "image" : "file";
    body = new FormData(); body.append("type", type); body.append("timer", String(timer));
    picked.forEach(function (f) { body.append("file", f, f.name); });
  }
  showErr($("send-error"), "");
  busy($("send"), true, mode === "files" ? "Uploading " + picked.length + "…" : "Sending…");
  try {
    var r = await sendClip(body);
    await addHistory({ code: r.code, type: type, expiresAt: r.expiresAt, createdAt: new Date().toISOString() });
    lastCode = r.code;
    $("done-code").textContent = r.code;
    renderQR(ORIGIN_URL + "/r/" + r.code);
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
$("send-another").onclick = function () { $("text").value = ""; picked = []; renderFiles(); $("send-done").hidden = true; $("send-form").hidden = false; $("text").focus(); };

// Retrieve
function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
async function save(f) {
  try {
    var blob = await (await fetch(f.url)).blob();
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = f.name || "download"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  } catch (e) { ext.tabs.create({ url: f.url }); }
}
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
      var files = (r.files && r.files.length) ? r.files : [{ url: r.fileUrl, name: r.fileName, mime: r.fileMime }];
      var imgs = r.type === "image";
      var wrap = el("div", imgs && files.length > 1 ? "gallery" : null);
      files.forEach(function (f) {
        if (!f.url) return;
        if (imgs) {
          var img = el("img", files.length > 1 ? null : "thumb"); img.src = f.url; img.alt = f.name || "Image"; img.title = "Click to save";
          img.onclick = function () { save(f); };
          wrap.appendChild(img);
        }
        if (!imgs || files.length > 1) {
          if (!imgs) {
            var row = el("div", "file-row"); row.append(el("span", "n", f.name || "File"));
            var s1 = el("button", null, "Save"); s1.onclick = function () { save(f); }; row.appendChild(s1);
            wrap.appendChild(row);
          }
        }
      });
      box.appendChild(wrap);
      var d = el("button", "secondary", files.length > 1 ? "Download all (" + files.length + ")" : "Download");
      d.style.width = "100%"; d.style.marginTop = "8px";
      d.onclick = async function () { for (var i = 0; i < files.length; i++) { await save(files[i]); await new Promise(function (r_) { setTimeout(r_, 350); }); } };
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
