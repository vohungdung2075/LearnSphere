import { useEffect } from 'react';

type AppToastProps = {
  message: string;
  tone?: 'success' | 'warning' | 'error' | 'loading';
  onClose?: () => void;
  durationMs?: number;
};

export function AppToast({ message, tone = 'warning', onClose, durationMs = 4000 }: AppToastProps) {
  useEffect(() => {
    if (!message || tone === 'loading' || !onClose) return;

    const timeoutId = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [durationMs, message, onClose, tone]);

  if (!message) return null;

  const toneClass = {
    success: 'border-[#24dfba]/30 text-[#24dfba]',
    warning: 'border-[#ffc080]/30 text-[#ffc080]',
    error: 'border-[#ffb4ab]/30 text-[#ffb4ab]',
    loading: 'border-[#adc7ff]/30 text-[#adc7ff]',
  }[tone];
  const icon = tone === 'loading' ? 'progress_activity' : tone === 'error' ? 'error' : tone === 'success' ? 'check_circle' : 'info';

  return (
    <div className={`fixed right-4 top-20 z-[90] flex w-[min(420px,calc(100vw-32px))] items-start gap-3 rounded-xl border bg-[#161c28]/95 px-4 py-3 shadow-2xl shadow-black/35 backdrop-blur-xl ${toneClass}`}>
      <span className={`material-symbols-outlined mt-0.5 text-[20px] ${tone === 'loading' ? 'animate-spin' : ''}`}>{icon}</span>
      <p className="text-[14px] font-semibold leading-6">{message}</p>
      {onClose && tone !== 'loading' && (
        <button className="ml-auto text-current opacity-70 hover:opacity-100" type="button" aria-label="Đóng thông báo" onClick={onClose}>
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      )}
    </div>
  );
}
