import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getAllWords, isInWrongNote, removeFromWrongNote } from '../services/words';
import { Page, EmptyState } from '../components/ui';
import { speak, haptic } from '../hooks/useSpeech';

const GRADUATE_TARGET = 2; // 연속 정답 몇 회에 졸업

/** 졸업 진행도 점 표시 (●●○○ 형태로 wrongStreak/GRADUATE_TARGET) */
function ProgressDots({ streak }) {
  const done = Math.min(streak, GRADUATE_TARGET);
  const remain = GRADUATE_TARGET - done;
  const label = done === 0
    ? '연속 2번 맞히면 졸업'
    : done >= GRADUATE_TARGET ? '졸업 완료!' : '한 번만 더 맞히면 졸업! 🔥';
  return (
    <div className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}>
      <span style={{ letterSpacing: 2, fontSize: 13 }}>
        <span style={{ color: 'var(--green)' }}>{'●'.repeat(done)}</span>
        <span style={{ color: 'var(--line)' }}>{'○'.repeat(remain)}</span>
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: done > 0 ? 'var(--green-dark)' : 'var(--gray-light)' }}>
        {label}
      </span>
    </div>
  );
}

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
        <div style={{ flex: 1 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 16 }}>{word.english}</strong>
            {word.pos && <span className="chip" style={{ fontSize: 10 }}>{word.pos}</span>}
            <span className="chip" style={{ background: 'var(--red-light)', color: 'var(--red-dark)' }}>틀림 {word.wrongCount || 0}회</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--gray)', marginTop: 2 }}>{word.korean}</div>
          <ProgressDots streak={word.wrongStreak || 0} />
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
  const [guideOpen, setGuideOpen] = useState(false);

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
      <p className="sub">틀린 단어를 모아서 다시 풀어요</p>

      {/* 졸업 안내 배너 (접이식) */}
      <div className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden', borderColor: 'var(--blue)', background: 'var(--tint-blue)' }}>
        <button onClick={() => { haptic(10); setGuideOpen((v) => !v); }}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: 'inherit', color: 'var(--blue-dark)' }}>
          <span className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 17 }}>💡</span>
            <strong style={{ fontSize: 14 }}>단어가 어떻게 없어지나요?</strong>
          </span>
          <motion.span animate={{ rotate: guideOpen ? 180 : 0 }} style={{ fontSize: 13 }}>▾</motion.span>
        </button>
        <AnimatePresence initial={false}>
          {guideOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0 16px 16px' }}>
                {[
                  { e: '1️⃣', t: '퀴즈에서 정답 1번', d: '아래 점이 ●○ 로 하나 차요' },
                  { e: '2️⃣', t: '연속으로 또 정답!', d: '●● 가 되면 오답노트에서 자동으로 사라져요' },
                  { e: '😵', t: '중간에 틀리면?', d: '점이 다시 ○○ 로 초기화돼요 (연속이어야 해요!)' },
                  { e: '👉', t: '이미 다 안다면?', d: '카드를 왼쪽으로 밀어서 바로 뺄 수 있어요' }
                ].map((s, i) => (
                  <div key={i} className="row" style={{ marginBottom: 10, alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{s.e}</span>
                    <div>
                      <strong style={{ fontSize: 13 }}>{s.t}</strong>
                      <div style={{ fontSize: 12, color: 'var(--gray)' }}>{s.d}</div>
                    </div>
                  </div>
                ))}
                <div className="card" style={{ background: 'var(--card)', borderColor: 'var(--line)', padding: 10, fontSize: 12, fontWeight: 700, color: 'var(--gray)', textAlign: 'center' }}>
                  각 단어 아래 <span style={{ color: 'var(--green)' }}>●○</span> 점을 보면 졸업까지 얼마나 남았는지 알 수 있어요!
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card" style={{ background: 'var(--green-light)', borderColor: 'var(--green)', color: 'var(--green-dark)', fontWeight: 800, textAlign: 'center', marginBottom: 12, padding: 12 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {words === null && [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 76, marginBottom: 10 }} />)}

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
            2번 연속 맞히면 자동으로 졸업해요 · ← 밀면 바로 빼기
          </div>
        </div>
      )}
    </Page>
  );
}
