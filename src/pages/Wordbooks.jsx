import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getAllWords, groupByDate } from '../services/words';
import { Page, EmptyState } from '../components/ui';

const fmtDate = (s) => {
  const [y, m, d] = s.split('-');
  const day = ['일', '월', '화', '수', '목', '금', '토'][new Date(s).getDay()];
  return `${Number(m)}월 ${Number(d)}일 (${day})`;
};

export default function Wordbooks() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    getAllWords(user.uid).then((words) => setGroups(groupByDate(words)));
  }, [user]);

  return (
    <Page>
      <h1>내 단어장 📚</h1>
      <p className="sub">날짜를 누르면 단어를 볼 수 있어요</p>

      {groups === null && [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 72, marginBottom: 10 }} />)}

      {groups?.length === 0 && (
        <EmptyState
          emoji="📸"
          title="아직 단어장이 비어있어요"
          desc="첫 단어를 찍어볼까요?"
          action={<button className="btn btn-green" onClick={() => nav('/')}>단어 찍으러 가기</button>}
        />
      )}

      {groups?.map((g, i) => {
        const memorized = g.words.filter((w) => w.memorized).length;
        const shared = g.words.some((w) => w.source?.startsWith('shared:'));
        return (
          <motion.div
            key={g.date}
            className="card card-press between"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
            style={{ marginBottom: 10 }}
            onClick={() => nav(`/wordbooks/${g.date}`)}
          >
            <div>
              <div className="row" style={{ gap: 8 }}>
                <strong style={{ fontSize: 16 }}>{fmtDate(g.date)}</strong>
                {shared && <span className="chip" style={{ background: 'var(--tint-purple)', color: 'var(--purple)' }}>👥 공유받음</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 4 }}>
                {g.words.length}개 단어 · 외운 단어 {memorized}개
              </div>
            </div>
            <div className="progress-track" style={{ maxWidth: 64, height: 10 }}>
              <div className="progress-fill" style={{ width: `${g.words.length ? (memorized / g.words.length) * 100 : 0}%` }} />
            </div>
          </motion.div>
        );
      })}
    </Page>
  );
}
