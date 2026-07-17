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
