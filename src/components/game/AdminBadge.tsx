import { Shield } from 'lucide-react';

interface AdminBadgeProps {
  email?: string;
}

export function AdminBadge({ email }: AdminBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30">
      <Shield className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-primary">MJ (Admin)</span>
      {email && (
        <span className="text-xs text-muted-foreground">
          {email}
        </span>
      )}
    </div>
  );
}
