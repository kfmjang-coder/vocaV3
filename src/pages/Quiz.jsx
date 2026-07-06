import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllWords, groupByBook, todayStr, dueWords, isInWrongNote } from '../services/words';
import { Page, EmptyState } from '../components/ui';
import { haptic } from '../hooks/useSpeech';

const fmtDate = (s) => {
  const [y, m, d] = s.split('-');
  return `${Number(m)}/${Number(d)}`;
};

const MODES = [
  { id: 'e2k', emoji: '🇺🇸→🇰🇷', title: '영어 → 한글', desc: '뜻 고르기' },
  { id: 'k2e', emoji: '🇰🇷→🇺🇸', title: '한글 → 영어', desc: '단어 고르기' },
  { id: 'spell', emoji: '⌨️', title: '스펠링 쓰기', desc: '영어 직접 입력' },
  { id: 'listen', emoji: '🎧', title: '듣고 말하기', desc: '발음 듣고 뜻 말하기' },
  { id: 'mix', emoji: '🎲', title: '믹스 모드', desc: '전부 섞어서!' }
];

export default function Quiz() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const [all, setAll] = useState(null);
  const [books, setBooks] = useState([]);
  const [range, setRange] = useState(state?.bookId ? `book:${state.bookId}` : 'today');
  const [mode, setMode] = useState('e2k');

  useEffect(() => {
    getAllWords(user.uid).then((words) => {
      setAll(words);
      setBooks(groupByBook(words));
    });
  }, [user]);

  if (all === null) return <Page><div className="skeleton" style={{ height: 200 }} /></Page>;

  const t = todayStr();
  const basePools = {
    today: all.filter((w) => w.date === t),
    wrong: all.filter(isInWrongNote),
    due: dueWords(all),
    all
  };
  const getPool = (rangeId) => {
    if (rangeId.startsWith('book:')) {
      const bid = rangeId.slice(5);
      return all.filter((w) => w.bookId === bid);
    }
    return basePools[rangeId] || [];
  };

  const RANGES = [
    { id: 'today', label: '오늘 단어', count: basePools.today.length },
    { id: 'due', label: '복습할 단어 🔔', count: basePools.due.length },
    { id: 'wrong', label: '오답노트 ❌', count: basePools.wrong.length },
    { id: 'all', label: '전체 단어', count: basePools.all.length }
  ];

  const pool = getPool(range);
  const canStart = pool.length >= 1;

  if (all.length === 0) {
    return (
      <Page>
        <h1>퀴즈 🎯</h1>
        <EmptyState emoji="📸" title="퀴즈 풀 단어가 없어요" desc="먼저 단어를 찍어서 저장해주세요!"
          action={<button className="btn btn-green" onClick={() => nav('/')}>단어 찍으러 가기</button>} />
      </Page>
    );
  }

  const rangeBtn = (r) => (
    <button key={r.id} className="btn-sm"
      onClick={() => { haptic(10); setRange(r.id); }}
      disabled={r.count === 0}
      style={{
        padding: '10px 14px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer',
        border: `2px solid ${range === r.id ? 'var(--green)' : 'var(--line)'}`,
        background: range === r.id ? 'var(--green-light)' : 'var(--card)',
        color: range === r.id ? 'var(--green-dark)' : r.count === 0 ? 'var(--gray-light)' : 'var(--ink)'
      }}>
      {r.label} ({r.count})
    </button>
  );

  return (
    <Page>
      <h1>퀴즈 🎯</h1>
      <p className="sub">한 번에 10단어씩, 짧고 굵게!</p>

      <div className="between" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>범위</h2>
        {basePools.wrong.length > 0 && (
          <button onClick={() => { haptic(10); nav('/wrong-note'); }}
            style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0 }}>
            오답노트 관리 →
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {RANGES.map(rangeBtn)}
      </div>

      {books.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: 'var(--gray)', fontWeight: 700, marginBottom: 8 }}>단어장별</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {books.map((b) => rangeBtn({
              id: `book:${b.bookId}`,
              label: b.title || fmtDate(b.date),
              count: b.words.length
            }))}
          </div>
        </>
      )}

      <h2>모드</h2>
      {MODES.map((m) => (
        <div key={m.id} className="card card-press row"
          onClick={() => { haptic(10); setMode(m.id); }}
          style={{ marginBottom: 10, borderColor: mode === m.id ? 'var(--green)' : 'var(--line)', background: mode === m.id ? 'var(--green-light)' : 'var(--card)' }}>
          <span style={{ fontSize: 24 }}>{m.emoji}</span>
          <div>
            <strong>{m.title}</strong>
            <div style={{ fontSize: 13, color: 'var(--gray)' }}>{m.desc}</div>
          </div>
        </div>
      ))}

      <button className="btn btn-green" style={{ marginTop: 12 }} disabled={!canStart}
        onClick={() => nav('/quiz/session', { state: { poolIds: pool.map((w) => w.id), mode } })}>
        {canStart ? '시작하기! 🚀' : '단어가 없어요'}
      </button>
    </Page>
  );
}
