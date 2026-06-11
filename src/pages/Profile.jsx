import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getAllWords, getProfile } from '../services/words';
import { Page } from '../components/ui';

const BADGES = [
  { id: 'first', emoji: '🌱', name: '첫 단어', check: (s) => s.total >= 1 },
  { id: 'w50', emoji: '📖', name: '단어 50개', check: (s) => s.total >= 50 },
  { id: 'w100', emoji: '🏛️', name: '단어 100개', check: (s) => s.total >= 100 },
  { id: 's3', emoji: '🔥', name: '3일 연속', check: (s) => s.streak >= 3 },
  { id: 's7', emoji: '⚡', name: '7일 연속', check: (s) => s.streak >= 7 },
  { id: 's30', emoji: '👑', name: '30일 연속', check: (s) => s.streak >= 30 },
  { id: 'q10', emoji: '🎯', name: '퀴즈 10회', check: (s) => s.quizzes >= 10 },
  { id: 'm50', emoji: '🧠', name: '50개 암기', check: (s) => s.memorized >= 50 }
];

export default function Profile() {
  const { user, logout, isAdmin } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const [words, profile] = await Promise.all([getAllWords(user.uid), getProfile(user.uid)]);
      setStats({
        total: words.length,
        memorized: words.filter((w) => w.memorized).length,
        streak: profile?.streak || 0,
        quizzes: profile?.totalQuizzes || 0,
        correct: profile?.totalCorrect || 0,
        name: profile?.name || user.displayName,
        photo: profile?.photo || user.photoURL
      });
    })();
  }, [user]);

  if (!stats) return <Page><div className="skeleton" style={{ height: 260 }} /></Page>;

  return (
    <Page>
      <div className="row" style={{ marginBottom: 20 }}>
        {stats.photo
          ? <img src={stats.photo} alt="" referrerPolicy="no-referrer" style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--line)' }} />
          : <div className="badge-icon">🦉</div>}
        <div>
          <h1 style={{ fontSize: 20 }}>{stats.name}</h1>
          <span style={{ fontSize: 13, color: 'var(--gray)' }}>{user.email}</span>
        </div>
      </div>

      {/* 스트릭 히어로 */}
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="card center" style={{ background: '#FFF6D6', borderColor: 'var(--yellow)', padding: 22, marginBottom: 14 }}>
        <span style={{ fontSize: 44 }}>🔥</span>
        <strong style={{ fontSize: 30 }}>{stats.streak}일 연속</strong>
        <span style={{ fontSize: 13, color: 'var(--gray)', fontWeight: 700 }}>
          {stats.streak > 0 ? '오늘도 퀴즈로 스트릭을 지켜요!' : '오늘 퀴즈 한 판으로 스트릭 시작!'}
        </span>
      </motion.div>

      <div className="row" style={{ marginBottom: 20 }}>
        {[
          { n: stats.total, l: '전체 단어', c: 'var(--blue)' },
          { n: stats.memorized, l: '외운 단어', c: 'var(--green)' },
          { n: stats.quizzes, l: '퀴즈 횟수', c: 'var(--purple)' }
        ].map((s) => (
          <div key={s.l} className="card center" style={{ flex: 1, padding: 12 }}>
            <strong style={{ fontSize: 22, color: s.c }}>{s.n}</strong>
            <span style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 700 }}>{s.l}</span>
          </div>
        ))}
      </div>

      <h2>내 뱃지 🏅</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {BADGES.map((b, i) => {
          const earned = b.check(stats);
          return (
            <motion.div key={b.id} className="center" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
              <div className={`badge-icon ${earned ? 'earned' : ''}`} style={{ filter: earned ? 'none' : 'grayscale(1) opacity(0.4)' }}>
                {b.emoji}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: earned ? 'var(--ink)' : 'var(--gray-light)', marginTop: 4 }}>{b.name}</span>
            </motion.div>
          );
        })}
      </div>

      {isAdmin && (
        <button className="btn btn-blue" style={{ marginBottom: 10 }} onClick={() => nav('/admin')}>
          🛡️ 사용자 승인 관리
        </button>
      )}
      <button className="btn btn-white" onClick={logout}>로그아웃</button>
    </Page>
  );
}
