import { getRoleNav, type NavItem } from '../lib/roleAccess';
import type { User } from '../services/api';

type RoleSidebarProps = {
  activePath?: string;
  items?: NavItem[];
  user?: User | null;
};

export function RoleSidebar({ activePath = window.location.pathname, items, user }: RoleSidebarProps) {
  const navItems = items ?? getRoleNav(user);

  return (
    <aside className="fixed bottom-0 left-0 top-16 z-40 hidden w-64 flex-col border-r border-white/5 bg-[#1a202c]/95 px-3 py-6 shadow-2xl shadow-black/20 backdrop-blur-xl md:flex">
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <a
            key={item.href}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all active:scale-95 ${
              item.href === activePath
                ? 'active-nav-glow bg-[#242a37] font-bold text-[#ffc080]'
                : 'text-[#c1c6d7] hover:translate-x-1 hover:bg-[#242a37] hover:text-[#dde2f4]'
            }`}
            href={item.href}
          >
            <span className="material-symbols-outlined text-[22px]" style={item.href === activePath ? { fontVariationSettings: '"FILL" 1' } : undefined}>{item.icon}</span>
            <span className="text-[14px] font-medium">{item.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}
