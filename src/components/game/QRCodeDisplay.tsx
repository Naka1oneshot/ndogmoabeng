import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QRCodeDisplayProps {
  joinCode: string;
  className?: string;
}

export function QRCodeDisplay({ joinCode, className }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const joinUrl = `${window.location.origin}/join/${joinCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('card-gradient rounded-lg border border-border p-6 text-center', className)}>
      <h3 className="font-display text-lg mb-4">Scanner pour rejoindre</h3>
      
      <div className="bg-white p-4 rounded-lg inline-block mb-4">
        <QRCodeSVG
          value={joinUrl}
          size={180}
          level="H"
          includeMargin={false}
        />
      </div>

      <div className="mb-4">
        <p className="text-muted-foreground text-sm mb-2">Code de la partie</p>
        <p className="font-display text-3xl text-primary text-glow tracking-widest">
          {joinCode}
        </p>
      </div>

      <Button
        variant="outline"
        onClick={handleCopy}
        className="w-full gap-2"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copié !
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copier le lien
          </>
        )}
      </Button>
    </div>
  );
}
