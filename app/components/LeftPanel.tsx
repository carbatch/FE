import React from 'react';
import type { PromptItem } from '../types';

interface LeftPanelProps {
  stylePrompt: string;
  setStylePrompt: (val: string) => void;
  styleImagePreview: string | null;
  onStyleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isExtractingStyle: boolean;
  isAutoDownload: boolean;
  setIsAutoDownload: (val: boolean) => void;
  onDownloadAllZip: () => void;
  onNewChat: () => void;
  prompts: PromptItem[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  isRunning: boolean;
  onRunToggle: () => void;
  onSwitchToSetup: () => void;
  nextStylePromptId?: string; // If style will be applied from next prompt
}

export default function LeftPanel({
  stylePrompt, setStylePrompt, styleImagePreview, onStyleImageUpload, isExtractingStyle,
  isAutoDownload, setIsAutoDownload, onDownloadAllZip, onNewChat,
  prompts, selectedId, setSelectedId,
  isRunning, onRunToggle, onSwitchToSetup, nextStylePromptId
}: LeftPanelProps) {

  return (
    <div className="w-[320px] shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col overflow-hidden">
      
      {/* Style Section */}
      <div className="p-3.5 px-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--dropdown-text)] text-[var(--text3)]">이미지 스타일 <span className="text-[var(--text3)] opacity-70">(선택)</span></div>
        </div>
        
        {/* Style Image Upload / Preview */}
        <div className="mb-2 relative">
          {styleImagePreview ? (
            <div className="relative w-full h-[120px] rounded-lg overflow-hidden border border-[var(--border2)] cursor-pointer" onClick={() => document.getElementById('style-file-input')?.click()}>
              <img src={styleImagePreview} alt="Style Reference" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
              {isExtractingStyle && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[11px] text-[var(--accent)] font-[var(--font-mono)]">
                  <span className="animate-[spin_1.5s_linear_infinite] mr-1">⟳</span> 분석 중...
                </div>
              )}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-[60px] border border-dashed border-[var(--border2)] rounded-lg hover:border-[var(--accent)] hover:bg-[var(--surface2)] cursor-pointer transition-all">
              <span className="text-[11px] text-[var(--text2)]">{isExtractingStyle ? '분석 중...' : '+ 레퍼런스 이미지 업로드'}</span>
            </label>
          )}
          <input id="style-file-input" type="file" accept="image/*" className="hidden" disabled={isExtractingStyle || isRunning} onChange={onStyleImageUpload} />
        </div>

        <textarea 
          className="bg-[var(--surface2)] border border-[var(--border2)] rounded-[var(--radius)] p-2.5 px-3 min-h-[72px] text-[12px] text-[var(--text)] font-[var(--font-mono)] resize-none w-full leading-[1.6] transition-colors duration-150 outline-none focus:border-[var(--accent)] placeholder:text-[var(--text3)]"
          rows={3}
          placeholder="스타일 텍스트. 없으면 위에서 이미지를 업로드해 자동 추출하세요."
          value={stylePrompt}
          onChange={e => setStylePrompt(e.target.value)}
        />
        {isRunning && nextStylePromptId && (
          <div className="text-[10px] text-[var(--text3)] mt-1.5 font-[var(--font-mono)]">
            <span className="text-[var(--accent)]">{nextStylePromptId}</span>부터 적용 예정
          </div>
        )}
      </div>

      {/* Removed Delay Section */}

      {/* Prompts List */}
      <div className="flex-1 overflow-y-auto py-2 prompt-list">
        {prompts.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center gap-3">
            <button 
              onClick={onSwitchToSetup}
              className="group flex flex-col items-center gap-3 px-6 py-8 border border-dashed border-[var(--border2)] rounded-xl text-[var(--text3)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all w-full"
            >
              <div className="text-[24px] group-hover:scale-110 transition-transform">+</div>
              <div className="text-[12px] font-medium font-[var(--font-sans)]">새 채팅 시작하기</div>
            </button>
          </div>
        ) : (
          prompts.map(p => {
            const isActive = selectedId === p.id;
            
            let statusIcon = '○';
            let statusColor = 'text-[var(--text3)]';
            let borderLeft = 'border-transparent';
            let bgColor = 'hover:bg-white/5';
            
            if (p.status === 'running') { statusIcon = '⟳'; statusColor = 'text-[var(--accent)]'; borderLeft = 'border-[var(--accent)]'; bgColor = 'bg-[#f5c5180d]'; }
            else if (p.status === 'done') { statusIcon = '✓'; statusColor = 'text-[var(--green)]'; borderLeft = 'border-[var(--green)]'; }
            else if (p.status === 'error') { statusIcon = '✗'; statusColor = 'text-[var(--red)]'; borderLeft = 'border-[var(--red)]'; }
            
            if (isActive) { borderLeft = 'border-[var(--accent)]'; bgColor = 'bg-[#f5c51812]'; }

            return (
              <div 
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex items-start gap-2.5 py-2 px-4 cursor-pointer transition-colors duration-100 border-l-2 ${borderLeft} ${bgColor}`}
              >
                <span className={`font-[var(--font-mono)] text-[11px] min-w-[28px] pt-[1px] ${isActive || p.status === 'running' ? 'text-[var(--accent)]' : p.status === 'done' ? 'text-[var(--green)]' : p.status === 'error' ? 'text-[var(--red)]' : 'text-[var(--text3)]'}`}>
                  {p.id}
                </span>
                <span className={`text-[11px] leading-[1.5] flex-1 overflow-hidden line-clamp-2 ${isActive ? 'text-[var(--text)]' : 'text-[var(--text2)]'}`}>
                  {p.text}
                </span>
                <span className={`text-[11px] shrink-0 mt-[1px] ${statusColor}`}>
                  {statusIcon}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Controls */}
      <div className="p-3 px-4 bg-[var(--surface)] border-t border-[var(--border)] flex flex-col gap-2">
        
        {/* Helper Checkbox for Auto Download */}
        <label className="flex items-center gap-2 mb-1 cursor-pointer">
          <input 
            type="checkbox" 
            checked={isAutoDownload} 
            onChange={e => setIsAutoDownload(e.target.checked)} 
            className="w-3.5 h-3.5 accent-[var(--accent)]"
          />
          <span className="text-[11px] text-[var(--text2)]">마치면 자동 ZIP 다운로드 (예약)</span>
        </label>

        <button 
          className={`w-full p-2.5 rounded-[var(--radius)] border-none font-[var(--font-sans)] text-[13px] font-semibold cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5
            ${isRunning ? 'bg-[#ef444426] text-[var(--red)] border border-[#ef44444d] hover:bg-[#ef444440]' : 'bg-[var(--accent)] text-[#0e0e10] hover:bg-[var(--accent2)] hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none'}`}
          onClick={onRunToggle}
          disabled={prompts.length === 0}
        >
          {isRunning ? '■ 자동화 중지' : '▶ 자동화 시작'}
        </button>
        <button 
          className="w-full p-2.5 rounded-[var(--radius)] border font-[var(--font-sans)] text-[12px] font-semibold cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5 bg-transparent text-[var(--green)] border-[var(--green)] opacity-80 hover:bg-[#22c55e14] hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={onDownloadAllZip}
          disabled={prompts.filter(p => p.status === 'done' && p.image).length === 0}
        >
          전체 이미지 ZIP 다운로드
        </button>
        <button 
          className="w-full p-2.5 rounded-[var(--radius)] border font-[var(--font-sans)] text-[12px] font-semibold cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5 bg-transparent text-[var(--accent)] border-[var(--accent)] opacity-80 hover:bg-[#8b5cf614] hover:opacity-100 disabled:opacity-40"
          onClick={onNewChat}
          disabled={isRunning}
        >
          + 새 채팅 (캔버스 이동)
        </button>
        <button 
          className="w-full p-2.5 rounded-[var(--radius)] border font-[var(--font-sans)] text-[12px] font-semibold cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5 bg-transparent text-[var(--text2)] border-[var(--border2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] mt-1"
          onClick={onSwitchToSetup}
        >
          설정으로 (프롬프트 파싱 로드)
        </button>
      </div>
    </div>
  );
}
