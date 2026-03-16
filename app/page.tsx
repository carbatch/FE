"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { PromptItem, PageSummary, LogEntry } from './types';
import { authAtom } from './store/atoms';
import AuthModal from './components/AuthModal';
import TopBar from './components/TopBar';
import LeftPanel from './components/LeftPanel';
import CanvasPane from './components/CanvasPane';
import { SetupPane, LogsPane } from './components/SetupAndLogsPanes';

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// ── API 호출 ──────────────────────────────────────────────────────────────

async function apiPollStatus(
  promptId: string,
  isAborted: () => boolean = () => false,
): Promise<{ status: string; image_paths: string[]; error_msg?: string } | null> {
  const base = getApiUrl();
  for (let i = 0; i < 120; i++) {
    if (isAborted()) return null;
    await new Promise<void>(r => setTimeout(r, 2000));
    if (isAborted()) return null;
    try {
      const res = await fetch(`${base}/api/v1/generations/${promptId}/status`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status === 'done' || data.status === 'error') return data;
    } catch { /* retry */ }
  }
  return null;
}

async function apiGenerateImages(
  prompt: string,
  promptId: string,
  count = 2,
  pageId?: number,
  isAborted: () => boolean = () => false,
  token: string | null = null,
) {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/generate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ prompt, id: promptId, count, page_id: pageId }),
    });
    if (!res.ok) return { success: false, images: [], error: `API Error: ${res.status}` };
  } catch {
    return { success: false, images: [], error: '이미지 생성 요청 실패' };
  }

  const data = await apiPollStatus(promptId, isAborted);
  if (!data) return { success: false, images: [], error: isAborted() ? '취소됨' : '타임아웃' };
  if (data.status === 'error') return { success: false, images: [], error: data.error_msg || '생성 실패' };

  const base = getApiUrl();
  return { success: true, images: data.image_paths.map((p: string) => `${base}/storage/${p}`) };
}

async function apiCreatePage(title = '새 채팅', token: string | null = null): Promise<PageSummary> {
  const res = await fetch(`${getApiUrl()}/api/v1/pages`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ title }),
  });
  return res.json();
}

async function apiListPages(token: string | null = null): Promise<PageSummary[]> {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/pages`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function apiGetPageGenerations(pageId: number, token: string | null = null): Promise<PromptItem[]> {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/pages/${pageId}/generations`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return [];
    const gens = await res.json();
    const base = getApiUrl();
    return gens.map((g: {
      prompt_id: string;
      prompt_text: string;
      image_paths: string[];
      status: string;
      error_msg?: string;
    }) => ({
      id: g.prompt_id,
      text: g.prompt_text,
      status: (g.status === 'done' || g.status === 'error' || g.status === 'running' || g.status === 'pending')
        ? g.status as PromptItem['status']
        : 'done' as const,
      images: g.image_paths.length > 0 ? g.image_paths.map((p: string) => `${base}/storage/${p}`) : null,
      error: g.error_msg,
    }));
  } catch { return []; }
}

