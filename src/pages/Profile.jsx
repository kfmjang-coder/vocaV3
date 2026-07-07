import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getAllWords, getProfile, saveProfile, getTodayQuizzes } from '../services/words';
import { toggleTheme, isDark } from '../hooks/useTheme';
import { haptic, speak, VOICE_PROFILES, VOICE_ORDER, getVoiceProfile, setVoiceProfile } from '../hooks/useSpeech';
import { Avatar, AVATAR_EMOJIS, AVATAR_COLORS, DEFAULT_AVATAR } from '../components/Avatar';
import { buildAchievementCard } from '../utils/achievementCard';
import { Page } from '../components/ui';

const BRAG_THRESHOLD = 10; // 하루 퀴즈 N회 이상이면 자랑하기

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
  const [dark, setDark] = useState(isDark());
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [voice, setVoice] = useState(getVoiceProfile());
  const [makerOpen, setMakerOpen] = useState(false);      // 만든이 정보 접기
  const [editOpen, setEditOpen] = useState(false);        // 프로필 편집 시트
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState(DEFAULT_AVATAR.emoji);
  const [editColor, setEditColor] = useState(DEFAULT_AVATAR.color);
  const [saving, setSaving] = useState(false);
  const [bragging, setBragging] = useState(false);
  const [toast, setToast] = useState('');

  const chooseVoice = (id) => {
    haptic(12);
    setVoice(id);
    setVoiceProfile(id);
    // 선택 즉시 미리듣기 (랜덤은 실제 뽑힌 음성으로 들림)
    setTimeout(() => speak('Hello! Nice to meet you.'), 60);
  };

  /** 앱 공유하기 — 폰 기본 공유창(카톡 등), 미지원 시 링크 복사 */
  const shareApp = async () => {
    haptic(15);
    const url = location.origin;
    const text = '📚 시우지우 영어단어장!\n교과서를 찍으면 단어장이 되고, 퀴즈로 저절로 외워져요 🎯\n(가입 후 관리자 승인을 받으면 바로 시작!)';
    if (navigator.share) {
      try { await navigator.share({ title: '시우지우 영어단어장', text, url }); } catch { /* 사용자가 취소 */ }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  useEffect(() => {
    (async () => {
      const [words, profile] = await Promise.all([getAllWords(user.uid), getProfile(user.uid)]);
      setStats({
        total: words.length,
        memorized: words.filter((w) => w.memorized).length,
        streak: profile?.streak || 0,
        quizzes: profile?.totalQuizzes || 0,
        correct: profile?.totalCorrect || 0,
        name: profile?.name || user.displayName || '학습자',
        avatarEmoji: profile?.avatarEmoji || DEFAULT_AVATAR.emoji,
        avatarColor: profile?.avatarColor || DEFAULT_AVATAR.color,
        todayQuizzes: getTodayQuizzes(profile)
      });
    })();
  }, [user]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); }
  }, [toast]);

  const openEdit = () => {
    haptic(12);
    setEditName(stats.name);
    setEditEmoji(stats.avatarEmoji);
    setEditColor(stats.avatarColor);
    setEditOpen(true);
  };
  const submitProfile = async () => {
    setSaving(true);
    const patch = { name: editName.trim() || '학습자', avatarEmoji: editEmoji, avatarColor: editColor };
    await saveProfile(user.uid, patch);
    setStats((s) => ({ ...s, ...patch }));
    setSaving(false);
    setEditOpen(false);
    setToast('프로필을 저장했어요 ✨');
  };

  const brag = async () => {
    haptic(20);
    setBragging(true);
    try {
      const accuracy = stats.quizzes > 0 ? Math.round((stats.correct / (stats.quizzes * 10)) * 100) : 0;
      const earnedBadges = BADGES.filter((b) => b.check(stats));
      const blob = await buildAchievementCard({
        name: stats.name,
        avatarEmoji: stats.avatarEmoji,
        avatarColor: stats.avatarColor,
        todayQuizzes: stats.todayQuizzes,
        accuracy: Math.min(accuracy, 100),
        streak: stats.streak,
        memorized: stats.memorized,
        badges: earnedBadges.map((b) => b.emoji),
        badgeEarned: earnedBadges.length,
        badgeTotal: BADGES.length
      });
      const file = new File([blob], 'siwoojiwoo-achievement.png', { type: 'image/png' });
      const url = location.origin;
      const text = `오늘 영어 퀴즈 ${stats.todayQuizzes}판 완료! 🔥\n📚 시우지우 영어단어장`;

      // Web Share (파일 지원) 우선
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, url }).catch(() => {});
      } else {
        // 폴백: 이미지 다운로드 + 링크 복사
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'siwoojiwoo-achievement.png';
        a.click();
        URL.revokeObjectURL(a.href);
        await navigator.clipboard?.writeText(`${text}\n${url}`).catch(() => {});
        setToast('이미지를 저장했어요! SNS에 올려보세요 📸');
      }
    } catch {
      setToast('이미지 생성에 실패했어요. 다시 시도해주세요');
    }
    setBragging(false);
  };

  if (!stats) return <Page><div className="skeleton" style={{ height: 260 }} /></Page>;

  return (
    <Page>
      <div className="between" style={{ marginBottom: 20 }}>
        <div className="row">
          <Avatar emoji={stats.avatarEmoji} color={stats.avatarColor} size={56} />
          <div>
            <h1 style={{ fontSize: 20 }}>{stats.name}</h1>
            <span style={{ fontSize: 13, color: 'var(--gray)' }}>{user.email}</span>
          </div>
        </div>
        <button className="btn-sm" onClick={openEdit}
          style={{ border: '2px solid var(--line)', background: 'var(--card)', color: 'var(--gray)', borderRadius: 10, padding: '8px 12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          ✏️ 편집
        </button>
      </div>

      {/* 스트릭 히어로 */}
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="card center" style={{ background: 'var(--tint-yellow)', borderColor: 'var(--yellow)', padding: 22, marginBottom: 14 }}>
        <span style={{ fontSize: 44 }}>🔥</span>
        <strong style={{ fontSize: 30 }}>{stats.streak}일 연속</strong>
        <span style={{ fontSize: 13, color: 'var(--gray)', fontWeight: 700 }}>
          {stats.streak > 0 ? '오늘도 퀴즈로 스트릭을 지켜요!' : '오늘 퀴즈 한 판으로 스트릭 시작!'}
        </span>
      </motion.div>

      <div className="row" style={{ marginBottom: 20 }}>
        {[
          { n: stats.total, l: '전체 단어', c: 'var(--blue)' },
          { n: stats.memorized, l: '외운 단어 ⓘ', c: 'var(--green)', info: true },
          { n: stats.quizzes, l: '퀴즈 횟수', c: 'var(--purple)' }
        ].map((s) => (
          <div
            key={s.l}
            className={`card center ${s.info ? 'card-press' : ''}`}
            style={{ flex: 1, padding: 12 }}
            onClick={s.info ? () => { haptic(10); setShowInfo(true); } : undefined}
          >
            <strong style={{ fontSize: 22, color: s.c }}>{s.n}</strong>
            <span style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 700 }}>{s.l}</span>
          </div>
        ))}
      </div>

      {/* 외운 단어 기준 안내 시트 */}
      <AnimatePresence>
        {showInfo && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowInfo(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 91,
                background: 'var(--bg)', borderRadius: '20px 20px 0 0',
                padding: '24px 20px calc(24px + var(--safe-b))',
                maxWidth: 480, margin: '0 auto'
              }}>
              <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 16px' }} />
              <h2 style={{ marginBottom: 14 }}>"외운 단어"는 이렇게 돼요 ✅</h2>

              {[
                { e: '🌱', t: '퀴즈에서 정답 1번', d: '싹이 텄어요. 한 번 더!' },
                { e: '✨', t: '정답 2번 → 외운 단어!', d: '여기서 숫자가 +1 올라가요' },
                { e: '📅', t: '3일 → 7일 → 14일 뒤 재확인', d: '잊어버릴 때쯤 퀴즈에 다시 나와요' },
                { e: '📉', t: '틀리면 처음부터', d: '외운 단어에서 빠지고 다시 도전!' }
              ].map((s, i) => (
                <div key={i} className="row" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 24 }}>{s.e}</span>
                  <div>
                    <strong style={{ fontSize: 15 }}>{s.t}</strong>
                    <div style={{ fontSize: 13, color: 'var(--gray)' }}>{s.d}</div>
                  </div>
                </div>
              ))}

              <div className="card" style={{ background: 'var(--tint-yellow)', borderColor: 'var(--yellow)', padding: 12, fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                💡 꿀팁: 이미 아는 쉬운 단어는 단어장에서 카드를 오른쪽으로 밀면(→) 바로 외움 처리돼요
              </div>

              <button className="btn btn-green" style={{ marginTop: 16 }} onClick={() => setShowInfo(false)}>
                알겠어요!
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

      {/* 자랑하기 — 하루 10회 이상 퀴즈 달성 시 */}
      <AnimatePresence>
        {stats.todayQuizzes >= BRAG_THRESHOLD && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            className="card" style={{
              marginBottom: 24, padding: 18,
              background: 'linear-gradient(135deg, var(--tint-yellow), var(--green-light))',
              borderColor: 'var(--yellow)'
            }}>
            <div className="between">
              <div className="row" style={{ gap: 10 }}>
                <span style={{ fontSize: 32 }}>🎉</span>
                <div>
                  <strong style={{ fontSize: 15 }}>오늘 퀴즈 {stats.todayQuizzes}판 달성!</strong>
                  <div style={{ fontSize: 12, color: 'var(--gray)', fontWeight: 600 }}>대단해요! 친구들에게 자랑해볼까요?</div>
                </div>
              </div>
            </div>
            <button className="btn btn-green" style={{ marginTop: 14 }} disabled={bragging} onClick={brag}>
              {bragging ? '카드 만드는 중...' : '📸 자랑하기 (이미지 공유)'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 다크 모드 토글 */}
      <div className="card between" style={{ marginBottom: 20, padding: '14px 16px' }}>
        <div className="row" style={{ gap: 10 }}>
          <span style={{ fontSize: 22 }}>{dark ? '🌙' : '☀️'}</span>
          <strong>다크 모드</strong>
        </div>
        <button
          onClick={() => { haptic(15); setDark(toggleTheme() === 'dark'); }}
          aria-label="다크 모드 전환"
          style={{
            width: 52, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: dark ? 'var(--green)' : 'var(--line)',
            position: 'relative', transition: 'background 0.25s'
          }}
        >
          <motion.div
            animate={{ x: dark ? 22 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              position: 'absolute', top: 3, left: 4,
              width: 24, height: 24, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }}
          />
        </button>
      </div>

      {/* 퀴즈 발음 목소리 선택 */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div className="between" style={{ marginBottom: 12 }}>
          <div className="row" style={{ gap: 10 }}>
            <span style={{ fontSize: 22 }}>🔊</span>
            <div>
              <strong>퀴즈 발음 목소리</strong>
              <div style={{ fontSize: 12, color: 'var(--gray)' }}>고르면 바로 들려줘요</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {VOICE_ORDER.map((id) => {
            const p = VOICE_PROFILES[id];
            const on = voice === id;
            return (
              <button key={id} onClick={() => chooseVoice(id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '12px 4px', borderRadius: 14, cursor: 'pointer',
                  border: `2px solid ${on ? 'var(--green)' : 'var(--line)'}`,
                  background: on ? 'var(--green-light)' : 'var(--card)',
                  color: on ? 'var(--green-dark)' : 'var(--ink)',
                  fontWeight: 800, fontSize: 13, transition: 'all 0.12s'
                }}>
                <span style={{ fontSize: 26 }}>{p.emoji}</span>
                {p.label}
                {on && <span style={{ fontSize: 10, color: 'var(--green)' }}>● 선택됨</span>}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: 'var(--gray-light)', marginTop: 10, lineHeight: 1.5 }}>
          ℹ️ 기기에 목소리가 없으면 음높이·속도로 흉내 내요. 랜덤은 문제마다 목소리가 바뀌어요!
        </p>
      </div>

      {isAdmin && (
        <button className="btn btn-blue" style={{ marginBottom: 10 }} onClick={() => nav('/admin')}>
          🛡️ 사용자 승인 관리
        </button>
      )}
      <button className="btn btn-green" style={{ marginBottom: 10 }} onClick={shareApp}>
        📤 친구에게 앱 공유하기
      </button>
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card" style={{
              background: 'var(--green-light)', borderColor: 'var(--green)', color: 'var(--green-dark)',
              fontWeight: 800, textAlign: 'center', fontSize: 14, marginBottom: 10, padding: 12
            }}>
            링크가 복사됐어요! 친구에게 붙여넣기 해주세요 📋
          </motion.div>
        )}
      </AnimatePresence>
      <button className="btn btn-white" onClick={logout}>로그아웃</button>

      {/* 만든 사람 (접기/펼치기) */}
      <div className="card" style={{ marginTop: 24, padding: 0, borderStyle: 'dashed', overflow: 'hidden' }}>
        <button
          onClick={() => { haptic(10); setMakerOpen((v) => !v); }}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: 'var(--ink)', font: 'inherit'
          }}>
          <span className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 18 }}>🔨</span>
            <strong style={{ fontSize: 14 }}>Made by 장재석</strong>
          </span>
          <motion.span animate={{ rotate: makerOpen ? 180 : 0 }} style={{ fontSize: 13, color: 'var(--gray-light)' }}>▾</motion.span>
        </button>
        <AnimatePresence initial={false}>
          {makerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
              <div className="center" style={{ padding: '4px 20px 20px' }}>
                <p style={{ fontSize: 13, color: 'var(--gray)', margin: '0 0 2px', lineHeight: 1.6, fontWeight: 600, textAlign: 'center' }}>
                  "이거 앱으로 만들면 되는 거 아냐?"<br />
                  일상의 사소한 불편, 그냥 안 넘어가고<br />
                  진짜로 만들어버립니다 ⚒️
                </p>
                <p style={{ fontSize: 12, color: 'var(--gray-light)', margin: '6px 0 12px', fontWeight: 600, textAlign: 'center' }}>
                  시우 · 지우의 단어 암기를 위해 아빠가 만든 첫 번째 앱 💚
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <a href="tel:01086522639" className="chip" style={{ textDecoration: 'none' }}>📞 010-8652-2639</a>
                  <a href="mailto:kfmjang@gmail.com" className="chip" style={{ textDecoration: 'none' }}>✉️ 메일 보내기</a>
                </div>
                <span style={{ fontSize: 11, color: 'var(--gray-light)', marginTop: 12 }}>
                  시우지우 영어단어장 v1.4
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* 프로필 편집 시트 */}
      <AnimatePresence>
        {editOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !saving && setEditOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 91, background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(24px + var(--safe-b))', maxWidth: 480, margin: '0 auto', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--line)', margin: '6px auto 16px' }} />
              <h2 style={{ marginBottom: 16 }}>프로필 편집</h2>

              {/* 미리보기 */}
              <div className="center" style={{ marginBottom: 18 }}>
                <Avatar emoji={editEmoji} color={editColor} size={88} />
                <strong style={{ marginTop: 10, fontSize: 17 }}>{editName || '학습자'}</strong>
              </div>

              {/* 이름 */}
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>이름</label>
              <input className="input" value={editName} maxLength={12} placeholder="이름을 입력하세요"
                onChange={(e) => setEditName(e.target.value)} style={{ marginTop: 6, marginBottom: 18 }} />

              {/* 아바타 이모지 */}
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>아바타</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, margin: '8px 0 18px' }}>
                {AVATAR_EMOJIS.map((e) => (
                  <button key={e} onClick={() => { haptic(8); setEditEmoji(e); }}
                    style={{
                      aspectRatio: '1', borderRadius: 12, cursor: 'pointer', fontSize: 24,
                      border: `2px solid ${editEmoji === e ? 'var(--green)' : 'var(--line)'}`,
                      background: editEmoji === e ? 'var(--green-light)' : 'var(--card)'
                    }}>{e}</button>
                ))}
              </div>

              {/* 배경색 */}
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>배경색</label>
              <div style={{ display: 'flex', gap: 10, margin: '8px 0 20px', flexWrap: 'wrap' }}>
                {AVATAR_COLORS.map((c) => (
                  <button key={c} onClick={() => { haptic(8); setEditColor(c); }}
                    style={{
                      width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', background: c,
                      border: editColor === c ? '3px solid var(--ink)' : '3px solid transparent',
                      transform: editColor === c ? 'scale(1.1)' : 'none', transition: 'transform 0.12s'
                    }} />
                ))}
              </div>

              <button className="btn btn-green" disabled={saving} onClick={submitProfile}>
                {saving ? '저장 중...' : '저장하기'}
              </button>
              <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setEditOpen(false)}>취소</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 공통 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', left: 20, right: 20, bottom: 'calc(80px + var(--safe-b))', zIndex: 95, maxWidth: 440, margin: '0 auto', background: 'var(--ink)', color: '#fff', fontWeight: 700, fontSize: 14, textAlign: 'center', padding: '14px 18px', borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
