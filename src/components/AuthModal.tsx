import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import Modal from "./Modal";
import { useAccount } from "../context/AccountContext";
import { LogoMark } from "./Logo";

type Props = {
  open: boolean;
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export default function AuthModal({ open, mode, onModeChange, onClose, onSuccess }: Props) {
  const { signUp, logIn, backendConfigured } = useAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError("");
    setPassword("");
    setConfirm("");
    setTerms(false);
  }, [mode, open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "signup" && password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    if (mode === "signup" && !terms) {
      setError("Accept the account and cashback terms to continue.");
      return;
    }
    setLoading(true);
    try {
      const result = mode === "signup" ? await signUp(name, email, password) : await logIn(email, password);
      if (!result.ok) setError(result.message);
      else {
        setName(""); setEmail(""); setPassword(""); setConfirm("");
        onSuccess(result.message);
      }
    } catch {
      setError("Account access is unavailable in this browser. Check privacy settings and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === "login" ? "Welcome back" : "Create your PropApex account"} eyebrow={mode === "login" ? "ACCOUNT LOGIN" : "JOIN PropApex REWARDS"}>
      <div className="auth-layout">
        <div className="auth-aside">
          <span className="auth-logo"><LogoMark /></span>
          <h3>One account.<br />Every trading decision.</h3>
          <p>Track purchases, follow cashback verification and manage your firm reviews from one place.</p>
          <ul>
            <li><Check size={14} /> Cashback tracking dashboard</li>
            <li><Check size={14} /> Personal referral link</li>
            <li><Check size={14} /> Publish and manage reviews</li>
          </ul>
          <div className="auth-security"><ShieldCheck size={16} /><span>{backendConfigured ? "Account access is verified by Supabase Auth. Protected profile roles are checked on the server." : "Preview credentials are stored only in this browser. Configure Supabase before accepting real member accounts."}</span></div>
        </div>
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-tabs" role="tablist">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>Log in</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => onModeChange("signup")}>Sign up</button>
          </div>
          {mode === "signup" && <label className="form-field"><span>Full name</span><div><UserRound size={17} /><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your full name" required /></div></label>}
          <label className="form-field"><span>Email address</span><div><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></div></label>
          <label className="form-field"><span>Password</span><div><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {mode === "signup" && <>
            <label className="form-field"><span>Confirm password</span><div><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" placeholder="Repeat your password" required /></div></label>
            <label className="form-check"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span><Check size={12} /></span><p>I understand that cashback requires an eligible tracked purchase and verification.</p></label>
          </>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-lime auth-submit" disabled={loading} type="submit">{loading ? "Please wait…" : mode === "login" ? "Log in to PropApex" : "Create free account"}<ArrowRight size={17} /></button>
          <p className="auth-switch">{mode === "login" ? "New to PropApex?" : "Already have an account?"} <button type="button" onClick={() => onModeChange(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Create an account" : "Log in"}</button></p>
        </form>
      </div>
    </Modal>
  );
}
