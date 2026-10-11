// 线性 SVG 图标库（24x24，stroke=currentColor，替代全部 emoji）
import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>,
  video: <><rect x="2.5" y="6" width="13" height="12" rx="2" /><path d="m15.5 10 5-3v10l-5-3" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  flame: <path d="M12 3s-5 4.5-5 9.5a5 5 0 0 0 10 0c0-2-1-3.5-2-5-.5 1.5-1.5 2.5-1.5 2.5S12 6 12 3Z" />,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18.5 14.7c1.8.8 3 2.3 3 4.3" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  chat: <path d="M21 12a8 8 0 0 1-8 8H4l2.5-2.5A8 8 0 1 1 21 12Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  heart: <path d="M12 20.5S4 15 4 9.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8c0 5.5-8 11-8 11Z" />,
  bookmark: <path d="M6.5 3.5h11V21l-5.5-4-5.5 4V3.5Z" />,
  inbox: <><path d="M3 13.5 6 5h12l3 8.5V19H3v-5.5Z" /><path d="M3 13.5h5.5a3.5 3.5 0 0 0 7 0H21" /></>,
  ticket: <><path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4V8Z" /><path d="M13.5 7.5v2m0 5v2m0-6.5v1" /></>,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 8.5 12 12m0 0 3.5-3.5M12 12v6m-3-3.5h6" /></>,
  vote: <><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="m8.5 12.5 2.5 2.5 5-5.5" /></>,
  shield: <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3m0 13v3M4.5 12h-2m19 0h-2M5.6 5.6 4 4m16 16-1.6-1.6M18.4 5.6 20 4M4 20l1.6-1.6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2m0 15v2M2.5 12h2m15 0h2M4.8 4.8l1.4 1.4m11.6 11.6 1.4 1.4M19.2 4.8l-1.4 1.4M6.2 19.2l-1.4 1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  send: <path d="M21 3 10 14m11-11-7 18-4-7-7-4 18-7Z" />,
  trash: <><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6.5 7 7.5 20.5h9L17.5 7" /><path d="M10 11v6m4-6v6" /></>,
  pen: <><path d="M14.5 4.5 19.5 9.5 8 21H3v-5L14.5 4.5Z" /><path d="m12.5 6.5 5 5" /></>,
  file: <><path d="M6 2.5h8L19.5 8v13.5h-13V2.5Z" /><path d="M13.5 2.5V8H19" /><path d="M9 12.5h6M9 16h6" /></>,
  download: <><path d="M12 3.5V15m0 0 4-4m-4 4-4-4" /><path d="M4.5 19.5h15" /></>,
  upload: <><path d="M12 14.5V3.5m0 0 4 4m-4-4-4 4" /><path d="M4.5 19.5h15" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="17.5" cy="5.5" r="2.5" /><circle cx="17.5" cy="18.5" r="2.5" /><path d="m8.2 10.8 7-4m-7 6.4 7 4" /></>,
  flag: <><path d="M5.5 21V3.5" /><path d="M5.5 4h12l-2.5 4 2.5 4h-12" /></>,
  ban: <><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></>,
  logout: <><path d="M14 4h-8v16h8" /><path d="M10 12h11m0 0-3.5-3.5M21 12l-3.5 3.5" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v6H4V5h6" /></>,
  folder: <path d="M3 6.5h6l2 2.5h10v11H3v-13.5Z" />,
  radio: <><circle cx="12" cy="12" r="2" /><path d="M8.5 8.5a5 5 0 0 0 0 7m7-7a5 5 0 0 1 0 7M5.7 5.7a9 9 0 0 0 0 12.6m12.6-12.6a9 9 0 0 1 0 12.6" /></>,
  gem: <path d="M7 3.5h10l3.5 5L12 20.5 1.5 8.5l5.5-5Z" transform="translate(1.5 0)" />,
  medal: <><circle cx="12" cy="14.5" r="5.5" /><path d="m8.5 10 -3-6.5h4L12 8l2.5-4.5h4l-3 6.5" /><path d="m12 12.5.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3.9-1.8Z" /></>,
  flower: <><circle cx="12" cy="12" r="2.5" /><path d="M12 9.5c-1-2.5 0-5 0-5s1 2.5 0 5Zm0 5c1 2.5 0 5 0 5s-1-2.5 0-5Zm-2.5-2.5c-2.5-1-5 0-5 0s2.5 1 5 0Zm5 0c2.5 1 5 0 5 0s-2.5-1-5 0Zm-5-1.5c-1.5-2 0-4.5 0-4.5s2.5 1 1 3.5" /></>,
  bot: <><rect x="4.5" y="8" width="15" height="11" rx="2.5" /><path d="M12 8V4.5m0 0h2.5M9.5 13h.01m5 0h.01" /><path d="M2.5 12v4m19-4v4" /></>,
  ghost: <path d="M5 21V11a7 7 0 0 1 14 0v10l-2.3-2-2.4 2-2.3-2-2.3 2-2.4-2L5 21Z" />,
  cloud: <path d="M7 18.5h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5a4.5 4.5 0 0 0 1 9Z" />,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 2.5 14.5 0 17-2.5-2.5-2.5-14.5 0-17Z" /></>,
  waves: <path d="M3 8.5c2 0 2.5-1.5 4.5-1.5S10 8.5 12 8.5s2.5-1.5 4.5-1.5 2.5 1.5 4.5 1.5m-18 5c2 0 2.5-1.5 4.5-1.5s2.5 1.5 4.5 1.5 2.5-1.5 4.5-1.5 2.5 1.5 4.5 1.5m-18 5c2 0 2.5-1.5 4.5-1.5s2.5 1.5 4.5 1.5 2.5-1.5 4.5-1.5 2.5 1.5 4.5 1.5" />,
  hash: <path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h16m-17 6h16" />,
  maximize: <path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5" />,
  zap: <path d="M13 3 5 13.5h6L11 21l8-10.5h-6L13 3Z" />,
  alert: <><path d="M12 3.5 22 20H2L12 3.5Z" /><path d="M12 10v4.5m0 2.5v.5" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5m0-8v.5" /></>,
  arrowLeft: <path d="M19 12H5m0 0 5-5m-5 5 5 5" />,
  arrowRight: <path d="M5 12h14m0 0-5-5m5 5-5 5" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  play: <path d="M8 5.5 19 12 8 18.5v-13Z" />,
  pause: <path d="M8 5v14m8-14v14" />,
  volume: <><path d="M4 9.5v5h4l5 4v-13l-5 4H4Z" /><path d="M16.5 9a4.5 4.5 0 0 1 0 6" /></>,
  cc: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M10.5 10.2a2.4 2.4 0 1 0 0 3.6m6.5-3.6a2.4 2.4 0 1 0 0 3.6" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7m0 3v.5" /></>,
  megaphone: <><path d="M3 11v3l4 1 1 5 3-1-1-4.5L20 19V5L7 10H3Z" /><path d="M21 10.5v4" /></>,
  card: <><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 10h19" /><path d="M6 15h4" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
  refresh: <><path d="M20 5v5h-5" /><path d="M20 10a8 8 0 1 0 2 5" transform="rotate(-25 12 12)" /></>,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Z" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  playCircle: <><circle cx="12" cy="12" r="8.5" /><path d="M10 8.5 16 12l-6 3.5v-7Z" /></>,
  crown: <path d="M4 8.5 8 12l4-6 4 6 4-3.5L18.5 19h-13L4 8.5Z" />,
  wallet: <><path d="M4 7.5h13a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5Z" /><path d="M4 7.5V6a2 2 0 0 1 2-2h9v3.5" /><circle cx="15.5" cy="13.5" r="1.2" /></>,
  pip: <><rect x="3" y="4.5" width="18" height="15" rx="2" /><rect x="12" y="12" width="7" height="5" rx="1" /></>,
};

export type IconName = keyof typeof P;

export function I({ name, size = 18, filled = false, className, style }: {
  name: IconName;
  size?: number;
  filled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, verticalAlign: '-3px', ...style }}
      aria-hidden
    >
      {P[name] || P.info}
    </svg>
  );
}
