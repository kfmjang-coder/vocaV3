import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { saveWords, getAllWords, groupByBook, todayStr } from '../services/words';
import { haptic } from '../hooks/useSpeech';
import { Page } from '../components/ui';

const fmtDate = (s) => {
  const [y, m, d] = s.split('-');
  const day = ['일', '월', '화', '수', '목', '금', '토'][new Date(s).getDay()];
  return `${Number(m)}월 ${Number(d)}일 (${day})`;
};

export default function Capture() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const [items, setItems] = useState(state?.words || []);
  const [selected, setSelected] = useState(() => new Set());   // 선택된 단어 인덱스
  const [selectMode, setSelectMode] = useState(false);          // 선택 모드 on/off
  const [saving, setSaving] = useState(false);
  const [dest, setDest] = useState(null);      // 저장 대상 시트: 'all' | 'selected'
  const [bookName, setBookName] = useState('');
  const [existingBooks, setExistingBooks] = useState([]);
  const [targetChoice, setTargetChoice] = useState('new'); // 'new' | bookId

  if (!state?.words) return <Navigate to="/" replace />;

  const edit = (i, field, val) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    setItems(next);
  };
  const remove = (i) => {
    haptic(15);
    setItems(items.filter((_, idx) => idx !== i));
    setSelected((prev) => {
      const n = new Set();
      // 인덱스 재정렬
      [...prev].forEach((idx) => { if (idx < i) n.add(idx); else if (idx > i) n.add(idx - 1); });
      return n;
    });
  };
  const toggleSelect = (i) => {
    haptic(8);
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  // 저장 시트 열기 — 기존 단어장 목록도 불러온다
  const openDest = async (which) => {
    const valid = items.filter((w) => w.english.trim() && w.korean.trim());
    if (!valid.length) return;
    if (which === 'selected' && selected.size === 0) return;
    const books = groupByBook(await getAllWords(user.uid));
    setExistingBooks(books);
    setTargetChoice('new');
    setBookName('');
    setDest(which);
  };

  const confirmSave = async () => {
    setSaving(true);
    const valid = items
      .map((w, i) => ({ ...w, _i: i }))
      .filter((w) => w.english.trim() && w.korean.trim())
      .filter((w) => (dest === 'selected' ? selected.has(w._i) : true));

    let result;
    if (targetChoice === 'new') {
      result = await saveWords(user.uid, valid, { title: bookName.trim(), date: todayStr() });
    } else {
      const book = existingBooks.find((b) => b.bookId === targetChoice);
      result = await saveWords(user.uid, valid, {
        bookId: book.bookId.startsWith('legacy-') ? undefined : book.bookId,
        title: book.title, date: book.date
      });
    }
    haptic([20, 50, 20]);

    // 저장한 단어를 목록에서 제거 (분할 저장 흐름 지원)
    const savedIdx = new Set(valid.map((w) => w._i));
    const rest = items.filter((_, i) => !savedIdx.has(i));
    setSaving(false);
    setDest(null);
    setSelected(new Set());
    setSelectMode(false);

    if (rest.length > 0) {
      // 남은 단어가 있으면 화면에 유지 → 다른 단어장으로 계속 저장 가능
      setItems(rest);
    } else {
      nav('/wordbooks/' + result.bookId, { replace: true, state: { savedCount: result.added } });
    }
  };

  const allValid = items.filter((w) => w.english.trim() && w.korean.trim()).length;

  return (
    <Page className="no-tab">
      <button className="btn-ghost btn-sm" style={{ border: 'none', padding: 0, marginBottom: 8, cursor: 'pointer', background: 'none', color: 'var(--gray)', fontWeight: 700 }} onClick={() => nav(-1)}>
        ← 다시 찍기
      </button>
      <div className="between">
        <h1>단어 {items.length}개를 찾았어요! 🎉</h1>
        <button className="btn-sm" onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
          style={{ border: `2px solid ${selectMode ? 'var(--green)' : 'var(--line)'}`, background: selectMode ? 'var(--green-light)' : 'var(--card)', color: selectMode ? 'var(--green-dark)' : 'var(--gray)', borderRadius: 10, padding: '6px 12px', fontWeight: 800, cursor: 'pointer' }}>
          {selectMode ? '선택 취소' : '☑️ 나눠담기'}
        </button>
      </div>
      {state?.note && (
        <div className="chip" style={{ background: 'var(--tint-yellow)', color: 'var(--orange)', marginBottom: 6 }}>ℹ️ {state.note}</div>
      )}
      <p className="sub">
        {selectMode
          ? `단어를 눌러 선택하세요 · ${selected.size}개 선택됨`
          : '틀린 부분은 고치고, 필요 없는 단어는 ✕를 눌러요'}
      </p>

      {items.map((w, i) => {
        const isSel = selected.has(i);
        return (
          <motion.div
            key={i}
            className="card row"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.5) }}
            style={{
              marginBottom: 10, padding: 10,
              border: `2px solid ${isSel ? 'var(--green)' : 'var(--line)'}`,
              background: isSel ? 'var(--green-light)' : 'var(--card)'
            }}
            onClick={selectMode ? () => toggleSelect(i) : undefined}
          >
            {selectMode && (
              <div style={{
                width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                border: `2px solid ${isSel ? 'var(--green)' : 'var(--gray-light)'}`,
                background: isSel ? 'var(--green)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 900
              }}>{isSel ? '✓' : ''}</div>
            )}
            <input className="input" style={{ flex: 1, padding: '10px 12px' }} value={w.english}
              disabled={selectMode}
              onChange={(e) => edit(i, 'english', e.target.value)} placeholder="영어" />
            <input className="input" style={{ flex: 1.2, padding: '10px 12px' }} value={w.korean}
              disabled={selectMode}
              onChange={(e) => edit(i, 'korean', e.target.value)} placeholder="한글 뜻" />
            {!selectMode && (
              <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--gray-light)', cursor: 'pointer', padding: 4 }}>✕</button>
            )}
          </motion.div>
        );
      })}

      {/* 하단 저장 바 */}
      <div style={{ position: 'sticky', bottom: 16, marginTop: 20 }}>
        {selectMode ? (
          <button className="btn btn-green" disabled={selected.size === 0} onClick={() => openDest('selected')}>
            선택한 {selected.size}개를 단어장에 담기
          </button>
        ) : (
          <button className="btn btn-green" disabled={!allValid} onClick={() => openDest('all')}>
            {allValid}개 전부 단어장에 저장하기
          </button>
        )}
      </div>

      {/* ===== 저장 대상 선택 시트 ===== */}
      <AnimatePresence>
        {dest && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !saving && setDest(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 91, background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(24px + var(--safe-b))', maxWidth: 480, margin: '0 auto', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--line)', margin: '6px auto 16px' }} />
              <h2 style={{ marginBottom: 4 }}>
                {dest === 'selected' ? `선택한 ${selected.size}개를` : `${allValid}개를`} 어디에 담을까요?
              </h2>
              <p className="sub" style={{ marginBottom: 14 }}>새 단어장을 만들거나 기존 단어장에 추가해요</p>

              {/* 새 단어장 */}
              <div
                onClick={() => setTargetChoice('new')}
                className="card"
                style={{ marginBottom: 10, cursor: 'pointer', borderColor: targetChoice === 'new' ? 'var(--green)' : 'var(--line)', background: targetChoice === 'new' ? 'var(--green-light)' : 'var(--card)' }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 20 }}>✨</span>
                  <strong>새 단어장 만들기</strong>
                </div>
                {targetChoice === 'new' && (
                  <input className="input" autoFocus value={bookName} maxLength={20}
                    placeholder={`이름 (비우면 ${fmtDate(todayStr())})`}
                    onChange={(e) => setBookName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginTop: 10 }} />
                )}
              </div>

              {/* 기존 단어장 목록 */}
              {existingBooks.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--gray)', fontWeight: 700, margin: '4px 0 8px' }}>기존 단어장에 추가</div>
              )}
              {existingBooks.map((b) => (
                <div key={b.bookId}
                  onClick={() => setTargetChoice(b.bookId)}
                  className="card between"
                  style={{ marginBottom: 8, padding: 12, cursor: 'pointer', borderColor: targetChoice === b.bookId ? 'var(--green)' : 'var(--line)', background: targetChoice === b.bookId ? 'var(--green-light)' : 'var(--card)' }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{b.title || fmtDate(b.date)}</strong>
                    <div style={{ fontSize: 12, color: 'var(--gray)' }}>{b.words.length}개 단어</div>
                  </div>
                  {targetChoice === b.bookId && <span style={{ color: 'var(--green)', fontWeight: 900 }}>✓</span>}
                </div>
              ))}

              <button className="btn btn-green" style={{ marginTop: 12 }} disabled={saving} onClick={confirmSave}>
                {saving ? '저장 중...' : '여기에 저장하기'}
              </button>
              <button className="btn btn-ghost" style={{ marginTop: 6 }} disabled={saving} onClick={() => setDest(null)}>취소</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Page>
  );
}
