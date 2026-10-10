// Service worker (Chrome) / background script (Firefox).
if (typeof importScripts === "function") importScripts("shared.js");

ext.runtime.onInstalled.addListener(function () {
  ext.contextMenus.removeAll(function () {
    ext.contextMenus.create({ id: "send-text", title: "Send to origin", contexts: ["selection"] });
    ext.contextMenus.create({ id: "send-image", title: "Send to origin", contexts: ["image"] });
  });
});

async function notifyTab(tabId, payload) {
  if (tabId == null || tabId < 0) return;
  try {
    await ext.scripting.executeScript({ target: { tabId: tabId }, files: ["content.js"] });
    await ext.tabs.sendMessage(tabId, payload);
  } catch (e) {
    // Pages like the browser's own settings can't show the toast; history still has the code.
  }
}

async function imageForm(srcUrl) {
  var res = await fetch(srcUrl, { credentials: "omit" });
  if (!res.ok) throw new Error("Couldn't download that image.");
  var blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("That isn't an image origin can send.");
  var ext_ = (blob.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
  var name = "image." + ext_;
  try {
    var last = new URL(srcUrl).pathname.split("/").pop();
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) name = decodeURIComponent(last);
  } catch (e) {}
  var fd = new FormData();
  fd.append("type", "image");
  fd.append("timer", "3600");
  fd.append("file", blob, name);
  return fd;
}

ext.contextMenus.onClicked.addListener(async function (info, tab) {
  var tabId = tab && tab.id;
  try {
    var type, result;
    if (info.menuItemId === "send-text") {
      type = "text";
      result = await sendClip({ type: "text", content: info.selectionText || "", timer: 3600 });
    } else if (info.menuItemId === "send-image") {
      type = "image";
      result = await sendClip(await imageForm(info.srcUrl));
    } else return;
    await addHistory({ code: result.code, type: type, expiresAt: result.expiresAt, createdAt: new Date().toISOString() });
    await notifyTab(tabId, { kind: "origin-sent", code: result.code });
  } catch (e) {
    await notifyTab(tabId, { kind: "origin-error", message: e.message || "Couldn't send to origin." });
  }
});
