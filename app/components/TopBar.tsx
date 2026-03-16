import { ScrollText, Settings, LogOut } from 'lucide-react';

interface TopBarProps {
  activeTab: 'canvas' | 'setup' | 'logs';
  setActiveTab: (tab: 'canvas' | 'setup' | 'logs') => void;
  promptsCount: number;
  doneCount: number;
  isRunning: boolean;
  username: string | null;
  onLogout: () => void;
}

export default function TopBar({ activeTab, setActiveTab, promptsCount, doneCount, isRunning, username, onLogout }: TopBarProps) {
  const pct = promptsCount > 0 ? Math.round((doneCount / promptsCount) * 100) : 0;

  return (
    <div className="flex items-center justify-between px-5 h-[52px] bg-[var(--surface)] border-b border-[var(--border)] shrink-0 gap-3">
      <div className="flex items-center gap-2.5">
        <div className="font-[var(--font-serif)] text-[18px] text-[var(--accent)] tracking-[-0.3px]">
          Batch<span className="text-[var(--text2)] text-[13px] font-[var(--font-sans)] font-light">&nbsp;Image Studio</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {promptsCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--surface2)] border border-[var(--border)] rounded-[20px] text-[11px] text-[var(--text2)] font-[var(--font-mono)]">
            <div className={`w-[7px] h-[7px] rounded-full shrink-0 ${isRunning ? 'bg-[var(--accent)] animate-[blink_1s_ease-in-out_infinite]' : (doneCount === promptsCount ? 'bg-[var(--green)]' : 'bg-[var(--text3)]')}`} />
            <div className="w-[60px] h-[3px] bg-[var(--border2)] rounded-[2px] overflow-hidden">
              <div className="h-full bg-[var(--accent)] rounded-[2px] transition-all duration-400 ease-in-out" style={{ width: `${pct}%` }} />
            </div>
            <span>{doneCount} / {promptsCount}</span>
          </div>
        )}

        <button
          onClick={() => setActiveTab(activeTab === 'logs' ? 'canvas' : 'logs')}
          title="로그"
          className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 border
            ${activeTab === 'logs'
              ? 'bg-[var(--surface2)] border-[var(--border2)] text-[var(--text)]'
              : 'border-transparent text-[var(--text3)] hover:text-[var(--text)] hover:bg-white/5'}`}
        >
          <ScrollText size={15} />
        </button>

        <button
          onClick={() => setActiveTab(activeTab === 'setup' ? 'canvas' : 'setup')}
          title="설정 / 프롬프트 로드"
          className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 border
            ${activeTab === 'setup'
              ? 'bg-[var(--surface2)] border-[var(--border2)] text-[var(--text)]'
              : 'border-transparent text-[var(--text3)] hover:text-[var(--text)] hover:bg-white/5'}`}
        >
          <Settings size={15} />
        </button>

        {username && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border)]">
            <span className="text-[11px] text-[var(--text3)] font-[var(--font-mono)]">{username}</span>
            <button
              onClick={onLogout}
              title="로그아웃"
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 border border-transparent text-[var(--text3)] hover:text-[var(--red)] hover:bg-white/5"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
