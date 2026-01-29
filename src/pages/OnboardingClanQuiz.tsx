import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ClanAffinityQuiz } from '@/components/clanAffinityQuiz/ClanAffinityQuiz';
import { Loader2 } from 'lucide-react';

export default function OnboardingClanQuiz() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  useEffect(() => {
    const checkQuizStatus = async () => {
      if (authLoading) return;

      if (!user) {
        navigate('/login', { replace: true });
        return;
      }

      // Check if user already completed the quiz
      const { data: profile } = await supabase
        .from('profiles')
        .select('clan_affinity_completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.clan_affinity_completed_at) {
        setAlreadyCompleted(true);
        navigate('/profile', { replace: true });
        return;
      }

      setChecking(false);
    };

    checkQuizStatus();
  }, [user, authLoading, navigate]);

  const handleClose = () => {
    navigate('/profile', { replace: true });
  };

  const handleCompleted = () => {
    navigate('/profile', { replace: true });
  };

  if (authLoading || checking || alreadyCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ClanAffinityQuiz
      mode="onboarding"
      onClose={handleClose}
      onCompleted={handleCompleted}
    />
  );
}
