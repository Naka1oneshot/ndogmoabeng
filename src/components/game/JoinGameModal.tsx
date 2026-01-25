import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ForestButton } from '@/components/ui/ForestButton';
import { Camera, Upload, Keyboard, X, Loader2, Users, Gamepad2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PublicLobbyGame {
  id: string;
  name: string;
  join_code: string;
  player_count: number;
  game_type_name: string | null;
}

interface JoinGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinGameModal({ open, onOpenChange }: JoinGameModalProps) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [publicGames, setPublicGames] = useState<PublicLobbyGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch public lobby games
  const fetchPublicGames = useCallback(async () => {
    setLoadingGames(true);
    try {
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select(`
          id,
          name,
          join_code,
          selected_game_type_code,
          game_types!games_selected_game_type_code_fkey (name)
        `)
        .eq('status', 'LOBBY')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (gamesError) throw gamesError;

      // Get player counts
      const gameIds = games?.map(g => g.id) || [];
      const { data: players } = await supabase
        .from('game_players')
        .select('game_id')
        .in('game_id', gameIds)
        .is('removed_at', null)
        .eq('is_host', false);

      const playerCounts: Record<string, number> = {};
      players?.forEach(p => {
        playerCounts[p.game_id] = (playerCounts[p.game_id] || 0) + 1;
      });

      setPublicGames(
        games?.map(g => ({
          id: g.id,
          name: g.name,
          join_code: g.join_code,
          player_count: playerCounts[g.id] || 0,
          game_type_name: g.game_types?.name || null,
        })) || []
      );
    } catch (err) {
      console.error('Error fetching public games:', err);
    } finally {
      setLoadingGames(false);
    }
  }, []);

  // Fetch games when modal opens
  useEffect(() => {
    if (open) {
      fetchPublicGames();
    }
  }, [open, fetchPublicGames]);

  // Extract code from URL or use as-is
  const extractCode = useCallback((input: string): string => {
    const trimmed = input.trim().toUpperCase();
    
    // Check if it's a URL containing /join/:code
    const urlMatch = trimmed.match(/\/join\/([A-Z0-9]+)/i);
    if (urlMatch) {
      console.log('QR detected: URL with code', urlMatch[1].toUpperCase());
      return urlMatch[1].toUpperCase();
    }
    
    // Otherwise treat as plain code
    console.log('QR detected: plain code', trimmed);
    return trimmed;
  }, []);

  // Handle successful code detection
  const handleCodeDetected = useCallback((detectedCode: string) => {
    const extractedCode = extractCode(detectedCode);
    if (extractedCode) {
      console.log('Joining code:', extractedCode);
      stopScanner();
      onOpenChange(false);
      navigate(`/join/${extractedCode}`);
    }
  }, [extractCode, navigate, onOpenChange]);

  // Stop the QR scanner
  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) { // SCANNING state
          await html5QrCodeRef.current.stop();
        }
      } catch (err) {
        console.log('Scanner stop error (may be already stopped):', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Start the QR scanner
  const startScanner = async () => {
    setCameraError(null);
    setError('');
    
    try {
      // Create scanner instance
      const scannerId = 'qr-scanner-region';
      html5QrCodeRef.current = new Html5Qrcode(scannerId);
      
      setIsScanning(true);
      
      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {
          // QR code scan failure - ignore, keep scanning
        }
      );
    } catch (err: any) {
      console.error('Camera error:', err);
      setIsScanning(false);
      
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        setCameraError('Accès caméra refusé. Vous pouvez importer une image à la place.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('Aucune caméra détectée. Vous pouvez importer une image à la place.');
      } else {
        setCameraError('Impossible d\'accéder à la caméra. Vous pouvez importer une image à la place.');
      }
    }
  };

  // Handle file upload for QR scanning
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setError('');
    setCameraError(null);
    
    try {
      const html5QrCode = new Html5Qrcode('qr-file-scanner');
      const result = await html5QrCode.scanFile(file, true);
      console.log('QR detected from image:', result);
      handleCodeDetected(result);
    } catch (err) {
      console.error('QR scan from image failed:', err);
      setError('Impossible de lire le QR code depuis cette image.');
    } finally {
      setIsProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle manual code submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim().toUpperCase();
    
    if (!trimmedCode) {
      setError('Veuillez entrer un code de session.');
      return;
    }
    
    console.log('Joining code:', trimmedCode);
    onOpenChange(false);
    navigate(`/join/${trimmedCode}`);
  };

  // Join a public game
  const handleJoinPublicGame = (joinCode: string) => {
    onOpenChange(false);
    navigate(`/join/${joinCode}`);
  };

  // Cleanup on modal close
  useEffect(() => {
    if (!open) {
      stopScanner();
      setCode('');
      setError('');
      setCameraError(null);
    }
  }, [open, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card/100 backdrop-blur-none border-primary/20 max-h-[85vh] max-w-[95vw] overflow-hidden flex flex-col mx-auto" style={{ backgroundColor: 'hsl(var(--card))' }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-display text-glow">
            Rejoindre une partie
          </DialogTitle>
          <DialogDescription>
            Rejoignez une partie publique ou entrez un code de session
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 py-4 px-1">
            {/* Manual code entry */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Keyboard className="h-4 w-4" />
                <span>Code de session</span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: AB12CD"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  className="flex-1 uppercase tracking-widest text-center font-mono text-lg"
                  maxLength={10}
                />
                <ForestButton type="submit" disabled={!code.trim()}>
                  Rejoindre
                </ForestButton>
              </div>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou scanner</span>
              </div>
            </div>

            {/* QR Scanner section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Camera className="h-4 w-4" />
                <span>Scanner un QR code</span>
              </div>

              {/* Scanner container */}
              <div 
                id="qr-scanner-region" 
                ref={scannerContainerRef}
                className={`relative rounded-lg overflow-hidden bg-black/50 ${isScanning ? 'min-h-[300px]' : 'hidden'}`}
              />
              
              {/* Hidden element for file scanning */}
              <div id="qr-file-scanner" className="hidden" />

              {/* Camera controls */}
              {!isScanning && (
                <div className="space-y-3">
                  <ForestButton 
                    variant="secondary" 
                    className="w-full"
                    onClick={startScanner}
                  >
                    <Camera className="h-5 w-5" />
                    Ouvrir la caméra
                  </ForestButton>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Autorisez l'accès caméra pour scanner le QR
                  </p>
                </div>
              )}

              {/* Stop scanning button */}
              {isScanning && (
                <ForestButton 
                  variant="outline" 
                  className="w-full"
                  onClick={stopScanner}
                >
                  <X className="h-5 w-5" />
                  Arrêter le scan
                </ForestButton>
              )}

              {/* Camera error - show file upload fallback */}
              {cameraError && (
                <div className="space-y-3">
                  <p className="text-sm text-amber-400 text-center">
                    {cameraError}
                  </p>
                  <ForestButton 
                    variant="secondary" 
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    Importer une image
                  </ForestButton>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* Always show file upload option even when camera works */}
              {!cameraError && !isScanning && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-muted-foreground hover:text-primary underline w-full text-center"
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Analyse en cours...' : 'Ou importer une image du QR code'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-destructive text-center">
                {error}
              </p>
            )}

            {/* Public games list - at the bottom */}
            <div className="relative pt-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">parties publiques</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Gamepad2 className="h-4 w-4" />
                <span>En attente de joueurs</span>
              </div>

              {loadingGames && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!loadingGames && publicGames.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  Aucune partie publique en attente
                </div>
              )}

              {publicGames.length > 0 && (
                <ScrollArea className="h-[180px] sm:h-[220px]">
                  <div className="space-y-2 pr-3">
                    {publicGames.map((game) => (
                      <button
                        key={game.id}
                        onClick={() => handleJoinPublicGame(game.join_code)}
                        className="w-full p-3 rounded-lg bg-muted/50 hover:bg-primary/20 border border-border hover:border-primary/50 transition-colors text-left group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate group-hover:text-primary transition-colors text-sm sm:text-base">
                              {game.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {game.game_type_name || 'Mode unique'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              <span>{game.player_count}</span>
                            </div>
                            <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 sm:px-2 py-0.5 rounded">
                              {game.join_code}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

