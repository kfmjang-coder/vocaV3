import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './contexts/AuthContext';
import TabBar from './components/TabBar';
import Login from './pages/Login';
import Pending from './pages/Pending';
import Home from './pages/Home';
import Capture from './pages/Capture';
import Wordbooks from './pages/Wordbooks';
import WordbookDetail from './pages/WordbookDetail';
import Quiz from './pages/Quiz';
import QuizSession from './pages/QuizSession';
import QuizResult from './pages/QuizResult';
import Import from './pages/Import';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

const TAB_PATHS = ['/', '/quiz', '/wordbooks', '/profile'];

export default function App() {
  const { user, allowed, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page no-tab center" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
        <div style={{ fontSize: 64 }}>🦉</div>
        <div className="skeleton" style={{ width: 140, height: 16, marginTop: 16 }} />
      </div>
    );
  }

  if (!user) return <Login />;
  if (allowed === false) return <Pending />;

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/wordbooks" element={<Wordbooks />} />
          <Route path="/wordbooks/:bookId" element={<WordbookDetail />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/quiz/session" element={<QuizSession />} />
          <Route path="/quiz/result" element={<QuizResult />} />
          <Route path="/import" element={<Import />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      {TAB_PATHS.includes(location.pathname) && <TabBar />}
    </>
  );
}
