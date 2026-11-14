type LogoProps = {
  compact?: boolean;
  className?: string;
};

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d="M8 54V10h21c12 0 19 6 19 17S41 44 29 44h-9v10H8Zm12-20h9c4 0 7-2 7-7s-3-7-7-7h-9v14Z" />
      <path d="m32 54 12-31h8l12 31h-9l-2.5-7h-9L41 54h-9Zm13-14h6l-3-8-3 8Z" fill="currentColor" />
    </svg>
  );
}

export default function Logo({ compact = false, className = "" }: LogoProps) {
  return (
    <span className={`brand ${className}`}>
      <span className="brand-mark"><LogoMark /></span>
      {!compact && (
        <span className="brand-type">
          <strong>PropApex</strong>
          <small>TRADING &amp; REWARDS</small>
        </span>
      )}
    </span>
  );
}
