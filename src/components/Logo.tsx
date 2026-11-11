import { useAccount } from "../context/AccountContext";

type LogoProps = {
  compact?: boolean;
  className?: string;
};

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M31.9 6.5 57 54H44.2L32 29.4 19.7 54H7L31.9 6.5Z"
        fill="currentColor"
      />
      <path d="M18.5 43.2 42.7 34.6 47 42.4 14.8 54.5 18.5 43.2Z" fill="currentColor" />
    </svg>
  );
}

export default function Logo({ compact = false, className = "" }: LogoProps) {
  const { platformSettings } = useAccount();
  return (
    <span className={`brand ${className}`}>
      <span className={`brand-mark ${platformSettings.siteLogo ? "has-custom-logo" : ""}`}>{platformSettings.siteLogo ? <img src={platformSettings.siteLogo} alt="APEX Trading logo" /> : <LogoMark />}</span>
      {!compact && (
        <span className="brand-type">
          <strong>APEX</strong>
          <small>TRADING</small>
        </span>
      )}
    </span>
  );
}
