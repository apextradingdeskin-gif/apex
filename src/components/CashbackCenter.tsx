import { useMemo, useState } from "react";
import { ArrowRight, BadgePercent, Check, CircleDollarSign, MousePointerClick, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { cashbackRateFor, isAffiliateTrackingReady, type Firm } from "../data/firms";
import { useAccount } from "../context/AccountContext";
import FirmLogo from "./FirmLogo";
import { LogoMark } from "./Logo";

export default function CashbackCenter({ onActivate }: { onActivate: (firm: Firm) => void }) {
  const { firms, backendConfigured, platformSettings } = useAccount();
  const rewardFirms = useMemo(() => firms.filter((firm) => firm.status !== "archived" && isAffiliateTrackingReady(firm)).sort((a, b) => cashbackRateFor(b) - cashbackRateFor(a)), [firms]);
  const [calculatorFirmId, setCalculatorFirmId] = useState(firms[0]?.id ?? "");
  const [spend, setSpend] = useState("500");
  const calculatorFirm = rewardFirms.find((firm) => firm.id === calculatorFirmId) ?? rewardFirms[0] ?? firms[0];
  const hasTrackedFirms = rewardFirms.length > 0;
  const estimated = hasTrackedFirms ? (Number(spend) || 0) * cashbackRateFor(calculatorFirm) / 100 : 0;

  return (
    <section className="cashback-section" id="cashback">
      <div className="cashback-aurora" />
      <div className="container">
        <div className="cashback-heading">
          <div><p className="eyebrow"><span /> PropApex REWARDS</p><h2>Buy through PropApex.<br /><em>Get cashback back.</em></h2></div>
          <div className="cashback-heading-copy"><p>Earn cashback on every eligible prop-firm purchase made through our tracked link or listed code. Activate, purchase and submit your order—we’ll keep its status clear.</p><a href="#cashback-terms">How eligibility works <ArrowRight size={14} /></a></div>
            <div className="cashback-coin-stage" aria-label="Three-dimensional PropApex rewards coin">
              <span className="coin-orbit orbit-a" /><span className="coin-orbit orbit-b" />
              <div className="credit-coin"><div className="coin-rim" /><LogoMark /><span>PropApex</span><small>CREDITS</small></div>
              <span className="coin-pedestal" />
            </div>
        </div>

        <div className="cashback-workflow">
          {[
            [MousePointerClick, "01", "Activate", "Open the firm through your PropApex account."],
            [BadgePercent, "02", "Purchase", "Use the eligible link or listed code at checkout."],
            [ReceiptText, "03", "Submit", "Add the order ID and net purchase amount."],
            [WalletCards, "04", "Get rewarded", "Track verification and available cashback."],
          ].map(([Icon, number, title, copy], index) => {
            const StepIcon = Icon as typeof Check;
            return <div className="cashback-step" key={number as string}><span className="step-number">{number as string}</span><span className="step-icon"><StepIcon size={20} /></span><div><strong>{title as string}</strong><p>{copy as string}</p></div>{index < 3 && <ArrowRight className="step-arrow" size={17} />}</div>;
          })}
        </div>

        <div className="rewards-layout">
          <div className="reward-firms-panel">
            <div className="panel-heading"><div><span>Affiliate links configured by PropApex</span><h3>Choose a firm & activate</h3></div>{hasTrackedFirms && <span className="rate-badge">UP TO {Math.max(...rewardFirms.map((firm) => cashbackRateFor(firm)))}% BACK</span>}</div>
            {hasTrackedFirms ? <div className="reward-firm-grid">
              {rewardFirms.slice(0, 6).map((firm) => <article className="reward-firm-card" key={firm.id}>
                <div className="reward-firm-top"><FirmLogo firm={firm} large /><span className="reward-percent">{cashbackRateFor(firm)}<small>%</small></span></div>
                <h3>{firm.name}</h3><p>{firm.market} · {firm.allocationLabel} allocation</p>
                <div className="reward-code">{firm.apexCode ? <><span>PropApex code</span><strong>{firm.apexCode}</strong></> : <span>Tracked link · {firm.code ? `Offer code ${firm.code}` : "click ID enabled"}</span>}</div>
                <button onClick={() => onActivate(firm)}>Activate cashback <ArrowRight size={15} /></button>
              </article>)}
            </div> : <div className="tracking-setup-empty"><span><ShieldCheck size={23} /></span><div><strong>Cashback partners are being set up.</strong><p>PropApex cashback appears here once partner links or exclusive PropApex codes are configured. For a purchase to qualify, its link or code must be verifiable with the firm.</p></div></div>}
          </div>

          <aside className="cashback-calculator">
            <div className="calculator-icon"><CircleDollarSign size={25} /></div>
            <p className="eyebrow">REWARD CALCULATOR</p><h3>See what your next<br />challenge could earn.</h3>
            <label><span>Choose your firm</span><select disabled={!hasTrackedFirms} value={calculatorFirm?.id ?? ""} onChange={(event) => setCalculatorFirmId(event.target.value)}>{hasTrackedFirms ? rewardFirms.map((firm) => <option value={firm.id} key={firm.id}>{firm.name} · {cashbackRateFor(firm)}%</option>) : <option value="">No tracked firms yet</option>}</select></label>
            <label><span>Net purchase amount</span><div className="calculator-input"><span>$</span><input type="number" min="0" step="1" value={spend} onChange={(event) => setSpend(event.target.value)} /><small>USD</small></div></label>
            <div className="calculator-result"><span>Estimated cashback</span><strong>${estimated.toFixed(2)}</strong><small>{cashbackRateFor(calculatorFirm)}% of ${(Number(spend) || 0).toFixed(2)} eligible net spend</small></div>
            <button className="button button-lime" disabled={!hasTrackedFirms} onClick={() => onActivate(calculatorFirm)}>{hasTrackedFirms ? `Activate ${cashbackRateFor(calculatorFirm)}% reward` : "Tracking setup required"} <ArrowRight size={16} /></button>
            <p className="calculator-disclaimer"><ShieldCheck size={14} /> An estimate, not an approval. Final rewards depend on tracked, eligible net spend.</p>
          </aside>
        </div>

        <div className="cashback-terms" id="cashback-terms"><ShieldCheck size={20} /><div><strong>Clear terms. No mystery balances.</strong><p>Cashback applies to qualifying new purchases attributed to PropApex. Refunded, charged-back, duplicate or untracked orders may be ineligible. Submitted orders begin as pending; cashback becomes available only after purchase and referral verification. {backendConfigured ? "Your order is saved to your account and reviewed by an administrator." : "This preview stores orders on this device until a verification backend is connected."}</p></div><a href={`mailto:${platformSettings.supportEmail}?subject=Cashback%20eligibility%20question`}>Ask rewards support <ArrowRight size={14} /></a></div>
      </div>
    </section>
  );
}
