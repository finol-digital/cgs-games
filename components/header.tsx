import MainNav from '@/components/mainNav';
import MobileNav from '@/components/mobileNav';
import AccountControls from '@/components/accountControls';

/** Server-renders navigation while account controls follow authentication state. */
export default function Header() {
  return (
    <header className="bg-[var(--color-gold)] sticky top-0 w-full border-b">
      <div className="h-16 container flex items-center">
        <MainNav />
        <MobileNav />
        <AccountControls />
      </div>
    </header>
  );
}
