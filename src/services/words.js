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

/** 새 단어장 ID 생성 */
export const newBookId = () =>
  'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const wordsCol = (uid) => collection(db, 'users', uid, 'words');

/**
 * 전체 단어 로드. bookId 없는 기존(legacy) 단어는 date 기반 가상 bookId를 부여해
 * 마이그레이션 없이도 단어장 단위로 동작하게 한다.
 */
export async function getAllWords(uid) {
  const snap = await getDocs(wordsCol(uid));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      bookId: data.bookId || `legacy-${data.date}`,
      _legacy: !data.bookId // 아직 bookId가 DB에 없는 단어 표시
    };
  });
}

/** 단어장(bookId) 단위 그룹핑. 각 그룹은 title/date/words 포함 */
export function groupByBook(words) {
  const map = {};
  for (const w of words) {
    const key = w.bookId;
    if (!map[key]) map[key] = { bookId: key, words: [], date: w.date, title: '' };
    map[key].words.push(w);
    // 그룹 대표 날짜는 가장 최근, 제목은 존재하는 것 우선
    if (w.date > map[key].date) map[key].date = w.date;
    if (w.title && !map[key].title) map[key].title = w.title;
  }
  // createdAt(있으면) 혹은 date 기준 최신순 정렬
  return Object.values(map).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.bookId < b.bookId ? 1 : -1;
  });
}

/** 하위호환용: 기존 코드가 쓰던 날짜 그룹핑도 유지 */
export function groupByDate(words) {
  const map = {};
  for (const w of words) (map[w.date] ||= []).push(w);
  return Object.entries(map)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({ date, words: list }));
}

/**
 * 단어 일괄 저장. bookId/title/date를 지정한다.
 * 같은 단어장(bookId) 안에서 같은 영어단어 중복만 방지.
 */
export async function saveWords(uid, items, { bookId, title = '', date, source = 'camera' }) {
  const bId = bookId || newBookId();
  const d = date || todayStr();
  const existing = await getAllWords(uid);
  const dup = new Set(existing.filter((w) => w.bookId === bId).map((w) => w.english));
  const batch = writeBatch(db);
  let added = 0;
  for (const it of items) {
    if (dup.has(it.english)) continue;
    const ref = doc(wordsCol(uid));
    batch.set(ref, {
      english: it.english,
      korean: it.korean,
      phonetic: it.phonetic || '',
      pos: it.pos || '',
      example: it.example || '',
      exampleKo: it.exampleKo || '',
      bookId: bId,
      title: title || '',
      date: d,
      source,
      memorized: false,
      wrongCount: 0,
      correctCount: 0,
      reviewStage: 0,
      nextReview: d,
      createdAt: serverTimestamp()
    });
    added++;
  }
  if (added) await batch.commit();
  return { added, bookId: bId };
}

/** 단어 하나를 특정 단어장에 수동 추가 */
export async function addWordManual(uid, { bookId, title, date, english, korean }) {
  return saveWords(uid, [{ english: english.trim().toLowerCase(), korean: korean.trim() }],
    { bookId, title, date, source: 'manual' });
}

export const updateWord = (uid, id, data) => updateDoc(doc(db, 'users', uid, 'words', id), data);
export const deleteWord = (uid, id) => deleteDoc(doc(db, 'users', uid, 'words', id));

/** 단어장 이름 변경 — 그룹 내 모든 단어의 title 갱신 (legacy는 bookId도 함께 확정) */
export async function renameBook(uid, group, title) {
  if (!group.words.length) return;
  const realBookId = group.words[0].bookId?.startsWith('legacy-')
    ? newBookId() : group.words[0].bookId;
  const batch = writeBatch(db);
  for (const w of group.words) {
    const patch = { title: title.trim() };
    if (w._legacy) { patch.bookId = realBookId; } // legacy → 실제 bookId 확정
    batch.update(doc(db, 'users', uid, 'words', w.id), patch);
  }
  await batch.commit();
  return realBookId;
}

/** 단어장 통째 삭제 — 그룹 내 모든 단어 삭제 (배치 청크) */
export async function deleteBook(uid, group) {
  const target = group.words;
  if (!target.length) return 0;
  for (let i = 0; i < target.length; i += 450) {
    const batch = writeBatch(db);
    for (const w of target.slice(i, i + 450)) {
      batch.delete(doc(db, 'users', uid, 'words', w.id));
    }
    await batch.commit();
  }
  return target.length;
}

/** 간격 반복 (U2): 정답 시 1→3→7→14일 뒤 복습, 오답 시 리셋 */
const INTERVALS = [1, 3, 7, 14];
export async function recordAnswer(uid, word, correct) {
  const ref = doc(db, 'users', uid, 'words', word.id);
  if (correct) {
    const stage = Math.min((word.reviewStage || 0) + 1, INTERVALS.length);
    const next = new Date();
    next.setDate(next.getDate() + INTERVALS[stage - 1]);
    // 오답노트 졸업: 틀린 뒤 연속 2회 정답이면 오답노트에서 제외
    const streak = (word.wrongStreak || 0) + 1;
    const patch = {
      correctCount: increment(1),
      reviewStage: stage,
      memorized: stage >= 2,
      nextReview: todayStr(next),
      wrongStreak: streak
    };
    // 현재 오답노트에 있는 단어(기존 데이터 포함)가 연속 2회 정답이면 졸업
    if (streak >= 2 && isInWrongNote(word)) patch.inWrongNote = false;
    await updateDoc(ref, patch);
  } else {
    // 틀리거나 스킵 → 오답노트 편입, 연속정답 카운터 리셋
    await updateDoc(ref, {
      wrongCount: increment(1),
      reviewStage: 0,
      memorized: false,
      nextReview: todayStr(),
      wrongStreak: 0,
      inWrongNote: true
    });
  }
}

/** 오답노트에서 수동 제거 */
export async function removeFromWrongNote(uid, id) {
  await updateDoc(doc(db, 'users', uid, 'words', id), { inWrongNote: false, wrongStreak: 2 });
}

/** 오답노트 포함 여부 판정 (기존 데이터 호환: inWrongNote 없으면 wrongCount로 추정) */
export const isInWrongNote = (w) =>
  w.inWrongNote !== undefined ? w.inWrongNote : (w.wrongCount || 0) > 0;

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
