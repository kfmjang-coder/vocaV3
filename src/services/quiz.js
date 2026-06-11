import { todayStr } from './words';

export const SESSION_SIZE = 10; // U4: 한 세션 10단어

// 단어가 4개 미만일 때 보기 보충용 기본 풀
const FALLBACK = [
  { english: 'apple', korean: '사과' },
  { english: 'school', korean: '학교' },
  { english: 'friend', korean: '친구' },
  { english: 'water', korean: '물' },
  { english: 'happy', korean: '행복한' },
  { english: 'study', korean: '공부하다' },
  { english: 'music', korean: '음악' },
  { english: 'family', korean: '가족' }
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** 출제 단어 선정: 오답 많은 단어 + 복습 기한 도래 단어 우선 */
export function pickSessionWords(words, count = SESSION_SIZE) {
  const t = todayStr();
  const scored = words.map((w) => ({
    w,
    score:
      (w.wrongCount || 0) * 3 +
      ((w.nextReview || w.date) <= t ? 5 : 0) +
      Math.random() * 4 // 같은 단어만 반복되지 않도록 랜덤성
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((s) => s.w);
}

/** 4지선다 보기 생성 — 본인이 저장한 다른 단어에서 추출 (확정안) */
export function buildChoices(answerWord, allWords, field) {
  const pool = allWords.filter(
    (w) => w.english !== answerWord.english && w[field] && w[field] !== answerWord[field]
  );
  const uniq = [];
  const seen = new Set([answerWord[field]]);
  for (const w of shuffle(pool)) {
    if (!seen.has(w[field])) { uniq.push(w[field]); seen.add(w[field]); }
    if (uniq.length === 3) break;
  }
  // 부족하면 기본 풀에서 보충
  for (const f of shuffle(FALLBACK)) {
    if (uniq.length === 3) break;
    if (!seen.has(f[field])) { uniq.push(f[field]); seen.add(f[field]); }
  }
  return shuffle([answerWord[field], ...uniq]);
}

/** 세션 문제 생성. mode: e2k | k2e | spell | listen | mix */
export function buildSession(words, allWords, mode) {
  const picked = pickSessionWords(words);
  const modes = ['e2k', 'k2e', 'spell', 'listen'];
  return picked.map((w) => {
    const m = mode === 'mix' ? modes[Math.floor(Math.random() * modes.length)] : mode;
    const q = { word: w, mode: m };
    if (m === 'e2k') q.choices = buildChoices(w, allWords, 'korean');
    if (m === 'k2e') q.choices = buildChoices(w, allWords, 'english');
    return q;
  });
}

// ===== 정답 매칭 =====
const normKo = (s) =>
  String(s || '').replace(/\s/g, '').replace(/[.,!?~'"()]/g, '').trim();

/** 저장된 한글 뜻 분해: "달리다; 운영하다" → ["달리다","운영하다"] */
export const koCandidates = (korean) =>
  String(korean || '')
    .split(/[;,/·]/)
    .map((s) => normKo(s))
    .filter(Boolean);

/** 듣고말하기 1차 문자열 매칭 */
export function matchKorean(korean, spoken) {
  const said = normKo(spoken);
  if (!said) return false;
  return koCandidates(korean).some(
    (c) => said === c || said.includes(c) || c.includes(said)
  );
}

/** 스펠링 매칭 */
export const matchEnglish = (english, typed) =>
  String(typed || '').trim().toLowerCase() === String(english).trim().toLowerCase();
