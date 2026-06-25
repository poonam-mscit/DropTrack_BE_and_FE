import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  as?: 'div' | 'article' | 'section';
}

export function GlassCard({ children, className, glow = true, as = 'div' }: Props) {
  const Tag = as;
  return (
    <Tag className={cn('glass p-6 md:p-7', glow && 'glow-border', className)}>{children}</Tag>
  );
}
