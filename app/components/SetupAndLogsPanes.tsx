import React, { useState, useRef } from 'react';

interface SetupPaneProps {
  onParsePrompts: (text: string) => Promise<boolean>;
  onCancel: () => void;
}

export function SetupPane({ onParsePrompts, onCancel }: SetupPaneProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParse = async () => {
    if (!text.trim()) {
      setError('텍스트를 입력해주세요');
      return;
    }
    const success = await onParsePrompts(text);
    if (!success) {
      setError('프롬프트를 파싱할 수 없습니다. 형식을 확인해주세요.');
    } else {
      setError('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      setError('.txt 파일만 지원합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setText(content);
      setFileName(file.name);
      setError('');
    };
    reader.onerror = () => {
      setError('파일을 읽는 중 오류가 발생했습니다.');
    };
    reader.readAsText(file, 'UTF-8');

    // Reset file input so the same file can be re-uploaded
    e.target.value = '';
  };

  const clearFile = () => {
    setFileName(null);
    setText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadExample = () => {
    setFileName(null);
    setText(`001 Medium shot, a 12-year-old Korean boy with pale white skin, short black hair, dark deep eyes, wearing old white hemp clothes soaked with dripping water, barefoot sitting on a giant turtle with mystical blue patterns on its shell, glowing ethereal light, moonlight scene, no text\n\n003 Wide shot, bright full moon night in Joseon era Korea, 99-room tile-roofed mansion with a boy on a giant turtle at the gate, silver moonlight flooding the scene, eerie atmosphere, no text\n\n005 Medium shot, a Joseon era servant lifting torch high, face showing sudden shock and terror, torch about to fall from trembling hand, night scene, no text\n\n007 Full shot, a Korean nobleman in silk robes running in panic, mansion courtyard at night, urgent fearful movement, servants in background, no text`);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-[560px] bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
        {/* Header */}
        <div className="pt-5 pb-3 px-6">
          <div className="font-[var(--font-serif)] text-[20px] text-[var(--text)] mb-1">+ 새 채팅</div>
          <div className="text-[12px] text-[var(--text2)] leading-[1.6]">
            번호 구분 프롬프트를 직접 입력하거나 <span className="text-[var(--accent)] font-medium">.txt 파일</span>을 업로드하세요.
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-2 flex flex-col gap-3">
          {/* File Upload Area */}
          <div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".txt" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            {fileName ? (
              <div className="flex items-center gap-2 bg-[var(--surface2)] border border-[var(--accent)] border-opacity-30 rounded-[10px] py-2 px-3 transition-all duration-200">
                <span className="text-[var(--accent)] text-[13px] shrink-0">📄</span>
                <span className="text-[12px] text-[var(--text)] font-[var(--font-mono)] flex-1 truncate">{fileName}</span>
                <button 
                  onClick={clearFile}
                  className="text-[var(--text3)] hover:text-[var(--red)] text-[14px] transition-colors duration-150 shrink-0 cursor-pointer"
                  title="파일 제거"
                >✕</button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[var(--border2)] rounded-[10px] text-[12px] text-[var(--text2)] bg-transparent hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--surface2)] cursor-pointer transition-all duration-200"
              >
                <span className="text-[14px]">📁</span>
                <span>.txt 파일 업로드</span>
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--border)]"></div>
            <span className="text-[10px] text-[var(--text3)] uppercase tracking-widest font-semibold">또는 직접 입력</span>
            <div className="flex-1 h-px bg-[var(--border)]"></div>
          </div>

          {/* Textarea */}
          <div>
            <textarea 
              className="w-full bg-[var(--surface2)] border border-[var(--border2)] rounded-[10px] p-3 px-3.5 text-[12px] font-[var(--font-mono)] text-[var(--text)] resize-none outline-none transition-colors duration-150 leading-[1.7] focus:border-[var(--accent)] placeholder:text-[var(--text3)]"
              rows={7}
              placeholder={"001 Medium shot, a Korean boy...\n\n003 Wide shot, bright full moon...\n\n005 Close up, a servant's terror..."}
              value={text}
              onChange={e => { setText(e.target.value); setFileName(null); }}
            />
            <div className="text-[10px] text-[var(--text3)] mt-1 font-[var(--font-mono)] leading-[1.5]">
              포맷: <code className="bg-[var(--surface2)] px-1 py-px rounded text-[var(--accent)]">001 프롬프트...</code> — 번호 구분 (001, 003, 005...)
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-[#ef44441a] border border-[#ef444440] rounded-[10px] py-2 px-3 text-[11px] text-[#fca5a5] leading-[1.5]">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pb-5 px-6 pt-2 flex gap-2">
          <button
            className="py-2 px-3 rounded-[10px] font-[var(--font-sans)] text-[12px] font-semibold border border-[var(--border2)] bg-transparent text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors duration-150 cursor-pointer"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            className="flex-1 py-2 rounded-[10px] font-[var(--font-sans)] text-[12px] font-semibold border border-[var(--border2)] bg-transparent text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors duration-150 cursor-pointer"
            onClick={loadExample}
          >
            예시 로드
          </button>
          <button 
            className="flex-[1.5] py-2 rounded-[10px] font-[var(--font-sans)] text-[12px] font-semibold border-none bg-[var(--accent)] text-[#0e0e10] hover:bg-[var(--accent2)] hover:-translate-y-px transition-all duration-150 cursor-pointer"
            onClick={handleParse}
          >
            파싱 &amp; 적용 →
          </button>
        </div>
      </div>
    </div>
  );
}

import type { LogEntry } from '../types';

export function LogsPane({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3.5 px-5 font-[var(--font-mono)] text-[11px] leading-[1.8]">
        {logs.length === 0 ? (
          <div className="text-[var(--text3)] text-center py-15 text-[12px]">자동화를 시작하면 로그가 표시됩니다</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="text-[var(--text3)] min-w-[72px] shrink-0">{log.time}</span>
              <span className="text-[var(--blue)] min-w-[36px] shrink-0">{log.promptId || ''}</span>
              <span className={`flex-1 ${log.level === 'success' ? 'text-[var(--green)]' : log.level === 'error' ? 'text-[var(--red)]' : log.level === 'warn' ? 'text-[var(--accent)]' : 'text-[var(--text2)]'}`}>
                {log.msg}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
