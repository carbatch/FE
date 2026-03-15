import { useRef } from 'react';
import type { PromptItem } from '../types';
import { saveAs } from 'file-saver';
import { Play, Sparkles, Dices, Plus, Copy, Download, RotateCcw, PackageOpen } from 'lucide-react';

interface CanvasPaneProps {
  prompts: PromptItem[];
  currentPromptIndex: number;
  isRunning: boolean;
  currentPageId: number | null;
  onSendSinglePrompt: (text: string) => void;
  onRetryPrompt: (id: string) => void;
  onParsePrompts: (text: string) => Promise<boolean>;
  onDownloadAllZip: () => void;
}

export default function CanvasPane({
  prompts, onSendSinglePrompt, onRetryPrompt, onParsePrompts, onDownloadAllZip
}: CanvasPaneProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const text = inputRef.current?.value.trim();
    if (text) {
      onSendSinglePrompt(text);
      inputRef.current!.value = '';
      inputRef.current!.style.height = 'auto';
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
    if (!file.name.endsWith('.txt')) { alert('.txt 파일만 지원합니다.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => onParsePrompts(ev.target?.result as string);
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* 카드 그리드 */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {prompts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-[var(--text3)] text-center">
            <Sparkles className="w-10 h-10 opacity-20" />
            <p className="text-[13px] leading-[1.6] max-w-[280px]">
              <strong className="text-[var(--text2)]">배치 이미지 생성기</strong><br />
              왼쪽에서 자동화를 시작하거나<br />아래 입력창에서 바로 생성하세요
            </p>
          </div>
        ) : (
          prompts.map((p) => {
            const imgs = p.images || [];
            const isCardRunning = p.status === 'running';
            const isError = p.status === 'error';

            return (
              <div
                key={p.id}
                id={`card-${p.id}`}
                className="flex rounded-[14px] overflow-hidden border border-[var(--border)] bg-[var(--surface)] transition-all duration-200 hover:border-[var(--border2)]"
              >
                {/* 이미지 영역 */}
                <div className="flex-1 grid grid-cols-2 gap-[1px] bg-[var(--border)]">
                  {imgs.length === 0 ? (
                    <div className={`col-span-2 aspect-[4/1] flex items-center justify-center bg-[var(--surface2)]
                      ${isCardRunning ? 'bg-gradient-to-r from-[var(--surface2)] via-[var(--border2)] to-[var(--surface2)] animate-[shimmer_1.5s_ease-in-out_infinite] bg-[length:200%_100%]' : ''}`}>
                      <div className={`flex flex-col items-center gap-2 text-[11px] font-[var(--font-mono)]
                        ${isCardRunning ? 'text-[var(--accent)]' : isError ? 'text-[var(--red)]' : 'text-[var(--text3)]'}`}>
                        <span className={`text-[24px] ${isCardRunning ? 'animate-[spin_1.5s_linear_infinite] opacity-70' : 'opacity-30'}`}>
                          {isCardRunning ? '⟳' : isError ? '✗' : '✦'}
                        </span>
                        <span>{isCardRunning ? '생성 중...' : isError ? (p.error || '오류') : '대기중'}</span>
                      </div>
                    </div>
                  ) : (
                    imgs.map((img, idx) => (
                      <div key={idx} className="aspect-video bg-[var(--surface2)] overflow-hidden">
                        <img src={img} alt={`${p.id}-${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))
                  )}
                </div>

                {/* 액션 버튼 (우측 세로) */}
                <div className="w-14 shrink-0 bg-[var(--surface)] border-l border-[var(--border)] flex flex-col items-center justify-center gap-3 py-4">
                  <button
                    onClick={() => navigator.clipboard.writeText(p.text)}
                    title="프롬프트 복사"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-all duration-150 cursor-pointer"
                  >
                    <Copy size={14} />
                  </button>

                  <button
                    onClick={() => {
                      if (p.images && p.images.length > 0) {
                        p.images.forEach((img, idx) => saveAs(img, `${p.folderName || p.id}-image-${idx + 1}.png`));
                      }
                    }}
                    disabled={!p.images || p.images.length === 0}
                    title="이미지 다운로드"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text3)] hover:text-[var(--green)] hover:bg-[#22c55e14] transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Download size={14} />
                  </button>

                  <button
                    onClick={() => onRetryPrompt(p.id)}
                    disabled={isCardRunning}
                    title="재시도"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text3)] hover:text-[var(--accent)] hover:bg-[#f5c51814] transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 하단 입력바 */}
      <div className="border-t border-[var(--border)] p-3 px-4 flex items-end gap-2 bg-[var(--surface)] shrink-0">
        {/* + 파일 업로드 */}
        <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
        <button
          onClick={() => fileInputRef.current?.click()}
          title=".txt 파일 업로드"
          className="w-10 h-10 rounded-full border border-[var(--border2)] text-[var(--text2)] flex items-center justify-center cursor-pointer transition-all hover:bg-[var(--surface2)] hover:text-[var(--accent)] hover:border-[var(--accent)] shrink-0"
        >
          <Plus size={18} />
        </button>

        {/* 텍스트 입력 */}
        <div className="flex-1 bg-[var(--surface2)] border border-[var(--border2)] rounded-[12px] px-3.5 py-2.5 flex items-end gap-2.5 focus-within:border-[var(--accent)] transition-colors duration-150">
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
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
          />
          <button
            onClick={handleSend}
            className="w-8 h-8 rounded-full bg-[var(--accent)] text-[#0e0e10] flex items-center justify-center cursor-pointer hover:bg-[var(--accent2)] hover:scale-105 transition-all duration-150 shrink-0"
          >
            <Play size={14} fill="currentColor" />
          </button>
        </div>

        {/* 주사위 */}
        <button
          onClick={rollDice}
          title="랜덤 아이디어"
          className="w-10 h-10 rounded-full border border-[var(--border2)] text-[var(--text3)] flex items-center justify-center cursor-pointer transition-all hover:bg-[var(--surface2)] hover:text-[var(--text)] hover:border-[var(--border)] shrink-0"
        >
          <Dices size={18} />
        </button>

        {/* ZIP 전체 다운로드 */}
        <button
          onClick={onDownloadAllZip}
          disabled={!prompts.some(p => p.status === 'done' && p.images && p.images.length > 0)}
          title="전체 ZIP 다운로드"
          className="w-10 h-10 rounded-full border border-[var(--border2)] text-[var(--text3)] flex items-center justify-center cursor-pointer transition-all hover:bg-[var(--surface2)] hover:text-[var(--green)] hover:border-[var(--green)] shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <PackageOpen size={18} />
        </button>
      </div>
    </div>
  );
}
