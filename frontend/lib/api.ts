/** 后端 API 封装：普通请求 + SSE 流式解析 */
import type { JD, MatchHandlers } from "./types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `请求失败（${res.status}）`);
  }
  return res.json();
}

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

export async function deleteJD(id: number): Promise<void> {
  await fetch(`/api/jd/${id}`, { method: "DELETE" });
}

/**
 * 发起匹配并解析 SSE 流。
 * 后端事件序列：profile → scores → advice_delta* → done；出错时收到 error。
 */
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
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `请求失败（${res.status}）`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (event: string, dataRaw: string) => {
    const data = JSON.parse(dataRaw);
    switch (event) {
      case "profile":
        handlers.onProfile?.(data);
        break;
      case "scores":
        handlers.onScores?.(data);
        break;
      case "advice_delta":
        handlers.onAdviceDelta?.(data);
        break;
      case "done":
        handlers.onDone?.(data);
        break;
      case "error":
        handlers.onError?.(data);
        break;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 帧以空行分隔；一帧内含 event: / data: 行
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        // 忽略 id: / retry: / 注释行
      }
      if (dataLines.length) dispatch(event, dataLines.join("\n"));
    }
  }
}
