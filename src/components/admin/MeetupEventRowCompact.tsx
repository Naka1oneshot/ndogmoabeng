import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, Eye, Edit, Archive, Copy, Settings2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MeetupEvent {
  id: string;
  slug: string;
  title: string;
  city: string;
  venue: string | null;
  start_at: string;
  status: string;
  price_eur: number;
  expected_players: number;
  paid_registrations: number;
  total_registrations: number;
}

interface MeetupEventRowCompactProps {
  event: MeetupEvent;
  onViewRegistrations: (event: MeetupEvent) => void;
  onEdit: (event: MeetupEvent) => void;
  onArchive: (eventId: string) => void;
  onDuplicate: (event: MeetupEvent) => void;
  onManage: (eventId: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

export function MeetupEventRowCompact({
  event,
  onViewRegistrations,
  onEdit,
  onArchive,
  onDuplicate,
  onManage,
  getStatusBadge,
}: MeetupEventRowCompactProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header: Title + Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{event.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(event.start_at)}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.city}
                </span>
              </div>
            </div>
            {getStatusBadge(event.status)}
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-accent">{event.paid_registrations}</span>
              <span className="text-muted-foreground">/ {event.total_registrations}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {event.price_eur}€
            </Badge>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onViewRegistrations(event)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Inscrits
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voir les inscriptions</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onManage(event.id)}
                >
                  <Settings2 className="h-4 w-4 mr-1" />
                  Gérer
                </Button>
              </TooltipTrigger>
              <TooltipContent>Invités, Budget, PNL, Tâches</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(event)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Modifier</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDuplicate(event)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dupliquer</TooltipContent>
            </Tooltip>

            {event.status !== 'ARCHIVED' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onArchive(event.id)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Archiver</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
