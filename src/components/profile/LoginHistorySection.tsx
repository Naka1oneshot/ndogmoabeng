import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  History, 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  ChevronDown,
  ChevronUp,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LoginRecord {
  id: string;
  logged_in_at: string;
  ip_address: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
}

export function LoginHistorySection() {
  const { user } = useAuth();
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const displayCount = expanded ? 10 : 3;

  useEffect(() => {
    if (user) {
      fetchLoginHistory();
    }
  }, [user]);

  const fetchLoginHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('login_history')
        .select('id, logged_in_at, ip_address, device_type, browser, os')
        .eq('user_id', user?.id)
        .order('logged_in_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLoginHistory(data || []);
    } catch (error) {
      console.error('Error fetching login history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const getBrowserColor = (browser: string | null) => {
    switch (browser?.toLowerCase()) {
      case 'chrome':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'firefox':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'safari':
        return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
      case 'edge':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historique des connexions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Historique des connexions
            </CardTitle>
            <CardDescription>
              Vos {loginHistory.length} dernières connexions
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loginHistory.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Aucune connexion enregistrée
          </p>
        ) : (
          <div className="space-y-3">
            {loginHistory.slice(0, displayCount).map((record, index) => (
              <div 
                key={record.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  index === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${index === 0 ? 'bg-primary/20' : 'bg-muted'}`}>
                    {getDeviceIcon(record.device_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {record.device_type || 'Appareil inconnu'}
                      </span>
                      {record.browser && (
                        <Badge variant="outline" className={`text-xs ${getBrowserColor(record.browser)}`}>
                          {record.browser}
                        </Badge>
                      )}
                      {record.os && (
                        <Badge variant="secondary" className="text-xs">
                          {record.os}
                        </Badge>
                      )}
                      {index === 0 && (
                        <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                          Session actuelle
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>
                        {formatDistanceToNow(new Date(record.logged_in_at), { 
                          addSuffix: true, 
                          locale: fr 
                        })}
                      </span>
                      <span>•</span>
                      <span>
                        {format(new Date(record.logged_in_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </span>
                      {record.ip_address && record.ip_address !== 'Unknown' && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {record.ip_address}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {loginHistory.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Voir moins
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Voir plus ({loginHistory.length - 3} autres)
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
