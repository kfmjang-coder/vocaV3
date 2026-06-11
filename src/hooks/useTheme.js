const KEY = 'voca-theme';

/** 앱 시작 시 테마 적용: 저장값 > 시스템 설정 순 */
export function initTheme() {
  const saved = localStorage.getItem(KEY);
  const dark = saved
    ? saved === 'dark'
    : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem(KEY, next);
  return next;
}

export const isDark = () => document.documentElement.dataset.theme === 'dark';
