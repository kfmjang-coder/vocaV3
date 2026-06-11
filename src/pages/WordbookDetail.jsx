import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getAllWords, deleteWord, updateWord, addWordManual, getProfile } from '../services/words';
import { createShare, shareCode } from '../services/share';
import WordCard from '../components/WordCard';
import { Page } from '../components/ui';
import { haptic } from '../hooks/useSpeech';

export default function WordbookDetail() {
  const { date } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const [words, setWords] = useState(null);
  const [adding, setAdding] = useState(false);
  const [en, setEn] = useState('');
  const [ko, setKo] = useState('');
  const [shareInfo, setShareInfo] = useState(null); // {code, status}
  const [toast, setToast] = useState(state?.savedCount ? `${state.savedCount}개 단어 저장 완료! 🎉` : '');

  const load = () => getAllWords(user.uid).then((all) => setWords(all.filter((w) => w.date === date)));
  useEffect(() => { load(); }, [user, date]);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t); }
  }, [toast]);

  const onDelete = async (w) => {
    setWords(words.filter((x) => x.id !== w.id)); // 낙관적 업데이트
    await deleteWord(user.uid, w.id);
  };
  const onToggle = async (w) => {
    setWords(words.map((x) => (x.id === w.id ? { ...x, memorized: !x.memorized } : x)));
    await updateWord(user.uid, w.id, { memorized: !w.memorized });
  };
  const onAdd = async () => {
    if (!en.trim() || !ko.trim()) return;
    await addWordManual(user.uid, date, en, ko);
    setEn(''); setKo(''); setAdding(false);
    setToast('단어를 추가했어요 ✏️');
    load();
  };

  const onShare = async () => {
    haptic(20);
    const profile = await getProfile(user.uid);
    const title = `${date} 단어장`;
    const code = await createShare(user.uid, profile?.name || '친구', title, words);
    const status = await shareCode(code, title);
    setShareInfo({ code, status });
  };

  return (
    <Page className="no-tab">
      <button style={{ background: 'none', border: 'none', color: 'var(--gray)', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 8 }} onClick={() => nav('/wordbooks')}>
        ← 단어장 목록
      </button>
      <div className="between">
        <h1>{date}</h1>
        {words?.length > 0 && (
          <button className="btn btn-blue btn-sm" onClick={onShare}>친구에게 공유 📤</button>
        )}
      </div>
      <p className="sub">← 밀면 삭제 · 밀면 외움 표시 →</p>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card" style={{ background: 'var(--green-light)', borderColor: 'var(--green)', color: 'var(--green-dark)', fontWeight: 800, textAlign: 'center', marginBottom: 12 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 공유 코드 카드 */}
      <AnimatePresence>
        {shareInfo && (
          <motion.div
            initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="card center" style={{ borderColor: 'var(--blue)', background: '#EFF9FF', marginBottom: 14, padding: 20 }}
          >
            <span style={{ fontSize: 13, color: 'var(--gray)', fontWeight: 700 }}>공유 코드 (30일간 유효)</span>
            <strong style={{ fontSize: 34, letterSpacing: 6, color: 'var(--blue-dark)', margin: '6px 0' }}>{shareInfo.code}</strong>
            <span style={{ fontSize: 13, color: 'var(--gray)' }}>
              {shareInfo.status === 'copied' ? '링크가 복사됐어요! 친구에게 붙여넣기 해주세요' : '친구가 이 코드를 입력하면 단어장을 받을 수 있어요'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {words?.map((w) => (
        <WordCard key={w.id} word={w} onDelete={onDelete} onToggleMemorized={onToggle} />
      ))}

      {adding ? (
        <div className="card" style={{ marginTop: 8 }}>
          <input className="input" placeholder="영어 단어" value={en} onChange={(e) => setEn(e.target.value)} style={{ marginBottom: 8 }} autoFocus />
          <input className="input" placeholder="한글 뜻" value={ko} onChange={(e) => setKo(e.target.value)} style={{ marginBottom: 10 }} />
          <div className="row">
            <button className="btn btn-green" style={{ flex: 1 }} onClick={onAdd}>추가</button>
            <button className="btn btn-white" style={{ flex: 1 }} onClick={() => setAdding(false)}>취소</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-white" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>＋ 단어 직접 추가</button>
      )}

      {words?.length > 0 && (
        <button className="btn btn-green" style={{ marginTop: 12 }} onClick={() => nav('/quiz', { state: { date } })}>
          이 단어장으로 퀴즈 풀기 🎯
        </button>
      )}
    </Page>
  );
}
