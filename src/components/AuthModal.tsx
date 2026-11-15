import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import Modal from "./Modal";
import { useAccount } from "../context/AccountContext";
import { LogoMark } from "./Logo";
import { supabase } from "../lib/supabase";

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
  const [view, setView] = useState<"auth" | "forgot" | "reset">(() => window.location.hash.includes("type=recovery") ? "reset" : "auth");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setError("");
    setNotice("");
    setView(window.location.hash.includes("type=recovery") ? "reset" : "auth");
    setPassword("");
    setConfirm("");
    setTerms(false);
  }, [mode, open]);

  const requestPasswordReset = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Enter the email address linked to your account.");
      return;
    }
    if (!supabase) {
      setError("Password reset is unavailable until Supabase is configured.");
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/`,
      });
      if (resetError) setError(resetError.message);
      else setNotice("If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.");
    } catch {
      setError("Could not send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveNewPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    if (!supabase) {
      setError("Password update is unavailable until Supabase is configured.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) setError(updateError.message);
      else {
        setPassword("");
        setConfirm("");
        setNotice("Your password has been updated. You can now log in with your new password.");
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        setView("auth");
      }
    } catch {
      setError("Could not update your password. Please open the latest reset link and try again.");
    } finally {
      setLoading(false);
    }
  };

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
        <form className="auth-form" onSubmit={view === "forgot" ? requestPasswordReset : view === "reset" ? saveNewPassword : submit} noValidate>
          {view === "auth" && <div className="auth-tabs" role="tablist">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>Log in</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => onModeChange("signup")}>Sign up</button>
          </div>}
          {view === "forgot" && <><h3 className="auth-form-heading">Forgot your password?</h3><p className="auth-form-copy">Enter your account email and we’ll send you a reset link.</p></>}
          {view === "reset" && <><h3 className="auth-form-heading">Set a new password</h3><p className="auth-form-copy">Choose a new password for your PropApex account.</p></>}
          {view !== "reset" && mode === "signup" && <label className="form-field"><span>Full name</span><div><UserRound size={17} /><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your full name" required /></div></label>}
          {view !== "reset" && <label className="form-field"><span>Email address</span><div><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></div></label>}
          {view !== "forgot" && <label className="form-field"><span>Password</span><div><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={view === "reset" || mode === "signup" ? "At least 8 characters" : "Your password"} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>}
          {view !== "forgot" && (view === "reset" || mode === "signup") && <>
            <label className="form-field"><span>Confirm password</span><div><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" placeholder="Repeat your password" required /></div></label>
            {view === "auth" && mode === "signup" && <label className="form-check"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span><Check size={12} /></span><p>I understand that cashback requires an eligible tracked purchase and verification.</p></label>}
          </>}
          {error && <div className="form-error" role="alert">{error}</div>}
          {notice && <div className="form-success" role="status">{notice}</div>}
          {view === "forgot" ? <button className="button button-lime auth-submit" disabled={loading} type="submit">{loading ? "Sending…" : "Send reset link"}<ArrowRight size={17} /></button>
            : view === "reset" ? <button className="button button-lime auth-submit" disabled={loading} type="submit">{loading ? "Saving…" : "Update password"}<ArrowRight size={17} /></button>
            : <button className="button button-lime auth-submit" disabled={loading} type="submit">{loading ? "Please wait…" : mode === "login" ? "Log in to PropApex" : "Create free account"}<ArrowRight size={17} /></button>}
          {view === "auth" && mode === "login" && <button className="text-button auth-forgot" type="button" onClick={() => { setError(""); setNotice(""); setView("forgot"); }}>Forgot password?</button>}
          {view !== "reset" && <p className="auth-switch">{view === "forgot" ? "Remember your password?" : mode === "login" ? "New to PropApex?" : "Already have an account?"} <button type="button" onClick={() => { if (view === "forgot") { setView("auth"); } else onModeChange(mode === "login" ? "signup" : "login"); }}>{view === "forgot" ? "Back to login" : mode === "login" ? "Create an account" : "Log in"}</button></p>}
        </form>
      </div>
    </Modal>
  );
}
