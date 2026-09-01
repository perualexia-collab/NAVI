import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(children: React.ReactNode, props: IconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Briefcase: (p: IconProps) => base(<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M2 13h20" /></>, p),
  Building: (p: IconProps) => base(<><rect x="4" y="2" width="16" height="20" rx="1" /><path d="M9 22v-4h6v4M9 6h1M14 6h1M9 10h1M14 10h1M9 14h1M14 14h1" /></>, p),
  Activity: (p: IconProps) => base(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />, p),
  AlertTriangle: (p: IconProps) => base(<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" /></>, p),
  Eye: (p: IconProps) => base(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></>, p),
  Star: (p: IconProps) => base(<path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />, p),
  Clock: (p: IconProps) => base(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>, p),
  Search: (p: IconProps) => base(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>, p),
  ChevronRight: (p: IconProps) => base(<path d="M9 18l6-6-6-6" />, p),
  Sparkles: (p: IconProps) => base(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />, p),
  Send: (p: IconProps) => base(<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />, p),
  ThumbsUp: (p: IconProps) => base(<path d="M7 10v12M2 10h3.5c1 0 1.5-.5 2-1l4.5-7c.5-1 2-1 2.5 0 .3.6.3 1.3 0 2l-1.5 4H19a2 2 0 0 1 2 2.3l-1.3 7A3 3 0 0 1 16.8 22H7" />, p),
  ThumbsDown: (p: IconProps) => base(<path d="M17 14V2M22 14h-3.5c-1 0-1.5.5-2 1l-4.5 7c-.5 1-2 1-2.5 0-.3-.6-.3-1.3 0-2l1.5-4H5a2 2 0 0 1-2-2.3l1.3-7A3 3 0 0 1 7.2 2H17" />, p),
  Trophy: (p: IconProps) => base(<><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4" /></>, p),
  Info: (p: IconProps) => base(<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>, p),
  RefreshCw: (p: IconProps) => base(<path d="M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 15-3.5L23 10M1 14l4.5 4.5A9 9 0 0 0 20.5 15" />, p),
  Play: (p: IconProps) => base(<path d="M5 3l16 9-16 9V3z" />, p),
  Plus: (p: IconProps) => base(<path d="M12 5v14M5 12h14" />, p),
  Wallet: (p: IconProps) => base(<><path d="M20 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v3" /><path d="M20 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6" /><path d="M17 15h.01" /></>, p),
  Mail: (p: IconProps) => base(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></>, p),
  Lock: (p: IconProps) => base(<><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, p),
  Leaf: (p: IconProps) => base(<><path d="M11 20A7 7 0 0 1 4 13c0-6 5-10 12-11 0 7-1 12-5 18Z" /><path d="M4 13c3 0 5-1 7-3" /></>, p),
  MoreVertical: (p: IconProps) => base(<><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>, p),
  Home: (p: IconProps) => base(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9.5 20v-6h5v6" /></>, p),
  HeartPulse: (p: IconProps) =>
    base(
      <>
        <path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.53L12 21.35Z" />
        <path d="M4.5 12h2.7l1.4 2.6 2.6-6 1.6 3.4h5" />
      </>,
      p
    ),
  Settings: (p: IconProps) => base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>, p),
  X: (p: IconProps) => base(<path d="M18 6 6 18M6 6l12 12" />, p),
  Check: (p: IconProps) => base(<path d="M20 6 9 17l-5-5" />, p)
};
