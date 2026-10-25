// Emblème officiel TVNest (logo 3D luminescent + typographie optionnelle).
import { cn } from '@/lib/utils';

interface TvNestLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
}

const MARK_SIZE: Record<NonNullable<TvNestLogoProps['size']>, string> = {
  xs: 'h-5 w-auto',
  sm: 'h-7 w-auto',
  md: 'h-8 w-auto',
  lg: 'h-12 w-auto',
};

export function TvNestLogo({
  size = 'md',
  showWordmark = false,
  subtitle,
  className,
}: TvNestLogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <img
        src="./assets/icons/tvnest-logo.png"
        alt="TVNest"
        draggable={false}
        className={cn(
          'shrink-0 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.12)]',
          MARK_SIZE[size]
        )}
      />
      {showWordmark ? (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-[15px] font-bold tracking-tight text-foreground">
            TV<span className="text-primary">Nest</span>
          </p>
          {subtitle ? (
            <p className="truncate text-[10px] font-medium text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
