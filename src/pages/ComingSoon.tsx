import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, LogIn, Loader2, UserPlus, Eye, EyeOff, BookOpen, Lock, Sparkles, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useEarlyAccessRequests } from '@/hooks/useEarlyAccessRequests';
import { useMeetupEvents } from '@/hooks/useMeetupEvents';
import { toast } from '@/hooks/use-toast';
import { RivieresRulesOverlay } from '@/components/rivieres/rules/RivieresRulesOverlay';
import { ForetRulesOverlay } from '@/components/foret/rules/ForetRulesOverlay';
import { InfectionRulesOverlay } from '@/components/infection/rules/InfectionRulesOverlay';
import { ComingSoonEventCard } from '@/components/meetup/ComingSoonEventCard';

// Import logo
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

// Import game images
import foretImg from '@/assets/games/foret-ndogmoabeng.png';
import infectionImg from '@/assets/games/infection-ndogmoabeng.png';
import lionImg from '@/assets/games/lion-ndogmoabeng.png';
import rivieresImg from '@/assets/games/rivieres-ndogmoabeng.png';
import villageImg from '@/assets/games/village-ndogmoabeng.png';

// Import clan images
import akandeImg from '@/assets/clans/akande.png';
import aseyraImg from '@/assets/clans/cercle-aseyra.png';
import ezkarImg from '@/assets/clans/ezkar.png';
import zoulouImg from '@/assets/clans/fraternite-zoulous.png';
import keryndesImg from '@/assets/clans/maison-keryndes.png';
import royaleImg from '@/assets/clans/maison-royale.png';
import akilaImg from '@/assets/clans/sources-akila.png';

const gameImages = [foretImg, infectionImg, lionImg, rivieresImg, villageImg];
const clanImages = [akandeImg, aseyraImg, ezkarImg, zoulouImg, keryndesImg, royaleImg, akilaImg];

// Launch date: Saturday, January 31, 2026 at 5 PM (Paris timezone)
const LAUNCH_DATE = new Date('2026-01-31T17:00:00+01:00');

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(): TimeLeft {
  const difference = LAUNCH_DATE.getTime() - new Date().getTime();
  
  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

// Generate well-distributed positions using grid-based placement
function generateFloatingPositions(count: number, seed: number, isGameImages: boolean) {
  const positions = [];
  
  // Create a grid to ensure even distribution
  const cols = isGameImages ? 3 : 4; // Different grid for games vs clans
  const rows = Math.ceil(count / cols);
  
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    // Calculate base position in grid cell
    const cellWidth = 100 / cols;
    const cellHeight = 100 / rows;
    
    // Add some variance within the cell using deterministic pseudo-random
    const hash = (i * 2654435761 + seed) % 1000;
    const variance = 0.3; // 30% variance within cell
    
    const baseX = col * cellWidth + cellWidth / 2;
    const baseY = row * cellHeight + cellHeight / 2;
    
    // Offset within cell
    const offsetX = ((hash % 100) / 100 - 0.5) * cellWidth * variance;
    const offsetY = (((hash * 7) % 100) / 100 - 0.5) * cellHeight * variance;
    
    positions.push({
      startX: Math.max(5, Math.min(95, baseX + offsetX)),
      startY: Math.max(5, Math.min(95, baseY + offsetY)),
      rotation: ((hash * 3) % 40) - 20,
      duration: 20 + (hash % 15), // 20-35 seconds for slower, smoother movement
      delay: (i * 0.5),
      // Random travel distances (can go across entire screen)
      travelX: ((hash * 11) % 60) - 30, // -30 to +30 vw travel
      travelY: ((hash * 13) % 40) - 20, // -20 to +20 vh travel
    });
  }
  return positions;
}

