/** 与后端 JDOut / 匹配事件对应的类型定义 */

export interface JD {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  education: string;
  skills: string[];
  duties: string[];
  bonus: string[];
  raw_text: string;
  created_at: string;
}

export interface Profile {
  education: string;
  skills: string[];
  projects: { name: string; highlights: string }[];
  experience: string;
}

export interface Dimension {
  name: string;
  score: number;
  reason: string;
}

export interface Scores {
  dimensions: Dimension[];
  overall: number;
  verdict: string;
}

/** SSE 事件回调集合 */
export interface MatchHandlers {
  onProfile?: (p: Profile) => void;
  onScores?: (s: Scores) => void;
  onAdviceDelta?: (chunk: string) => void;
  onDone?: (fullAdvice: string) => void;
  onError?: (message: string) => void;
}

// ---------- 知识库 ----------

export interface KBDocMeta {
  id: string;
  title: string;
  source: string; // jd / upload
  created_at: string;
}

export interface KBSource {
  chunk_id: string;
  doc_id: string;
  title: string;
  text: string;
  channels: string[]; // vector / bm25
  rrf_score: number;
}

export interface AskHandlers {
  onSources?: (sources: KBSource[]) => void;
  onAnswerDelta?: (chunk: string) => void;
  onDone?: (fullAnswer: string) => void;
  onError?: (message: string) => void;
}

// ---------- 模拟面试 ----------

export interface InterviewStart {
  session_id: number;
  question: string;
  focus: string;
  round: number;
  total_rounds: number;
}

export interface InterviewQuestion {
  question: string;
  focus: string;
  round: number;
  total_rounds: number;
}

export interface InterviewHandlers {
  onFeedbackDelta?: (chunk: string) => void;
  onQuestion?: (q: InterviewQuestion) => void;
  onReportDelta?: (chunk: string) => void;
  onDone?: (fullReport: string) => void;
  onError?: (message: string) => void;
}
