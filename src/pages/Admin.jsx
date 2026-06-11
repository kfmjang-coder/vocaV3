import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Page, EmptyState } from '../components/ui';

export default function Admin() {
  const { isAdmin } = useAuth();
  const nav = useNavigate();
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
  const reject = async (r) => {
    await deleteDoc(doc(db, 'accessRequests', r.id));
    load();
  };
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
      <h1>사용자 관리 🛡️</h1>

      <h2 style={{ marginTop: 16 }}>가입 신청 ({requests.length})</h2>
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
    </Page>
  );
}
