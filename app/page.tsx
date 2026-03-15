"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { PromptItem, PageSummary, LogEntry } from './types';
import TopBar from './components/TopBar';
import LeftPanel from './components/LeftPanel';
import CanvasPane from './components/CanvasPane';
import { SetupPane, LogsPane } from './components/SetupAndLogsPanes';

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── API 호출 ──────────────────────────────────────────────────────────────

async function apiGenerateImages(prompt: string, promptId: string, count = 2, pageId?: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, id: promptId, count, page_id: pageId }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const data = await res.json();
    return { success: true, images: (data.images || []) as string[] };
  } catch (err) {
    clearTimeout(timeoutId);
    return { success: false, images: [], error: '이미지 생성 실패' };
  }
}

async function apiCreatePage(title = '새 채팅'): Promise<PageSummary> {
  const res = await fetch(`${getApiUrl()}/api/v1/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return res.json();
}

async function apiListPages(): Promise<PageSummary[]> {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/pages`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function apiGetPageGenerations(pageId: number): Promise<PromptItem[]> {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/pages/${pageId}/generations`);
    if (!res.ok) return [];
    const gens = await res.json();
    const base = getApiUrl();
    return gens.map((g: { prompt_id: string; prompt_text: string; image_paths: string[] }) => ({
      id: g.prompt_id,
      text: g.prompt_text,
      status: 'done' as const,
      images: g.image_paths.map((p: string) => `${base}/storage/${p}`),
    }));
  } catch { return []; }
}

async function apiRenamePage(pageId: number, title: string) {
  await fetch(`${getApiUrl()}/api/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

async function apiDeletePage(pageId: number) {
  await fetch(`${getApiUrl()}/api/v1/pages/${pageId}`, { method: 'DELETE' });
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────

export default function Page() {
  const [activeTab, setActiveTab] = useState<'canvas' | 'setup' | 'logs'>('canvas');

  // 페이지 목록
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [currentPageId, setCurrentPageId] = useState<number | null>(null);

  // 현재 페이지의 프롬프트 목록
  const [prompts, setPrompts] = useState<PromptItem[]>([]);

  // 스타일
  const [stylePrompt, setStylePrompt] = useState('');
  const [styleImagePreview, setStyleImagePreview] = useState<string | null>(null);
  const [isExtractingStyle, setIsExtractingStyle] = useState(false);

  // 자동화
  const [isRunning, setIsRunning] = useState(false);
  const [isAutoDownload, setIsAutoDownload] = useState(false);
  const abortFlagRef = useRef(false);

  // 로그
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((level: LogEntry['level'], msg: string) => {
    setLogs(prev => [...prev, { level, msg, time: new Date().toLocaleTimeString('ko-KR', { hour12: false }) }]);
  }, []);

  // ── 초기 로드 ─────────────────────────────────────────────────────────

  useEffect(() => {
    apiListPages().then(list => {
      setPages(list);
      if (list.length > 0) selectPage(list[0].id);
    });
  }, []);

  // ── 페이지 선택 ───────────────────────────────────────────────────────

  const selectPage = async (pageId: number) => {
    if (isRunning) return;
    setCurrentPageId(pageId);
    setActiveTab('canvas');
    setPrompts([]);
    const items = await apiGetPageGenerations(pageId);
    setPrompts(items);
  };

  // ── 새 페이지 생성 ────────────────────────────────────────────────────

  const handleNewPage = async () => {
    if (isRunning) return;
    const page = await apiCreatePage();
    setPages(prev => [page, ...prev]);
    setCurrentPageId(page.id);
    setPrompts([]);
    setActiveTab('canvas');
    addLog('info', `새 페이지 생성됨 (ID: ${page.id})`);
  };

  // ── 페이지 삭제 ───────────────────────────────────────────────────────

  const handleDeletePage = async (pageId: number) => {
    await apiDeletePage(pageId);
    setPages(prev => prev.filter(p => p.id !== pageId));
    if (currentPageId === pageId) {
      const remaining = pages.filter(p => p.id !== pageId);
      if (remaining.length > 0) {
        selectPage(remaining[0].id);
      } else {
        setCurrentPageId(null);
        setPrompts([]);
      }
    }
  };

  // ── 단일 프롬프트 전송 ────────────────────────────────────────────────

  const sendSinglePrompt = async (text: string) => {
    // 페이지 없으면 자동 생성
    let pageId = currentPageId;
    if (!pageId) {
      const page = await apiCreatePage(text.slice(0, 30));
      setPages(prev => [page, ...prev]);
      setCurrentPageId(page.id);
      pageId = page.id;
    }

    const promptId = `${Date.now()}`;
    const newPrompt: PromptItem = { id: promptId, text, status: 'running', images: null };
    setPrompts(prev => [...prev, newPrompt]);

    // 첫 프롬프트면 페이지 제목 업데이트
    if (prompts.length === 0) {
      const title = text.slice(0, 30);
      apiRenamePage(pageId, title);
      setPages(prev => prev.map(p => p.id === pageId ? { ...p, title } : p));
    }

    addLog('info', `이미지 생성 시작`);

    const full = stylePrompt ? `${text}, ${stylePrompt}` : text;
    const result = await apiGenerateImages(full, promptId, 2, pageId);

    setPrompts(prev => prev.map(p =>
      p.id === promptId
        ? { ...p, status: result.success ? 'done' : 'error', images: result.images.length ? result.images : null, error: result.error }
        : p
    ));

    if (result.success) addLog('success', '이미지 2장 생성 완료');
    else addLog('error', `생성 실패: ${result.error}`);
  };

  // ── 배치 자동화 ───────────────────────────────────────────────────────

  const handleRunToggle = async () => {
    if (isRunning) {
      abortFlagRef.current = true;
      setIsRunning(false);
      addLog('warn', '자동화 중지됨');
      return;
    }

    const pending = prompts.filter(p => p.status === 'pending' || p.status === 'error');
    if (!pending.length) return;
    if (!currentPageId) return;

    setIsRunning(true);
    abortFlagRef.current = false;
    addLog('info', `자동화 시작 — ${pending.length}개 프롬프트`);

    for (const p of pending) {
      if (abortFlagRef.current) break;

      setPrompts(prev => prev.map(x => x.id === p.id ? { ...x, status: 'running' } : x));
      const full = stylePrompt ? `${p.text}, ${stylePrompt}` : p.text;
      const result = await apiGenerateImages(full, p.id, 2, currentPageId!);

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
      if (isAutoDownload) handleDownloadAllZip();
    }

    setIsRunning(false);
    abortFlagRef.current = false;
  };

  // ── 프롬프트 재시도 ───────────────────────────────────────────────────

  const retryPrompt = (id: string) => {
    setPrompts(prev => prev.map(p =>
      p.id === id ? { ...p, status: 'pending', images: null, error: undefined } : p
    ));
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

    // 페이지 없으면 생성
    if (!currentPageId) {
      const page = await apiCreatePage(results[0].text.slice(0, 30));
      setPages(prev => [page, ...prev]);
      setCurrentPageId(page.id);
    }

    setPrompts(prev => [...prev, ...results]);
    setActiveTab('canvas');
    addLog('info', `${results.length}개 프롬프트 로드 완료`);
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
          headers: { 'Content-Type': 'application/json' },
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
    const done = prompts.filter(p => p.status === 'done' && p.images?.length);
    if (!done.length) { addLog('warn', '다운로드할 이미지가 없습니다.'); return; }
    const zip = new JSZip();
    for (const p of done) {
      for (let i = 0; i < p.images!.length; i++) {
        const img = p.images![i];
        if (img.startsWith('data:image/')) {
          zip.file(`${p.id}-image-${i + 1}.png`, img.split(',')[1], { base64: true });
        } else {
          try {
            const blob = await fetch(img).then(r => r.blob());
            zip.file(`${p.id}-image-${i + 1}.png`, blob);
          } catch { /* skip */ }
        }
      }
    }
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `carbatch-page-${currentPageId}.zip`);
    addLog('success', 'ZIP 다운로드 완료');
  };

  // ── 렌더링 ────────────────────────────────────────────────────────────

  const doneCount = prompts.filter(p => p.status === 'done').length;

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden font-[var(--font-sans)]">
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        promptsCount={prompts.length}
        doneCount={doneCount}
        isRunning={isRunning}
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
              onRetryPrompt={retryPrompt}
              onParsePrompts={parsePrompts}
              onDownloadAllZip={handleDownloadAllZip}
              currentPageId={currentPageId}
            />
          )}
          {activeTab === 'setup' && (
            <SetupPane onParsePrompts={parsePrompts} />
          )}
          {activeTab === 'logs' && (
            <LogsPane logs={logs} />
          )}
        </div>
      </div>
    </div>
  );
}
