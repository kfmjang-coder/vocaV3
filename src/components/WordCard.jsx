import { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { speak, haptic } from '../hooks/useSpeech';

export default function WordCard({ word, onDelete, onToggleMemorized }) {
  const x = useMotionValue(0);
  const [open, setOpen] = useState(false);
  const dark = document.documentElement.dataset.theme === 'dark';
  const bg = useTransform(
    x,
    [-120, 0, 120],
    dark ? ['#3F181C', '#202F36', '#203A10'] : ['#FFDFE0', '#FFFFFF', '#D7FFB8']
  );

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
        className="card"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={handleDragEnd}
        style={{ x, background: bg, position: 'relative' }}
      >
        <div
          className="between"
          onClick={() => { if (word.example) { haptic(8); setOpen(!open); } }}
          style={{ cursor: word.example ? 'pointer' : 'default' }}
        >
          <div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 17 }}>{word.english}</strong>
              {word.pos && <span className="chip" style={{ fontSize: 11 }}>{word.pos}</span>}
              {word.phonetic && <span style={{ fontSize: 13, color: 'var(--gray-light)', fontWeight: 600 }}>{word.phonetic}</span>}
              {word.memorized && <span className="chip" style={{ background: 'var(--green-light)', color: 'var(--green-dark)' }}>외움</span>}
              {word.wrongCount > 0 && <span className="chip" style={{ background: 'var(--red-light)', color: 'var(--red-dark)' }}>오답 {word.wrongCount}</span>}
            </div>
            <div style={{ color: 'var(--gray)', fontSize: 14, marginTop: 2 }}>
              {word.korean}
              {word.example && (
                <span style={{ fontSize: 11, color: 'var(--gray-light)', marginLeft: 6 }}>
                  {open ? '▲' : '💬 예문'}
                </span>
              )}
            </div>
          </div>
          <button
            className="btn-ghost"
            style={{ border: 'none', fontSize: 22, background: 'none', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); speak(word.english); }}
            aria-label="발음 듣기"
          >
            🔊
          </button>
        </div>

        {/* 예문 펼침 */}
        <AnimatePresence>
          {open && word.example && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="row" style={{
                marginTop: 10, paddingTop: 10, gap: 10, alignItems: 'flex-start',
                borderTop: '1px solid var(--line)'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>{word.example}</div>
                  {word.exampleKo && (
                    <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>{word.exampleKo}</div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); speak(word.example, 0.9); }}
                  style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 0 }}
                  aria-label="예문 듣기"
                >
                  🔊
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
