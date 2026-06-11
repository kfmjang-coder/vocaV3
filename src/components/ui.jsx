import { motion } from 'framer-motion';

/** 네이티브 push 느낌의 페이지 전환 */
export function Page({ children, className = '' }) {
  return (
    <motion.div
      className={`page ${className}`}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** 빈 상태 (U5) */
export function EmptyState({ emoji = '📭', title, desc, action }) {
  return (
    <div className="center" style={{ padding: '56px 20px' }}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        style={{ fontSize: 64, marginBottom: 12 }}
      >
        {emoji}
      </motion.div>
      <h2>{title}</h2>
      <p className="sub" style={{ marginBottom: 20 }}>{desc}</p>
      {action}
    </div>
  );
}

/** 컨페티 (퀴즈 결과) */
export function Confetti() {
  const pieces = Array.from({ length: 26 });
  const colors = ['#58CC02', '#1CB0F6', '#FFC800', '#FF9600', '#CE82FF', '#FF4B4B'];
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 99 }}>
      {pieces.map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: -30, x: Math.random() * window.innerWidth, rotate: 0, opacity: 1 }}
          animate={{ y: window.innerHeight + 40, rotate: 360 + Math.random() * 360, opacity: [1, 1, 0.7] }}
          transition={{ duration: 2 + Math.random() * 1.6, delay: Math.random() * 0.5, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            width: 10, height: 14, borderRadius: 3,
            background: colors[i % colors.length]
          }}
        />
      ))}
    </div>
  );
}
