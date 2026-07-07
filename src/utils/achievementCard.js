// 자랑하기 성취 카드 생성 — Canvas로 그려서 Blob 반환
// 인스타 스토리 규격 1080x1920

const C = {
  green: '#58CC02', greenDark: '#46A302', ink: '#3C3C3C',
  gray: '#777777', yellow: '#FFC800', bg: '#FFFFFF', soft: '#F7F7F7', line: '#E5E5E5'
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * @param {object} data { name, avatarEmoji, avatarColor, todayQuizzes, accuracy, streak, total, memorized }
 * @returns {Promise<Blob>}
 */
export async function buildAchievementCard(data) {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 배경 그라데이션 (그린 계열)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7BE838');
  g.addColorStop(0.5, C.green);
  g.addColorStop(1, C.greenDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 장식 원들
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#FFFFFF';
  [[150, 300, 220], [950, 500, 160], [880, 1500, 260], [120, 1650, 180]].forEach(([x, y, r]) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  // 상단 라벨
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '800 42px Pretendard, sans-serif';
  ctx.fillText('🔥 오늘의 학습 달성 🔥', W / 2, 220);

  // 흰 카드 패널
  const cardX = 90, cardY = 300, cardW = W - 180, cardH = 1180;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
  ctx.fillStyle = C.bg;
  roundRect(ctx, cardX, cardY, cardW, cardH, 56);
  ctx.fill();
  ctx.restore();

  // 아바타 원
  const avY = cardY + 170;
  const avColor = data.avatarColor || C.green;
  ctx.beginPath(); ctx.arc(W / 2, avY, 110, 0, Math.PI * 2);
  ctx.fillStyle = avColor + '22'; ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = avColor; ctx.stroke();
  ctx.font = '120px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(data.avatarEmoji || '🦉', W / 2, avY + 8);
  ctx.textBaseline = 'alphabetic';

  // 이름
  ctx.fillStyle = C.ink;
  ctx.font = '800 60px Pretendard, sans-serif';
  ctx.fillText(data.name || '학습자', W / 2, avY + 210);

  // 큰 숫자: 오늘 퀴즈 횟수
  ctx.fillStyle = C.green;
  ctx.font = '900 200px Pretendard, sans-serif';
  ctx.fillText(String(data.todayQuizzes), W / 2, avY + 470);
  ctx.fillStyle = C.gray;
  ctx.font = '700 48px Pretendard, sans-serif';
  ctx.fillText('오늘 푼 퀴즈', W / 2, avY + 550);

  // 하단 스탯 3개 (정답률 · 스트릭 · 외운단어)
  const stats = [
    { n: `${data.accuracy}%`, l: '정답률' },
    { n: `${data.streak}일`, l: '연속학습' },
    { n: `${data.memorized}`, l: '외운단어' }
  ];
  const sy = cardY + cardH - 140;
  const sw = cardW / 3;
  stats.forEach((s, i) => {
    const sx = cardX + sw * i + sw / 2;
    ctx.fillStyle = C.ink;
    ctx.font = '800 64px Pretendard, sans-serif';
    ctx.fillText(s.n, sx, sy);
    ctx.fillStyle = C.gray;
    ctx.font = '600 34px Pretendard, sans-serif';
    ctx.fillText(s.l, sx, sy + 55);
    if (i < 2) { // 구분선
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + sw * (i + 1), sy - 70);
      ctx.lineTo(cardX + sw * (i + 1), sy + 20);
      ctx.stroke();
    }
  });

  // 하단 앱 이름/링크
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '800 52px Pretendard, sans-serif';
  ctx.fillText('📚 시우지우 영어단어장', W / 2, cardY + cardH + 130);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 38px Pretendard, sans-serif';
  ctx.fillText('vocav3.web.app', W / 2, cardY + cardH + 190);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
