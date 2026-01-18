import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { MobileBottomBar } from '@/components/landing/MobileBottomBar';
import { HeroSection } from '@/components/landing/HeroSection';
import { ConceptSection } from '@/components/landing/ConceptSection';
import { GamesSection } from '@/components/landing/GamesSection';
import { ClansSection } from '@/components/landing/ClansSection';
import { ActiveGamesSection } from '@/components/landing/ActiveGamesSection';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col">
      <LandingNavbar />
      
      <main className="flex-1">
        <HeroSection />
        <ConceptSection />
        <GamesSection />
        <ClansSection />
        <ActiveGamesSection />
      </main>

      <LandingFooter />
      <MobileBottomBar />
    </div>
  );
}
