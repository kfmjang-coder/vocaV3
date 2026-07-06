import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getAllWords, groupByBook, renameBook, deleteBook } from '../services/words';
import { Page, EmptyState } from '../components/ui';
import { haptic } from '../hooks/useSpeech';

const fmtDate = (s) => {
  const [y, m, d] = s.split('-');
  const day = ['일', '월', '화', '수', '목', '금', '토'][new Date(s).getDay()];
  return `${Number(m)}월 ${Number(d)}일 (${day})`;
};

function BookCard({ g, index, onOpen, onLongPress, onSwipeDelete }) {
  const x = useMotionValue(0);
  const delOpacity = useTransform(x, [-80, -20, 0], [1, 0.4, 0]);
  const pressTimer = useRef(null);
  const moved = useRef(false);

  const memorized = g.words.filter((w) => w.memorized).length;
  const shared = g.words.some((w) => w.source?.startsWith('shared:'));
  const label = g.title || fmtDate(g.date);

  const startPress = () => {
    moved.current = false;
    pressTimer.current = setTimeout(() => { if (!moved.current) { haptic(30); onLongPress(g); } }, 500);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  return (
    <div style={{ position: 'relative', marginBottom: 10 }}>
      <motion.div style={{ opacity: delOpacity }} onClick={() => onSwipeDelete(g)}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--red)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 24, color: '#fff', fontWeight: 800, gap: 6 }}>
          🗑️ 삭제
        </div>
      </motion.div>
      <motion.div
        className="card between"
        drag="x" dragConstraints={{ left: -88, right: 0 }} dragElastic={0.15}
        style={{ x, position: 'relative', background: 'var(--card)' }}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.04, 0.4) }}
        onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress}
        onDragStart={() => { moved.current = true; cancelPress(); }}
        onDragEnd={(_, info) => { x.set(info.offset.x < -50 ? -88 : 0); }}
        onClick={() => { if (!moved.current && x.get() === 0) onOpen(g); }}
      >
        <div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 16 }}>{label}</strong>
            {g.title && <span className="chip" style={{ fontSize: 10 }}>{fmtDate(g.date)}</span>}
            {shared && <span className="chip" style={{ background: 'var(--tint-purple)', color: 'var(--purple)' }}>👥 공유받음</span>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 4 }}>
            {g.words.length}개 단어 · 외운 단어 {memorized}개
          </div>
        </div>
        <div className="progress-track" style={{ maxWidth: 64, height: 10 }}>
          <div className="progress-fill" style={{ width: `${g.words.length ? (memorized / g.words.length) * 100 : 0}%` }} />
        </div>
      </motion.div>
    </div>
  );
}

export default function Wordbooks() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [groups, setGroups] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const load = () => getAllWords(user.uid).then((words) => setGroups(groupByBook(words)));
  useEffect(() => { load(); }, [user]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); } }, [toast]);

  const openRename = (g) => { setSheet(null); setNameInput(g.title || ''); setRenaming(g); };
  const submitRename = async () => {
    setBusy(true);
    await renameBook(user.uid, renaming, nameInput);
    setBusy(false); setRenaming(null); setToast('단어장 이름을 바꿨어요 ✏️'); load();
  };
  const doDelete = async (g) => {
    setBusy(true);
    const n = await deleteBook(user.uid, g);
    setBusy(false); setConfirmDel(null); setSheet(null);
    setToast(`단어장을 삭제했어요 (단어 ${n}개) 🗑️`); load();
  };

  return (
    <Page>
      <h1>내 단어장 📚</h1>
      <p className="sub">누르면 열려요 · 왼쪽으로 밀거나 길게 누르면 편집</p>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card" style={{ background: 'var(--green-light)', borderColor: 'var(--green)', color: 'var(--green-dark)', fontWeight: 800, textAlign: 'center', marginBottom: 12, padding: 12 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {groups === null && [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 72, marginBottom: 10 }} />)}

      {groups?.length === 0 && (
        <EmptyState emoji="📸" title="아직 단어장이 비어있어요" desc="첫 단어를 찍어볼까요?"
          action={<button className="btn btn-green" onClick={() => nav('/')}>단어 찍으러 가기</button>} />
      )}

      {groups?.map((g, i) => (
        <BookCard key={g.bookId} g={g} index={i}
          onOpen={(g) => nav(`/wordbooks/${encodeURIComponent(g.bookId)}`)}
          onLongPress={setSheet} onSwipeDelete={setConfirmDel} />
      ))}

      {/* 액션 시트 */}
      <AnimatePresence>
        {sheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSheet(null)} style={ov} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }} style={sheetStyle}>
              <div style={grabber} />
              <div style={{ textAlign: 'center', marginBottom: 4 }}>
                <strong style={{ fontSize: 16 }}>{sheet.title || fmtDate(sheet.date)}</strong>
                <div style={{ fontSize: 13, color: 'var(--gray)' }}>단어 {sheet.words.length}개</div>
              </div>
              <button className="btn btn-white" style={{ marginTop: 12 }} onClick={() => openRename(sheet)}>✏️ 이름 바꾸기</button>
              <button className="btn btn-red" style={{ marginTop: 10 }} onClick={() => { setConfirmDel(sheet); setSheet(null); }}>🗑️ 단어장 삭제</button>
              <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setSheet(null)}>취소</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 이름 변경 시트 */}
      <AnimatePresence>
        {renaming && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setRenaming(null)} style={ov} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }} style={sheetStyle}>
              <div style={grabber} />
              <h2 style={{ marginBottom: 4 }}>단어장 이름 바꾸기</h2>
              <p className="sub" style={{ marginBottom: 14 }}>예: 중간고사 단어, 3과 단어장</p>
              <input className="input" autoFocus value={nameInput} maxLength={20}
                placeholder={fmtDate(renaming.date)}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                style={{ marginBottom: 6 }} />
              <p style={{ fontSize: 12, color: 'var(--gray-light)', marginBottom: 14 }}>비워두면 날짜({fmtDate(renaming.date)})로 표시돼요</p>
              <button className="btn btn-green" disabled={busy} onClick={submitRename}>{busy ? '저장 중...' : '저장'}</button>
              <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setRenaming(null)}>취소</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 삭제 확인 시트 */}
      <AnimatePresence>
        {confirmDel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmDel(null)} style={ov} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }} style={sheetStyle}>
              <div style={grabber} />
              <div className="center" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 40 }}>🗑️</span>
                <h2 style={{ marginTop: 8 }}>이 단어장을 삭제할까요?</h2>
              </div>
              <div className="card" style={{ background: 'var(--red-light)', borderColor: 'var(--red)', textAlign: 'center', marginBottom: 14 }}>
                <strong style={{ color: 'var(--red-dark)' }}>{confirmDel.title || fmtDate(confirmDel.date)}</strong>
                <div style={{ fontSize: 13, color: 'var(--red-dark)', marginTop: 2 }}>단어 {confirmDel.words.length}개가 모두 지워져요 · 되돌릴 수 없어요</div>
              </div>
              <button className="btn btn-red" disabled={busy} onClick={() => doDelete(confirmDel)}>
                {busy ? '삭제 중...' : `네, ${confirmDel.words.length}개 삭제할게요`}
              </button>
              <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setConfirmDel(null)}>취소</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Page>
  );
}

const ov = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 };
const sheetStyle = { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 91, background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(24px + var(--safe-b))', maxWidth: 480, margin: '0 auto' };
const grabber = { width: 40, height: 4, borderRadius: 999, background: 'var(--line)', margin: '6px auto 16px' };
