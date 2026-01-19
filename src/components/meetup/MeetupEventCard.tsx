import { useState, useRef } from 'react';
import { Calendar, MapPin, Users, Trophy, Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MeetupEvent } from '@/hooks/useMeetupEvents';
import { MeetupRegistrationModal } from './MeetupRegistrationModal';

interface MeetupEventCardProps {
  event: MeetupEvent;
  onRegistrationSuccess: () => void;
}

export function MeetupEventCard({ event, onRegistrationSuccess }: MeetupEventCardProps) {
  const [showRegistration, setShowRegistration] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const isFull = (event.registration_count || 0) >= event.expected_players;
  
  const startDate = new Date(event.start_at);
  const endDate = new Date(event.end_at);
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }).replace(':', 'h');
  };

  const toggleVideo = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsAudioPlaying(!isAudioPlaying);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isAudioMuted;
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if ((videoRef.current as any).webkitRequestFullscreen) {
        (videoRef.current as any).webkitRequestFullscreen();
      } else if ((videoRef.current as any).msRequestFullscreen) {
        (videoRef.current as any).msRequestFullscreen();
      }
    }
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-surface via-surface to-surface-2 shadow-xl transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30">
        {/* Video Section */}
        <div className="relative aspect-video bg-background">
          {event.video_url ? (
            <>
              <video
                ref={videoRef}
                src={event.video_url}
                className="w-full h-full object-cover"
                poster={event.cover_image_url || undefined}
                onEnded={() => setIsVideoPlaying(false)}
              />
              <button
                onClick={toggleVideo}
                className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300 hover:bg-black/30"
              >
                <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/50 transition-transform duration-300 hover:scale-110">
                  {isVideoPlaying ? (
                    <Pause className="w-8 h-8 text-primary-foreground" />
                  ) : (
                    <Play className="w-8 h-8 text-primary-foreground ml-1" />
                  )}
                </div>
              </button>
              {/* Fullscreen Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center transition-all duration-300 hover:bg-black/80 hover:scale-110"
                title="Plein écran"
              >
                <Maximize className="w-5 h-5 text-white" />
              </button>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent/20 via-surface-2 to-primary/20 flex items-center justify-center">
              <span className="text-muted-foreground">Aperçu vidéo à venir</span>
            </div>
          )}
          
          {/* Status Badge */}
          {isFull && (
            <Badge className="absolute top-4 right-4 bg-destructive text-destructive-foreground">
              Complet
            </Badge>
          )}
        </div>

        {/* Audio Player */}
        <div className="px-6 py-4 border-b border-border/30 bg-surface-2/50">
          {event.audio_url ? (
            <div className="flex items-center gap-4">
              <button
                onClick={toggleAudio}
                className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center transition-all duration-300 hover:bg-primary/30 hover:scale-105"
              >
                {isAudioPlaying ? (
                  <Pause className="w-5 h-5 text-primary" />
                ) : (
                  <Play className="w-5 h-5 text-primary ml-0.5" />
                )}
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">🎵 Générique La carte trouvée de Ndogmoabeng</p>
                <p className="text-xs text-muted-foreground">Écouter l'ambiance</p>
              </div>
              <button
                onClick={toggleMute}
                className="w-8 h-8 rounded-full bg-surface flex items-center justify-center transition-all duration-300 hover:bg-surface-2"
              >
                {isAudioMuted ? (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="w-4 h-4 text-foreground" />
                )}
              </button>
              <audio
                ref={audioRef}
                src={event.audio_url}
                onEnded={() => setIsAudioPlaying(false)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-4 opacity-50">
              <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Générique à venir</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <h3 className="text-2xl font-bold text-foreground tracking-tight">
            {event.title}
          </h3>
          
          <p className="text-muted-foreground leading-relaxed text-sm">
            {event.description}
          </p>

          {/* Info Chips */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-surface-2/50 border-border/50">
              <Calendar className="w-3 h-3 mr-1.5" />
              {formatDate(startDate)}
            </Badge>
            <Badge variant="outline" className="bg-surface-2/50 border-border/50">
              🕐 {formatTime(startDate)} – {formatTime(endDate)}
            </Badge>
            <Badge variant="outline" className="bg-surface-2/50 border-border/50">
              <MapPin className="w-3 h-3 mr-1.5" />
              {event.city}
            </Badge>
            <Badge variant="outline" className="bg-surface-2/50 border-border/50">
              <Users className="w-3 h-3 mr-1.5" />
              {event.registration_count || 0}/{event.expected_players} joueurs
            </Badge>
          </div>

          {/* Pricing */}
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-2xl font-bold text-primary">{event.price_eur} €</span>
              <span className="text-xs text-muted-foreground">
                dont {event.pot_contribution_eur} € cagnotte
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20">
              <Trophy className="w-5 h-5 text-accent" />
              <span className="text-sm font-medium text-foreground">
                Cagnotte potentielle : <span className="text-accent font-bold">{event.pot_potential_eur} €</span>
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="pt-4">
            <Button
              onClick={() => setShowRegistration(true)}
              disabled={isFull}
              className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40 hover:scale-[1.02]"
            >
              {isFull ? 'Événement complet' : 'Rejoindre l\'aventure'}
            </Button>
            {!isFull && (
              <p className="text-center text-xs text-muted-foreground mt-2">
                Inscris-toi pour être rappelé(e)
              </p>
            )}
          </div>
        </div>
      </div>

      <MeetupRegistrationModal
        open={showRegistration}
        onOpenChange={setShowRegistration}
        event={event}
        onSuccess={() => {
          setShowRegistration(false);
          onRegistrationSuccess();
        }}
      />
    </>
  );
}
