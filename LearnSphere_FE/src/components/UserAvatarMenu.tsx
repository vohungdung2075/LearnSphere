import { useEffect, useRef, useState } from 'react';
import { clearSession } from '../services/api';

type UserAvatarMenuProps = {
  name: string;
  role: string;
  avatarSrc: string;
};

const menuItems = [
  { icon: 'person', label: 'Thông tin cá nhân', href: '/profile' },
  { icon: 'settings', label: 'Cài đặt', href: '#' },
];

export function UserAvatarMenu({ name, role, avatarSrc }: UserAvatarMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="flex items-center gap-3 border-l border-[#414754]/70 pl-3 text-left sm:pl-4"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="hidden text-right sm:block">
          <span className="block text-[14px] leading-tight text-[#dde2f4]">{name}</span>
          <span className="block text-[12px] text-[#8b90a0]">{role}</span>
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#adc7ff]/20 bg-[#242a37] text-[13px] font-bold text-[#adc7ff] shadow-lg shadow-black/20 transition-colors hover:border-[#adc7ff]/60">
          {avatarSrc ? (
            <img
              className="h-full w-full object-cover"
              src={avatarSrc}
              alt={name}
            />
          ) : (
            initials || 'LS'
          )}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-[70] mt-2 w-56 overflow-hidden rounded-xl border border-white/5 bg-[#161c28]/95 py-2 shadow-2xl backdrop-blur-xl"
          role="menu"
        >
          {menuItems.map((item) => (
            <a
              key={item.label}
              className="flex items-center px-4 py-2.5 text-[14px] text-[#dde2f4] transition-colors hover:bg-[#2f3542]"
              href={item.href}
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <span className="material-symbols-outlined mr-2 text-[20px]">{item.icon}</span>
              {item.label}
            </a>
          ))}
          <div className="my-1 border-t border-white/5" />
          <a
            className="flex items-center px-4 py-2.5 text-[14px] text-[#ffb4ab] transition-colors hover:bg-[#2f3542]"
            href="/login"
            role="menuitem"
            onClick={() => {
              clearSession();
              setIsOpen(false);
            }}
          >
            <span className="material-symbols-outlined mr-2 text-[20px]">logout</span>
            Đăng xuất
          </a>
        </div>
      )}
    </div>
  );
}
