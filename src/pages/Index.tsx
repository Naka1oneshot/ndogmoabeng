import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { MobileBottomBar } from '@/components/landing/MobileBottomBar';
import { HeroSection } from '@/components/landing/HeroSection';
import { ConceptSection } from '@/components/landing/ConceptSection';
import { GamesSection } from '@/components/landing/GamesSection';
import { ClansSection } from '@/components/landing/ClansSection';
import { ActiveGamesSection } from '@/components/landing/ActiveGamesSection';
import { MeetupSection } from '@/components/landing/MeetupSection';
import { ShopPreviewSection } from '@/components/landing/ShopPreviewSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { useMeetupPaymentCallback } from '@/hooks/useMeetupPayment';
import { HomeSEO } from '@/components/seo/SEOHead';

export default function Index() {
  // Check for payment callback from Stripe
  useMeetupPaymentCallback();

  return (
    <>
      <HomeSEO />
      <div className="min-h-screen flex flex-col">
        <LandingNavbar />
        
        <main className="flex-1">
          <HeroSection />
          <ConceptSection />
          <GamesSection />
          <ClansSection />
          <ShopPreviewSection />
          <MeetupSection />
          <ActiveGamesSection />
        </main>

        <LandingFooter />
        <MobileBottomBar />
      </div>
    </>
  );
}
