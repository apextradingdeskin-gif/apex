import { useMemo, useState } from "react";
import { ArrowRight, Check, Coins, Gift, GraduationCap, Lock, ShieldCheck, Sparkles, Wrench, Trophy, type LucideIcon } from "lucide-react";
import { rewardCatalog, rewardCategories, type RewardCategory, type RewardItem } from "../data/rewards";
import { useAccount } from "../context/AccountContext";
import Modal from "./Modal";

const categoryIcon: Record<RewardCategory, LucideIcon> = {
  Challenges: Trophy,
  Tools: Wrench,
  "Gift cards": Gift,
  Experiences: GraduationCap,
};

type Props = { onRequireAuth: () => void; onNotice: (message: string) => void };

export default function Marketplace({ onRequireAuth, onNotice }: Props) {
  const { user, credits, redeemItem, platformSettings, backendConfigured } = useAccount();
  const [category, setCategory] = useState<"All" | RewardCategory>("All");
  const [selected, setSelected] = useState<RewardItem | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const items = useMemo(() => rewardCatalog.filter((item) => category === "All" || item.category === category), [category]);
  const nextGoal = useMemo(() => rewardCatalog.filter((item) => item.cost > credits.available).sort((a, b) => a.cost - b.cost)[0], [credits.available]);

  const confirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const result = await redeemItem({ id: selected.id, name: selected.name, cost: selected.cost });
      if (!result.ok) { setError(result.message); return; }
      onNotice(result.message);
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="market-section" id="marketplace">
      <div className="market-glow" />
      <div className="container">
        <div className="section-heading market-heading">
          <div><p className="eyebrow"><span /> PropApex MARKETPLACE</p><h2>Turn every purchase<br />into <em>PropApex Credits.</em></h2></div>
          <p>Earn {platformSettings.creditRate} credit{platformSettings.creditRate === 1 ? "" : "s"} per $1 of eligible net spend. Once your purchases are verified, redeem credits for challenge credits, trader tools and more.</p>
        </div>

        <div className="credits-bar">
          <div className="credits-bar-icon"><Coins size={24} /></div>
          {user ? (
            <>
              <div className="credits-stat main"><span>Available credits</span><strong>{credits.available.toLocaleString()}</strong></div>
              <div className="credits-stat"><span>Pending verification</span><strong>{credits.pending.toLocaleString()}</strong></div>
              <div className="credits-stat"><span>Redeemed</span><strong>{credits.spent.toLocaleString()}</strong></div>
              <div className="credits-goal">
                {nextGoal ? (
                  <>
                    <div><span>Next reward: {nextGoal.name}</span><strong>{Math.min(100, Math.round((credits.available / nextGoal.cost) * 100))}%</strong></div>
                    <div className="goal-track"><span style={{ width: `${Math.min(100, (credits.available / nextGoal.cost) * 100)}%` }} /></div>
                    <small>{(nextGoal.cost - credits.available).toLocaleString()} more credits needed</small>
                  </>
                ) : <small>You can afford every reward in the catalog.</small>}
              </div>
            </>
          ) : (
            <>
              <div className="credits-guest"><strong>Start earning credits</strong><span>Create a free account, then submit eligible purchases to build your balance.</span></div>
              <button className="button button-lime" onClick={onRequireAuth}>Create free account <ArrowRight size={16} /></button>
            </>
          )}
        </div>

        <div className="market-steps">
          {[["Earn", "1 credit per $1 of eligible net spend"], ["Verify", "Credits become spendable after purchase approval"], ["Redeem", "Request a reward; credits are reserved instantly"]].map(([title, copy], index) => (
            <div key={title}><span>0{index + 1}</span><p><strong>{title}</strong>{copy}</p></div>
          ))}
        </div>

        <div className="market-filters" role="tablist" aria-label="Reward categories">
          {rewardCategories.map((item) => (
            <button key={item} role="tab" aria-selected={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}<small>{item === "All" ? rewardCatalog.length : rewardCatalog.filter((reward) => reward.category === item).length}</small></button>
          ))}
        </div>

        <div className="reward-grid">
          {items.map((item) => {
            const Icon = categoryIcon[item.category];
            const affordable = user ? credits.available >= item.cost : false;
            return (
              <article className={`reward-card ${affordable ? "affordable" : ""}`} key={item.id}>
                {item.badge && <span className="reward-badge"><Sparkles size={11} />{item.badge}</span>}
                <div className="reward-card-icon"><Icon size={24} /></div>
                <p className="reward-category">{item.category}</p>
                <h3>{item.name}</h3>
                <p className="reward-desc">{item.description}</p>
                <div className="reward-card-foot">
                  <div><strong><Coins size={14} />{item.cost.toLocaleString()}</strong><small>Value {item.value}</small></div>
                  <button
                    className={affordable ? "redeem-btn ready" : "redeem-btn"}
                    onClick={() => { if (!user) { onRequireAuth(); return; } setError(""); setSelected(item); }}
                  >
                    {!user ? <><Lock size={13} /> Log in</> : affordable ? <>Redeem <ArrowRight size={13} /></> : "View"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <p className="market-disclaimer"><ShieldCheck size={15} /> The catalog is a preview. {backendConfigured ? "Redemptions are saved in Supabase and remain requests until an administrator fulfils them." : "Redemptions are saved as requests on this device until the rewards backend is connected."} Fulfilment, availability and partner terms must be confirmed. Credits have no cash value and are not transferable.</p>
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Confirm redemption" eyebrow="PropApex MARKETPLACE">
        {selected && (
          <div className="redeem-modal">
            <div className="redeem-summary"><div className="reward-card-icon"><Coins size={24} /></div><div><h3>{selected.name}</h3><p>{selected.description}</p></div></div>
            <dl>
              <div><dt>Cost</dt><dd>{selected.cost.toLocaleString()} credits</dd></div>
              <div><dt>Your available balance</dt><dd>{credits.available.toLocaleString()} credits</dd></div>
              <div className="total"><dt>Balance after redemption</dt><dd>{Math.max(0, credits.available - selected.cost).toLocaleString()} credits</dd></div>
            </dl>
            {credits.available < selected.cost && <div className="form-error" role="alert">You need {(selected.cost - credits.available).toLocaleString()} more approved credits. Pending credits can’t be spent until the related purchases are verified.</div>}
            {error && <div className="form-error" role="alert">{error}</div>}
            <p className="redeem-note"><ShieldCheck size={14} /> You can cancel a requested redemption from your dashboard to release the credits.</p>
            <button className="button button-lime redeem-confirm" onClick={confirm} disabled={credits.available < selected.cost || submitting}><Check size={16} />{submitting ? "Submitting…" : "Confirm redemption"}</button>
          </div>
        )}
      </Modal>
    </section>
  );
}