export default function ComingSoon() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, signIn, loading: authLoading } = useAuth();
  const { submitRequest } = useEarlyAccessRequests();
  const { events, refetch: refetchEvents } = useMeetupEvents();
  
  // Get the first upcoming event
  const nextEvent = events.length > 0 ? events[0] : null;
  
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  
  // Early access form state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Rules overlays state
  const [rivieresRulesOpen, setRivieresRulesOpen] = useState(false);
  const [foretRulesOpen, setForetRulesOpen] = useState(false);
  const [infectionRulesOpen, setInfectionRulesOpen] = useState(false);

  // Generate stable positions once on mount
  const gamePositions = useMemo(() => generateFloatingPositions(gameImages.length, 12345, true), []);
  const clanPositions = useMemo(() => generateFloatingPositions(clanImages.length, 67890, false), []);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // If user is authenticated, redirect to home
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          title: "Erreur de connexion",
          description: error.message || "Identifiants incorrects",
          variant: "destructive",
        });
      } else {
        setLoginOpen(false);
        toast({
          title: "Connexion réussie",
          description: "Bienvenue !",
        });
        // The useEffect will handle redirect
      }
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite",
        variant: "destructive",
      });
    } finally {
      setLoggingIn(false);
    }
  };

  const handleRegisterRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const result = await submitRequest({
      full_name: registerName,
      email: registerEmail,
      phone: registerPhone || undefined,
      message: registerMessage || undefined,
    });

    setSubmitting(false);

    if (result.success) {
      setRegisterOpen(false);
      setRegisterName('');
      setRegisterEmail('');
      setRegisterPhone('');
      setRegisterMessage('');
      toast({
        title: "Demande envoyée !",
        description: "Nous vous contacterons bientôt pour valider votre accès.",
      });
    } else {
      toast({
        title: "Erreur",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {/* Rules Overlays */}
      <RivieresRulesOverlay 
        open={rivieresRulesOpen} 
        onClose={() => setRivieresRulesOpen(false)}
        defaultMode="QUICK"
      />
      <ForetRulesOverlay 
        open={foretRulesOpen} 
        onClose={() => setForetRulesOpen(false)}
        userRole="PLAYER"
        defaultMode="QUICK"
      />
      <InfectionRulesOverlay 
        open={infectionRulesOpen} 
        onClose={() => setInfectionRulesOpen(false)}
        userRole="PLAYER"
        defaultMode="QUICK"
      />

    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/10 overflow-hidden relative">
      {/* Theme Toggle - Fixed position */}
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="fixed top-4 right-4 z-50 p-2 rounded-full bg-card/80 backdrop-blur-sm border border-primary/30 hover:border-primary transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-primary" />
        ) : (
          <Moon className="w-5 h-5 text-primary" />
        )}
      </motion.button>
      {/* Floating Images - Full page background (z-index 0) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Game Images floating across entire page */}
        {gameImages.map((img, index) => {
          const pos = gamePositions[index];
          return (
            <motion.img
              key={`game-${index}`}
              src={img}
              alt=""
              className="absolute w-20 h-20 md:w-28 md:h-28 rounded-xl opacity-30 object-cover"
              style={{
                left: `${pos.startX}%`,
                top: `${pos.startY}%`,
                transform: 'translate(-50%, -50%)',
              }}
              animate={{
                x: [`0vw`, `${pos.travelX}vw`, `${-pos.travelX * 0.5}vw`, `${pos.travelX * 0.3}vw`, `0vw`],
                y: [`0vh`, `${pos.travelY}vh`, `${-pos.travelY * 0.7}vh`, `${pos.travelY * 0.4}vh`, `0vh`],
                rotate: [pos.rotation, pos.rotation + 8, pos.rotation - 8, pos.rotation + 4, pos.rotation],
              }}
              transition={{
                duration: pos.duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: pos.delay,
              }}
            />
          );
        })}

        {/* Clan Images floating across entire page */}
        {clanImages.map((img, index) => {
          const pos = clanPositions[index];
          return (
            <motion.img
              key={`clan-${index}`}
              src={img}
              alt=""
              className="absolute w-16 h-16 md:w-24 md:h-24 rounded-full opacity-25 object-cover"
              style={{
                left: `${pos.startX}%`,
                top: `${pos.startY}%`,
                transform: 'translate(-50%, -50%)',
              }}
              animate={{
                x: [`0vw`, `${-pos.travelX}vw`, `${pos.travelX * 0.6}vw`, `${-pos.travelX * 0.3}vw`, `0vw`],
                y: [`0vh`, `${-pos.travelY}vh`, `${pos.travelY * 0.8}vh`, `${-pos.travelY * 0.5}vh`, `0vh`],
                rotate: [pos.rotation, pos.rotation - 10, pos.rotation + 10, pos.rotation - 5, pos.rotation],
              }}
              transition={{
                duration: pos.duration + 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: pos.delay + 0.5,
              }}
            />
          );
        })}
      </div>

      {/* Center Content - z-index 10 to be above floating images */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Animated Logo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8"
        >
          <motion.img
            src={logoNdogmoabeng}
            alt="Ndogmoabeng"
            className="w-32 h-32 md:w-48 md:h-48 drop-shadow-2xl"
            animate={{
              scale: [1, 1.05, 1],
              rotate: [0, 2, -2, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>

        {/* Message */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-2xl md:text-4xl font-bold text-center mb-8 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent"
        >
          L'accès au village sera bientôt possible...
        </motion.h1>

        {/* Countdown */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="grid grid-cols-4 gap-4 md:gap-8 mb-12"
        >
          {[
            { value: timeLeft.days, label: 'Jours' },
            { value: timeLeft.hours, label: 'Heures' },
            { value: timeLeft.minutes, label: 'Minutes' },
            { value: timeLeft.seconds, label: 'Secondes' },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              className="flex flex-col items-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7 + index * 0.1, type: "spring" }}
            >
              <div className="bg-card/80 backdrop-blur-sm border border-primary/30 rounded-xl p-3 md:p-6 min-w-[60px] md:min-w-[100px]">
                <span className="text-2xl md:text-5xl font-bold text-primary block text-center">
                  {String(item.value).padStart(2, '0')}
                </span>
              </div>
              <span className="text-xs md:text-sm text-muted-foreground mt-2">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Action Buttons - Right after countdown */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 mb-12"
        >
          {/* Early Access Request Button */}
          <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="w-4 h-4" />
                Demander un accès anticipé
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Demande d'inscription anticipée
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRegisterRequest} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Nom complet *</Label>
                  <Input
                    id="register-name"
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Votre nom"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email *</Label>
                  <Input
                    id="register-email"
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-phone">Téléphone</Label>
                  <Input
                    id="register-phone"
                    type="tel"
                    value={registerPhone}
                    onChange={(e) => setRegisterPhone(e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-message">Message (optionnel)</Label>
                  <Textarea
                    id="register-message"
                    value={registerMessage}
                    onChange={(e) => setRegisterMessage(e.target.value)}
                    placeholder="Dites-nous pourquoi vous souhaitez rejoindre le village..."
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    'Envoyer ma demande'
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Nous examinerons votre demande et vous contacterons par email.
                </p>
              </form>
            </DialogContent>
          </Dialog>

          {/* Login Button */}
          <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Settings className="w-4 h-4" />
                Accès réservé
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <LogIn className="w-5 h-5" />
                  Connexion
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loggingIn}>
                  {loggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Réservé aux membres ayant déjà un compte.
                </p>
              </form>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Game Rules Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="mb-12 w-full max-w-2xl"
        >
          <h2 className="text-lg md:text-xl font-semibold text-center mb-4 text-foreground">
            📖 Découvrez les règles des jeux
          </h2>
          
          {/* Available Games */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Button 
              variant="outline" 
              className="flex flex-col items-center gap-2 h-auto py-3 bg-card/60 backdrop-blur-sm border-primary/30 hover:border-primary hover:bg-primary/10"
              onClick={() => setRivieresRulesOpen(true)}
            >
              <BookOpen className="w-5 h-5 text-blue-400" />
              <span className="text-xs md:text-sm">Rivières</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col items-center gap-2 h-auto py-3 bg-card/60 backdrop-blur-sm border-primary/30 hover:border-primary hover:bg-primary/10"
              onClick={() => setForetRulesOpen(true)}
            >
              <BookOpen className="w-5 h-5 text-green-400" />
              <span className="text-xs md:text-sm">Forêt</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col items-center gap-2 h-auto py-3 bg-card/60 backdrop-blur-sm border-primary/30 hover:border-primary hover:bg-primary/10"
              onClick={() => setInfectionRulesOpen(true)}
            >
              <BookOpen className="w-5 h-5 text-red-400" />
              <span className="text-xs md:text-sm">Infection</span>
            </Button>
          </div>

          {/* Locked Games */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-2 py-3 px-4 rounded-lg bg-muted/40 backdrop-blur-sm border border-muted-foreground/20">
              <Lock className="w-5 h-5 text-amber-500" />
              <span className="text-xs md:text-sm text-muted-foreground">Sheriff</span>
              <span className="text-[10px] md:text-xs text-center text-muted-foreground/70">À découvrir lors de l'événement</span>
            </div>
            <div className="flex flex-col items-center gap-2 py-3 px-4 rounded-lg bg-muted/40 backdrop-blur-sm border border-muted-foreground/20">
              <Lock className="w-5 h-5 text-rose-400" />
              <span className="text-xs md:text-sm text-muted-foreground">Le CŒUR du Lion</span>
              <span className="text-[10px] md:text-xs text-center text-muted-foreground/70">La carte trouvée...</span>
            </div>
          </div>
        </motion.div>

        {/* Next Event Section - Last */}
        {nextEvent && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="mb-12 w-full max-w-2xl"
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Prochain événement</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Inscris-toi dès maintenant pour réserver ta place !
              </p>
            </div>
            
            <ComingSoonEventCard 
              event={nextEvent} 
              onRegistrationSuccess={refetchEvents}
            />
          </motion.div>
        )}

      </div>

      {/* Decorative gradient orbs - z-index 5 between floating images and content */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none z-5" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl pointer-events-none z-5" />
    </div>
    </>
  );
}