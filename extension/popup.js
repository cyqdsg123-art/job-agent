// popup.js v4：截图当前标签页可见区域 → 发给后端 OCR + LLM 解析
const $ = (s) => document.querySelector(s);
const btn = $("#collect");
const result = $("#result");
const status = $("#status");

function show(cls, msg) {
  if (!msg) { result.className = ""; result.textContent = ""; return; }
  result.className = cls;
  result.textContent = msg;
}

btn.addEventListener("click", async () => {
  btn.disabled = true;
  btn.textContent = "截图中…";
  show("");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("无法获取当前标签页");

    // 截取当前标签页可见区域
    status.textContent = "正在截图…";
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const blob = await (await fetch(dataUrl)).blob();

    // 发给后端 OCR+LLM 解析
    status.textContent = `截图 ${(blob.size / 1024).toFixed(0)}KB，正在 OCR + LLM 解析（约 10 秒）…`;
    const form = new FormData();
    form.append("file", blob, "screenshot.png");
    const res = await fetch("http://localhost:9000/api/jd/parse", { method: "POST", body: form });

    if (res.ok) {
      const jd = await res.json();
      show("success", `✅ 解析成功！\n\n📌 ${jd.title}\n💰 ${jd.salary || "—"}\n📍 ${jd.location || "—"}\n\n已自动入库并进入知识库`);
      status.textContent = "完成 ✅";
    } else {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      show("error", `解析失败：${err.detail}`);
    }
  } catch (e) {
    show("error", `失败：${e instanceof Error ? e.message : "未知"}\n请确认后端已启动`);
  } finally {
    btn.disabled = false;
    btn.textContent = "📸 一键截图采集";
  }
});
