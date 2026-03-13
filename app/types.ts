export type PromptStatus = 'pending' | 'running' | 'done' | 'error';

export interface PromptItem {
  id: string;
  number: number;
  text: string;
  folderName?: string;
  status: PromptStatus;
  images: string[] | null;
  error?: string;
}

export interface LogEntry {
  level: 'info' | 'success' | 'warn' | 'error';
  msg: string;
  promptId?: string;
  time: string;
}
