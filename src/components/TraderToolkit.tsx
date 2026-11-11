import { useMemo, useState } from "react";
import { Calculator, Crosshair, Gauge, Info, ShieldAlert, Target } from "lucide-react";

type Tab = "position" | "challenge" | "rr";

const INSTRUMENTS = [
  { id: "EURUSD", label: "EUR/USD", kind: "usd-quote", price: 1.12 },
  { id: "GBPUSD", label: "GBP/USD", kind: "usd-quote", price: 1.34 },
  { id: "AUDUSD", label: "AUD/USD", kind: "usd-quote", price: 0.69 },
  { id: "NZDUSD", label: "NZD/USD", kind: "usd-quote", price: 0.56 },
  { id: "USDJPY", label: "USD/JPY", kind: "jpy", price: 158 },
  { id: "USDCAD", label: "USD/CAD", kind: "usd-base", price: 1.41 },
  { id: "USDCHF", label: "USD/CHF", kind: "usd-base", price: 0.82 },
] as const;

const money = (value: number, digits = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0);
const num = (value: string) => Number.parseFloat(value) || 0;

function NumberField({ label, value, onChange, suffix, prefix, step = "any", hint }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; prefix?: string; step?: string; hint?: string }) {
  return (
    <label className="tool-field">
      <span>{label}</span>
      <div>
        {prefix && <em>{prefix}</em>}
        <input type="number" inputMode="decimal" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} />
        {suffix && <small>{suffix}</small>}
      </div>
      {hint && <p>{hint}</p>}
    </label>
  );
}

