import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

type Quote = { pair: string; rate: number; change: number | null };
const PAIRS: { pair: string; symbol: string; invert: boolean; digits: number }[] = [
  { pair: "EUR/USD", symbol: "EUR", invert: true, digits: 4 },
  { pair: "GBP/USD", symbol: "GBP", invert: true, digits: 4 },
  { pair: "USD/JPY", symbol: "JPY", invert: false, digits: 2 },
  { pair: "USD/CHF", symbol: "CHF", invert: false, digits: 4 },
  { pair: "AUD/USD", symbol: "AUD", invert: true, digits: 4 },
  { pair: "USD/CAD", symbol: "CAD", invert: false, digits: 4 },
  { pair: "NZD/USD", symbol: "NZD", invert: true, digits: 4 },
];

type ApiResponse = { rates: Record<string, Record<string, number>> };

export default function MarketTicker() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [asOf, setAsOf] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const end = new Date();
    const start = new Date(end.getTime() - 9 * 24 * 3600 * 1000);
    const fmt = (date: Date) => date.toISOString().slice(0, 10);
    const symbols = PAIRS.map((item) => item.symbol).join(",");

    fetch(`https://api.frankfurter.dev/v1/${fmt(start)}..${fmt(end)}?base=USD&symbols=${symbols}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Rates unavailable"))))
      .then((data: ApiResponse) => {
        const dates = Object.keys(data.rates).sort();
        if (dates.length === 0) throw new Error("No rates");
        const latest = data.rates[dates[dates.length - 1]];
        const previous = dates.length > 1 ? data.rates[dates[dates.length - 2]] : null;
        setAsOf(dates[dates.length - 1]);
        setQuotes(
          PAIRS.map(({ pair, symbol, invert }) => {
            const value = invert ? 1 / latest[symbol] : latest[symbol];
            const prior = previous ? (invert ? 1 / previous[symbol] : previous[symbol]) : null;
            return { pair, rate: value, change: prior ? ((value - prior) / prior) * 100 : null };
          }),
        );
      })
      .catch(() => setQuotes(null));
    return () => controller.abort();
  }, []);

  if (!quotes) return null;
  const items = [...quotes, ...quotes];

  return (
    <div className="market-ticker" aria-label={`Daily reference exchange rates as of ${asOf}`}>
      <div className="container market-ticker-inner">
        <span className="ticker-label"><i /> ECB REFERENCE · {new Date(asOf + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        <div className="ticker-window">
          <div className="ticker-track">
            {items.map((quote, index) => {
              const digits = PAIRS.find((item) => item.pair === quote.pair)?.digits ?? 4;
              const up = (quote.change ?? 0) >= 0;
              return (
                <span className="ticker-item" key={`${quote.pair}-${index}`} aria-hidden={index >= quotes.length}>
                  <strong>{quote.pair}</strong>
                  <span>{quote.rate.toFixed(digits)}</span>
                  {quote.change !== null && <em className={up ? "up" : "down"}>{up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{up ? "+" : ""}{quote.change.toFixed(2)}%</em>}
                </span>
              );
            })}
          </div>
        </div>
        <span className="ticker-note">Daily reference rates, not live trading prices</span>
      </div>
    </div>
  );
}
