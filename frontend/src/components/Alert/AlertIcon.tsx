import type { AccidentSeverity } from '../../types/accident';

type AlertIconSize = 'sm' | 'md' | 'lg';

interface AlertIconProps {
  severity: AccidentSeverity;
  size?: AlertIconSize;
  animated?: boolean;
}

const severityStyles: Record<AccidentSeverity, { container: string; accent: string }> = {
  A1: { container: 'bg-danger-500 border-danger-500', accent: 'text-white' },
  A2: { container: 'bg-warning-500 border-warning-500', accent: 'text-white' },
  A3: { container: 'bg-secondary-500 border-secondary-500', accent: 'text-white' },
};

const sizeStyles: Record<AlertIconSize, { container: string; icon: number }> = {
  sm: { container: 'h-8 w-8', icon: 16 },
  md: { container: 'h-12 w-12', icon: 24 },
  lg: { container: 'h-16 w-16', icon: 32 },
};

const AlertIcon = ({ severity, size = 'md', animated = false }: AlertIconProps) => {
  const containerStyles = [
    'flex items-center justify-center rounded-full border-2 shadow-md',
    severityStyles[severity].container,
    sizeStyles[size].container,
    animated ? 'animate-pulse' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const iconSize = sizeStyles[size].icon;

  return (
    <div className={containerStyles}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={severityStyles[severity].accent}
        aria-hidden
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M21.73 18l-9.73-16L2.27 18z" />
      </svg>
      <span className="sr-only">{severity} 等級警示</span>
    </div>
  );
};

export default AlertIcon;
