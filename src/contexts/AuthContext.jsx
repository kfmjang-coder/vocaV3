import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, ADMIN_EMAIL } from '../firebase';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [allowed, setAllowed] = useState(null); // null=확인중, true/false
  const [loading, setLoading] = useState(true);
  // Gemini 키는 메모리에만 보관 (localStorage 저장 금지 — S2)
  const geminiRef = useRef({ apiKey: null, model: 'gemini-2.5-flash' });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) { setAllowed(null); geminiRef.current.apiKey = null; setLoading(false); return; }

      const isAdmin = u.email === ADMIN_EMAIL;
      let ok = isAdmin;
      if (!ok) {
        try {
          const snap = await getDoc(doc(db, 'allowedUsers', u.email));
          ok = snap.exists();
        } catch { ok = false; }
      }
      setAllowed(ok);

      if (ok) {
        // 승인 사용자에게 Gemini 키 자동 주입 (config/gemini 보호 문서)
        try {
          const cfg = await getDoc(doc(db, 'config', 'gemini'));
          if (cfg.exists()) {
            geminiRef.current.apiKey = cfg.data().apiKey || null;
            geminiRef.current.model = cfg.data().model || 'gemini-2.5-flash';
          }
        } catch (e) { console.error('config load fail', e); }

        // 프로필 문서 생성/보장
        try {
          const pref = doc(db, 'users', u.uid);
          const psnap = await getDoc(pref);
          if (!psnap.exists()) {
            await setDoc(pref, {
              name: u.displayName || '학습자',
              email: u.email,
              photo: u.photoURL || '',
              streak: 0,
              lastStudyDate: '',
              totalQuizzes: 0,
              totalCorrect: 0,
              shareCount: 0,
              usage: { date: '', count: 0 },
              createdAt: serverTimestamp()
            });
          }
        } catch (e) { console.error('profile init fail', e); }
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);
  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <AuthCtx.Provider value={{ user, allowed, loading, login, logout, isAdmin, gemini: geminiRef.current }}>
      {children}
    </AuthCtx.Provider>
  );
}
