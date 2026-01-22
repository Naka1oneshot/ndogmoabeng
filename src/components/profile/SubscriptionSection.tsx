import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  SUBSCRIPTION_TIERS, 
  TOKEN_NDOGMOABENG, 
  formatLimitValue, 
  getTierDisplayName, 
  getTierBadgeVariant,
  formatChatAccess,
  formatGamesCreatable,
  SubscriptionTier 
} from '@/lib/subscriptionTiers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Crown, 
  Sparkles, 
  Users, 
  Shield, 
  Clock, 
  Zap,
  Check,
  Loader2,
  ExternalLink,
  ChevronDown,
  MessageCircle,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

export function SubscriptionSection() {
  const navigate = useNavigate();
  const { isAdminOrSuper } = useUserRole();
  const {
    tier,
    limits,
    max_limits,
    usage,
    subscription_end,
    source,
    trial_active,
    token_bonus,
    loading,
    createCheckout,
    createTokenPayment,
    openCustomerPortal,
    getRemainingTrialDays,
  } = useSubscription();

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());

  const toggleTierExpanded = (tierKey: string) => {
    setExpandedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tierKey)) {
        next.delete(tierKey);
      } else {
        next.add(tierKey);
      }
      return next;
    });
  };

  const handleSubscribe = async (selectedTier: 'starter' | 'premium' | 'royal') => {
    setCheckoutLoading(selectedTier);
    try {
      await createCheckout(selectedTier);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer la session de paiement",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleBuyToken = async () => {
    setCheckoutLoading('token');
    try {
      await createTokenPayment(1);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer la session de paiement",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setCheckoutLoading('portal');
    try {
      await openCustomerPortal();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ouvrir le portail de gestion",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const remainingDays = getRemainingTrialDays();
  const tiers = Object.entries(SUBSCRIPTION_TIERS) as [SubscriptionTier, typeof SUBSCRIPTION_TIERS[SubscriptionTier]][];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-accent" />
              Mon Abonnement
            </CardTitle>
            <CardDescription>
              Gérez votre abonnement et vos avantages
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdminOrSuper && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/subscriptions')}
                className="border-accent text-accent"
              >
                <Settings className="w-4 h-4 mr-2" />
                Gérer les tokens
              </Button>
            )}
            <Badge variant={getTierBadgeVariant(tier)} className="text-sm px-3 py-1">
              {getTierDisplayName(tier)}
            </Badge>
            {trial_active && (
              <Badge variant="outline" className="text-sm px-3 py-1 border-accent text-accent">
                <Clock className="w-3 h-3 mr-1" />
                Essai: {remainingDays}j restants
              </Badge>
            )}
            {source === 'stripe' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleManageSubscription}
                disabled={checkoutLoading === 'portal'}
              >
                {checkoutLoading === 'portal' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Gérer
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current limits display with usage */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <Crown className="w-6 h-6 mx-auto mb-1 text-primary" />
            <div className="text-lg font-bold">
              {limits.games_creatable}
              {max_limits && (
                <span className="text-xs text-muted-foreground font-normal">/{max_limits.games_creatable}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">Initialisations restantes</div>
            {usage && usage.games_created > 0 && (
              <div className="text-xs text-muted-foreground mt-1">({usage.games_created} utilisées)</div>
            )}
          </div>
          <div className="text-center">
            <Users className="w-6 h-6 mx-auto mb-1 text-primary" />
            <div className="text-lg font-bold">{formatLimitValue(limits.max_friends)}</div>
            <div className="text-xs text-muted-foreground">Amis max</div>
          </div>
          <div className="text-center">
            <Shield className="w-6 h-6 mx-auto mb-1 text-primary" />
            <div className="text-lg font-bold">{limits.clan_benefits ? 'Oui' : 'Non'}</div>
            <div className="text-xs text-muted-foreground">Avantages clan</div>
          </div>
          <div className="text-center">
            <MessageCircle className="w-6 h-6 mx-auto mb-1 text-primary" />
            <div className="text-lg font-bold">{limits.chat_access === 'full' ? 'Complet' : 'Lecture'}</div>
            <div className="text-xs text-muted-foreground">Accès chat</div>
          </div>
        </div>

        {/* Token balance if any */}
        {token_bonus.token_balance > 0 && (
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
            <div className="flex items-center gap-2 text-accent">
              <Zap className="w-4 h-4" />
              <span className="font-medium">Solde Tokens:</span>
              <span>{token_bonus.token_balance} token{token_bonus.token_balance > 1 ? 's' : ''} disponible{token_bonus.token_balance > 1 ? 's' : ''}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">1 Token = 1 init OU 1 partie avec avantage clan</p>
          </div>
        )}

        {/* Subscription end date */}
        {subscription_end && source === 'stripe' && (
          <div className="text-sm text-muted-foreground">
            Votre abonnement se renouvelle le {format(new Date(subscription_end), 'dd MMMM yyyy', { locale: fr })}
          </div>
        )}

        {/* Subscription tiers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map(([tierKey, tierData]) => {
            const isCurrentTier = tier === tierKey;
            const isUpgrade = tiers.findIndex(([k]) => k === tierKey) > tiers.findIndex(([k]) => k === tier);
            const isExpanded = expandedTiers.has(tierKey);
            
            return (
              <Card 
                key={tierKey} 
                className={`relative ${isCurrentTier ? 'border-primary border-2' : ''}`}
              >
                {isCurrentTier && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="default" className="px-3">
                      <Check className="w-3 h-3 mr-1" />
                      Actuel
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{tierData.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{tierData.price}€</span>
                    {tierData.price > 0 && <span className="text-muted-foreground">/mois</span>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{tierData.description}</p>
                  
                  <Collapsible open={isExpanded} onOpenChange={() => toggleTierExpanded(tierKey)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between px-0 h-8">
                        <span className="text-xs text-muted-foreground">Voir les détails</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <ul className="space-y-1 text-sm">
                        <li className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-muted-foreground" />
                          {formatLimitValue(tierData.features.games_creatable)} initialisations de parties
                        </li>
                        <li className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          {formatLimitValue(tierData.features.max_friends)} amis
                        </li>
                        <li className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-muted-foreground" />
                          {tierData.features.clan_benefits ? 'Avantages clan' : 'Pas d\'avantages clan'}
                        </li>
                        <li className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-muted-foreground" />
                          {formatChatAccess(tierData.features.chat_access)}
                        </li>
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>

                  {tierKey !== 'freemium' && !isCurrentTier && isUpgrade && (
                    <Button 
                      className="w-full" 
                      onClick={() => handleSubscribe(tierKey as 'starter' | 'premium' | 'royal')}
                      disabled={checkoutLoading === tierKey}
                    >
                      {checkoutLoading === tierKey ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      S'abonner
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Token purchase */}
        <Card className="bg-gradient-to-r from-accent/10 to-primary/10 border-accent/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">{TOKEN_NDOGMOABENG.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {TOKEN_NDOGMOABENG.tokens_per_pack} Tokens (1 Token = 1 init OU 1 partie avec clan)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold">{TOKEN_NDOGMOABENG.price}€</span>
                <Button 
                  onClick={handleBuyToken}
                  disabled={checkoutLoading === 'token'}
                  variant="outline"
                  className="border-accent text-accent hover:bg-accent/10"
                >
                  {checkoutLoading === 'token' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Acheter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
