import { doc, getDoc, setDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { saveWords } from './words';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 헷갈리는 문자(I,L,O,0,1) 제외
const genCode = () =>
  Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

/** 단어장 공유 생성 → 공유 코드 반환 */
export async function createShare(uid, ownerName, title, words) {
  let code = genCode();
  // 코드 충돌 방지 (최대 3회 재시도)
  for (let i = 0; i < 3; i++) {
    const snap = await getDoc(doc(db, 'sharedWordbooks', code));
    if (!snap.exists()) break;
    code = genCode();
  }
  const expires = new Date();
  expires.setDate(expires.getDate() + 30); // 30일 만료
  await setDoc(doc(db, 'sharedWordbooks', code), {
    ownerId: uid,
    ownerName,
    title,
    words: words.map((w) => ({ english: w.english, korean: w.korean, phonetic: w.phonetic || '', pos: w.pos || '', example: w.example || '', exampleKo: w.exampleKo || '' })),
    importCount: 0,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromDate(expires)
  });
  return code;
}

/** 코드로 공유 단어장 조회 (미리보기용) */
export async function getShare(code) {
  const snap = await getDoc(doc(db, 'sharedWordbooks', code.toUpperCase().trim()));
  if (!snap.exists()) return { error: 'NOT_FOUND' };
  const data = snap.data();
  if (data.expiresAt?.toDate() < new Date()) return { error: 'EXPIRED' };
  return { data: { code: snap.id, ...data } };
}

/** 공유 단어장을 내 단어장으로 복사 — Gemini 재호출 없음 */
export async function importShare(uid, share, date) {
  const added = await saveWords(uid, date, share.words, `shared:${share.ownerName}`);
  try {
    await updateDoc(doc(db, 'sharedWordbooks', share.code), { importCount: increment(1) });
  } catch { /* 카운트 실패는 무시 */ }
  return added;
}

/** Web Share API로 카톡 등 공유 (폴백: 클립보드) */
export async function shareCode(code, title) {
  const url = `${location.origin}/import?code=${code}`;
  const text = `📚 '${title}' 단어장을 공유했어요!\n코드: ${code}`;
  if (navigator.share) {
    try { await navigator.share({ title: '시우지우 영어단어장', text, url }); return 'shared'; }
    catch { return 'cancel'; }
  }
  await navigator.clipboard.writeText(`${text}\n${url}`);
  return 'copied';
}
