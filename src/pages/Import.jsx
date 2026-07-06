import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getShare, importShare } from '../services/share';
import { todayStr } from '../services/words';
import { Page } from '../components/ui';
import { haptic } from '../hooks/useSpeech';

export default function Import() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') || '');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const lookup = async (c) => {
    setError('');
    setPreview(null);
    const r = await getShare(c);
    if (r.error === 'NOT_FOUND') setError('코드를 찾을 수 없어요. 다시 확인해주세요!');
    else if (r.error === 'EXPIRED') setError('만료된 공유 코드예요 (30일 경과).');
    else setPreview(r.data);
  };

  // 링크로 진입한 경우 자동 조회
  useEffect(() => {
    if (params.get('code')) lookup(params.get('code'));
  }, []);

  const doImport = async () => {
    setImporting(true);
    haptic(20);
    const { added, bookId } = await importShare(user.uid, preview, todayStr());
    nav(`/wordbooks/${encodeURIComponent(bookId)}`, { replace: true, state: { savedCount: added } });
  };

  return (
    <Page className="no-tab">
      <button style={{ background: 'none', border: 'none', color: 'var(--gray)', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 8 }} onClick={() => nav('/')}>
        ← 홈으로
      </button>
      <h1>단어장 받기 🎁</h1>
      <p className="sub">친구가 보낸 6자리 코드를 입력해요</p>

      <div className="row" style={{ marginBottom: 12 }}>
        <input
          className="input"
          placeholder="예: A3K9P2"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6, fontWeight: 800 }}
        />
        <button className="btn btn-blue" style={{ width: 100 }} disabled={code.length !== 6} onClick={() => lookup(code)}>
          조회
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)', background: 'var(--red-light)', color: 'var(--red-dark)', fontWeight: 700, fontSize: 14 }}>
          {error}
        </div>
      )}

      {preview && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ borderColor: 'var(--blue)' }}>
          <div className="between" style={{ marginBottom: 10 }}>
            <div>
              <strong style={{ fontSize: 17 }}>{preview.title}</strong>
              <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>
                👤 {preview.ownerName} · 단어 {preview.words.length}개 · {preview.importCount}명이 가져갔어요
              </div>
            </div>
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            {preview.words.map((w, i) => (
              <div key={i} className="between" style={{ padding: '8px 0', fontSize: 15 }}>
                <strong>{w.english}</strong>
                <span style={{ color: 'var(--gray)' }}>{w.korean}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-green" style={{ marginTop: 14 }} disabled={importing} onClick={doImport}>
            {importing ? '가져오는 중...' : '내 오늘 단어장에 추가하기'}
          </button>
        </motion.div>
      )}
    </Page>
  );
}
