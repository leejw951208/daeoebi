// lucide-react 아이콘 표준 wrapper. 사이즈와 aria 속성을 일관되게 적용한다.
import type { LucideIcon } from 'lucide-react';

export interface IconProps {
  icon: LucideIcon;
  size?: number;
  label?: string;
  className?: string;
}

export function Icon({ icon: LucideComponent, size = 20, label, className }: IconProps) {
  return (
    <LucideComponent
      size={size}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      strokeWidth={1.75}
      className={className}
    />
  );
}
