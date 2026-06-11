import { useEffect, useState } from 'react';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { EmptyState } from '../components/ui';

export default function Pending() {
  const { user, logout } = useAuth();
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const ref = doc(db, 'accessRequests', user.email);
      const snap = await getDoc(ref).catch(() => null);
      if (snap?.exists()) { setRequested(true); return; }
      await setDoc(ref, {
        email: user.email,
        name: user.displayName || '',
        requestedAt: serverTimestamp()
      }).catch(() => {});
      setRequested(true);
    })();
  }, [user]);

  return (
    <div className="page no-tab center" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
      <EmptyState
        emoji="⏳"
        title="승인을 기다리고 있어요"
        desc={requested
          ? `${user?.email} 계정으로 가입 신청이 완료됐어요.\n관리자가 승인하면 바로 사용할 수 있어요!`
          : '가입 신청 중...'}
        action={<button className="btn btn-white" onClick={logout}>다른 계정으로 로그인</button>}
      />
    </div>
  );
}
