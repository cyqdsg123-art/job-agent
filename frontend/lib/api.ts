/** 后端 API 封装：普通请求 + SSE 流式解析 */
import type {
  AskHandlers,
  InterviewHandlers,
  InterviewStart,
  JD,
  KBDocMeta,
  MatchHandlers,
} from "./types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `请求失败（${res.status}）`);
  }
  return res.json();
}

/** 读取并解析 SSE 响应流（兼容 \n 与 \r\n 换行），每帧回调 onEvent */
async function readSSE(
  res: Response,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `请求失败（${res.status}）`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let m: RegExpMatchArray | null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    while ((m = buffer.match(/\r?\n\r?\n/)) && m.index !== undefined) {
      const frame = buffer.slice(0, m.index);
      buffer = buffer.slice(m.index + m[0].length);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        // 忽略 id: / retry: / 注释行
      }
      if (dataLines.length) onEvent(event, JSON.parse(dataLines.join("\n")));
    }
  }
}

// ---------- JD ----------

/** 上传招聘截图并解析 */
export async function parseJD(file: File): Promise<JD> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/jd/parse", { method: "POST", body: form });
  return jsonOrThrow<JD>(res);
}

export async function listJDs(): Promise<JD[]> {
  return jsonOrThrow<JD[]>(await fetch("/api/jd"));
}

/** 粘贴公开职位页链接解析（登录墙页面会返回可读错误） */
export async function parseJDUrl(url: string): Promise<JD> {
  const form = new FormData();
  form.append("url", url);
  const res = await fetch("/api/jd/parse-url", { method: "POST", body: form });
  return jsonOrThrow<JD>(res);
}

/** 直接粘贴职位描述文本解析（适用于登录墙页面） */
export async function parseJDText(text: string): Promise<JD> {
  const form = new FormData();
  form.append("text", text);
  const res = await fetch("/api/jd/parse-text", { method: "POST", body: form });
  return jsonOrThrow<JD>(res);
}

export async function deleteJD(id: number): Promise<void> {
  await fetch(`/api/jd/${id}`, { method: "DELETE" });
}

// ---------- 匹配 ----------

/** 发起匹配：SSE 事件 profile → scores → advice_delta* → done */
export async function streamMatch(
  jdId: number,
  resume: { text?: string; file?: File },
  handlers: MatchHandlers,
): Promise<void> {
  const form = new FormData();
  form.append("jd_id", String(jdId));
  if (resume.file) form.append("resume_file", resume.file);
  if (resume.text) form.append("resume_text", resume.text);

  const res = await fetch("/api/match", { method: "POST", body: form });
  await readSSE(res, (event, data) => {
    if (event === "profile") handlers.onProfile?.(data as never);
    else if (event === "scores") handlers.onScores?.(data as never);
    else if (event === "advice_delta") handlers.onAdviceDelta?.(data as string);
    else if (event === "done") handlers.onDone?.(data as string);
    else if (event === "error") handlers.onError?.(data as string);
  });
}

// ---------- 知识库 ----------

/** 上传资料入库：pdf/图片(自动OCR)/txt/md 或纯文本 */
export async function uploadKBDoc(input: {
  file?: File;
  title?: string;
  text?: string;
}): Promise<{ doc_id: string; chars: number }> {
  const form = new FormData();
  if (input.file) form.append("file", input.file);
  if (input.title) form.append("title", input.title);
  if (input.text) form.append("text", input.text);
  const res = await fetch("/api/kb/upload", { method: "POST", body: form });
  return jsonOrThrow(res);
}

export async function listKBDocs(): Promise<KBDocMeta[]> {
  return jsonOrThrow<KBDocMeta[]>(await fetch("/api/kb/docs"));
}

export async function deleteKBDoc(id: string): Promise<void> {
  await fetch(`/api/kb/docs/${id}`, { method: "DELETE" });
}

/** 知识库问答：SSE 事件 sources → answer_delta* → done */
export async function streamAsk(
  question: string,
  handlers: AskHandlers,
): Promise<void> {
  const form = new FormData();
  form.append("question", question);
  const res = await fetch("/api/kb/ask", { method: "POST", body: form });
  await readSSE(res, (event, data) => {
    if (event === "sources") handlers.onSources?.(data as never);
    else if (event === "answer_delta") handlers.onAnswerDelta?.(data as string);
    else if (event === "done") handlers.onDone?.(data as string);
    else if (event === "error") handlers.onError?.(data as string);
  });
}

// ---------- 面试准备包 ----------

/** 生成面试准备包：SSE prep_delta* → done */
export async function streamPrep(
  jdId: number,
  resumeText: string,
  repo: string,
  handlers: {
    onDelta?: (chunk: string) => void;
    onDone?: (full: string) => void;
    onError?: (message: string) => void;
  },
): Promise<void> {
  const form = new FormData();
  form.append("jd_id", String(jdId));
  form.append("resume_text", resumeText);
  if (repo.trim()) form.append("repo", repo.trim());
  const res = await fetch("/api/prep", { method: "POST", body: form });
  await readSSE(res, (event, data) => {
    if (event === "prep_delta") handlers.onDelta?.(data as string);
    else if (event === "done") handlers.onDone?.(data as string);
    else if (event === "error") handlers.onError?.(data as string);
  });
}

// ---------- 模拟面试 ----------

/** 开始面试，返回第一题。repo 可选：本地仓库路径或 git 链接 */
export async function startInterview(
  jdId: number,
  resumeText: string,
  repo?: string,
): Promise<InterviewStart> {
  const form = new FormData();
  form.append("jd_id", String(jdId));
  form.append("resume_text", resumeText);
  if (repo?.trim()) form.append("repo", repo.trim());
  const res = await fetch("/api/interview/start", { method: "POST", body: form });
  return jsonOrThrow<InterviewStart>(res);
}

/** 提交回答：SSE feedback_delta* → (question | report_delta* → done) */
export async function answerInterview(
  sessionId: number,
  answer: string,
  handlers: InterviewHandlers,
): Promise<void> {
  const form = new FormData();
  form.append("answer", answer);
  const res = await fetch(`/api/interview/${sessionId}/answer`, {
    method: "POST",
    body: form,
  });
  await readSSE(res, (event, data) => {
    if (event === "feedback_delta") handlers.onFeedbackDelta?.(data as string);
    else if (event === "question") handlers.onQuestion?.(data as never);
    else if (event === "report_delta") handlers.onReportDelta?.(data as string);
    else if (event === "done") handlers.onDone?.(data as string);
    else if (event === "error") handlers.onError?.(data as string);
  });
}
