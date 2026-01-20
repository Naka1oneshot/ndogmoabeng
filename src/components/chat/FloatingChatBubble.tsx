import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingChatBubbleProps {
  unreadCount: number;
  onClick: () => void;
  previousUnreadCount?: number;
}

interface Position {
  x: number;
  y: number;
}

export function FloatingChatBubble({ 
  unreadCount, 
  onClick,
  previousUnreadCount = 0 
}: FloatingChatBubbleProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const previousUnreadRef = useRef(previousUnreadCount);

  // Initialize position to bottom-right
  useEffect(() => {
    const initPosition = () => {
      const padding = 16;
      const bubbleSize = 56;
      setPosition({
        x: window.innerWidth - bubbleSize - padding,
        y: window.innerHeight - bubbleSize - padding,
      });
    };

    initPosition();
    window.addEventListener('resize', initPosition);
    return () => window.removeEventListener('resize', initPosition);
  }, []);

  // Reappear when new message is received
  useEffect(() => {
    if (unreadCount > previousUnreadRef.current && isDismissed) {
      setIsDismissed(false);
    }
    previousUnreadRef.current = unreadCount;
  }, [unreadCount, isDismissed]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!bubbleRef.current) return;
    
    // Prevent if clicking on the X button
    if ((e.target as HTMLElement).closest('[data-dismiss-button]')) {
      return;
    }

    setIsDragging(true);
    const rect = bubbleRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const bubbleSize = 56;
    const padding = 8;
    
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;

    // Constrain to viewport
    newX = Math.max(padding, Math.min(window.innerWidth - bubbleSize - padding, newX));
    newY = Math.max(padding, Math.min(window.innerHeight - bubbleSize - padding, newY));

    setPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!bubbleRef.current) return;
    
    // Prevent if touching the X button
    if ((e.target as HTMLElement).closest('[data-dismiss-button]')) {
      return;
    }

    const touch = e.touches[0];
    setIsDragging(true);
    const rect = bubbleRef.current.getBoundingClientRect();
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    const bubbleSize = 56;
    const padding = 8;

    let newX = touch.clientX - dragOffset.x;
    let newY = touch.clientY - dragOffset.y;

    // Constrain to viewport
    newX = Math.max(padding, Math.min(window.innerWidth - bubbleSize - padding, newX));
    newY = Math.max(padding, Math.min(window.innerHeight - bubbleSize - padding, newY));

    setPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse/touch listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if we didn't just drag
    if (!isDragging) {
      onClick();
    }
  };

  const handleDismiss = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div
      ref={bubbleRef}
      className={cn(
        "fixed z-50 group",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Dismiss button */}
      <Button
        data-dismiss-button
        variant="ghost"
        size="icon"
        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-muted/80 hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={handleDismiss}
        onTouchEnd={(e) => {
          e.stopPropagation();
          handleDismiss(e);
        }}
      >
        <X className="h-3 w-3" />
      </Button>

      {/* Drag indicator */}
      <div className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Main bubble */}
      <button
        onClick={handleClick}
        className={cn(
          "h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          isDragging && "scale-110 shadow-xl"
        )}
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </button>
    </div>
  );
}
