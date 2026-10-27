import MainNav from '@/components/mainNav';
import MobileNav from '@/components/mobileNav';
import AccountControls from '@/components/accountControls';
import HeaderSearch from '@/components/headerSearch';

/** Server-renders navigation while account controls follow authentication state. */
export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-[var(--color-gold)]">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-y-2 px-4 py-2 lg:grid lg:grid-cols-3 lg:gap-x-4 lg:px-6">
        <MainNav />
        <MobileNav />
        <HeaderSearch />
        <AccountControls />
      </div>
    </header>
  );
}
