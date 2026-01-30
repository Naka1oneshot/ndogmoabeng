import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, RotateCcw, Trophy, ListChecks, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  BANK_QUESTIONS,
  TIEBREAK_1,
  TIEBREAK_2,
  CLAN_MAP,
  CLAN_CODES,
  CLAN_IMAGES,
  CLAN_UI_COLORS,
  NEUTRAL_COLORS,
  type ClanCode,
  type QuizQuestion,
  type QuizOption,
} from './quizData';
import {
  createSeededRandom,
  seededShuffle,
  generateQuizSeed,
} from './seededRandom';

interface ClanAffinityQuizProps {
  mode: 'onboarding' | 'profile';
  onClose?: () => void;
  onCompleted?: () => void;
  existingSeed?: string | null;
  /** Si true, le quiz a déjà été complété (mode profile refaire le test) */
  isRetake?: boolean;
}

interface Answer {
  questionId: number;
  pickedClanCode: ClanCode;
  pickedText: string;
}

type QuizPhase = 'questions' | 'tiebreak1' | 'tiebreak2' | 'results';

export function ClanAffinityQuiz({ mode, onClose, onCompleted, existingSeed, isRetake = false }: ClanAffinityQuizProps) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [tieBreakAnswers, setTieBreakAnswers] = useState<Answer[]>([]);
  const [phase, setPhase] = useState<QuizPhase>('questions');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Ref pour éviter double sauvegarde automatique
  const autoSaveTriggeredRef = useRef(false);

  // Generate deterministic seed
  const seed = useMemo(() => {
    if (existingSeed) return existingSeed;
    if (!user) return 'anonymous:CLAN_QUIZ_V1';
    return generateQuizSeed(user.id);
  }, [user, existingSeed]);

  // Select and shuffle 10 questions deterministically
  const selectedQuestions = useMemo(() => {
    const randFn = createSeededRandom(seed);
    const shuffled = seededShuffle(BANK_QUESTIONS, randFn);
    const picked = shuffled.slice(0, 10);
    // Sort by ID for canonical order
    return picked.sort((a, b) => a.id - b.id);
  }, [seed]);

  // Shuffle options for each question deterministically
  const getShuffledOptions = useCallback((question: QuizQuestion): QuizOption[] => {
    const randFn = createSeededRandom(`${seed}:Q${question.id}`);
    return seededShuffle(question.options, randFn);
  }, [seed]);

  // Calculate scores from answers
  const calculateScores = useCallback((allAnswers: Answer[]): Record<ClanCode, number> => {
    const scores: Record<ClanCode, number> = {
      ROY: 0, ZOU: 0, KER: 0, AKA: 0, ASE: 0, AKI: 0, EZK: 0,
    };
    allAnswers.forEach((a) => {
      scores[a.pickedClanCode]++;
    });
    return scores;
  }, []);

  // Get current dominant clan (for theming)
  const currentScores = useMemo(() => calculateScores([...answers, ...tieBreakAnswers]), [answers, tieBreakAnswers, calculateScores]);
  
  const dominantClan = useMemo((): ClanCode | null => {
    const maxScore = Math.max(...Object.values(currentScores));
    if (maxScore === 0) return null;
    const topClans = CLAN_CODES.filter((c) => currentScores[c] === maxScore);
    return topClans.length === 1 ? topClans[0] : null;
  }, [currentScores]);

  // Get tied clans at top
  const getTopTiedClans = useCallback((scores: Record<ClanCode, number>): ClanCode[] => {
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return [];
    return CLAN_CODES.filter((c) => scores[c] === maxScore);
  }, []);

  // Current question based on phase
  const currentQuestion = useMemo(() => {
    if (phase === 'questions') {
      return selectedQuestions[currentIndex];
    } else if (phase === 'tiebreak1') {
      return TIEBREAK_1;
    } else if (phase === 'tiebreak2') {
      return TIEBREAK_2;
    }
    return null;
  }, [phase, currentIndex, selectedQuestions]);

  // Current UI colors
  const uiColors = dominantClan ? CLAN_UI_COLORS[dominantClan] : NEUTRAL_COLORS;
  const bgGradient = dominantClan ? CLAN_MAP[dominantClan].bgGradient : 'from-slate-500/10 via-slate-600/5 to-slate-700/5';

  // Handle answer selection
  const handleAnswer = useCallback(async (option: QuizOption) => {
    const answer: Answer = {
      questionId: currentQuestion!.id,
      pickedClanCode: option.clanCode,
      pickedText: option.text,
    };

    if (phase === 'questions') {
      const newAnswers = [...answers, answer];
      setAnswers(newAnswers);

      if (currentIndex < selectedQuestions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // End of main questions - check for tie
        const scores = calculateScores(newAnswers);
        const topTied = getTopTiedClans(scores);
        if (topTied.length > 1) {
          setPhase('tiebreak1');
        } else {
          setPhase('results');
        }
      }
    } else if (phase === 'tiebreak1') {
      const newTieBreak = [...tieBreakAnswers, answer];
      setTieBreakAnswers(newTieBreak);
      
      const scores = calculateScores([...answers, ...newTieBreak]);
      const topTied = getTopTiedClans(scores);
      if (topTied.length > 1) {
        setPhase('tiebreak2');
      } else {
        setPhase('results');
      }
    } else if (phase === 'tiebreak2') {
      setTieBreakAnswers([...tieBreakAnswers, answer]);
      setPhase('results');
    }
  }, [phase, currentIndex, answers, tieBreakAnswers, selectedQuestions, currentQuestion, calculateScores, getTopTiedClans]);

  // Final scores and winner
  const finalScores = useMemo(() => calculateScores([...answers, ...tieBreakAnswers]), [answers, tieBreakAnswers, calculateScores]);
  
  const winnerClan = useMemo((): ClanCode => {
    const topTied = getTopTiedClans(finalScores);
    // If still tied after tie-breaks, pick first alphabetically
    return topTied.sort()[0] || 'ROY';
  }, [finalScores, getTopTiedClans]);

  // Save results to database
  const saveResults = useCallback(async () => {
    if (!user || saving || saved) return;
    setSaving(true);

    const clanInfo = CLAN_MAP[winnerClan];
    const details = {
      version: 1,
      seed,
      selectedQuestionIds: selectedQuestions.map((q) => q.id),
      answers: answers.map((a) => ({
        questionId: a.questionId,
        pickedClanCode: a.pickedClanCode,
        pickedText: a.pickedText,
      })),
      tieBreakUsed: tieBreakAnswers.map((a) => ({
        questionId: a.questionId,
        pickedClanCode: a.pickedClanCode,
        pickedText: a.pickedText,
      })),
    };

    const { error } = await supabase
      .from('profiles')
      .update({
        clan_affinity_id: clanInfo.id,
        clan_affinity_scores: finalScores,
        clan_affinity_details: details,
        clan_affinity_completed_at: new Date().toISOString(),
        clan_affinity_quiz_version: 1,
        clan_affinity_seed: seed,
      })
      .eq('user_id', user.id);

    setSaving(false);

    if (error) {
      console.error('Error saving quiz results:', error);
      toast.error('Erreur lors de la sauvegarde');
    } else {
      setSaved(true);
      toast.success('Résultats enregistrés !');
      onCompleted?.();
    }
  }, [user, winnerClan, seed, selectedQuestions, answers, tieBreakAnswers, finalScores, onCompleted, saving, saved]);

  // Auto-save pour le premier test (pas un refaire)
  // Sauvegarde automatiquement quand on atteint la phase résultats
  useEffect(() => {
    if (phase === 'results' && !isRetake && !autoSaveTriggeredRef.current && user) {
      autoSaveTriggeredRef.current = true;
      saveResults();
    }
  }, [phase, isRetake, user, saveResults]);

  // Progress calculation
  const progressPercent = phase === 'questions' 
    ? ((currentIndex + 1) / selectedQuestions.length) * 100
    : phase === 'tiebreak1' ? 90 
    : phase === 'tiebreak2' ? 95 
    : 100;

  const progressLabel = phase === 'questions'
    ? `${currentIndex + 1}/${selectedQuestions.length}`
    : phase === 'tiebreak1' ? 'Départage 1'
    : phase === 'tiebreak2' ? 'Départage 2'
    : 'Résultats';

  // Render question phase
  if (phase !== 'results' && currentQuestion) {
    const shuffledOptions = getShuffledOptions(currentQuestion);

    return (
      <motion.div
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-gradient-to-br",
          bgGradient,
          "bg-background"
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Sparkles className={cn("w-6 h-6", uiColors.text)} />
            <span className="font-semibold">Test d'affinité aux clans</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{progressLabel}</span>
            {mode === 'onboarding' && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Passer
              </Button>
            )}
            {mode === 'profile' && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-2">
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Question content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto"
            >
              {/* Question text */}
              <h2 className="text-xl md:text-2xl font-bold text-center mb-8">
                {currentQuestion.text}
              </h2>

              {/* Options */}
              <div className="space-y-3">
                {shuffledOptions.map((option, idx) => (
                  <motion.button
                    key={`${option.clanCode}-${idx}`}
                    onClick={() => handleAnswer(option)}
                    className={cn(
                      "w-full p-4 rounded-lg border text-left transition-all",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      "bg-card/80 backdrop-blur-sm",
                      "border-border hover:border-primary/50",
                      "hover:shadow-lg"
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-sm md:text-base">{option.text}</span>
                  </motion.button>
                ))}
              </div>

              {/* Tiebreak indicator */}
              {(phase === 'tiebreak1' || phase === 'tiebreak2') && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center"
                >
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Égalité détectée ! Question départage pour déterminer ton clan.
                  </p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  // Results phase
  const winnerInfo = CLAN_MAP[winnerClan];
  const winnerColors = CLAN_UI_COLORS[winnerClan];

  return (
    <motion.div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-gradient-to-br",
        winnerInfo.bgGradient,
        "bg-background overflow-auto"
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Trophy className={cn("w-6 h-6", winnerColors.text)} />
          <span className="font-semibold">Résultats</span>
        </div>
        {mode === 'profile' && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 p-4 md:p-8 space-y-6 max-w-2xl mx-auto w-full">
        {/* Winner card */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
        >
          <Card className={cn("border-2", winnerColors.border)}>
            <CardContent className="p-6 text-center">
              <motion.img
                src={CLAN_IMAGES[winnerClan]}
                alt={winnerInfo.label}
                className="w-32 h-32 mx-auto mb-4 object-contain"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              />
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-muted-foreground mb-2">Ton clan dominant est</p>
                <h2 className={cn("text-3xl font-bold mb-4", winnerColors.text)}>
                  {winnerInfo.label}
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {winnerInfo.interpretation}
                </p>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Scores */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="w-4 h-4" />
                Tableau des scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CLAN_CODES.map((code) => (
                  <div
                    key={code}
                    className={cn(
                      "p-2 rounded-lg text-center",
                      code === winnerClan ? CLAN_UI_COLORS[code].secondary : "bg-muted/50"
                    )}
                  >
                    <div className={cn("font-bold text-lg", code === winnerClan && CLAN_UI_COLORS[code].text)}>
                      {finalScores[code]}
                    </div>
                    <div className="text-xs text-muted-foreground">{CLAN_MAP[code].label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Details collapsible */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ChevronRight className={cn("w-4 h-4 transition-transform", detailsOpen && "rotate-90")} />
                      Détail des réponses
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {answers.length + tieBreakAnswers.length} réponses
                    </span>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {answers.map((a, idx) => {
                      const q = selectedQuestions.find((q) => q.id === a.questionId);
                      return (
                        <div key={a.questionId} className="text-sm p-2 bg-muted/30 rounded">
                          <span className="text-muted-foreground">Q{idx + 1}:</span>{' '}
                          <span className="font-medium">{a.pickedText}</span>{' '}
                          <span className={cn("text-xs", CLAN_UI_COLORS[a.pickedClanCode].text)}>
                            → {CLAN_MAP[a.pickedClanCode].label} (+1)
                          </span>
                        </div>
                      );
                    })}
                    {tieBreakAnswers.map((a, idx) => (
                      <div key={`tb-${a.questionId}`} className="text-sm p-2 bg-amber-500/10 rounded border border-amber-500/20">
                        <span className="text-amber-600 dark:text-amber-400">Départage {idx + 1}:</span>{' '}
                        <span className="font-medium">{a.pickedText}</span>{' '}
                        <span className={cn("text-xs", CLAN_UI_COLORS[a.pickedClanCode].text)}>
                          → {CLAN_MAP[a.pickedClanCode].label} (+1)
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-3 pb-8"
        >
          <Button
            onClick={saveResults}
            disabled={saving || saved}
            className={cn("flex-1", winnerColors.buttonBg, winnerColors.buttonText)}
          >
            {saving ? 'Enregistrement...' : saved ? '✓ Enregistré' : 'Enregistrer mon résultat'}
          </Button>
          {mode === 'profile' && (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Fermer
            </Button>
          )}
          {mode === 'onboarding' && (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Continuer vers le profil
            </Button>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
