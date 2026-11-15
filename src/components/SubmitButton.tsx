"use client";
import { useFormStatus } from "react-dom";

// Instant feedback: spinner + disabled while the server action runs (prevents double-clicks).
export function SubmitButton({ children, className = "btn-lime", disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} type="submit" disabled={disabled || pending} aria-busy={pending} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
      {pending && <span aria-hidden className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
