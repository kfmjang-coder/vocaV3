import { useEffect, useRef, useState, useCallback } from 'react';

// ===== TTS 음성 프로필 =====
export const VOICE_PROFILES = {
  woman:  { label: '여자',   emoji: '👩', gender: 'female', pitch: 1.0,  rate: 1.0 },
  man:    { label: '남자',   emoji: '👨', gender: 'male',   pitch: 0.85, rate: 0.98 },
  kid:    { label: '어린이', emoji: '🧒', gender: 'female', pitch: 1.6,  rate: 1.08 },
  teen:   { label: '청소년', emoji: '🧑', gender: 'female', pitch: 1.25, rate: 1.05 },
  elder:  { label: '노인',   emoji: '👴', gender: 'male',   pitch: 0.7,  rate: 0.82 },
  random: { label: '랜덤',   emoji: '🎲', gender: null,     pitch: 1.0,  rate: 1.0 }
};
export const VOICE_ORDER = ['woman', 'man', 'kid', 'teen', 'elder', 'random'];

const VOICE_KEY = 'voca-voice';
export const getVoiceProfile = () => localStorage.getItem(VOICE_KEY) || 'woman';
export const setVoiceProfile = (id) => localStorage.setItem(VOICE_KEY, id);

// 성별에 맞는 실제 en 음성 찾기 (기기에 있는 것 우선 활용)
function pickVoice(gender) {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
  if (!voices.length) return null;
  const byName = (kw) => voices.find((v) => kw.some((k) => v.name.toLowerCase().includes(k)));
  if (gender === 'male') return byName(['male', 'daniel', 'fred', 'aaron', 'arthur']) || voices[0];
  if (gender === 'female') return byName(['female', 'samantha', 'karen', 'moira', 'tessa', 'zira']) || voices[0];
  return voices[0];
}

/** 영어 TTS — rate 인자는 '천천히 듣기(0.7)'용, 선택된 음성 프로필과 곱해 적용 */
export function speak(text, rate = 1) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();

  let id = getVoiceProfile();
  if (id === 'random') {
    const pool = VOICE_ORDER.filter((k) => k !== 'random');
    id = pool[Math.floor(Math.random() * pool.length)];
  }
  const p = VOICE_PROFILES[id] || VOICE_PROFILES.woman;

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = Math.max(0.5, Math.min(1.6, p.rate * rate)); // 프로필 속도 × 천천히듣기 배수
  u.pitch = p.pitch;
  const v = pickVoice(p.gender);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

// Android Chrome에서 voices가 비동기 로딩되는 경우 대비
if ('speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}

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
