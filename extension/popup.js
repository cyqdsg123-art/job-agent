// popup.js：点击采集按钮 → 注入 content script → 提取文字 → 发给本地后端解析
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
  btn.textContent = "提取页面文字中…";
  show("");

  try {
    // 1) 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("无法获取当前标签页");

    // 2) 注入 content script 提取正文
    let extracted = "";
    try {
      const injections = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 简单粗暴：取 body 全部 innerText（去 script/style），让 LLM 自己做噪声过滤
          const doc = document.implementation.createHTMLDocument("");
          doc.body.innerHTML = document.body.innerHTML;
          doc.querySelectorAll("script,style,noscript,svg").forEach((e) => e.remove());
          return (doc.body.innerText || "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        },
      });
      extracted = injections?.[0]?.result || "";
    } catch (e) {
      // content script 注入可能失败（受限页面如 chrome://），回退到只读 innerText
      const fallback = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body?.innerText || "",
      });
      extracted = fallback?.[0]?.result || "";
    }

    if (!extracted || extracted.length < 20) {
      show("info", `提取文字不足 20 字（实际 ${extracted.length} 字）：\n\n该页面可能需要先登录，或当前不是职位详情页。\n请先登录招聘网站并打开具体的职位详情。`);
      btn.disabled = false;
      btn.textContent = "📋 一键采集";
      return;
    }

    // 3) 发给本地后端解析
    status.textContent = `已提取 ${extracted.length} 字，正在解析…`;
    const form = new FormData();
    form.append("text", extracted);
    const res = await fetch("http://localhost:8000/api/jd/parse-text", { method: "POST", body: form });

    if (res.ok) {
      const jd = await res.json();
      show("success", `✅ 解析成功！\n\n📌 ${jd.title}\n💰 ${jd.salary || "—"}\n📍 ${jd.location || "—"}\n\n已自动入库并进入知识库，\n去 http://localhost:3000 看看吧`);
      status.textContent = "完成 ✅";
    } else {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      show("error", `解析失败：${err.detail}`);
    }
  } catch (e) {
    show("error", `连接后端失败：${e instanceof Error ? e.message : "未知错误"}\n\n请确认后端已启动 (http://localhost:8000)`);
  } finally {
    btn.disabled = false;
    btn.textContent = "📋 一键采集";
  }
});
