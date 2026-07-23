import { useEffect, useRef, useState } from 'react';
import { api, type NotificationItem } from '../services/api';

type NotificationBellProps = {
  enabled: boolean;
};

const TOAST_DURATION_MS = 10000;
const POLL_INTERVAL_MS = 15000;

function formatTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

export function NotificationBell({ enabled }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const didBootstrapRef = useRef(false);

  async function loadNotifications({ showToast = true } = {}) {
    if (!enabled) return;

    try {
      setIsLoading(true);
      const result = await api.getNotifications(30);
      const nextItems = result.items;
      const newItems = nextItems.filter((item) => !knownIdsRef.current.has(item._id));

      setNotifications(nextItems);
      setUnreadCount(result.unread_count);
      nextItems.forEach((item) => knownIdsRef.current.add(item._id));

      if (showToast && didBootstrapRef.current) {
        const newestUnread = newItems.find((item) => !item.read_at);
        if (newestUnread) setToast(newestUnread);
      }

      didBootstrapRef.current = true;
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!enabled) return;

    void loadNotifications({ showToast: false });
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled]);

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  async function handleToggleOpen() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      await loadNotifications({ showToast: false });
    }
  }

  async function handleOpenNotification(item: NotificationItem) {
    if (!item.read_at) {
      await api.markNotificationAsRead(item._id).catch(() => null);
      await loadNotifications({ showToast: false });
    }

    if (item.link) {
      window.location.assign(item.link);
    }
  }

  async function handleMarkAllRead() {
    await api.markAllNotificationsAsRead().catch(() => null);
    await loadNotifications({ showToast: false });
  }

  if (!enabled) {
    return (
      <button className="icon-button relative" type="button" aria-label="Thông báo" disabled>
        <span className="material-symbols-outlined">notifications</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        className="icon-button relative"
        type="button"
        aria-label="Thông báo"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => void handleToggleOpen()}
      >
        <span className="material-symbols-outlined" style={unreadCount ? { fontVariationSettings: '"FILL" 1' } : undefined}>
          notifications
        </span>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#ffc080] px-1 font-mono text-[10px] font-bold leading-4 text-[#2c1600]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {toast && (
        <button
          className="fixed right-6 top-20 z-[80] w-[min(360px,calc(100vw-32px))] rounded-xl border border-[#ffc080]/30 bg-[#161c28]/95 p-4 text-left shadow-2xl shadow-black/35 backdrop-blur-xl"
          type="button"
          onClick={() => void handleOpenNotification(toast)}
        >
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffc080]/15 text-[#ffc080]">
              <span className="material-symbols-outlined">notifications_active</span>
            </span>
            <span>
              <span className="block text-[14px] font-bold text-[#dde2f4]">{toast.title}</span>
              <span className="mt-1 line-clamp-2 block text-[13px] leading-5 text-[#c1c6d7]">{toast.message}</span>
            </span>
          </div>
        </button>
      )}

      {isOpen && (
        <div
          className="absolute right-0 z-[70] mt-2 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl border border-white/5 bg-[#161c28]/95 shadow-2xl backdrop-blur-xl"
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div>
              <h2 className="text-[15px] font-bold text-[#dde2f4]">Thông báo</h2>
              <p className="font-mono text-[11px] text-[#8b90a0]">{unreadCount} chưa đọc</p>
            </div>
            <button className="rounded-lg px-3 py-2 font-mono text-[12px] text-[#adc7ff] hover:bg-[#242a37]" type="button" onClick={() => void handleMarkAllRead()}>
              Đánh dấu đã đọc
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto py-2">
            {isLoading && !notifications.length && (
              <p className="px-4 py-6 text-center font-mono text-[12px] text-[#8b90a0]">Đang tải thông báo...</p>
            )}

            {!isLoading && !notifications.length && (
              <div className="px-4 py-8 text-center text-[#c1c6d7]">
                <span className="material-symbols-outlined mb-2 text-[34px] text-[#8b90a0]">notifications_off</span>
                <p className="text-[14px]">Chưa có thông báo nào.</p>
              </div>
            )}

            {notifications.map((item) => (
              <button
                key={item._id}
                className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[#242a37]"
                type="button"
                role="menuitem"
                onClick={() => void handleOpenNotification(item)}
              >
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.read_at ? 'bg-[#414754]' : 'bg-[#ffc080]'}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="line-clamp-1 text-[14px] font-bold text-[#dde2f4]">{item.title}</span>
                    <span className="shrink-0 font-mono text-[11px] text-[#8b90a0]">{formatTime(item.createdAt)}</span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[13px] leading-5 text-[#c1c6d7]">{item.message}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
