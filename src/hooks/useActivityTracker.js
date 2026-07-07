import { useEffect, useRef } from 'react';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const FLUSH_MS = 30000;      // 30초마다 누적 저장
const MAX_SESSION_MS = 4 * 60 * 60 * 1000; // 비정상 값 방지 상한(4시간)

/**
 * 로그인 사용자의 "포그라운드 체류시간"만 측정해 하루 단위로 Firestore에 집계.
 * - Page Visibility API: 화면에 보일 때만 타이머 작동(백그라운드·화면잠금 정지)
 * - 초 단위 로그를 남기지 않고 하루치 seconds/opens만 누적 → 가볍고 프라이버시 보호
 * 저장 위치: users/{uid}.activity.{YYYY-MM-DD} = { seconds, opens }, activity.lastActive
 */
export function useActivityTracker(uid) {
  const startRef = useRef(null);   // 현재 포그라운드 구간 시작 시각
  const bufferRef = useRef(0);     // 아직 저장 안 한 누적 ms
  const flushTimer = useRef(null);

  useEffect(() => {
    if (!uid) return;

    const ref = doc(db, 'users', uid);

    const beginSegment = () => { startRef.current = Date.now(); };
    const endSegment = () => {
      if (startRef.current == null) return;
      const elapsed = Math.min(Date.now() - startRef.current, MAX_SESSION_MS);
      if (elapsed > 0) bufferRef.current += elapsed;
      startRef.current = null;
    };

    const flush = async (extraOpen = 0) => {
      endSegment();
      const secs = Math.round(bufferRef.current / 1000);
      bufferRef.current = 0;
      if (secs <= 0 && extraOpen <= 0) { beginSegment(); return; }
      const t = todayStr();
      try {
        await setDoc(ref, {
          activity: {
            lastActive: serverTimestamp(),
            [t]: {
              seconds: increment(secs),
              opens: increment(extraOpen)
            }
          }
        }, { merge: true });
      } catch (e) { /* 오프라인 등은 조용히 무시, 다음 flush에서 재시도 */ }
      beginSegment();
    };

    // 앱 진입 = 오픈 1회 + 세션 시작
    beginSegment();
    flush(1);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        beginSegment();
      } else {
        flush(0); // 백그라운드 전환 시 누적 저장
      }
    };
    const onHide = () => { endSegment(); flush(0); };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    flushTimer.current = setInterval(() => flush(0), FLUSH_MS);

    return () => {
      clearInterval(flushTimer.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      flush(0);
    };
  }, [uid]);
}
