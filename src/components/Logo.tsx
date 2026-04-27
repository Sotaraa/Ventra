interface LogoMarkProps {
  size?: number
  className?: string
}

/** The Ventra "V" mark — works on both dark and light backgrounds */
export function LogoMark({ size = 36, className = '' }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Rounded square backing */}
      <rect width="36" height="36" rx="10" fill="rgba(255,255,255,0.12)" />

      {/* Bold V — entry mark */}
      <path
        d="M10 12L18 24L26 12"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Amber entry dot — the access point */}
      <circle cx="18" cy="9" r="2.6" fill="#F59E0B" />
    </svg>
  )
}

interface LogoProps {
  size?: number
  /** 'full' shows mark + wordmark. 'mark' shows just the icon. */
  variant?: 'full' | 'mark'
  className?: string
}

/** Full Ventra logo: mark + wordmark */
export default function Logo({ size = 36, variant = 'full', className = '' }: LogoProps) {
  if (variant === 'mark') return <LogoMark size={size} className={className} />

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      <div>
        <p className="text-white font-display font-bold text-lg leading-none tracking-tight">
          Ventra
        </p>
        <p className="text-white/50 text-[10px] font-medium tracking-widest uppercase leading-none mt-0.5">
          Management
        </p>
      </div>
    </div>
  )
}
