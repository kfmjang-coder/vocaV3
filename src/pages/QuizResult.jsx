import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Confetti } from '../components/ui';
import { speak } from '../hooks/useSpeech';

export default function QuizResult() {
  const { state } = useLocation();
  const nav = useNavigate();
  const [count, setCount] = useState(0);

  if (!state) return <Navigate to="/quiz" replace />;
  const { score, total, wrong, streak, poolIds, mode, doneIds, poolTotal } = state;
  const perfect = score === total;

  // 진도 계산
  const doneCount = doneIds?.length || total;
  const poolSize = poolTotal || total;
  const remaining = Math.max(0, poolSize - doneCount);
  const hasMore = remaining > 0 && poolIds && mode;
  const progressPct = Math.round((doneCount / poolSize) * 100);

  // 점수 카운트업
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n++; setCount(n);
      if (n >= score) clearInterval(t);
    }, 120);
    return () => clearInterval(t);
  }, [score]);

  // 이어서 하기: 남은 단어로 다음 세션 시작 (설정 화면 건너뜀)
  const continueNext = () => {
    nav('/quiz/session', { replace: true, state: { poolIds, mode, doneIds } });
  };
  // 처음부터 다시: 진도 초기화
  const restart = () => {
    nav('/quiz/session', { replace: true, state: { poolIds, mode, doneIds: [] } });
  };

  const allDone = poolIds && remaining === 0; // 이 단어장을 다 훑음

  return (
    <div className="page no-tab center" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
      {(perfect || allDone) && <Confetti />}
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }} style={{ fontSize: 76 }}>
        {allDone ? '🏁' : perfect ? '🏆' : score >= total * 0.7 ? '🎉' : '💪'}
      </motion.div>
      <h1 style={{ fontSize: 26, marginTop: 8 }}>
        {allDone ? '한 바퀴 완주!' : perfect ? '완벽해요!' : score >= total * 0.7 ? '잘했어요!' : '조금만 더!'}
      </h1>
      <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--green)', margin: '8px 0' }}>
        {count}<span style={{ fontSize: 24, color: 'var(--gray-light)' }}> / {total}</span>
      </div>

      {/* 진도 표시 (단어장 범위일 때만) */}
      {poolIds && poolSize > total && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          style={{ width: '100%', marginBottom: 4 }}>
          <div className="between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>단어장 진도</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--green-dark)' }}>{doneCount} / {poolSize}개</span>
          </div>
          <div className="progress-track" style={{ height: 12 }}>
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </motion.div>
      )}

      <span className="chip" style={{ background: 'var(--tint-yellow)', color: 'var(--orange)', fontSize: 15, padding: '6px 14px', marginTop: 10 }}>
        🔥 연속 {streak}일째 학습 중!
      </span>

      {wrong.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="card" style={{ width: '100%', marginTop: 20, textAlign: 'left' }}>
          <strong style={{ color: 'var(--red-dark)' }}>다시 볼 단어 ({wrong.length})</strong>
          {wrong.map((w, i) => (
            <div key={i} className="between" style={{ padding: '10px 0', borderBottom: i < wrong.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div>
                <strong>{w.english}</strong>
                <span style={{ color: 'var(--gray)', marginLeft: 8 }}>{w.korean}</span>
              </div>
              <button onClick={() => speak(w.english)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>🔊</button>
            </div>
          ))}
        </motion.div>
      )}

      <div style={{ width: '100%', marginTop: 24 }}>
        {hasMore ? (
          <>
            <button className="btn btn-green" onClick={continueNext}>
              이어서 계속하기 (남은 {remaining}개) →
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => nav('/quiz')}>그만하고 나가기</button>
          </>
        ) : allDone ? (
          <>
            <div style={{ fontSize: 14, color: 'var(--gray)', marginBottom: 12, fontWeight: 600 }}>
              이 단어장을 한 바퀴 다 훑었어요! 👏
            </div>
            <button className="btn btn-green" onClick={restart}>처음부터 다시 훑기 🔁</button>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => nav('/')}>홈으로</button>
          </>
        ) : (
          <>
            <button className="btn btn-green" onClick={() => nav('/quiz')}>다른 퀴즈 풀기 🚀</button>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => nav('/')}>홈으로</button>
          </>
        )}
      </div>
    </div>
  );
}
