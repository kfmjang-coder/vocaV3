import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/image';
import { extractWords } from '../services/gemini';
import { getAllWords, getProfile, todayStr, dueWords, checkAndCountUsage, DAILY_LIMIT } from '../services/words';
import { haptic } from '../hooks/useSpeech';
import { Page } from '../components/ui';

export default function Home() {
  const { user, gemini } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef(null);      // 카메라 촬영
  const galleryRef = useRef(null);   // 앨범에서 불러오기
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(null); // { cur, total } 다중 분석 진행률
  const [pendingFiles, setPendingFiles] = useState(null); // 모드 선택 대기 중인 파일들
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const [words, profile] = await Promise.all([getAllWords(user.uid), getProfile(user.uid)]);
      const t = todayStr();
      setStats({
        today: words.filter((w) => w.date === t).length,
        due: dueWords(words.filter((w) => !w.memorized || (w.nextReview || '') <= t)).length,
        total: words.length,
        streak: profile?.streak || 0,
        name: profile?.name || '학습자'
      });
    })();
  }, [user]);

  const onPick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    if (!navigator.onLine) { setError('인터넷 연결이 필요해요. 저장된 단어로 퀴즈는 가능해요!'); return; }
    // 파일을 받아두고 추출 모드를 먼저 물어본다
    setPendingFiles(files);
  };

  const runExtraction = async (mode) => {
    const files = pendingFiles;
    setPendingFiles(null);
    if (!files?.length) return;

    setAnalyzing(true);
    try {
      const merged = [];
      const seen = new Set();
      let failCount = 0;

      for (let i = 0; i < files.length; i++) {
        // 사진마다 일일 분석 횟수 차감 (여러 장이면 여러 번)
        const ok = await checkAndCountUsage(user.uid);
        if (!ok) {
          setError(`오늘 사진 분석 ${DAILY_LIMIT}회를 모두 사용했어요.${merged.length ? ' 지금까지 찾은 단어만 저장할게요!' : ' 내일 다시 만나요!'}`);
          break;
        }
        if (files.length > 1) setProgress({ cur: i + 1, total: files.length });

        try {
          const { base64, mimeType } = await compressImage(files[i]);
          const words = await extractWords(gemini, base64, mimeType, mode);
          for (const w of words) {
            if (!seen.has(w.english)) { seen.add(w.english); merged.push(w); }
          }
        } catch (err) {
          if (err.message === 'NO_KEY') throw err;
          failCount++;
        }
      }

      setProgress(null);
      if (!merged.length) {
        setError(mode === 'headword'
          ? '표제어를 못 찾았어요. 단어장 페이지가 맞나요? "전체 모드"로 다시 시도해보세요! 📖'
          : '단어를 못 찾았어요. 글자가 잘 보이게 다시 찍어주세요! 📷');
      } else {
        haptic(30);
        const note = failCount > 0 ? `${failCount}장은 단어를 못 찾았어요` : '';
        nav('/capture', { state: { words: merged, note } });
      }
    } catch (err) {
      setError(err.message === 'NO_KEY'
        ? '설정 오류예요. 관리자에게 알려주세요.'
        : '분석에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setProgress(null);
      setAnalyzing(false);
    }
  };

  return (
    <Page>
      <div className="between" style={{ marginBottom: 8 }}>
        <h1>안녕, {stats?.name?.split(' ')[0] || ''}! 👋</h1>
        <span className="chip" style={{ background: 'var(--tint-yellow)', color: 'var(--orange)', fontSize: 14 }}>
          🔥 {stats?.streak ?? 0}일
        </span>
      </div>
      <p className="sub">오늘도 단어를 찍어볼까요?</p>

      {/* 메인 카메라 버튼 */}
      <motion.button
        className="center"
        onClick={() => { haptic(15); fileRef.current?.click(); }}
        disabled={analyzing}
        whileTap={{ scale: 0.94 }}
        animate={analyzing ? {} : { scale: [1, 1.03, 1] }}
        transition={analyzing ? {} : { repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
        style={{
          width: '100%', padding: '44px 20px', marginBottom: 16,
          background: analyzing ? 'var(--bg-soft)' : 'var(--green)',
          border: 'none', borderRadius: 24, cursor: 'pointer',
          boxShadow: analyzing ? 'none' : '0 6px 0 var(--green-dark)',
          color: '#fff'
        }}
      >
        {analyzing ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} style={{ fontSize: 44 }}>🔍</motion.div>
            <strong style={{ color: 'var(--gray)', fontSize: 17, marginTop: 8 }}>
              {progress ? `단어 찾는 중... (${progress.cur}/${progress.total}장)` : '단어 찾는 중...'}
            </strong>
            <span style={{ color: 'var(--gray-light)', fontSize: 13, marginTop: 4 }}>AI가 사진을 읽고 있어요</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 52 }}>📸</span>
            <strong style={{ fontSize: 19, marginTop: 8 }}>단어 찍기</strong>
            <span style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>교과서·단어장을 찍으면 자동으로 저장돼요</span>
          </>
        )}
      </motion.button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={onPick} />

      {/* 앨범에서 불러오기 */}
      <button
        className="btn btn-white"
        style={{ marginBottom: 16 }}
        disabled={analyzing}
        onClick={() => { haptic(10); galleryRef.current?.click(); }}
      >
        🖼️ 앨범에서 사진 불러오기 (여러 장 가능)
      </button>

      {error && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="card" style={{ borderColor: 'var(--red)', background: 'var(--red-light)', color: 'var(--red-dark)', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
          {error}
        </motion.div>
      )}

      {/* 오늘 요약 */}
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="card center" style={{ flex: 1, padding: 14 }}>
          <strong style={{ fontSize: 26, color: 'var(--green)' }}>{stats?.today ?? '–'}</strong>
          <span style={{ fontSize: 12, color: 'var(--gray)', fontWeight: 700 }}>오늘 단어</span>
        </div>
        <div className="card center" style={{ flex: 1, padding: 14 }}>
          <strong style={{ fontSize: 26, color: 'var(--blue)' }}>{stats?.total ?? '–'}</strong>
          <span style={{ fontSize: 12, color: 'var(--gray)', fontWeight: 700 }}>전체 단어</span>
        </div>
      </div>

      {/* 복습 알림 카드 (U2) */}
      {stats?.due > 0 && (
        <motion.div
          className="card card-press between"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ borderColor: 'var(--yellow)', background: 'var(--tint-yellow)' }}
          onClick={() => nav('/quiz')}
        >
          <div>
            <strong>오늘 복습할 단어 {stats.due}개 🔔</strong>
            <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>잊어버리기 전에 퀴즈로 복습해요</div>
          </div>
          <span style={{ fontSize: 22 }}>→</span>
        </motion.div>
      )}

      <button className="btn btn-white" style={{ marginTop: 16 }} onClick={() => nav('/import')}>
        🎁 코드로 단어장 받기
      </button>

      {/* 추출 모드 선택 시트 */}
      <AnimatePresence>
        {pendingFiles && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPendingFiles(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 91, background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(24px + var(--safe-b))', maxWidth: 480, margin: '0 auto' }}>
              <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--line)', margin: '6px auto 16px' }} />
              <h2 style={{ marginBottom: 4 }}>어떻게 단어를 뽑을까요?</h2>
              <p className="sub" style={{ marginBottom: 16 }}>
                사진 {pendingFiles.length}장 · 사진 종류에 맞게 골라주세요
              </p>

              <div className="card card-press" style={{ marginBottom: 10, borderColor: 'var(--green)' }}
                onClick={() => { haptic(12); runExtraction('headword'); }}>
                <div className="row" style={{ gap: 10 }}>
                  <span style={{ fontSize: 28 }}>📖</span>
                  <div>
                    <div className="row" style={{ gap: 6 }}>
                      <strong>단어장 모드</strong>
                      <span className="chip" style={{ background: 'var(--green-light)', color: 'var(--green-dark)' }}>추천</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>표제어만 쏙! 예문·제목 속 단어는 제외해요</div>
                  </div>
                </div>
              </div>

              <div className="card card-press" style={{ marginBottom: 6 }}
                onClick={() => { haptic(12); runExtraction('all'); }}>
                <div className="row" style={{ gap: 10 }}>
                  <span style={{ fontSize: 28 }}>📄</span>
                  <div>
                    <strong>전체 모드</strong>
                    <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>사진 속 모든 영어 단어를 다 가져와요 (지문·필기용)</div>
                  </div>
                </div>
              </div>

              <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setPendingFiles(null)}>취소</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Page>
  );
}
