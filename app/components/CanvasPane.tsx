import React, { useRef } from 'react';
import type { PromptItem } from '../types';
import { saveAs } from 'file-saver';
import { Play, Sparkles, X, Dices, Plus } from 'lucide-react';

interface CanvasPaneProps {
  prompts: PromptItem[];
  currentPromptIndex: number;
  isRunning: boolean;
  onSendSinglePrompt: (text: string) => void;
  onRetryPrompt: (id: string) => void;
  onParsePrompts: (text: string) => boolean;
}

export default function CanvasPane({ 
  prompts, currentPromptIndex, isRunning, onSendSinglePrompt, onRetryPrompt, onParsePrompts
}: CanvasPaneProps) {
  const currentPrompt = prompts[currentPromptIndex];
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const doneCount = prompts.filter(p => p.status === 'done').length;
  const totalCount = prompts.length;

  let badgeLabel = '대기';
  let badgeClass = 'bg-[#5a596833] text-[var(--text3)]';
  if (isRunning) {
    badgeLabel = '실행중';
    badgeClass = 'bg-[#f5c51826] text-[var(--accent)]';
  } else if (doneCount === totalCount && totalCount > 0) {
    badgeLabel = '완료';
    badgeClass = 'bg-[#22c55e1f] text-[var(--green)]';
  }

  const handleSend = () => {
    if (inputRef.current) {
      const text = inputRef.current.value;
      if (text.trim()) {
        onSendSinglePrompt(text);
        inputRef.current.value = '';
        inputRef.current.style.height = 'auto';
      }
    }
  };

  const rollDice = () => {
    const ideas = [
      'A lone warrior standing on a mountain peak at sunset, dramatic clouds',
      'Underwater city with bioluminescent coral towers, deep blue atmosphere',
      'Ancient forest spirit emerging from a giant oak tree, mystical fog',
      'Futuristic market street at night, neon signs reflected in rain puddles',
      'A child riding a giant firefly through a bamboo forest at dusk',
      'Dragon made of crystalline ice soaring over frozen tundra, aurora borealis',
    ];
    if (inputRef.current) {
      inputRef.current.value = ideas[Math.floor(Math.random() * ideas.length)];
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
      inputRef.current.focus();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      alert('.txt 파일만 지원합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onParsePrompts(content);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = ''; // Reset
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between py-2.5 px-5 border-b border-[var(--border)] shrink-0">
        <div className="font-[var(--font-mono)] text-[11px] text-[var(--text2)] max-w-[60%] overflow-hidden whitespace-nowrap text-ellipsis">
          {currentPrompt ? (
            <><span className="text-[var(--accent)] mr-1.5">{currentPrompt.id}</span>{currentPrompt.text}</>
          ) : (
            '아직 실행된 프롬프트가 없습니다'
          )}
        </div>
        <div className="flex gap-1.5 items-center">
          {prompts.length > 0 && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-[var(--font-mono)] font-medium ${badgeClass}`}>
              {badgeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 content-start max-w-[1600px] mx-auto w-full">
        {prompts.length === 0 ? (
          <div className="col-span-full h-full flex flex-col items-center justify-center gap-4 text-[var(--text3)] p-10 text-center">
            <Sparkles className="w-12 h-12 opacity-20" />
            <p className="text-[13px] leading-[1.6] max-w-[300px]">
              <strong className="text-[var(--text2)]">배치 이미지 생성기</strong><br/>
              왼쪽에서 프롬프트를 클릭하거나<br/>아래 입력창에서 바로 생성하세요
            </p>
          </div>
        ) : (
          prompts.map(p => (
            <div key={p.id} id={`card-${p.id}`} className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] overflow-hidden transition-all duration-200 hover:border-[var(--border2)] hover:-translate-y-0.5">
              <div className="p-2 px-3 flex items-center justify-between border-b border-[var(--border)]">
                <span className="font-[var(--font-mono)] text-[11px] text-[var(--accent)]">{p.id}</span>
                <div className="flex items-center gap-1 text-[10px] text-[var(--text3)]">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-[var(--font-mono)] font-medium
                    ${p.status === 'pending' ? 'bg-[#5a596833]' : p.status === 'running' ? 'bg-[#f5c51826] text-[var(--accent)]' : p.status === 'done' ? 'bg-[#22c55e1f] text-[var(--green)]' : 'bg-[#ef44441f] text-[var(--red)]'}
                  `}>
                    {p.status === 'pending' ? '대기' : p.status === 'running' ? '생성중' : p.status === 'done' ? '완료' : '오류'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-[1px] bg-[var(--border)]">
                {(() => {
                  const imgs = p.images || [];
                  const isRunning = p.status === 'running';
                  const isError = p.status === 'error';
                  
                  if (imgs.length === 0) {
                    return (
                      <div className={`col-span-2 w-full aspect-[32/9] flex items-center justify-center relative overflow-hidden bg-[var(--surface2)]
                        ${isRunning ? 'animate-[shimmer_1.5s_ease-in-out_infinite] bg-[length:200%_100%] bg-gradient-to-r from-[var(--surface2)] via-[var(--border2)] to-[var(--surface2)]' : ''}
                      `}>
                        <div className={`flex flex-col items-center gap-2 text-[11px] font-[var(--font-mono)]
                          ${isRunning ? 'text-[var(--accent)]' : isError ? 'text-[var(--red)]' : 'text-[var(--text3)]'}
                        `}>
                          <div className={`text-[28px] ${isRunning ? 'opacity-70 animate-[spin_1.5s_linear_infinite]' : 'opacity-30'}`}>
                            {isRunning ? '⟳' : isError ? '✗' : '✦'}
                          </div>
                          <div>{isRunning ? '생성 중...' : isError ? (p.error || '오류') : '대기중'}</div>
                        </div>
                      </div>
                    );
                  }

                  return imgs.map((img, idx) => (
                    <div key={idx} className="w-full aspect-square flex items-center justify-center relative overflow-hidden bg-[var(--surface2)]">
                      <img src={img} alt={`${p.id}-${idx+1}`} className="w-full h-full object-cover" />
                    </div>
                  ));
                })()}
              </div>
              <div className="p-2 px-3 flex gap-1.5">
                <button 
                  onClick={() => onRetryPrompt(p.id)}
                  disabled={p.status === 'running'}
                  className="flex-1 py-1 rounded-[7px] border border-[var(--border2)] bg-transparent text-[var(--text2)] text-[11px] font-[var(--font-sans)] cursor-pointer transition-colors duration-100 hover:bg-[var(--surface2)] hover:text-[var(--text)] disabled:opacity-50"
                >
                  재시도
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(p.text);
                  }}
                  className="flex-[2] py-1.5 rounded-[7px] border border-[var(--border2)] bg-transparent text-[var(--text2)] text-[11px] font-[var(--font-sans)] cursor-pointer transition-colors duration-100 hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                >
                  복사
                </button>
                {p.images && p.images.length > 0 && p.status === 'done' && (
                  <button 
                    onClick={() => {
                      p.images!.forEach((img, idx) => {
                        saveAs(img, `${p.folderName || p.id}-image-${idx+1}.png`);
                      });
                    }}
                    className="flex-[2] py-1.5 rounded-[7px] border border-[var(--border2)] bg-transparent text-[var(--text2)] text-[11px] font-[var(--font-sans)] cursor-pointer transition-colors duration-100 hover:bg-[#22c55e14] hover:border-[var(--green)] hover:text-[var(--green)]"
                  >
                    다운로드
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Bar */}
      <div className="border-t border-[var(--border)] p-3 px-5 flex items-end justify-center bg-[var(--surface)] shrink-0">
        <div className="w-full max-w-[800px] flex items-stretch gap-2.5 mx-auto">
          {/* File Upload Button */}
          <div className="flex items-stretch">
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".txt" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-12 rounded-[10px] border border-[var(--border2)] text-[var(--text2)] flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-[var(--surface2)] hover:text-[var(--accent)] hover:border-[var(--accent)] shrink-0"
              title=".txt 파일 업로드"
            >
              <Plus size={24} />
            </button>
          </div>

          <div className="flex-1 bg-[var(--surface2)] border border-[var(--border2)] rounded-[var(--radius)] p-2.5 px-3.5 flex items-end gap-2.5 transition-colors duration-150 focus-within:border-[var(--accent)]">
            <textarea 
              ref={inputRef}
              className="flex-1 bg-transparent border-none outline-none text-[var(--text)] text-[13px] font-[var(--font-sans)] resize-none leading-[1.5] max-h-[120px] placeholder:text-[var(--text3)]"
              rows={1}
              placeholder="아이디어를 설명하거나 주사위를 굴려 아이디어를 얻으세요."
              onChange={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button 
              onClick={handleSend}
              className="w-8 h-8 rounded-lg bg-[var(--accent)] text-[#0e0e10] flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-[var(--accent2)] hover:scale-105 shrink-0"
            >
              <Play size={16} fill="currentColor" />
            </button>
          </div>
          
          <div className="flex items-stretch">
            <button onClick={rollDice} className="w-12 rounded-[10px] border border-[var(--border2)] text-[var(--text3)] flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-[var(--surface2)] hover:text-[var(--text)] hover:border-[var(--border)] shrink-0" title="랜덤 아이디어 생성">
              <Dices size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
