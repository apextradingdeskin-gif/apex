import { useMemo, useState } from "react";
import { ArrowRight, BadgePercent, Check, CircleDollarSign, MousePointerClick, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { getCashbackRate, type Firm } from "../data/firms";
import { useAccount } from "../context/AccountContext";
import FirmLogo from "./FirmLogo";
import { mailto } from "../data/contact";

export default function CashbackCenter({ onActivate }: { onActivate: (firm: Firm) => void }) {
  const { firms } = useAccount();
  const rewardFirms = useMemo(() => firms.filter((firm) => firm.status !== "archived").sort((a, b) => getCashbackRate(b.id) - getCashbackRate(a.id)), [firms]);
  const [calculatorFirmId, setCalculatorFirmId] = useState("shark-funded");
  const [spend, setSpend] = useState("500");
  const calculatorFirm = rewardFirms.find((firm) => firm.id === calculatorFirmId) ?? rewardFirms[0];
  const estimated = (Number(spend) || 0) * getCashbackRate(calculatorFirm?.id ?? "") / 100;

  if (!calculatorFirm) return <section className="cashback-section" id="cashback"><div className="container"><p className="eyebrow">APEX REWARDS</p><h2>New firm offers are being prepared.</h2><p>Check back soon or contact our team for help.</p></div></section>;

  return (
    <section className="cashback-section" id="cashback">
      <div className="cashback-aurora" />
      <div className="container">
        <div className="cashback-heading">
          <div><p className="eyebrow"><span /> APEX REWARDS</p><h2>Buy through APEX.<br /><em>Get cashback back.</em></h2></div>
          <div className="cashback-heading-copy"><p>Earn cashback on every eligible prop-firm purchase made through our tracked link or listed code. Activate, purchase and submit your order—we’ll keep its status clear.</p><a href="#cashback-terms">How eligibility works <ArrowRight size={14} /></a></div>
        </div>

        <div className="cashback-workflow">
          {[
            [MousePointerClick, "01", "Activate", "Open the firm through your APEX account."],
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
            <div className="panel-heading"><div><span>Listed reward rates</span><h3>Choose a firm & activate</h3></div><span className="rate-badge">UP TO {Math.max(0, ...rewardFirms.map((firm) => getCashbackRate(firm.id)))}% BACK</span></div>
            <div className="reward-firm-grid">
              {rewardFirms.slice(0, 6).map((firm) => <article className="reward-firm-card" key={firm.id}>
                <div className="reward-firm-top"><FirmLogo firm={firm} large /><span className="reward-percent">{getCashbackRate(firm.id)}<small>%</small></span></div>
                <h3>{firm.name}</h3><p>{firm.market} · {firm.allocationLabel} allocation</p>
                <div className="reward-code">{firm.code ? <><span>Code</span><strong>{firm.code}</strong></> : <span>Tracked link only</span>}</div>
                <button onClick={() => onActivate(firm)}>Activate cashback <ArrowRight size={15} /></button>
              </article>)}
            </div>
          </div>

          <aside className="cashback-calculator">
            <div className="calculator-icon"><CircleDollarSign size={25} /></div>
            <p className="eyebrow">REWARD CALCULATOR</p><h3>See what your next<br />challenge could earn.</h3>
            <label><span>Choose your firm</span><select value={calculatorFirmId} onChange={(event) => setCalculatorFirmId(event.target.value)}>{rewardFirms.map((firm) => <option value={firm.id} key={firm.id}>{firm.name} · {getCashbackRate(firm.id)}%</option>)}</select></label>
            <label><span>Net purchase amount</span><div className="calculator-input"><span>$</span><input type="number" min="0" step="1" value={spend} onChange={(event) => setSpend(event.target.value)} /><small>USD</small></div></label>
            <div className="calculator-result"><span>Estimated cashback</span><strong>${estimated.toFixed(2)}</strong><small>{getCashbackRate(calculatorFirm.id)}% of ${(Number(spend) || 0).toFixed(2)} eligible net spend</small></div>
            <button className="button button-lime" onClick={() => onActivate(calculatorFirm)}>Activate {getCashbackRate(calculatorFirm.id)}% reward <ArrowRight size={16} /></button>
            <p className="calculator-disclaimer"><ShieldCheck size={14} /> An estimate, not an approval. Final rewards depend on tracked, eligible net spend.</p>
          </aside>
        </div>

        <div className="cashback-terms" id="cashback-terms"><ShieldCheck size={20} /><div><strong>Clear terms. No mystery balances.</strong><p>Cashback applies to qualifying new purchases attributed to APEX. Refunded, charged-back, duplicate or untracked orders may be ineligible. Submitted orders begin as pending; cashback becomes available only after purchase and referral verification. Your orders and rewards are saved to your APEX account and reviewed by authorised administrators.</p></div><a href={mailto("Cashback eligibility question")}>Ask rewards support <ArrowRight size={14} /></a></div>
      </div>
    </section>
  );
}
