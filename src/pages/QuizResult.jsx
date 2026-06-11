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
  const { score, total, wrong, streak } = state;
  const perfect = score === total;

  // 점수 카운트업
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n++;
      setCount(n);
      if (n >= score) clearInterval(t);
    }, 120);
    return () => clearInterval(t);
  }, [score]);

  return (
    <div className="page no-tab center" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
      {perfect && <Confetti />}
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }} style={{ fontSize: 76 }}>
        {perfect ? '🏆' : score >= total * 0.7 ? '🎉' : '💪'}
      </motion.div>
      <h1 style={{ fontSize: 26, marginTop: 8 }}>
        {perfect ? '완벽해요!' : score >= total * 0.7 ? '잘했어요!' : '조금만 더!'}
      </h1>
      <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--green)', margin: '8px 0' }}>
        {count}<span style={{ fontSize: 24, color: 'var(--gray-light)' }}> / {total}</span>
      </div>
      <span className="chip" style={{ background: '#FFF6D6', color: 'var(--orange)', fontSize: 15, padding: '6px 14px' }}>
        🔥 연속 {streak}일째 학습 중!
      </span>

      {wrong.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="card" style={{ width: '100%', marginTop: 24, textAlign: 'left' }}>
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
        <button className="btn btn-green" onClick={() => nav('/quiz')}>한 번 더! 🚀</button>
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => nav('/')}>홈으로</button>
      </div>
    </div>
  );
}
