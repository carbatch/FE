export type PromptStatus = 'pending' | 'running' | 'done' | 'error';

export interface PromptItem {
  id: string;           // 로컬 추적용 ID (타임스탬프 기반)
  text: string;         // 프롬프트 텍스트
  status: PromptStatus;
  images: string[] | null;
  error?: string;
}

export interface PageSummary {
  id: number;           // 서버 DB ID
  title: string;        // 페이지 제목 (첫 프롬프트 기반으로 자동 설정)
  created_at: string;
}

export interface LogEntry {
  level: 'info' | 'success' | 'warn' | 'error';
  msg: string;
  time: string;
}
