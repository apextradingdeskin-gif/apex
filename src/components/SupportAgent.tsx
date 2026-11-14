import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUpRight, Bot, ExternalLink, MessageCircle, RotateCcw, SendHorizontal, Sparkles, X } from "lucide-react";
import { useAccount } from "../context/AccountContext";
import { answerQuestion, type AssistantAction, type AssistantReply } from "../lib/assistant";
import { mailto } from "../data/contact";
import { DiscordIcon } from "./SocialLinks";

type Message = { id: string; role: "user" | "assistant"; text: string; actions?: AssistantAction[]; suggestions?: string[]; time: number };

type Props = { onOpenAuth: () => void; onTrackPurchase: () => void; onWriteReview: () => void };

const STORAGE_KEY = "apex_assist_transcript_v1";
const makeId = () => `m_${Math.random().toString(36).slice(2, 10)}`;

function renderRich(text: string): ReactNode[] {
  return text.split("\n").map((line, lineIndex) => {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part, partIndex) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*")) return <em key={partIndex}>{part.slice(1, -1)}</em>;
      return <span key={partIndex}>{part}</span>;
    });
    return <span className="msg-line" key={lineIndex}>{parts.length ? parts : "\u00a0"}</span>;
  });
}

export default function SupportAgent({ onOpenAuth, onTrackPurchase, onWriteReview }: Props) {
  const { user, purchases, credits, firms, payoutRequests, platformSettings } = useAccount();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Message[]) : [];
    } catch {
      return [];
    }
  });
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  const ctx = useMemo(() => ({ user, purchases, credits, payoutRequests, payoutMethods: platformSettings.payoutMethods, firms, minPayout: platformSettings.minPayout, social: platformSettings }), [user, purchases, credits, payoutRequests, platformSettings, firms]);

  const welcome = useCallback((): Message => ({
    id: makeId(), role: "assistant", time: Date.now(),
    text: `Hi${user ? ` ${user.name.split(" ")[0]}` : ""}, I'm **PropApex Assist** — an automated assistant that answers from PropApex's help content and your account. Ask me about cashback, credits, any listed firm, or the tools. If I can't help, I'll connect you with the team.`,
    suggestions: ["How does cashback work?", "Which firm has the best cashback?", "What's my purchase status?", "Talk to a human"],
  }), [user]);

  useEffect(() => {
    if (messages.length === 0) setMessages([welcome()]);
  }, [messages.length, welcome]);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60))); } catch { /* storage unavailable */ }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    setUnread(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    const keyHandler = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("apex:open-support", openHandler);
    window.addEventListener("keydown", keyHandler);
    return () => { window.removeEventListener("apex:open-support", openHandler); window.removeEventListener("keydown", keyHandler); };
  }, []);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  const transcriptForEmail = () =>
    messages.slice(-12).map((message) => `${message.role === "user" ? "Me" : "PropApex Assist"}: ${message.text.replace(/\*\*/g, "").replace(/\n/g, "\n   ")}`).join("\n\n");

  const handleAction = (action: AssistantAction) => {
    if (action.type === "link") {
      if (action.external) window.open(action.href, "_blank", "noopener,noreferrer");
      else { window.location.hash = action.href; if (window.innerWidth < 760) setOpen(false); }
      return;
    }
    if (action.event === "human") {
      const body = `Hi PropApex team,\n\n[Describe your question here]\n\n---\nMember: ${user ? `${user.name} (${user.email}) · ID ${user.id}` : "Guest"}\nRecent chat with PropApex Assist:\n\n${transcriptForEmail()}`;
      window.location.href = mailto("Support request via PropApex Assist", body, platformSettings.supportEmail);
      return;
    }
    setOpen(false);
    if (action.event === "auth") onOpenAuth();
    if (action.event === "purchase") onTrackPurchase();
    if (action.event === "review") onWriteReview();
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    const userMessage: Message = { id: makeId(), role: "user", text, time: Date.now() };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setTyping(true);
    const reply: AssistantReply = answerQuestion(text, ctx);
    const delay = Math.min(1400, 350 + reply.text.length * 4);
    timerRef.current = window.setTimeout(() => {
      setMessages((current) => [...current, { id: makeId(), role: "assistant", text: reply.text, actions: reply.actions, suggestions: reply.suggestions, time: Date.now() }]);
      setTyping(false);
      if (!open) setUnread((count) => count + 1);
    }, delay);
  };

  const submit = (event: FormEvent) => { event.preventDefault(); send(input); };
  const reset = () => { setMessages([welcome()]); setInput(""); };

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");

  return (
    <>
      <button className={`assist-launcher ${open ? "is-open" : ""}`} onClick={() => setOpen((value) => !value)} aria-label={open ? "Close PropApex Assist" : "Open PropApex Assist support chat"} aria-expanded={open}>
        <span className="assist-launcher-icon">{open ? <X size={22} /> : <MessageCircle size={22} />}</span>
        {!open && <span className="assist-launcher-label">Ask PropApex</span>}
        {!open && unread > 0 && <span className="assist-unread">{unread}</span>}
      </button>

      <section className={`assist-panel ${open ? "is-open" : ""}`} role="dialog" aria-label="PropApex Assist support chat" aria-hidden={!open}>
        <header className="assist-header">
          <div className="assist-avatar"><Bot size={20} /><span className="assist-online" /></div>
          <div className="assist-title"><strong>PropApex Assist</strong><small><Sparkles size={10} /> Automated assistant · answers in seconds</small></div>
          <button className="assist-icon-btn" onClick={reset} aria-label="Start a new conversation" title="New conversation"><RotateCcw size={16} /></button>
          <button className="assist-icon-btn" onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button>
        </header>

        <div className="assist-messages" ref={listRef}>
          {messages.map((message) => (
            <div className={`assist-msg ${message.role}`} key={message.id}>
              {message.role === "assistant" && <span className="assist-msg-avatar"><Bot size={14} /></span>}
              <div className="assist-bubble">
                <div className="assist-text">{renderRich(message.text)}</div>
                {message.actions && message.actions.length > 0 && (
                  <div className="assist-actions">
                    {message.actions.map((action, index) => (
                      <button key={index} onClick={() => handleAction(action)}>
                        {action.type === "event" && action.event === "human" ? <DiscordIcon size={12} /> : null}
                        {action.label}
                        {action.type === "link" && action.external ? <ExternalLink size={11} /> : <ArrowUpRight size={11} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {typing && (
            <div className="assist-msg assistant">
              <span className="assist-msg-avatar"><Bot size={14} /></span>
              <div className="assist-bubble typing"><span /><span /><span /></div>
            </div>
          )}
        </div>

        {!typing && lastAssistant?.suggestions && lastAssistant.id === messages[messages.length - 1]?.id && (
          <div className="assist-suggestions">
            {lastAssistant.suggestions.map((suggestion) => <button key={suggestion} onClick={() => send(suggestion)}>{suggestion}</button>)}
          </div>
        )}

        <form className="assist-composer" onSubmit={submit}>
          <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about cashback, firms, credits…" aria-label="Type your question" maxLength={400} />
          <button type="submit" disabled={!input.trim() || typing} aria-label="Send"><SendHorizontal size={17} /></button>
        </form>
        <footer className="assist-footer">
          <span>Not financial advice. Account questions may be escalated to <a href={`mailto:${platformSettings.supportEmail}`}>{platformSettings.supportEmail}</a>.</span>
          <a href={platformSettings.socialDiscord} target="_blank" rel="noreferrer"><DiscordIcon size={12} /> Discord</a>
        </footer>
      </section>
    </>
  );
}