function PositionSize() {
  const [balance, setBalance] = useState("10000");
  const [risk, setRisk] = useState("1");
  const [stop, setStop] = useState("25");
  const [instrumentId, setInstrumentId] = useState<(typeof INSTRUMENTS)[number]["id"]>("EURUSD");
  const instrument = INSTRUMENTS.find((item) => item.id === instrumentId) ?? INSTRUMENTS[0];
  const [price, setPrice] = useState(String(instrument.price));

  const result = useMemo(() => {
    const riskAmount = (num(balance) * num(risk)) / 100;
    const px = num(price);
    // Pip value (USD) for one standard lot of 100,000 units.
    let pipValue = 10;
    if (instrument.kind === "jpy") pipValue = px > 0 ? 1000 / px : 0;
    if (instrument.kind === "usd-base") pipValue = px > 0 ? 10 / px : 0;
    const stopPips = num(stop);
    const lots = stopPips > 0 && pipValue > 0 ? riskAmount / (stopPips * pipValue) : 0;
    return { riskAmount, pipValue, lots, units: lots * 100000 };
  }, [balance, risk, stop, price, instrument.kind]);

  const changeInstrument = (id: (typeof INSTRUMENTS)[number]["id"]) => {
    setInstrumentId(id);
    const next = INSTRUMENTS.find((item) => item.id === id);
    if (next) setPrice(String(next.price));
  };

  return (
    <div className="tool-grid">
      <div className="tool-inputs">
        <label className="tool-field">
          <span>Instrument</span>
          <div><select value={instrumentId} onChange={(event) => changeInstrument(event.target.value as typeof instrumentId)}>{INSTRUMENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
        </label>
        <NumberField label="Account balance" prefix="$" value={balance} onChange={setBalance} suffix="USD" />
        <NumberField label="Risk per trade" value={risk} onChange={setRisk} suffix="%" step="0.1" hint="Many traders keep this between 0.25% and 1%." />
        <NumberField label="Stop loss" value={stop} onChange={setStop} suffix="pips" />
        {instrument.kind !== "usd-quote" && <NumberField label={`Current ${instrument.label} price`} value={price} onChange={setPrice} step="0.0001" hint="Needed to convert the pip value into USD." />}
      </div>
      <div className="tool-result">
        <div className="tool-result-main"><span>Recommended position size</span><strong>{result.lots.toFixed(2)} <small>lots</small></strong><p>{Math.round(result.units).toLocaleString()} units</p></div>
        <dl>
          <div><dt>Amount at risk</dt><dd>{money(result.riskAmount)}</dd></div>
          <div><dt>Pip value (1 lot)</dt><dd>{money(result.pipValue, 3)}</dd></div>
          <div><dt>Loss if stop hit</dt><dd>{money(result.lots * num(stop) * result.pipValue)}</dd></div>
        </dl>
        <p className="tool-note"><Info size={13} /> Round down to your broker’s lot step and always confirm contract size and pip value on your own platform.</p>
      </div>
    </div>
  );
}

function ChallengePlanner() {
  const [size, setSize] = useState("100000");
  const [target, setTarget] = useState("8");
  const [maxDd, setMaxDd] = useState("10");
  const [dailyDd, setDailyDd] = useState("5");
  const [riskPerTrade, setRiskPerTrade] = useState("0.5");
  const [winRate, setWinRate] = useState("45");
  const [rr, setRr] = useState("2");

  const r = useMemo(() => {
    const account = num(size);
    const targetAmount = (account * num(target)) / 100;
    const riskAmount = (account * num(riskPerTrade)) / 100;
    const expectancyR = (num(winRate) / 100) * num(rr) - (1 - num(winRate) / 100);
    const expectedPerTrade = expectancyR * riskAmount;
    const tradesNeeded = expectedPerTrade > 0 ? Math.ceil(targetAmount / expectedPerTrade) : null;
    const lossesToBreach = riskAmount > 0 ? Math.floor((account * num(maxDd)) / 100 / riskAmount) : 0;
    const lossesToDaily = riskAmount > 0 ? Math.floor((account * num(dailyDd)) / 100 / riskAmount) : 0;
    return { targetAmount, riskAmount, expectancyR, tradesNeeded, lossesToBreach, lossesToDaily, maxDdAmount: (account * num(maxDd)) / 100, dailyAmount: (account * num(dailyDd)) / 100 };
  }, [size, target, maxDd, dailyDd, riskPerTrade, winRate, rr]);

  return (
    <div className="tool-grid">
      <div className="tool-inputs two-col">
        <NumberField label="Account size" prefix="$" value={size} onChange={setSize} suffix="USD" />
        <NumberField label="Profit target" value={target} onChange={setTarget} suffix="%" step="0.1" />
        <NumberField label="Max drawdown" value={maxDd} onChange={setMaxDd} suffix="%" step="0.1" />
        <NumberField label="Daily drawdown" value={dailyDd} onChange={setDailyDd} suffix="%" step="0.1" />
        <NumberField label="Risk per trade" value={riskPerTrade} onChange={setRiskPerTrade} suffix="%" step="0.1" />
        <NumberField label="Win rate" value={winRate} onChange={setWinRate} suffix="%" />
        <NumberField label="Average reward : risk" value={rr} onChange={setRr} suffix="R" step="0.1" />
      </div>
      <div className="tool-result">
        <div className="tool-result-main"><span>Profit target</span><strong>{money(r.targetAmount, 0)}</strong><p>{r.tradesNeeded ? `≈ ${r.tradesNeeded} trades at your current edge` : "No positive edge at these inputs"}</p></div>
        <dl>
          <div><dt>Risk per trade</dt><dd>{money(r.riskAmount, 0)}</dd></div>
          <div><dt>Expectancy per trade</dt><dd className={r.expectancyR >= 0 ? "pos" : "neg"}>{r.expectancyR >= 0 ? "+" : ""}{r.expectancyR.toFixed(2)}R</dd></div>
          <div><dt>Max drawdown limit</dt><dd>{money(r.maxDdAmount, 0)}</dd></div>
          <div><dt>Daily loss limit</dt><dd>{money(r.dailyAmount, 0)}</dd></div>
          <div><dt>Losses to breach daily</dt><dd className={r.lossesToDaily < 4 ? "neg" : ""}>{r.lossesToDaily} in a row</dd></div>
          <div><dt>Losses to breach max</dt><dd className={r.lossesToBreach < 8 ? "neg" : ""}>{r.lossesToBreach} in a row</dd></div>
        </dl>
        <p className="tool-note"><ShieldAlert size={13} /> A simple projection, not a prediction. Check how your chosen firm calculates drawdown (static, trailing or equity-based).</p>
      </div>
    </div>
  );
}

function RiskReward() {
  const [entry, setEntry] = useState("1.1000");
  const [stopPrice, setStopPrice] = useState("1.0975");
  const [targetPrice, setTargetPrice] = useState("1.1050");
  const [riskAmount, setRiskAmount] = useState("100");

  const r = useMemo(() => {
    const e = num(entry); const s = num(stopPrice); const t = num(targetPrice);
    const risk = Math.abs(e - s); const reward = Math.abs(t - e);
    const direction = t > e && s < e ? "Long" : t < e && s > e ? "Short" : "Check levels";
    const ratio = risk > 0 ? reward / risk : 0;
    return { ratio, direction, breakEven: ratio > 0 ? 100 / (1 + ratio) : 0, potential: num(riskAmount) * ratio, valid: direction !== "Check levels" };
  }, [entry, stopPrice, targetPrice, riskAmount]);

  return (
    <div className="tool-grid">
      <div className="tool-inputs two-col">
        <NumberField label="Entry price" value={entry} onChange={setEntry} step="0.0001" />
        <NumberField label="Stop-loss price" value={stopPrice} onChange={setStopPrice} step="0.0001" />
        <NumberField label="Take-profit price" value={targetPrice} onChange={setTargetPrice} step="0.0001" />
        <NumberField label="Amount risked" prefix="$" value={riskAmount} onChange={setRiskAmount} suffix="USD" />
      </div>
      <div className="tool-result">
        <div className="tool-result-main"><span>Reward : risk</span><strong>{r.valid ? `1 : ${r.ratio.toFixed(2)}` : "—"}</strong><p>{r.direction === "Check levels" ? "Stop and target must sit on opposite sides of entry" : `${r.direction} setup`}</p></div>
        <dl>
          <div><dt>Potential profit</dt><dd>{r.valid ? money(r.potential) : "—"}</dd></div>
          <div><dt>Break-even win rate</dt><dd>{r.valid ? `${r.breakEven.toFixed(1)}%` : "—"}</dd></div>
          <div><dt>Amount at risk</dt><dd>{money(num(riskAmount))}</dd></div>
        </dl>
        <p className="tool-note"><Info size={13} /> Break-even win rate ignores spreads, commissions and slippage.</p>
      </div>
    </div>
  );
}

export default function TraderToolkit() {
  const [tab, setTab] = useState<Tab>("position");
  const tabs: { id: Tab; label: string; icon: typeof Calculator; copy: string }[] = [
    { id: "position", label: "Position size", icon: Crosshair, copy: "Size every trade from your risk, not your hope." },
    { id: "challenge", label: "Challenge planner", icon: Gauge, copy: "Stress-test a prop-firm challenge before you pay for it." },
    { id: "rr", label: "Risk : reward", icon: Target, copy: "Measure a setup and the win rate it needs to break even." },
  ];
  const active = tabs.find((item) => item.id === tab) ?? tabs[0];

  return (
    <section className="toolkit-section" id="tools">
      <div className="container">
        <div className="section-heading toolkit-heading">
          <div><p className="eyebrow"><span /> TRADER TOOLKIT</p><h2>Plan the trade<br /><em>before the challenge.</em></h2></div>
          <p>Free calculators built for prop-firm traders. They run in your browser, with nothing saved or sent anywhere.</p>
        </div>
        <div className="toolkit-card">
          <div className="toolkit-tabs" role="tablist" aria-label="Trader calculators">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={17} />{label}</button>
            ))}
          </div>
          <p className="toolkit-copy"><Calculator size={15} /> {active.copy}</p>
          {tab === "position" && <PositionSize />}
          {tab === "challenge" && <ChallengePlanner />}
          {tab === "rr" && <RiskReward />}
        </div>
      </div>
    </section>
  );
}
