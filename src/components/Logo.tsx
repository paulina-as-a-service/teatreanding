type HatProps = { className?: string; title?: string };

/** Teatranding! top-hat mark, redrawn as SVG so it follows the theme colors. */
export function HatMark({ className, title }: HatProps) {
  return (
    <svg
      viewBox="560 740 1400 1480"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect x="761" y="792" width="1033" height="144" style={{ fill: 'var(--hat-dark)' }} />
      <path
        style={{ fill: 'var(--hat-main)' }}
        d="M758 1092h446v726H758zM1358 1092h445v726h-445zM645 1818a612 174 0 0 0 1224 0z"
      />
      <path style={{ fill: 'var(--hat-dark)' }} d="M621 1968a637 200 0 0 0 1274 0h-49a588 151 0 0 1-1176 0z" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-sans font-medium tracking-[0.32em] ${className}`}>
      <span style={{ color: 'var(--hat-main)' }}>Teatran</span>
      <span style={{ color: 'var(--hat-dark)' }}>ding</span>
      <span style={{ color: 'var(--hat-main)' }}>!</span>
    </span>
  );
}
