import { useState, useRef } from 'react';
import { Calendar, MapPin, Users, Trophy, Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MeetupEvent } from '@/hooks/useMeetupEvents';
import { ComingSoonRegistrationModal } from './ComingSoonRegistrationModal';

interface ComingSoonEventCardProps {
  event: MeetupEvent;
  onRegistrationSuccess: () => void;
}

export function ComingSoonEventCard({ event, onRegistrationSuccess }: ComingSoonEventCardProps) {
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
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card/80 backdrop-blur-sm shadow-xl max-w-2xl w-full"
      >
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
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/50 transition-transform duration-300 hover:scale-110">
                  {isVideoPlaying ? (
                    <Pause className="w-7 h-7 md:w-8 md:h-8 text-primary-foreground" />
                  ) : (
                    <Play className="w-7 h-7 md:w-8 md:h-8 text-primary-foreground ml-1" />
                  )}
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center transition-all duration-300 hover:bg-black/80 hover:scale-110"
                title="Plein écran"
              >
                <Maximize className="w-4 h-4 text-white" />
              </button>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent/20 via-surface-2 to-primary/20 flex items-center justify-center">
              <span className="text-muted-foreground">Aperçu vidéo à venir</span>
            </div>
          )}
          
          {isFull && (
            <Badge className="absolute top-3 right-3 bg-destructive text-destructive-foreground">
              Complet
            </Badge>
          )}
        </div>

        {/* Audio Player */}
        {event.audio_url && (
          <div className="px-4 md:px-6 py-3 border-b border-border/30 bg-surface-2/50">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAudio}
                className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center transition-all duration-300 hover:bg-primary/30 hover:scale-105"
              >
                {isAudioPlaying ? (
                  <Pause className="w-4 h-4 text-primary" />
                ) : (
                  <Play className="w-4 h-4 text-primary ml-0.5" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-foreground truncate">🎵 Générique La carte trouvée</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">Écouter l'ambiance</p>
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
          </div>
        )}

        {/* Content */}
        <div className="p-4 md:p-6 space-y-3 md:space-y-4">
          <h3 className="text-lg md:text-2xl font-bold text-foreground tracking-tight">
            {event.title}
          </h3>
          
          <p className="text-muted-foreground leading-relaxed text-xs md:text-sm line-clamp-3">
            {event.description}
          </p>

          {/* Info Chips */}
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            <Badge variant="outline" className="bg-surface-2/50 border-border/50 text-[10px] md:text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              {formatDate(startDate)}
            </Badge>
            <Badge variant="outline" className="bg-surface-2/50 border-border/50 text-[10px] md:text-xs">
              🕐 {formatTime(startDate)} – {formatTime(endDate)}
            </Badge>
            <Badge variant="outline" className="bg-surface-2/50 border-border/50 text-[10px] md:text-xs">
              <MapPin className="w-3 h-3 mr-1" />
              {event.city}
            </Badge>
            <Badge variant="outline" className="bg-surface-2/50 border-border/50 text-[10px] md:text-xs">
              <Users className="w-3 h-3 mr-1" />
              {event.registration_count || 0}/{event.expected_players}
            </Badge>
          </div>

          {/* Pricing */}
          <div className="flex flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-lg md:text-xl font-bold text-primary">{event.price_eur} €</span>
              <span className="text-[10px] md:text-xs text-muted-foreground">
                dont {event.pot_contribution_eur} € cagnotte
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
              <Trophy className="w-4 h-4 text-accent" />
              <span className="text-xs md:text-sm font-medium text-foreground">
                Cagnotte : <span className="text-accent font-bold">{event.pot_potential_eur} €</span>
              </span>
            </div>
          </div>

          {/* CTA */}
          <Button
            onClick={() => setShowRegistration(true)}
            disabled={isFull}
            className="w-full h-11 md:h-12 text-base md:text-lg font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40"
          >
            {isFull ? 'Événement complet' : '🎮 Demander à participer'}
          </Button>
        </div>
      </motion.div>

      <ComingSoonRegistrationModal
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
