import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => dstr(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dstr(d); };

/** 초 → "3분", "1시간 12분" */
export function fmtDuration(sec) {
  if (!sec || sec < 60) return `${sec || 0}초`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  return `${h}시간 ${m % 60}분`;
}

/** "며칠 전" 라벨 (마지막 접속 날짜 문자열 기준) */
export function daysSinceLabel(dateStr) {
  if (!dateStr) return { days: Infinity, label: '기록 없음' };
  const last = new Date(dateStr + 'T00:00:00');
  const now = new Date(today() + 'T00:00:00');
  const days = Math.round((now - last) / 86400000);
  if (days <= 0) return { days: 0, label: '오늘' };
  if (days === 1) return { days: 1, label: '어제' };
  return { days, label: `${days}일 전` };
}

// 건강한 하루 사용시간 상한(분) — 넘으면 과사용 경고(아동 웰빙)
export const HEALTHY_DAILY_MIN = 60;

/**
 * 전체 사용자 활동 요약을 관리자용으로 계산.
 * users 컬렉션 전체를 읽으므로 관리자 규칙 하에서만 성공.
 * @returns 사용자별 { uid, name, email, streak, lastActiveDate, todaySec, weekSec, weekOpens, inactiveDays, overuse }
 */
export async function loadActivityOverview() {
  const snap = await getDocs(collection(db, 'users'));
  const t = today();
  const weekDays = Array.from({ length: 7 }, (_, i) => daysAgo(i));

  const rows = snap.docs.map((docSnap) => {
    const d = docSnap.data();
    const act = d.activity || {};
    // 마지막 접속 날짜: activity의 날짜 키 중 최댓값 (lastActive 타임스탬프 대신 날짜 기반 — 견고)
    const dayKeys = Object.keys(act).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
    const lastActiveDate = d.lastStudyDate && d.lastStudyDate > (dayKeys.sort().at(-1) || '')
      ? d.lastStudyDate
      : (dayKeys.sort().at(-1) || '');

    const todaySec = act[t]?.seconds || 0;
    let weekSec = 0, weekOpens = 0;
    for (const k of weekDays) {
      weekSec += act[k]?.seconds || 0;
      weekOpens += act[k]?.opens || 0;
    }
    const { days: inactiveDays } = daysSinceLabel(lastActiveDate || d.lastStudyDate || '');

    return {
      uid: docSnap.id,
      name: d.name || '이름 없음',
      email: d.email || '',
      avatarEmoji: d.avatarEmoji || '🦉',
      avatarColor: d.avatarColor || '#58CC02',
      streak: d.streak || 0,
      totalQuizzes: d.totalQuizzes || 0,
      lastActiveDate: lastActiveDate || d.lastStudyDate || '',
      todaySec,
      weekSec,
      weekOpens,
      inactiveDays,
      overuse: Math.round(todaySec / 60) > HEALTHY_DAILY_MIN
    };
  });

  return rows;
}