async function apiRenamePage(pageId: number, title: string, token: string | null = null) {
  await fetch(`${getApiUrl()}/api/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ title }),
  });
}

async function apiDeletePage(pageId: number, token: string | null = null) {
  await fetch(`${getApiUrl()}/api/v1/pages/${pageId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────

export default function Page() {
  const [auth, setAuth] = useAtom(authAtom);

  // 마운트 시 저장된 토큰 유효성 검증
  useEffect(() => {
    if (!auth.token) return;
    fetch(`${getApiUrl()}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    }).then(res => {
      if (!res.ok) setAuth({ token: null, user: null });
    }).catch(() => { /* 네트워크 오류는 무시 */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // stale closure 방지용 tokenRef
  const tokenRef = useRef(auth.token);
  useEffect(() => { tokenRef.current = auth.token; }, [auth.token]);

  const [activeTab, setActiveTab] = useState<'canvas' | 'setup' | 'logs'>('canvas');

  const [pages, setPages] = useState<PageSummary[]>([]);
  const [currentPageId, setCurrentPageId] = useState<number | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);

  const [stylePrompt, setStylePrompt] = useState('');
  const [styleImagePreview, setStyleImagePreview] = useState<string | null>(null);
  const [isExtractingStyle, setIsExtractingStyle] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const [isAutoDownload, setIsAutoDownload] = useState(false);
  const abortFlagRef = useRef(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);

  // 현재 폴링 중인 prompt_id 집합 (중복 방지)
  const pollingRef = useRef<Set<string>>(new Set());

  const addLog = useCallback((level: LogEntry['level'], msg: string) => {
    setLogs(prev => [...prev, { level, msg, time: new Date().toLocaleTimeString('ko-KR', { hour12: false }) }]);
  }, []);

  // ── 재연결 폴링 ───────────────────────────────────────────────────────

  const resumePolling = useCallback((items: PromptItem[]) => {
    const base = getApiUrl();
    for (const item of items) {
      if ((item.status === 'running' || item.status === 'pending') && !pollingRef.current.has(item.id)) {
        pollingRef.current.add(item.id);
        apiPollStatus(item.id).then(data => {
          pollingRef.current.delete(item.id);
          if (!data) return;
          setPrompts(prev => prev.map(p =>
            p.id === item.id
              ? {
                  ...p,
                  status: data.status === 'done' ? 'done' : 'error',
                  images: data.status === 'done' && data.image_paths.length > 0
                    ? data.image_paths.map((path: string) => `${base}/storage/${path}`)
                    : null,
                  error: data.error_msg,
                }
              : p
          ));
          if (data.status === 'done') addLog('success', '이미지 생성 완료 (재연결)');
          else addLog('error', `생성 실패: ${data.error_msg || '알 수 없는 오류'}`);
        });
      }
    }
  }, [addLog]);

  // ── 초기 로드 ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!auth.token) return;
    apiListPages(auth.token).then(list => {
      setPages(list);
      if (list.length > 0) {
        const lastId = typeof window !== 'undefined' ? localStorage.getItem('lastPageId') : null;
        const target = lastId ? list.find(p => p.id === Number(lastId)) : null;
        selectPageById(target ? target.id : list[0].id);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  // ── 페이지 선택 ───────────────────────────────────────────────────────

  const selectPageById = async (pageId: number) => {
    setCurrentPageId(pageId);
    if (typeof window !== 'undefined') localStorage.setItem('lastPageId', String(pageId));
    setActiveTab('canvas');
    setPrompts([]);
    const items = await apiGetPageGenerations(pageId, tokenRef.current);
    setPrompts(items);
    resumePolling(items);
  };

  const selectPage = async (pageId: number) => {
    if (isRunning) return;
    selectPageById(pageId);
  };

  // ── 새 페이지 생성 ────────────────────────────────────────────────────

  const handleNewPage = async () => {
    if (isRunning) return;
    const page = await apiCreatePage('새 채팅', auth.token);
    setPages(prev => [page, ...prev]);
    setCurrentPageId(page.id);
    if (typeof window !== 'undefined') localStorage.setItem('lastPageId', String(page.id));
    setPrompts([]);
    setActiveTab('canvas');
    addLog('info', `새 페이지 생성됨 (ID: ${page.id})`);
  };

  // ── 페이지 삭제 ───────────────────────────────────────────────────────

  const handleDeletePage = async (pageId: number) => {
    await apiDeletePage(pageId, auth.token);
    setPages(prev => prev.filter(p => p.id !== pageId));
    if (currentPageId === pageId) {
      const remaining = pages.filter(p => p.id !== pageId);
      if (remaining.length > 0) {
        selectPage(remaining[0].id);
      } else {
        setCurrentPageId(null);
        setPrompts([]);
        if (typeof window !== 'undefined') localStorage.removeItem('lastPageId');
      }
    }
  };

  // ── 단일 프롬프트 전송 ────────────────────────────────────────────────

  const sendSinglePrompt = async (text: string) => {
    let pageId = currentPageId;
    if (!pageId) {
      const page = await apiCreatePage(text.slice(0, 30), auth.token);
      setPages(prev => [page, ...prev]);
      setCurrentPageId(page.id);
      if (typeof window !== 'undefined') localStorage.setItem('lastPageId', String(page.id));
      pageId = page.id;
    }

    const promptId = `${Date.now()}`;
    const newPrompt: PromptItem = { id: promptId, text, status: 'running', images: null };
    setPrompts(prev => [...prev, newPrompt]);

    if (prompts.length === 0) {
      const title = text.slice(0, 30);
      apiRenamePage(pageId, title, auth.token);
      setPages(prev => prev.map(p => p.id === pageId ? { ...p, title } : p));
    }

    addLog('info', `이미지 생성 시작`);

    const full = stylePromptRef.current ? `${text}, ${stylePromptRef.current}` : text;
    const result = await apiGenerateImages(full, promptId, 2, pageId, () => false, auth.token);

    setPrompts(prev => prev.map(p =>
      p.id === promptId
        ? { ...p, status: result.success ? 'done' : 'error', images: result.images.length ? result.images : null, error: result.error }
        : p
    ));

    if (result.success) addLog('success', '이미지 2장 생성 완료');
    else addLog('error', `생성 실패: ${result.error}`);
  };

  // stylePrompt stale closure 방지용 ref
  const stylePromptRef = useRef(stylePrompt);
  useEffect(() => { stylePromptRef.current = stylePrompt; }, [stylePrompt]);

  // ── 배치 실행 (items, pageId를 직접 받아 stale closure 방지) ──────────

  const runBatchItems = useCallback(async (items: PromptItem[], pageId: number) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    abortFlagRef.current = false;
    setIsRunning(true);
    addLog('info', `자동화 시작 — ${items.length}개 프롬프트`);

    for (const p of items) {
      if (abortFlagRef.current) break;

      setPrompts(prev => prev.map(x => x.id === p.id ? { ...x, status: 'running' } : x));
      // 매 항목마다 최신 스타일을 ref에서 읽음 (중간에 변경돼도 즉시 반영)
      const style = stylePromptRef.current;
      const full = style ? `${p.text}, ${style}` : p.text;
      const result = await apiGenerateImages(full, p.id, 2, pageId, () => abortFlagRef.current, tokenRef.current);

      setPrompts(prev => prev.map(x =>
        x.id === p.id
          ? { ...x, status: result.success ? 'done' : 'error', images: result.images.length ? result.images : null, error: result.error }
          : x
      ));

      if (result.success) addLog('success', '이미지 2장 생성 완료');
      else addLog('error', `생성 실패: ${result.error}`);

      if (!abortFlagRef.current) await new Promise<void>(r => setTimeout(r, 500));
    }

    if (!abortFlagRef.current) {
      addLog('success', '모든 프롬프트 처리 완료! ✦');
      if (isAutoDownload) {
        try {
          const res = await fetch(`${getApiUrl()}/api/v1/pages/${pageId}/download-zip`, {
          headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        });
          if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
          const blob = await res.blob();
          const { saveAs } = await import('file-saver');
          saveAs(blob, `carbatch-page-${pageId}.zip`);
          addLog('success', 'ZIP 자동 다운로드 완료');
        } catch (e) {
          addLog('error', `ZIP 자동 다운로드 실패: ${e}`);
        }
      }
    }

    isRunningRef.current = false;
    setIsRunning(false);
    abortFlagRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, isAutoDownload]);

  // ── 배치 자동화 ───────────────────────────────────────────────────────

  const handleRunToggle = async () => {
    if (isRunning) {
      abortFlagRef.current = true;
      isRunningRef.current = false;
      setIsRunning(false);
      addLog('warn', '자동화 중지됨');
      return;
    }

    const pending = prompts.filter(p => p.status === 'pending' || p.status === 'error');
    if (!pending.length || !currentPageId) return;

    runBatchItems(pending, currentPageId);
  };

  // ── 이미지 단건 재시도 ────────────────────────────────────────────────

  const [retryingImages, setRetryingImages] = useState<Set<string>>(new Set());

  const retryImage = async (promptId: string, imgIndex: number) => {
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt || !currentPageId) return;

    const key = `${promptId}__${imgIndex}`;
    setRetryingImages(prev => new Set([...prev, key]));

    const retryId = `${Date.now()}`;
    const style = stylePromptRef.current;
    const full = style ? `${prompt.text}, ${style}` : prompt.text;
    const result = await apiGenerateImages(full, retryId, 1, currentPageId, () => false, auth.token);

    setRetryingImages(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (result.success && result.images.length > 0) {
      setPrompts(prev => prev.map(p => {
        if (p.id !== promptId) return p;
        const newImages = [...(p.images || [])];
        newImages[imgIndex] = result.images[0];
        return { ...p, images: newImages, status: 'done' };
      }));
      addLog('success', '이미지 재시도 완료');
    } else {
      addLog('error', `이미지 재시도 실패: ${result.error}`);
    }
  };

  // ── 텍스트 파일 파싱 (배치 로드) ─────────────────────────────────────

  const parsePrompts = async (text: string): Promise<boolean> => {
    const results: PromptItem[] = [];
    const lines = text.split('\n');
    let curId: string | null = null, curLines: string[] = [];

    const flush = () => {
      if (curId && curLines.length) {
        const joined = curLines.join(' ').trim();
        if (joined) results.push({ id: `${Date.now()}_${results.length}`, text: joined, status: 'pending', images: null });
      }
    };

    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const m = t.match(/^(\d{1,3})\s+(.+)/);
      if (m) { flush(); curId = m[1]; curLines = [m[2]]; }
      else if (curId) curLines.push(t);
    }
    flush();

    if (!results.length) return false;

    let pageId = currentPageId;
    if (!pageId) {
      const page = await apiCreatePage(results[0].text.slice(0, 30), tokenRef.current);
      setPages(prev => [page, ...prev]);
      setCurrentPageId(page.id);
      if (typeof window !== 'undefined') localStorage.setItem('lastPageId', String(page.id));
      pageId = page.id;
    }

    setPrompts(prev => [...prev, ...results]);
    setActiveTab('canvas');
    addLog('info', `${results.length}개 프롬프트 로드 완료`);

    // 로드 즉시 자동 생성 시작
    if (!isRunning) {
      runBatchItems(results, pageId);
    }

    return true;
  };

  // ── 스타일 이미지 업로드 ──────────────────────────────────────────────

  const handleStyleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtractingStyle(true);
    addLog('info', '스타일 이미지 분석 중...');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64Data = ev.target?.result as string;
      setStyleImagePreview(base64Data);
      try {
        const res = await fetch(`${getApiUrl()}/api/v1/extract-style`, {
          method: 'POST',
          headers: authHeaders(tokenRef.current),
          body: JSON.stringify({ image: base64Data }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setStylePrompt(data.style);
        addLog('success', '스타일 추출 완료');
      } catch {
        addLog('error', '스타일 추출 실패');
      } finally {
        setIsExtractingStyle(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── ZIP 다운로드 ──────────────────────────────────────────────────────

  const handleDownloadAllZip = async () => {
    if (!currentPageId) { addLog('warn', '페이지를 선택해주세요.'); return; }
    const done = prompts.filter(p => p.status === 'done' && p.images?.length);
    if (!done.length) { addLog('warn', '다운로드할 이미지가 없습니다.'); return; }
    try {
      const res = await fetch(`${getApiUrl()}/api/v1/pages/${currentPageId}/download-zip`, {
        headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
      });
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      const blob = await res.blob();
      saveAs(blob, `carbatch-page-${currentPageId}.zip`);
      addLog('success', 'ZIP 다운로드 완료');
    } catch (e) {
      addLog('error', `ZIP 다운로드 실패: ${e}`);
    }
  };

  // ── 렌더링 ────────────────────────────────────────────────────────────

  const doneCount = prompts.filter(p => p.status === 'done').length;

  const handleLogout = () => {
    setAuth({ token: null, user: null });
    setPages([]);
    setPrompts([]);
    setCurrentPageId(null);
    if (typeof window !== 'undefined') localStorage.removeItem('lastPageId');
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden font-[var(--font-sans)]">
      {!auth.token && <AuthModal />}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        promptsCount={prompts.length}
        doneCount={doneCount}
        isRunning={isRunning}
        username={auth.user?.username ?? null}
        onLogout={handleLogout}
      />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          pages={pages}
          currentPageId={currentPageId}
          onSelectPage={selectPage}
          onNewPage={handleNewPage}
          onDeletePage={handleDeletePage}
          stylePrompt={stylePrompt}
          setStylePrompt={setStylePrompt}
          styleImagePreview={styleImagePreview}
          onStyleImageUpload={handleStyleImageUpload}
          isExtractingStyle={isExtractingStyle}
          isAutoDownload={isAutoDownload}
          setIsAutoDownload={setIsAutoDownload}
          isRunning={isRunning}
          onRunToggle={handleRunToggle}
          promptsCount={prompts.length}
        />
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {activeTab === 'canvas' && (
            <CanvasPane
              prompts={prompts}
              isRunning={isRunning}
              onSendSinglePrompt={sendSinglePrompt}
              onRetryImage={retryImage}
              retryingImages={retryingImages}
              onParsePrompts={parsePrompts}
              onDownloadAllZip={handleDownloadAllZip}
              currentPageId={currentPageId}
            />
          )}
          {activeTab === 'setup' && (
            <SetupPane
              onParsePrompts={parsePrompts}
              onCancel={() => setActiveTab('canvas')}
            />
          )}
          {activeTab === 'logs' && (
            <LogsPane logs={logs} />
          )}
        </div>
      </div>
    </div>
  );
}
