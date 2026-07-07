import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import { loadActivityOverview, fmtDuration, daysSinceLabel, HEALTHY_DAILY_MIN } from '../services/activity';
import { Page } from '../components/ui';

export default function Admin() {
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('users'); // 'users' | 'activity'
  const [requests, setRequests] = useState([]);
  const [allowed, setAllowed] = useState([]);

  const load = async () => {
    const [rq, al] = await Promise.all([
      getDocs(collection(db, 'accessRequests')),
      getDocs(collection(db, 'allowedUsers'))
    ]);
    setRequests(rq.docs.map((d) => ({ id: d.id, ...d.data() })));
    setAllowed(al.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const approve = async (r) => {
    await setDoc(doc(db, 'allowedUsers', r.id), { name: r.name || '', approvedAt: serverTimestamp() });
    await deleteDoc(doc(db, 'accessRequests', r.id));
    load();
  };
  const reject = async (r) => { await deleteDoc(doc(db, 'accessRequests', r.id)); load(); };
  const revoke = async (a) => {
    if (!confirm(`${a.id} 사용자의 접근을 해제할까요?`)) return;
    await deleteDoc(doc(db, 'allowedUsers', a.id));
    load();
  };

  return (
    <Page className="no-tab">
      <button style={{ background: 'none', border: 'none', color: 'var(--gray)', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 8 }} onClick={() => nav('/profile')}>
        ← 내 기록
      </button>
      <h1>관리자 🛡️</h1>

      {/* 탭 */}
      <div className="row" style={{ gap: 8, margin: '14px 0 18px' }}>
        {[['users', '사용자 관리'], ['activity', '활동 현황']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{
              flex: 1, padding: '10px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer',
              border: `2px solid ${tab === id ? 'var(--green)' : 'var(--line)'}`,
              background: tab === id ? 'var(--green-light)' : 'var(--card)',
              color: tab === id ? 'var(--green-dark)' : 'var(--gray)'
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' ? (
        <>
          <h2>가입 신청 ({requests.length})</h2>
          {requests.length === 0 && <p className="sub">대기 중인 신청이 없어요</p>}
          {requests.map((r) => (
            <div key={r.id} className="card between" style={{ marginBottom: 10 }}>
              <div>
                <strong>{r.name || '이름 없음'}</strong>
                <div style={{ fontSize: 13, color: 'var(--gray)' }}>{r.id}</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-green btn-sm" onClick={() => approve(r)}>승인</button>
                <button className="btn btn-white btn-sm" onClick={() => reject(r)}>거절</button>
              </div>
            </div>
          ))}

          <h2 style={{ marginTop: 24 }}>승인된 사용자 ({allowed.length})</h2>
          {allowed.map((a) => (
            <div key={a.id} className="card between" style={{ marginBottom: 8, padding: 12 }}>
              <div>
                <strong style={{ fontSize: 14 }}>{a.name || ''}</strong>
                <div style={{ fontSize: 13, color: 'var(--gray)' }}>{a.id}</div>
              </div>
              <button className="btn btn-red btn-sm" onClick={() => revoke(a)}>해제</button>
            </div>
          ))}
        </>
      ) : (
        <ActivityDashboard />
      )}
    </Page>
  );
}

/** 활동 현황 대시보드 */
function ActivityDashboard() {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState('attention'); // attention | active | time

  useEffect(() => { loadActivityOverview().then(setRows).catch(() => setRows([])); }, []);

  if (rows === null) return <div className="skeleton" style={{ height: 200 }} />;
  if (rows.length === 0) return <p className="sub">아직 활동 데이터가 없어요</p>;

  // 요약 지표
  const activeToday = rows.filter((r) => r.inactiveDays === 0).length;
  const attention = rows.filter((r) => r.inactiveDays >= 3 && r.inactiveDays !== Infinity);
  const overusers = rows.filter((r) => r.overuse);

  const sorted = [...rows].sort((a, b) => {
    if (sort === 'attention') return b.inactiveDays - a.inactiveDays; // 오래 안 온 순
    if (sort === 'active') return a.inactiveDays - b.inactiveDays;    // 최근 접속 순
    return b.weekSec - a.weekSec;                                     // 사용시간 순
  });

  return (
    <>
      {/* 요약 카드 3개 */}
      <div className="row" style={{ marginBottom: 8 }}>
        {[
          { n: activeToday, l: '오늘 접속', c: 'var(--green)' },
          { n: attention.length, l: '관심 필요', c: attention.length ? 'var(--orange)' : 'var(--gray)' },
          { n: rows.length, l: '전체', c: 'var(--blue)' }
        ].map((s) => (
          <div key={s.l} className="card center" style={{ flex: 1, padding: 12 }}>
            <strong style={{ fontSize: 24, color: s.c }}>{s.n}</strong>
            <span style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 700 }}>{s.l}</span>
          </div>
        ))}
      </div>

      {/* 아동 웰빙 안내 */}
      <div className="card" style={{ padding: 12, marginBottom: 8, background: 'var(--tint-blue)', borderColor: 'var(--blue)' }}>
        <div style={{ fontSize: 12, color: 'var(--blue-dark)', fontWeight: 700, lineHeight: 1.6 }}>
          💡 오래 붙잡는 것보다 <b>짧고 꾸준히</b>가 좋아요. 사용시간은 참고용이고, "며칠 안 왔는지"로 챙겨줄 아이를 먼저 봐주세요.
        </div>
      </div>

      {/* 관심 필요 알림 */}
      {attention.length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 8, background: 'var(--tint-yellow)', borderColor: 'var(--yellow)' }}>
          <strong style={{ fontSize: 13 }}>⚠️ {attention.length}명이 3일 이상 안 왔어요</strong>
          <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>
            {attention.slice(0, 5).map((r) => r.name).join(', ')}{attention.length > 5 ? ` 외 ${attention.length - 5}명` : ''}
          </div>
        </div>
      )}

      {/* 정렬 토글 */}
      <div className="row" style={{ gap: 6, margin: '14px 0 10px' }}>
        {[['attention', '관심 필요순'], ['active', '최근 접속순'], ['time', '사용시간순']].map(([id, label]) => (
          <button key={id} onClick={() => setSort(id)}
            style={{
              padding: '7px 12px', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer',
              border: `1.5px solid ${sort === id ? 'var(--green)' : 'var(--line)'}`,
              background: sort === id ? 'var(--green-light)' : 'var(--card)',
              color: sort === id ? 'var(--green-dark)' : 'var(--gray)'
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* 사용자 리스트 */}
      {sorted.map((r, i) => {
        const since = daysSinceLabel(r.lastActiveDate);
        const warn = r.inactiveDays >= 3 && r.inactiveDays !== Infinity;
        return (
          <motion.div key={r.uid} className="card" style={{ marginBottom: 8, padding: 12 }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
            <div className="between">
              <div className="row" style={{ gap: 10, flex: 1, minWidth: 0 }}>
                <Avatar emoji={r.avatarEmoji} color={r.avatarColor} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <strong style={{ fontSize: 14 }}>{r.name}</strong>
                    {r.streak > 0 && <span style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700 }}>🔥{r.streak}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: since.days === 0 ? 'var(--green)' : warn ? 'var(--orange)' : 'var(--gray)' }}>
                  {since.label}
                </span>
              </div>
            </div>
            {/* 상세 지표 줄 */}
            <div className="row" style={{ gap: 14, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span style={{ color: 'var(--gray)' }}>오늘 <b style={{ color: r.overuse ? 'var(--orange)' : 'var(--ink)' }}>{fmtDuration(r.todaySec)}</b>{r.overuse && ' ⚠️'}</span>
              <span style={{ color: 'var(--gray)' }}>주간 <b style={{ color: 'var(--ink)' }}>{fmtDuration(r.weekSec)}</b></span>
              <span style={{ color: 'var(--gray)' }}>접속 <b style={{ color: 'var(--ink)' }}>{r.weekOpens}회</b></span>
              <span style={{ color: 'var(--gray)' }}>퀴즈 <b style={{ color: 'var(--ink)' }}>{r.totalQuizzes}</b></span>
            </div>
          </motion.div>
        );
      })}

      <p style={{ fontSize: 11, color: 'var(--gray-light)', textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
        사용시간은 앱이 화면에 켜져 있던 시간만 집계해요 (뒤로 가거나 잠그면 멈춤).<br />
        주간 = 최근 7일 · ⚠️는 하루 {HEALTHY_DAILY_MIN}분 넘게 사용한 경우예요.
      </p>
    </>
  );
}
