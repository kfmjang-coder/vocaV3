import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getAllWords, recordAnswer, getProfile, updateStreak, updateWord } from '../services/words';
import { buildSession, matchKorean, matchEnglish } from '../services/quiz';
import { judgeMeaning, fetchWordDetails } from '../services/gemini';
import { speak, useRecognition, haptic } from '../hooks/useSpeech';

export default function QuizSession() {
  const { user, gemini } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const [questions, setQuestions] = useState(null);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState(null); // {correct, picked}
  const [score, setScore] = useState(0);
  const wrongRef = useRef([]);
  const [typed, setTyped] = useState('');
  const [judging, setJudging] = useState(false);
  const rec = useRecognition();

  useEffect(() => {
    if (!state?.poolIds) return;
    getAllWords(user.uid).then((all) => {
      const pool = all.filter((w) => state.poolIds.includes(w.id));
      const session = buildSession(pool, all, state.mode);
      setQuestions(session);

      // 발음기호/품사/예문 없는 기존 단어 자동 보충 (한 번에 일괄 조회 → DB 저장)
      const missing = [...new Set(
        session.filter((q) => !q.word.phonetic || !q.word.example || !q.word.pos).map((q) => q.word.english)
      )];
      if (missing.length && navigator.onLine && gemini?.apiKey) {
        fetchWordDetails(gemini, missing).then((map) => {
          if (!Object.keys(map).length) return;
          // 비어있는 필드만 채움 (기존 값 보존)
          const patchFor = (w) => {
            const d = map[w.english];
            if (!d) return null;
            const patch = {};
            for (const f of ['phonetic', 'pos', 'example', 'exampleKo']) {
              if (!w[f] && d[f]) patch[f] = d[f];
            }
            return Object.keys(patch).length ? patch : null;
          };
          setQuestions((prev) =>
            prev.map((q) => {
              const patch = patchFor(q.word);
              return patch ? { ...q, word: { ...q.word, ...patch } } : q;
            })
          );
          // 다음부터는 호출 없이 표시되도록 저장 (오프라인 대비)
          session.forEach((q) => {
            const patch = patchFor(q.word);
            if (patch) updateWord(user.uid, q.word.id, patch).catch(() => {});
          });
        });
      }
    });
  }, []);

  const q = questions?.[idx];

  // 자동 발음: 영→한 모드와 듣고말하기 모드는 문제 등장 시 발음 재생
  useEffect(() => {
    if ((q?.mode === 'listen' || q?.mode === 'e2k') && !feedback) {
      const t = setTimeout(() => speak(q.word.english), 400);
      return () => clearTimeout(t);
    }
  }, [idx, questions]);

  if (!state?.poolIds) return <Navigate to="/quiz" replace />;
  if (!questions) return <div className="page no-tab"><div className="skeleton" style={{ height: 300, marginTop: 60 }} /></div>;

  const total = questions.length;

  const settle = async (correct, pickedLabel = null, skipped = false) => {
    haptic(correct ? 25 : skipped ? 15 : [40, 60, 40]);
    setFeedback({ correct, picked: pickedLabel, skipped });
    if (correct) setScore((s) => s + 1);
    else wrongRef.current.push(q.word);
    // 정답 공개와 함께 발음 한 번 더 (영→한은 이미 들었으므로 제외)
    if (q.mode !== 'e2k') setTimeout(() => speak(q.word.english), 350);
    recordAnswer(user.uid, q.word, correct).catch(() => {});
  };

  /** 스킵: 오답 처리 → 오답노트 누적 + 다음 세션 출제 가중치 상승 */
  const skip = () => {
    if (feedback) return;
    rec.stop();
    settle(false, null, true);
  };

  const next = async () => {
    setFeedback(null);
    setTyped('');
    rec.setTranscript('');
    if (idx + 1 < total) {
      setIdx(idx + 1);
    } else {
      const profile = await getProfile(user.uid).catch(() => null);
      const streak = await updateStreak(user.uid, profile, score, total).catch(() => profile?.streak || 1);
      nav('/quiz/result', {
        replace: true,
        state: { score, total, wrong: wrongRef.current.map((w) => ({ english: w.english, korean: w.korean })), streak }
      });
    }
  };

  // 객관식 선택
  const pickChoice = (choice) => {
    if (feedback) return;
    const answer = q.mode === 'e2k' ? q.word.korean : q.word.english;
    settle(choice === answer, choice);
  };

  // 스펠링 제출
  const submitSpell = () => {
    if (feedback || !typed.trim()) return;
    settle(matchEnglish(q.word.english, typed));
  };

  // 듣고말하기 제출 (1차 문자열 → 2차 Gemini 판정)
  const submitListen = async (answerText) => {
    if (feedback) return;
    const said = answerText ?? rec.transcript;
    if (!said.trim()) return;
    if (matchKorean(q.word.korean, said)) { settle(true); return; }
    if (navigator.onLine && gemini?.apiKey) {
      setJudging(true);
      const ok = await judgeMeaning(gemini, q.word.english, q.word.korean, said);
      setJudging(false);
      settle(ok);
    } else {
      settle(false);
    }
  };

  const answerLabel = q.mode === 'e2k' ? q.word.korean : q.word.english;

  /** 예문 속 대상 단어 하이라이트 */
  const renderExample = (example, word) => {
    try {
      const parts = example.split(new RegExp(`(${word}\\w*)`, 'i'));
      return parts.map((p, i) =>
        p.toLowerCase().startsWith(word.toLowerCase())
          ? <strong key={i} style={{ color: 'var(--blue)' }}>{p}</strong>
          : p
      );
    } catch { return example; }
  };

  return (
    <div className="page no-tab">
      {/* 상단: 닫기 + 진행바 */}
      <div className="row" style={{ marginBottom: 24 }}>
        <button onClick={() => nav('/quiz')} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--gray-light)', cursor: 'pointer' }}>✕</button>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${((idx + (feedback ? 1 : 0)) / total) * 100}%` }} />
        </div>
        <span style={{ fontWeight: 800, color: 'var(--gray)', fontSize: 14 }}>{idx + 1}/{total}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={feedback && !feedback.correct ? 'shake' : ''}
        >
          {/* ===== 문제 영역 ===== */}
          {q.mode === 'e2k' && (
            <>
              <p className="sub">알맞은 뜻을 골라요</p>
              <div className="row" style={{ marginBottom: q.word.phonetic ? 4 : 28 }}>
                <h1 style={{ fontSize: 32 }}>{q.word.english}</h1>
                {q.word.pos && <span className="chip">{q.word.pos}</span>}
                <button onClick={() => speak(q.word.english)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>🔊</button>
              </div>
              {q.word.phonetic && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                  style={{ color: 'var(--gray)', fontSize: 18, fontWeight: 600, marginBottom: 24 }}
                >
                  {q.word.phonetic}
                </motion.div>
              )}
            </>
          )}
          {q.mode === 'k2e' && (
            <>
              <p className="sub">알맞은 영어 단어를 골라요</p>
              <h1 style={{ fontSize: 28, marginBottom: 28 }}>{q.word.korean}</h1>
            </>
          )}
          {q.mode === 'spell' && (
            <>
              <p className="sub">영어로 직접 써봐요</p>
              <h1 style={{ fontSize: 28, marginBottom: 24 }}>{q.word.korean}</h1>
              <input
                className="input" autoFocus autoCapitalize="none" autoComplete="off" autoCorrect="off"
                placeholder="영어 단어 입력"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitSpell()}
                disabled={!!feedback}
                style={{ fontSize: 20, textAlign: 'center', marginBottom: 16 }}
              />
              {!feedback && <button className="btn btn-green" disabled={!typed.trim()} onClick={submitSpell}>확인</button>}
              {!feedback && (
                <button className="btn btn-ghost" style={{ marginTop: 4 }} onClick={skip}>
                  🤷 모르겠어요
                </button>
              )}
            </>
          )}
          {q.mode === 'listen' && (
            <>
              <p className="sub">발음을 듣고 한글 뜻을 말해요</p>
              <div className="center" style={{ marginBottom: 20 }}>
                <div className="row">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => speak(q.word.english)}
                    style={{ width: 88, height: 88, borderRadius: '50%', border: 'none', background: 'var(--blue)', boxShadow: '0 4px 0 var(--blue-dark)', fontSize: 38, cursor: 'pointer' }}>
                    🔊
                  </motion.button>
                  <button className="btn btn-white btn-sm" onClick={() => speak(q.word.english, 0.7)}>🐢 천천히</button>
                </div>
              </div>

              {rec.supported ? (
                <div className="center">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={() => (rec.listening ? rec.stop() : rec.start())}
                    disabled={!!feedback || judging}
                    style={{
                      width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
                      background: rec.listening ? 'var(--red)' : 'var(--green)',
                      boxShadow: `0 4px 0 ${rec.listening ? 'var(--red-dark)' : 'var(--green-dark)'}`,
                      fontSize: 30
                    }}>
                    🎤
                  </motion.button>
                  <span style={{ fontSize: 13, color: 'var(--gray)', fontWeight: 700, marginTop: 8 }}>
                    {judging ? 'AI가 채점 중...' : rec.listening ? '듣고 있어요... 다 말하면 버튼을 눌러요' : '마이크를 누르고 뜻을 말해요'}
                  </span>
                  {rec.listening && (
                    <div className="row" style={{ gap: 5, height: 30, marginTop: 10, alignItems: 'center' }}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />
                      ))}
                    </div>
                  )}
                  {rec.transcript && (
                    <div className="card" style={{ marginTop: 14, width: '100%', textAlign: 'center', fontWeight: 800, fontSize: 18 }}>
                      “{rec.transcript}”
                    </div>
                  )}
                  {rec.transcript && !rec.listening && !feedback && !judging && (
                    <button className="btn btn-green" style={{ marginTop: 14 }} onClick={() => submitListen()}>이걸로 제출!</button>
                  )}
                </div>
              ) : (
                /* STT 미지원 폴백: 키보드 입력 */
                <>
                  <input className="input" placeholder="한글 뜻 입력 (음성 미지원 기기)" value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitListen(typed)}
                    disabled={!!feedback} style={{ textAlign: 'center', marginBottom: 12 }} />
                  {!feedback && <button className="btn btn-green" disabled={!typed.trim()} onClick={() => submitListen(typed)}>확인</button>}
                </>
              )}
              {/* 스킵: 정답 버튼과 경쟁하지 않는 고스트 스타일 */}
              {!feedback && !judging && (
                <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={skip}>
                  🤷 모르겠어요
                </button>
              )}
            </>
          )}

          {/* 객관식 보기 */}
          {(q.mode === 'e2k' || q.mode === 'k2e') &&
            q.choices.map((c) => {
              let cls = 'choice';
              if (feedback) {
                if (c === answerLabel) cls += ' correct';
                else if (c === feedback.picked) cls += ' wrong';
                else cls += ' dim';
              }
              return (
                <button key={c} className={cls} onClick={() => pickChoice(c)} disabled={!!feedback}>
                  {c}
                </button>
              );
            })}
        </motion.div>
      </AnimatePresence>

      {/* ===== 판정 시트 ===== */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
              background: feedback.correct ? 'var(--green-light)' : 'var(--red-light)',
              borderTop: `2px solid ${feedback.correct ? 'var(--green)' : 'var(--red)'}`,
              padding: '20px 20px calc(20px + var(--safe-b))'
            }}>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <strong style={{ fontSize: 20, color: feedback.correct ? 'var(--green-dark)' : 'var(--red-dark)' }}>
                {feedback.correct ? '정답이에요! 🎉' : feedback.skipped ? '괜찮아요, 다음에 맞히면 돼요! 💪' : '아쉬워요 😢'}
              </strong>
              <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 18, color: feedback.correct ? 'var(--green-dark)' : 'var(--red-dark)' }}>
                  {q.word.english}
                </strong>
                {q.word.pos && (
                  <span className="chip" style={{ fontSize: 11 }}>{q.word.pos}</span>
                )}
                {q.word.phonetic && (
                  <span style={{ fontSize: 15, fontWeight: 600, color: feedback.correct ? 'var(--green-dark)' : 'var(--red-dark)', opacity: 0.8 }}>
                    {q.word.phonetic}
                  </span>
                )}
                <button onClick={() => speak(q.word.english)}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 0 }}>🔊</button>
                <span style={{ fontWeight: 700, color: feedback.correct ? 'var(--green-dark)' : 'var(--red-dark)' }}>
                  = {q.word.korean}
                </span>
              </div>
              {/* 예문: 회상 직후가 문맥 학습의 골든타임 */}
              {q.word.example && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="row"
                  style={{
                    marginTop: 10, padding: '10px 14px', gap: 10, alignItems: 'flex-start',
                    background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12
                  }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.5 }}>
                      {renderExample(q.word.example, q.word.english)}
                    </div>
                    {q.word.exampleKo && (
                      <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 3 }}>{q.word.exampleKo}</div>
                    )}
                  </div>
                  <button onClick={() => speak(q.word.example, 0.9)}
                    style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 0, marginTop: 2 }}
                    aria-label="예문 듣기">🔊</button>
                </motion.div>
              )}
              <button className={`btn ${feedback.correct ? 'btn-green' : 'btn-red'}`} style={{ marginTop: 14 }} onClick={next}>
                {idx + 1 < total ? '다음 문제' : '결과 보기'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
