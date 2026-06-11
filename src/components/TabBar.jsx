import { useNavigate, useLocation } from 'react-router-dom';
import { haptic } from '../hooks/useSpeech';

const TABS = [
  { path: '/', ico: '📸', label: '홈' },
  { path: '/quiz', ico: '🎯', label: '퀴즈' },
  { path: '/wordbooks', ico: '📚', label: '단어장' },
  { path: '/profile', ico: '🔥', label: '내 기록' }
];

export default function TabBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button
          key={t.path}
          className={`tab-item ${pathname === t.path ? 'active' : ''}`}
          onClick={() => { haptic(10); nav(t.path); }}
        >
          <span className="ico">{t.ico}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
