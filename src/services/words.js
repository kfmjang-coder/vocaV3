import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  writeBatch, serverTimestamp, increment
} from 'firebase/firestore';
import { db } from '../firebase';

export const todayStr = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const wordsCol = (uid) => collection(db, 'users', uid, 'words');

/** 전체 단어 로드 (오프라인 캐시 활용, 클라이언트에서 날짜별 그룹핑) */
export async function getAllWords(uid) {
  const snap = await getDocs(wordsCol(uid));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function groupByDate(words) {
  const map = {};
  for (const w of words) (map[w.date] ||= []).push(w);
  return Object.entries(map)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({ date, words: list }));
}

/** 단어 일괄 저장 (F1) — 같은 날짜+같은 영어단어 중복 방지 */
export async function saveWords(uid, date, items, source = 'camera') {
  const existing = await getAllWords(uid);
  const dup = new Set(existing.filter((w) => w.date === date).map((w) => w.english));
  const batch = writeBatch(db);
  let added = 0;
  for (const it of items) {
    if (dup.has(it.english)) continue;
    const ref = doc(wordsCol(uid));
    batch.set(ref, {
      english: it.english,
      korean: it.korean,
      phonetic: it.phonetic || '',
      date,
      source,
      memorized: false,
      wrongCount: 0,
      correctCount: 0,
      reviewStage: 0,
      nextReview: date,
      createdAt: serverTimestamp()
    });
    added++;
  }
  if (added) await batch.commit();
  return added;
}

export async function addWordManual(uid, date, english, korean) {
  return saveWords(uid, date, [{ english: english.trim().toLowerCase(), korean: korean.trim() }], 'manual');
}

export const updateWord = (uid, id, data) => updateDoc(doc(db, 'users', uid, 'words', id), data);
export const deleteWord = (uid, id) => deleteDoc(doc(db, 'users', uid, 'words', id));

/** 간격 반복 (U2): 정답 시 1→3→7→14일 뒤 복습, 오답 시 리셋 */
const INTERVALS = [1, 3, 7, 14];
export async function recordAnswer(uid, word, correct) {
  const ref = doc(db, 'users', uid, 'words', word.id);
  if (correct) {
    const stage = Math.min((word.reviewStage || 0) + 1, INTERVALS.length);
    const next = new Date();
    next.setDate(next.getDate() + INTERVALS[stage - 1]);
    await updateDoc(ref, {
      correctCount: increment(1),
      reviewStage: stage,
      memorized: stage >= 2,
      nextReview: todayStr(next)
    });
  } else {
    await updateDoc(ref, {
      wrongCount: increment(1),
      reviewStage: 0,
      memorized: false,
      nextReview: todayStr()
    });
  }
}

/** 오늘 복습 대상 단어 */
export const dueWords = (words) => {
  const t = todayStr();
  return words.filter((w) => (w.nextReview || w.date) <= t);
};

// ===== 프로필 / 스트릭 / 사용량 =====
export async function getProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

/** 퀴즈 완료 시 스트릭 갱신 */
export async function updateStreak(uid, profile, score, total) {
  const t = todayStr();
  const yest = todayStr(new Date(Date.now() - 86400000));
  let streak = profile?.streak || 0;
  if (profile?.lastStudyDate === t) {
    // 오늘 이미 학습 → 유지
  } else if (profile?.lastStudyDate === yest) {
    streak += 1;
  } else {
    streak = 1;
  }
  await updateDoc(doc(db, 'users', uid), {
    streak,
    lastStudyDate: t,
    totalQuizzes: increment(1),
    totalCorrect: increment(score)
  });
  return streak;
}

/** 일일 사진 분석 제한 (S6): 하루 30회 */
export const DAILY_LIMIT = 30;
export async function checkAndCountUsage(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const t = todayStr();
  const usage = snap.data()?.usage || { date: '', count: 0 };
  const count = usage.date === t ? usage.count : 0;
  if (count >= DAILY_LIMIT) return false;
  await updateDoc(ref, { usage: { date: t, count: count + 1 } });
  return true;
}
