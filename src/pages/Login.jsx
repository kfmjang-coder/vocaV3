import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

/** 카톡/네이버/인스타 등 인앱 브라우저 감지 — 구글 로그인이 차단되는 환경 */
const ua = navigator.userAgent;
const isKakao = /KAKAOTALK/i.test(ua);
const isInApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|everytimeApp|whale.*inapp/i.test(ua);

/** 외부 브라우저(Chrome)로 현재 페이지 열기 */
const openExternal = () => {
  const url = location.href;
  if (isKakao) {
    // 카카오톡 전용: 기본 브라우저로 열기
    location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
  } else {
    // Android 공통: Chrome 인텐트
    location.href = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;
  }
};

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

      {isInApp ? (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} style={{ width: '100%' }}>
          <div className="card" style={{
            background: 'var(--tint-yellow)', borderColor: 'var(--yellow)',
            fontSize: 14, fontWeight: 700, lineHeight: 1.6, marginBottom: 14, textAlign: 'left'
          }}>
            ⚠️ {isKakao ? '카카오톡' : '앱 내'} 브라우저에서는 구글 로그인이 안 돼요.<br />
            아래 버튼을 눌러 <strong>Chrome으로 열어주세요!</strong>
          </div>
          <button className="btn btn-green" onClick={openExternal}>
            🌐 Chrome 브라우저로 열기
          </button>
          <p style={{ color: 'var(--gray-light)', fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
            버튼이 안 되면: 화면의 ⋮ 메뉴 → "다른 브라우저로 열기"
          </p>
        </motion.div>
      ) : (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} style={{ width: '100%' }}>
          <button className="btn btn-green" onClick={login}>
            구글 계정으로 시작하기
          </button>
        </motion.div>
      )}

      <p style={{ color: 'var(--gray-light)', fontSize: 12, marginTop: 16 }}>
        승인된 사용자만 이용할 수 있어요
      </p>
    </div>
  );
}
