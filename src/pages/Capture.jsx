import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { saveWords, todayStr } from '../services/words';
import { haptic } from '../hooks/useSpeech';
import { Page } from '../components/ui';

export default function Capture() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const [items, setItems] = useState(state?.words || []);
  const [saving, setSaving] = useState(false);

  if (!state?.words) return <Navigate to="/" replace />;

  const edit = (i, field, val) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    setItems(next);
  };
  const remove = (i) => { haptic(15); setItems(items.filter((_, idx) => idx !== i)); };

  const save = async () => {
    setSaving(true);
    const valid = items.filter((w) => w.english.trim() && w.korean.trim());
    const added = await saveWords(user.uid, todayStr(), valid);
    haptic([20, 50, 20]);
    nav('/wordbooks/' + todayStr(), { replace: true, state: { savedCount: added } });
  };

  return (
    <Page className="no-tab">
      <button className="btn-ghost btn-sm" style={{ border: 'none', padding: 0, marginBottom: 8, cursor: 'pointer', background: 'none', color: 'var(--gray)', fontWeight: 700 }} onClick={() => nav(-1)}>
        ← 다시 찍기
      </button>
      <h1>단어 {items.length}개를 찾았어요! 🎉</h1>
      <p className="sub">틀린 부분은 고치고, 필요 없는 단어는 ✕를 눌러요</p>

      {items.map((w, i) => (
        <motion.div
          key={i}
          className="card row"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.05, 0.6) }}
          style={{ marginBottom: 10, padding: 10 }}
        >
          <input className="input" style={{ flex: 1, padding: '10px 12px' }} value={w.english}
            onChange={(e) => edit(i, 'english', e.target.value)} placeholder="영어" />
          <input className="input" style={{ flex: 1.2, padding: '10px 12px' }} value={w.korean}
            onChange={(e) => edit(i, 'korean', e.target.value)} placeholder="한글 뜻" />
          <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--gray-light)', cursor: 'pointer', padding: 4 }}>✕</button>
        </motion.div>
      ))}

      <div style={{ position: 'sticky', bottom: 16, marginTop: 20 }}>
        <button className="btn btn-green" disabled={saving || !items.length} onClick={save}>
          {saving ? '저장 중...' : `오늘 단어장에 ${items.length}개 저장하기`}
        </button>
      </div>
    </Page>
  );
}
