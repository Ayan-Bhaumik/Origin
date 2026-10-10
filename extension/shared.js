// Shared helpers for popup and background. Works in Chrome (chrome.*) and Firefox (browser.*).
var ext = typeof browser !== "undefined" ? browser : chrome;
var ORIGIN_URL = "https://origin.ayanbhaumik.in";
var API = ORIGIN_URL + "/api/public/clips";
var HISTORY_KEY = "recent";
var HISTORY_MAX = 5;

async function sendClip(body) {
  var res;
  try {
    res = await fetch(API, body instanceof FormData ? { method: "POST", body: body } : {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("Can't reach origin. Check your connection.");
  }
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

async function getClip(code, pin) {
  var url = API + "/" + encodeURIComponent(code.trim()) + (pin ? "?pin=" + encodeURIComponent(pin) : "");
  var res;
  try { res = await fetch(url); } catch (e) { throw new Error("Can't reach origin. Check your connection."); }
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) { var err = new Error(data.error || "Something went wrong."); err.code = data.code; err.remaining = data.remaining; throw err; }
  return data;
}

async function addHistory(entry) {
  var got = await ext.storage.local.get(HISTORY_KEY);
  var list = (got[HISTORY_KEY] || []).filter(function (e) { return e.code !== entry.code; });
  list.unshift(entry);
  await ext.storage.local.set({ [HISTORY_KEY]: list.slice(0, HISTORY_MAX) });
}

async function getHistory() {
  var got = await ext.storage.local.get(HISTORY_KEY);
  var now = Date.now();
  var list = (got[HISTORY_KEY] || []).filter(function (e) { return new Date(e.expiresAt).getTime() > now; });
  return list.slice(0, HISTORY_MAX);
}
