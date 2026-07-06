import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getAllWords, isInWrongNote, removeFromWrongNote } from '../services/words';
import { Page, EmptyState } from '../components/ui';
import { speak, haptic } from '../hooks/useSpeech';

/** 오답노트 단어 카드: 왼쪽으로 밀면 "다 외웠어요"로 졸업 */
function WrongCard({ word, index, onGraduate }) {
  const x = useMotionValue(0);
  const bg = useTransform(x, [-120, 0], ['var(--green-light)', 'var(--card)']);
  const hint = useTransform(x, [-80, -20, 0], [1, 0.4, 0]);

  return (
    <div style={{ position: 'relative', marginBottom: 10 }}>
      <motion.div style={{ opacity: hint }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--green)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 20, color: '#fff', fontWeight: 800, gap: 6 }}>
          ✅ 다 외웠어요
        </div>
      </motion.div>
      <motion.div
        className="card between"
        drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.5}
        style={{ x, background: bg, position: 'relative' }}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.03, 0.4) }}
        onDragEnd={(_, info) => { if (info.offset.x < -90) { haptic(20); onGraduate(word); } }}
      >
        <div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 16 }}>{word.english}</strong>
            {word.pos && <span className="chip" style={{ fontSize: 10 }}>{word.pos}</span>}
            <span className="chip" style={{ background: 'var(--red-light)', color: 'var(--red-dark)' }}>틀림 {word.wrongCount || 0}회</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--gray)', marginTop: 2 }}>{word.korean}</div>
        </div>
        <button onClick={() => speak(word.english)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>🔊</button>
      </motion.div>
    </div>
  );
}

export default function WrongNote() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [words, setWords] = useState(null);
  const [toast, setToast] = useState('');

  const load = () => getAllWords(user.uid).then((all) => setWords(all.filter(isInWrongNote)));
  useEffect(() => { load(); }, [user]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); } }, [toast]);

  const graduate = async (w) => {
    setWords((prev) => prev.filter((x) => x.id !== w.id)); // 낙관적 제거
    setToast(`"${w.english}"를 오답노트에서 뺐어요 ✅`);
    await removeFromWrongNote(user.uid, w.id).catch(() => load());
  };

  return (
    <Page className="no-tab">
      <button style={{ background: 'none', border: 'none', color: 'var(--gray)', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 8 }} onClick={() => nav('/quiz')}>
        ← 퀴즈
      </button>
      <h1>오답노트 ❌</h1>
      <p className="sub">← 왼쪽으로 밀면 오답노트에서 빼요</p>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card" style={{ background: 'var(--green-light)', borderColor: 'var(--green)', color: 'var(--green-dark)', fontWeight: 800, textAlign: 'center', marginBottom: 12, padding: 12 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {words === null && [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 64, marginBottom: 10 }} />)}

      {words?.length === 0 && (
        <EmptyState emoji="🎉" title="오답노트가 비었어요!" desc="틀린 단어를 2번 연속 맞히면 자동으로 졸업해요"
          action={<button className="btn btn-green" onClick={() => nav('/quiz')}>퀴즈 풀러 가기</button>} />
      )}

      {words?.map((w, i) => <WrongCard key={w.id} word={w} index={i} onGraduate={graduate} />)}

      {words?.length > 0 && (
        <div style={{ position: 'sticky', bottom: 16, marginTop: 20 }}>
          <button className="btn btn-green"
            onClick={() => nav('/quiz/session', { state: { poolIds: words.map((w) => w.id), mode: 'e2k' } })}>
            오답 {words.length}개로 퀴즈 풀기 🎯
          </button>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-light)', marginTop: 8 }}>
            틀린 뒤 2번 연속 맞히면 자동으로 사라져요
          </div>
        </div>
      )}
    </Page>
  );
}
