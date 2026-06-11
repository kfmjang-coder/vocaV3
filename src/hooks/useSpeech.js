import { useEffect, useRef, useState, useCallback } from 'react';

/** 영어 TTS — rate 0.7 = 천천히 듣기 (U3) */
export function speak(text, rate = 1) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  // 영어 음성 우선 선택
  const v = speechSynthesis.getVoices().find((v) => v.lang.startsWith('en'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

// Android Chrome에서 voices가 비동기 로딩되는 경우 대비
if ('speechSynthesis' in window) speechSynthesis.getVoices();

/** 한글 음성 인식 (STT) — Android Chrome 완벽 지원, 미지원 시 supported=false */
export function useRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SR;
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join('');
      setTranscript(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.abort(); } catch {} };
  }, []);

  const start = useCallback(() => {
    if (!recRef.current) return;
    setTranscript('');
    try { recRef.current.start(); setListening(true); } catch {}
  }, []);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
  }, []);

  return { supported, listening, transcript, start, stop, setTranscript };
}

/** 햅틱 진동 (Android) */
export const haptic = (pattern = 20) => {
  try { navigator.vibrate?.(pattern); } catch {}
};
