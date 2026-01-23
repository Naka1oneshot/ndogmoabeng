import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { Eye, Trash2, Users, Loader2, ChevronRight } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface GameRow {
  id: string;
  name: string;
  join_code: string;
  status: string;
  created_at: string;
  active_players: number;
}

interface GameRowCompactProps {
  game: GameRow;
  deleting: string | null;
  onDelete: (gameId: string) => void;
}

export function GameRowCompact({ game, deleting, onDelete }: GameRowCompactProps) {
  const navigate = useNavigate();

  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-medium truncate">{game.name}</span>
              <GameStatusBadge status={game.status} />
            </div>
            
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span className="font-mono text-primary">{game.join_code}</span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {game.active_players}
              </span>
              <span>
                {new Date(game.created_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                })}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/admin/games/${game.id}`)}
              className="h-9 w-9"
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deleting === game.id}
                >
                  {deleting === game.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer la partie ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Toutes les données de la partie
                    "{game.name}" seront définitivement supprimées.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => onDelete(game.id)}
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
