'use client';
import { useState } from 'react';
import { useSetAtom } from 'jotai';
import { authAtom } from '../store/atoms';

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export default function AuthModal() {
  const setAuth = useSetAtom(authAtom);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = tab === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
    try {
      const res = await fetch(`${getApiUrl()}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || '오류가 발생했습니다');
        return;
      }
      setAuth({ token: data.access_token, user: { id: data.user_id, username: data.username } });
    } catch {
      setError('서버에 연결할 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[360px] bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden shadow-2xl">
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4">
          <div className="font-[var(--font-serif)] text-[22px] text-[var(--accent)] tracking-[-0.3px] mb-1">
            Batch<span className="text-[var(--text2)] text-[14px] font-[var(--font-sans)] font-light">&nbsp;Image Studio</span>
          </div>
          <p className="text-[12px] text-[var(--text3)]">계정으로 로그인하여 기록을 불러오세요</p>
        </div>

        {/* 탭 */}
        <div className="flex mx-6 mb-4 bg-[var(--surface2)] rounded-[10px] p-[3px]">
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-1.5 text-[12px] font-medium rounded-[8px] transition-all duration-150 cursor-pointer
                ${tab === t ? 'bg-[var(--border2)] text-[var(--text)]' : 'text-[var(--text3)] hover:text-[var(--text2)]'}`}
            >
              {t === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-[var(--text3)] font-medium">사용자명</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              autoComplete="username"
              required
              className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--text)] placeholder-[var(--text3)] outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-[var(--text3)] font-medium">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
              className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--text)] placeholder-[var(--text3)] outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {error && (
            <p className="text-[11px] text-[var(--red)] bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-[6px] px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full bg-[var(--accent)] hover:bg-[var(--accent2)] text-black font-semibold text-[13px] py-2.5 rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : tab === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
      </div>
    </div>
  );
}
