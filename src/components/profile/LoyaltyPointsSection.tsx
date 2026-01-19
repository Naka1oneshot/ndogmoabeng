import { useLoyaltyPoints } from '@/hooks/useLoyaltyPoints';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, TrendingUp, TrendingDown, Gift, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function LoyaltyPointsSection() {
  const { loyaltyInfo, transactions, loading } = useLoyaltyPoints();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTransactionIcon = (type: string, amount: number) => {
    if (amount > 0) {
      return <ArrowUpRight className="w-4 h-4 text-green-500" />;
    }
    return <ArrowDownRight className="w-4 h-4 text-red-500" />;
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'subscription_payment':
        return 'Abonnement';
      case 'meetup_payment':
        return 'Ticket événement';
      case 'admin_grant':
        return 'Octroi admin';
      case 'discount_used':
        return 'Réduction utilisée';
      default:
        return source;
    }
  };

  return (
    <Card className="border-yellow-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Points de Fidélité NDG
        </CardTitle>
        <CardDescription>
          1€ dépensé = 1 point • Cumulez des points pour obtenir des réductions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
            <Star className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {loyaltyInfo?.balance || 0}
            </div>
            <div className="text-xs text-muted-foreground">Points disponibles</div>
          </div>
          
          <div className="text-center p-4 bg-green-500/10 rounded-lg">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {loyaltyInfo?.total_earned || 0}
            </div>
            <div className="text-xs text-muted-foreground">Points gagnés</div>
          </div>
          
          <div className="text-center p-4 bg-red-500/10 rounded-lg">
            <TrendingDown className="w-6 h-6 mx-auto mb-2 text-red-500" />
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {loyaltyInfo?.total_spent || 0}
            </div>
            <div className="text-xs text-muted-foreground">Points utilisés</div>
          </div>
        </div>

        {/* Recent transactions */}
        {transactions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Dernières transactions</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {transactions.slice(0, 5).map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {getTransactionIcon(txn.transaction_type, txn.amount)}
                    <div>
                      <div className="text-sm font-medium">
                        {getSourceLabel(txn.source)}
                      </div>
                      {txn.note && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {txn.note}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={txn.amount > 0 ? 'default' : 'secondary'}>
                      {txn.amount > 0 ? '+' : ''}{txn.amount} pts
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(txn.created_at), 'dd MMM', { locale: fr })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {transactions.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Gift className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune transaction pour le moment</p>
            <p className="text-xs">Vos points s'accumuleront avec vos achats</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
