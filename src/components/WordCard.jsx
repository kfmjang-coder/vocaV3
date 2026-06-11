import { motion, useMotionValue, useTransform } from 'framer-motion';
import { speak, haptic } from '../hooks/useSpeech';

export default function WordCard({ word, onDelete, onToggleMemorized }) {
  const x = useMotionValue(0);
  const bg = useTransform(x, [-120, 0, 120], ['#FFDFE0', '#FFFFFF', '#D7FFB8']);

  const handleDragEnd = (_, info) => {
    if (info.offset.x < -90) { haptic([20, 40, 20]); onDelete(word); }
    else if (info.offset.x > 90) { haptic(20); onToggleMemorized(word); }
  };

  return (
    <div style={{ position: 'relative', marginBottom: 10 }}>
      {/* 스와이프 배경 힌트 */}
      <div className="between" style={{
        position: 'absolute', inset: 0, padding: '0 18px',
        borderRadius: 'var(--radius)', fontSize: 20
      }}>
        <span>✅</span><span>🗑️</span>
      </div>
      <motion.div
        className="card between"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={handleDragEnd}
        style={{ x, background: bg, position: 'relative' }}
      >
        <div>
          <div className="row" style={{ gap: 8 }}>
            <strong style={{ fontSize: 17 }}>{word.english}</strong>
            {word.memorized && <span className="chip" style={{ background: 'var(--green-light)', color: 'var(--green-dark)' }}>외움</span>}
            {word.wrongCount > 0 && <span className="chip" style={{ background: 'var(--red-light)', color: 'var(--red-dark)' }}>오답 {word.wrongCount}</span>}
          </div>
          <div style={{ color: 'var(--gray)', fontSize: 14, marginTop: 2 }}>{word.korean}</div>
        </div>
        <button
          className="btn-ghost"
          style={{ border: 'none', fontSize: 22, background: 'none', cursor: 'pointer' }}
          onClick={() => speak(word.english)}
          aria-label="발음 듣기"
        >
          🔊
        </button>
      </motion.div>
    </div>
  );
}
