import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';

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

export default function ComingSoon() {
  const navigate = useNavigate();
  const { user, signIn, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // If user is super admin, redirect to home
  useEffect(() => {
    if (!authLoading && !roleLoading && user && isSuperAdmin) {
      navigate('/', { replace: true });
    }
  }, [user, isSuperAdmin, authLoading, roleLoading, navigate]);

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
        // The useEffect will handle redirect if super admin
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/10 overflow-hidden relative">
      {/* Floating Game Images - Left side */}
      <div className="absolute left-0 top-0 bottom-0 w-1/4 pointer-events-none overflow-hidden">
        {gameImages.map((img, index) => (
          <motion.img
            key={`game-${index}`}
            src={img}
            alt=""
            className="absolute w-16 h-16 md:w-24 md:h-24 rounded-xl opacity-40 object-cover"
            initial={{ 
              x: Math.random() * 100 - 50,
              y: `${10 + index * 18}%`,
              rotate: Math.random() * 20 - 10,
            }}
            animate={{
              x: [Math.random() * 80 - 40, Math.random() * 80 - 40, Math.random() * 80 - 40],
              y: [`${10 + index * 18}%`, `${12 + index * 18}%`, `${10 + index * 18}%`],
              rotate: [Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10],
            }}
            transition={{
              duration: 8 + index * 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Floating Clan Images - Right side */}
      <div className="absolute right-0 top-0 bottom-0 w-1/4 pointer-events-none overflow-hidden">
        {clanImages.map((img, index) => (
          <motion.img
            key={`clan-${index}`}
            src={img}
            alt=""
            className="absolute w-14 h-14 md:w-20 md:h-20 rounded-full opacity-40 object-cover right-4"
            initial={{ 
              x: Math.random() * -100 + 50,
              y: `${5 + index * 14}%`,
              rotate: Math.random() * 20 - 10,
            }}
            animate={{
              x: [Math.random() * -80 + 40, Math.random() * -80 + 40, Math.random() * -80 + 40],
              y: [`${5 + index * 14}%`, `${7 + index * 14}%`, `${5 + index * 14}%`],
              rotate: [Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10],
            }}
            transition={{
              duration: 7 + index * 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.5,
            }}
          />
        ))}
      </div>

      {/* Center Content */}
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
                <motion.span
                  key={item.value}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-2xl md:text-5xl font-bold text-primary block text-center"
                >
                  {String(item.value).padStart(2, '0')}
                </motion.span>
              </div>
              <span className="text-xs md:text-sm text-muted-foreground mt-2">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Settings/Login Button */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
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
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
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
                  Pas d'inscription disponible pour le moment.
                </p>
              </form>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>

      {/* Decorative gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
