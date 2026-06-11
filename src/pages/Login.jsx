import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  return (
    <div className="page no-tab center" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 16 }}
        style={{ fontSize: 84, marginBottom: 8 }}
      >
        🦉
      </motion.div>
      <h1 style={{ fontSize: 28 }}>시우지우 영어단어장</h1>
      <p className="sub" style={{ marginBottom: 36 }}>
        찍고, 외우고, 친구랑 공유하는<br />가장 쉬운 단어 암기
      </p>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} style={{ width: '100%' }}>
        <button className="btn btn-green" onClick={login}>
          구글 계정으로 시작하기
        </button>
      </motion.div>
      <p style={{ color: 'var(--gray-light)', fontSize: 12, marginTop: 16 }}>
        승인된 사용자만 이용할 수 있어요
      </p>
    </div>
  );
}
