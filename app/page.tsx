"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { PromptItem, LogEntry } from './types';
import TopBar from './components/TopBar';
import LeftPanel from './components/LeftPanel';
import CanvasPane from './components/CanvasPane';
import { SetupPane, LogsPane } from './components/SetupAndLogsPanes';

async function generateImagesFromAPI(prompt: string, id: string, count: number = 2) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1/generate';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, id, count })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      images: (data.images || []) as string[],
      error: undefined
    };
  } catch (error: Error | unknown) {
    const errObj = error as Error;
    return {
      success: false,
      images: [],
      error: errObj.message || 'Unknown network error'
    };
  }
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<'canvas' | 'setup' | 'logs'>('canvas');
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [stylePrompt, setStylePrompt] = useState('');
  const [styleImagePreview, setStyleImagePreview] = useState<string | null>(null);
  const [isExtractingStyle, setIsExtractingStyle] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAutoDownload, setIsAutoDownload] = useState(false);
  const [downloadedZipCount, setDownloadedZipCount] = useState(0);

  // References for the automation loop
  const abortFlagRef = useRef(false);
  const isRunningRef = useRef(false);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const addLog = useCallback((level: 'info' | 'success' | 'warn' | 'error', msg: string, promptId?: string) => {
    setLogs(prev => [...prev, {
      level, msg, promptId, 
      time: new Date().toLocaleTimeString('ko-KR', { hour12: false })
    }]);
  }, []);

  const parsePrompts = (text: string) => {
    const results: PromptItem[] = [];
    const lines = text.split('\n');
    let curId: string | null = null, curLines: string[] = [];

    const flush = () => {
      if (curId && curLines.length) {
        const joined = curLines.join(' ').trim();
        if (joined) results.push({
          id: curId,
          number: parseInt(curId),
          text: joined,
          folderName: curId, // Fallback folder name
          status: 'pending',
          image: null
        });
      }
    };

    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const m = t.match(/^(\d{1,3})\s+(.+)/);
      if (m) {
        flush();
        curId = m[1].padStart(3, '0');
        curLines = [m[2]];
      } else if (curId) {
        curLines.push(t);
      }
    }
    flush();

    if (!results.length) return false;

    setPrompts(results);
    setSelectedId(null);
    setActiveTab('canvas');
    addLog('info', `${results.length}개 프롬프트 파싱 완료`);
    return true;
  };

  const handleRunToggle = async () => {
    if (isRunning) {
      // Stop
      abortFlagRef.current = true;
      setIsRunning(false);
      addLog('warn', '자동화 중지됨');
      return;
    }

    if (!prompts.length) return;

    setIsRunning(true);
    abortFlagRef.current = false;
    
    // Create a ref for the latest style prompt since state won't update in the async loop scope
    const currentStyle = stylePrompt;

    addLog('info', `자동화 시작 — ${prompts.length}개 프롬프트, 스타일: "${currentStyle || '없음'}"`);

    const pendingIndices = prompts.map((p, i) => (p.status === 'pending' || p.status === 'error') ? i : -1).filter(i => i !== -1);

    for (let i = 0; i < pendingIndices.length; i++) {
      if (abortFlagRef.current) break;

      const idx = pendingIndices[i];
      const p = prompts[idx];
      
      // Update running status
      setPrompts(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'running' };
        return next;
      });
      setSelectedId(p.id);

      addLog('info', `프롬프트 처리 중 (${i+1}/${pendingIndices.length})`, p.id);

      // Latest style from react state updater function hook wrapper could be better, 
      // but simple variable works for this mock.
      const fullPrompt = stylePrompt ? `${p.text}, ${stylePrompt}` : p.text;

      const result = await generateImagesFromAPI(fullPrompt, p.id, 1);

      if (abortFlagRef.current) break;

      setPrompts(prev => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          status: result.success ? 'done' : 'error',
          image: result.success && result.images && result.images.length > 0 ? result.images[0] : next[idx].image,
          error: result.error
        };
        return next;
      });

      if (result.success) {
        addLog('success', `이미지 1장 생성 완료`, p.id);
      } else {
        addLog('error', `생성 실패: ${result.error}`, p.id);
      }

      // Removed loop delay since we removed delaySec slider
      // Just a tiny pause to avoid locking main thread completely
      if (i < pendingIndices.length - 1 && !abortFlagRef.current) {
        await new Promise<void>(resolve => setTimeout(resolve, 500));
      }
    }

    if (!abortFlagRef.current) {
      addLog('success', '모든 프롬프트 처리 완료! ✦');
    }

    setIsRunning(false);
    abortFlagRef.current = false;
  };

  const handleStyleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Display preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setStyleImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsExtractingStyle(true);
    addLog('info', '이미지 분석 시작 (스타일 추출)...');

    try {
      // Mock API call for style extraction — in real world, post to /api/extract-style using Vision model
      await new Promise(resolve => setTimeout(resolve, 2000));
      const extractedStyle = "Cinematic lighting, 35mm photography, high contrast, muted aesthetic, highly detailed";
      setStylePrompt(extractedStyle);
      addLog('success', '스타일 텍스트 추출 완료');
    } catch (err: unknown) {
      addLog('error', `스타일 추출 실패: ${(err as Error).message || ''}`);
    } finally {
      setIsExtractingStyle(false);
    }
  };

  const handleDownloadAllZip = async () => {
    addLog('info', '전체 ZIP 다운로드 준비 중...');
    
    try {
      const zip = new JSZip();
      
      // Get all done prompts with images
      const donePrompts = prompts.filter(p => p.status === 'done' && p.image);
      
      if (donePrompts.length === 0) {
        addLog('warn', '다운로드할 완료된 이미지가 없습니다.');
        return;
      }

      for (const p of donePrompts) {
        const folderName = p.folderName || p.id;
        const imgUrlOrBase64 = p.image!;
        let imgData: Blob | string;

        if (imgUrlOrBase64.startsWith('data:image/')) {
          // Extract base64 part
          imgData = imgUrlOrBase64.split(',')[1];
          zip.folder(folderName)?.file(`image.png`, imgData, { base64: true });
        } else {
          try {
            const res = await fetch(imgUrlOrBase64);
            imgData = await res.blob();
            zip.folder(folderName)?.file(`image.png`, imgData);
          } catch(e) {
            addLog('warn', `이미지 다운로드 실패: ${folderName}`);
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `batch-studio-images.zip`);
      addLog('success', 'ZIP 다운로드 완료');
      setDownloadedZipCount(prev => prev + 1);
    } catch (e: unknown) {
      addLog('error', `ZIP 생성 중 에러 발생: ${(e as Error).message}`);
    }
  };

  // Keep track of completion to trigger auto-download only once per run
  useEffect(() => {
    const doneCount = prompts.filter(p => p.status === 'done').length;
    const errCount = prompts.filter(p => p.status === 'error').length;
    
    // If we have prompts, and all are either done or err, AND we are running (which just stopped), we could download.
    // Easiest is to just check if we just finished processing everything while auto-download is true.
    if (
      isAutoDownload &&
      prompts.length > 0 && 
      (doneCount + errCount === prompts.length) && 
      doneCount > 0 &&
      !isRunningRef.current // Only trigger when run loop explicitly finishes
    ) {
      // Small debounce to avoid multiple triggers on react state ticks
      const timeoutId = setTimeout(() => {
        // Prevent infinite loop if already downloaded this exact batch
        const sig = doneCount + "-" + prompts.length;
        if (downloadedZipCount.toString() !== sig) {
          addLog('info', '자동 ZIP 다운로드 예약 실행됨');
          handleDownloadAllZip();
          setDownloadedZipCount(parseInt(sig) || 0); // Mark as done for this batch size
        }
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [prompts, isAutoDownload]);

  const handleNewChat = () => {
    if (isRunning) return;
    if (prompts.length === 0) {
      return;
    }
    setPrompts([]);
    setSelectedId(null);
    setActiveTab('canvas');
    addLog('info', '새 채팅이 시작되었습니다.');
  };

  const sendSinglePrompt = async (text: string) => {
    const id = String(Date.now()).slice(-3).padStart(3, '0');
    const newPrompt: PromptItem = {
      id, number: parseInt(id), text, status: 'running', image: null
    };
    
    setPrompts(prev => [...prev, newPrompt]);
    setSelectedId(id);
    addLog('info', `단일 프롬프트 생성 시작`, id);

    const full = stylePrompt ? `${text}, ${stylePrompt}` : text;
    const result = await generateImagesFromAPI(full, id, 1);

    setPrompts(prev => {
      const next = [...prev];
      const idx = next.findIndex(x => x.id === id);
      if (idx !== -1) {
        next[idx] = {
          ...next[idx],
          status: result.success ? 'done' : 'error',
          image: result.success && result.images && result.images.length > 0 ? result.images[0] : next[idx].image,
          error: result.error
        };
      }
      return next;
    });

    if (result.success) {
      addLog('success', '이미지 1장 생성 완료', id);
    } else {
      addLog('error', result.error!, id);
    }
  };

  const retryPrompt = (id: string) => {
    setPrompts(prev => prev.map(p => 
      p.id === id ? { ...p, status: 'pending', image: null, error: undefined } : p
    ));
    addLog('info', `재시도 예약됨`, id);
  };

  const doneCount = prompts.filter(p => p.status === 'done').length;
  const currentPromptIndex = prompts.findIndex(p => p.id === selectedId) !== -1 
    ? prompts.findIndex(p => p.id === selectedId) 
    : isRunning ? prompts.findIndex(p => p.status === 'running')
    : 0; // Default to 0 or something

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
          stylePrompt={stylePrompt} setStylePrompt={setStylePrompt}
          styleImagePreview={styleImagePreview} onStyleImageUpload={handleStyleImageUpload}
          isExtractingStyle={isExtractingStyle}
          isAutoDownload={isAutoDownload} setIsAutoDownload={setIsAutoDownload}
          onDownloadAllZip={handleDownloadAllZip}
          onNewChat={handleNewChat}
          prompts={prompts}
          selectedId={selectedId} setSelectedId={setSelectedId}
          isRunning={isRunning}
          onRunToggle={handleRunToggle}
          onSwitchToSetup={() => setActiveTab('setup')}
          nextStylePromptId={isRunning && currentPromptIndex < prompts.length - 1 ? prompts[currentPromptIndex + 1]?.id : undefined}
        />
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[var(--bg)]">
          {activeTab === 'canvas' && (
            <CanvasPane 
              prompts={prompts}
              currentPromptIndex={currentPromptIndex}
              isRunning={isRunning}
              onSendSinglePrompt={sendSinglePrompt}
              onRetryPrompt={retryPrompt}
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
