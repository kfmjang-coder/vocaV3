// 프로필 아바타: 이모지 + 배경색 (Storage 없이 초경량)
export const AVATAR_EMOJIS = ['🦊', '🐱', '🐶', '🐰', '🐻', '🐼', '🦁', '🐯', '🐨', '🐹', '🐸', '🦉', '🦄', '🐧', '🐢', '🦖'];
export const AVATAR_COLORS = ['#58CC02', '#1CB0F6', '#CE82FF', '#FF9600', '#FF4B4B', '#FFC800', '#2EC4B6', '#FF6B9D'];

export const DEFAULT_AVATAR = { emoji: '🦉', color: '#58CC02' };

/** 아바타 원형 뷰. size로 크기 조절 */
export function Avatar({ emoji, color, size = 56, style = {} }) {
  const e = emoji || DEFAULT_AVATAR.emoji;
  const c = color || DEFAULT_AVATAR.color;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: c + '22', // 배경은 색의 연한 톤
      border: `2px solid ${c}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.52, flexShrink: 0, ...style
    }}>
      {e}
    </div>
  );
}
