import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  BadgeCheck,
  BadgePercent,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  GitCompareArrows,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { cashbackRateFor, formatReviews, isAffiliateTrackingReady, type Firm } from "../data/firms";
import { useAccount } from "../context/AccountContext";
import { copyText } from "../utils/copyText";
import FirmLogo from "./FirmLogo";
import Modal from "./Modal";

const platformOptions = ["MT5", "cTrader", "Match-Trader", "TradeLocker", "NinjaTrader"];

function Rating({ firm }: { firm: Firm }) {
  return (
    <div className="rating-cell">
      <span><Star size={14} fill="currentColor" /> {firm.rating.toFixed(1)}</span>
      <small>{formatReviews(firm.reviews)} trader reviews</small>
    </div>
  );
}

type FirmDirectoryProps = {
  onActivateCashback: (firm: Firm) => void;
  onWriteReview: (firm: Firm) => void;
};

export default function FirmDirectory({ onActivateCashback, onWriteReview }: FirmDirectoryProps) {
  const { firms } = useAccount();
  const activeFirms = firms.filter((firm) => firm.status !== "archived");
  const offerFirms = [activeFirms[0], activeFirms[3], activeFirms[6]].filter(Boolean) as Firm[];
  const countries = Array.from(new Set(activeFirms.map((firm) => firm.country))).sort();
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState(() => {
    const preferred = localStorage.getItem("apex_preferred_market");
    localStorage.removeItem("apex_preferred_market");
    return preferred === "Forex" || preferred === "Futures" ? preferred : "All";
  });
  const [platform, setPlatform] = useState("All");
  const [country, setCountry] = useState("All");
  const [sort, setSort] = useState("popular");
  const [offersOnly, setOffersOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const filteredFirms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return activeFirms
      .filter((firm) => {
        const haystack = [firm.name, firm.country, firm.market, ...firm.assets, ...firm.platforms].join(" ").toLowerCase();
        return (
          (!normalizedQuery || haystack.includes(normalizedQuery)) &&
          (market === "All" || firm.market === market) &&
          (platform === "All" || firm.platforms.includes(platform)) &&
          (country === "All" || firm.country === country) &&
          (!offersOnly || Boolean(firm.code))
        );
      })
      .sort((a, b) => {
        if (sort === "rating") return b.rating - a.rating || b.reviews - a.reviews;
        if (sort === "allocation") return b.allocation - a.allocation;
        if (sort === "newest") return b.founded - a.founded;
        if (sort === "name") return a.name.localeCompare(b.name);
        return b.rating * Math.log10(b.reviews + 10) - a.rating * Math.log10(a.reviews + 10);
      });
  }, [activeFirms, query, market, platform, country, offersOnly, sort]);

  useEffect(() => setVisibleCount(12), [query, market, platform, country, offersOnly, sort]);

  useEffect(() => {
    const onMarketFilter = (event: Event) => {
      const value = (event as CustomEvent<"All" | "Forex" | "Futures">).detail;
      if (["All", "Forex", "Futures"].includes(value)) {
        setMarket(value);
        setFiltersOpen(false);
      }
    };
    window.addEventListener("apex:filter-market", onMarketFilter);
    return () => window.removeEventListener("apex:filter-market", onMarketFilter);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const syncFirmFromHash = () => {
      const hash = decodeURIComponent(window.location.hash);
      if (hash.startsWith("#firm-")) {
        const match = firms.find((firm) => `#firm-${firm.id}` === hash);
        setSelectedFirm(match ?? null);
      } else {
        setSelectedFirm(null);
      }
    };
    syncFirmFromHash();
    window.addEventListener("hashchange", syncFirmFromHash);
    window.addEventListener("popstate", syncFirmFromHash);
    return () => {
      window.removeEventListener("hashchange", syncFirmFromHash);
      window.removeEventListener("popstate", syncFirmFromHash);
    };
  }, []);

  const openFirm = (firm: Firm) => {
    setCompareOpen(false);
    setSelectedFirm(firm);
    window.history.pushState(null, "", `#firm-${firm.id}`);
  };

  const closeFirm = useCallback(() => {
    setSelectedFirm(null);
    if (window.location.hash.startsWith("#firm-")) {
      window.history.replaceState(null, "", "#top-prop-firms-section");
    }
  }, []);

  const handleCopy = async (firm: Firm) => {
    const code = firm.apexCode || firm.code;
    if (!code) return;
    const success = await copyText(code);
    if (success) {
      setCopied(firm.id);
      setNotice(`${code} copied. Verify eligibility before checkout.`);
      window.setTimeout(() => setCopied((current) => current === firm.id ? null : current), 1800);
    } else {
      setNotice(`Copy unavailable. Code: ${code}`);
    }
  };

  const toggleCompare = (firm: Firm) => {
    setCompareIds((current) => {
      if (current.includes(firm.id)) return current.filter((id) => id !== firm.id);
      if (current.length >= 3) {
        setNotice("You can compare up to three firms at a time.");
        return current;
      }
      return [...current, firm.id];
    });
  };

  const resetFilters = () => {
    setQuery("");
    setMarket("All");
    setPlatform("All");
    setCountry("All");
    setOffersOnly(false);
    setSort("popular");
  };

  const compareFirms = compareIds.map((id) => firms.find((firm) => firm.id === id)).filter(Boolean) as Firm[];
  const hasFilters = Boolean(query || market !== "All" || platform !== "All" || country !== "All" || offersOnly);

  return (
    <section className="directory-section" id="top-prop-firms-section">
      <div className="container">
        <div className="section-heading directory-heading">
          <div>
            <p className="eyebrow"><span /> THE FIRM DIRECTORY</p>
            <h2>Compare The <em>Best Prop Firms</em></h2>
          </div>
          <p>Compare markets, operating history, platforms, assets and allocations. Open any firm for rule context and official-source links.</p>
        </div>

        <div className="offer-desk" id="offers">
          <div className="offer-desk-title">
            <BadgePercent size={20} />
            <div><strong>Offer desk</strong><span>Rule fit first. Discount second.</span></div>
          </div>
          <div className="offer-desk-items">
            {offerFirms.map((firm) => (
              <button key={firm.id} onClick={() => openFirm(firm)}>
                <FirmLogo firm={firm} />
                <span><strong>{firm.name}</strong><small>{firm.promo} · {firm.code}</small></span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        </div>

        <div className="market-tabs" role="tablist" aria-label="Filter firms by market">
          {["All", "Forex", "Futures"].map((item) => (
            <button key={item} role="tab" aria-selected={market === item} className={market === item ? "active" : ""} onClick={() => setMarket(item)}>
              {item === "All" ? "All firms" : `${item} firms`}
              <small>{item === "All" ? activeFirms.length : activeFirms.filter((firm) => firm.market === item).length}</small>
            </button>
          ))}
          <span className="market-tabs-note"><BadgePercent size={14} /> Every listed firm earns PropApex cashback and credits</span>
        </div>

        <div className="directory-toolbar">
          <label className="search-field">
            <Search size={19} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search firm, platform, asset or country…"
              aria-label="Search prop firms"
            />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
          </label>
          <div className="toolbar-selects">
            <button className={`filter-button ${filtersOpen || hasFilters ? "active" : ""}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
              <SlidersHorizontal size={17} /> Filters
              {hasFilters && <span />}
            </button>
            <label className="select-field sort-field">
              <ArrowUpDown size={15} />
              <span className="sr-only">Sort firms</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="popular">Most popular</option>
                <option value="rating">Top rated</option>
                <option value="allocation">Max allocation</option>
                <option value="newest">Newest</option>
                <option value="name">A–Z</option>
              </select>
              <ChevronDown size={15} />
            </label>
          </div>
        </div>

        <div className={`advanced-filters ${filtersOpen ? "is-open" : ""}`}>
          <div className="advanced-filters-inner">
            <label className="filter-group">
              <span>Trading platform</span>
              <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
                <option value="All">All platforms</option>
                {platformOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="filter-group">
              <span>Country of operation</span>
              <select value={country} onChange={(event) => setCountry(event.target.value)}>
                <option value="All">All countries</option>
                {countries.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="check-filter">
              <input type="checkbox" checked={offersOnly} onChange={(event) => setOffersOnly(event.target.checked)} />
              <span><Check size={13} /></span> Firms with a listed code
            </label>
            {hasFilters && <button className="text-button" onClick={resetFilters}>Reset all <X size={14} /></button>}
          </div>
        </div>

        <div className="results-meta">
          <p><strong>{filteredFirms.length}</strong> firms found <span>·</span> Showing {Math.min(visibleCount, filteredFirms.length)}</p>
          <p><ShieldCheck size={15} /> Directory data should be reconfirmed on the official firm website.</p>
        </div>

        {filteredFirms.length > 0 ? (
          <>
            <div className="firm-table-wrap">
              <table className="firm-table">
                <thead>
                  <tr>
                    <th>Popularity / Firm</th>
                    <th>Rank / Reviews</th>
                    <th>Country / Years</th>
                    <th>Assets</th>
                    <th>Platforms</th>
                    <th>Max Allocation</th>
                    <th>Promo</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFirms.slice(0, visibleCount).map((firm) => {
                    const rank = firms.findIndex((item) => item.id === firm.id) + 1;
                    const isCompared = compareIds.includes(firm.id);
                    return (
                      <tr key={firm.id}>
                        <td>
                          <button className="firm-identity" onClick={() => openFirm(firm)}>
                            <FirmLogo firm={firm} />
                            <span><strong>{firm.name} {firm.verified && <BadgeCheck size={14} />}</strong><small>{firm.market} · {firm.models[0]}</small></span>
                          </button>
                        </td>
                        <td><div className="rank-review"><small>#{String(rank).padStart(2, "0")}</small><Rating firm={firm} /></div></td>
                        <td><div className="country-cell"><strong><span>{firm.countryCode}</span>{firm.country}</strong><small>Since {firm.founded} · {new Date().getFullYear() - firm.founded} yrs</small></div></td>
                        <td><div className="tag-list">{firm.assets.slice(0, 3).map((asset) => <span key={asset}>{asset}</span>)}{firm.assets.length > 3 && <span>+{firm.assets.length - 3}</span>}</div></td>
                        <td><div className="platform-list">{firm.platforms.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div></td>
                        <td><div className="allocation-cell"><strong>{firm.allocationLabel}</strong><small>Profit split {firm.profitSplit}</small></div></td>
                        <td>
                          <div className="promo-cell"><strong>{firm.promo}</strong>{(firm.apexCode || firm.code) ? <button onClick={() => handleCopy(firm)}>{copied === firm.id ? <Check size={13} /> : <Copy size={13} />}{copied === firm.id ? "Copied" : firm.apexCode || firm.code}</button> : <small>See firm details</small>}{isAffiliateTrackingReady(firm) ? <button className="cashback-mini-action" onClick={() => onActivateCashback(firm)}><BadgePercent size={12} />{cashbackRateFor(firm)}% PropApex cashback</button> : <small className="tracking-unavailable">Cashback setup in progress</small>}</div>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className={`compare-icon ${isCompared ? "selected" : ""}`} onClick={() => toggleCompare(firm)} aria-label={`${isCompared ? "Remove" : "Add"} ${firm.name} ${isCompared ? "from" : "to"} comparison`} title="Compare firm">
                              {isCompared ? <Check size={16} /> : <Plus size={16} />}
                            </button>
                            <button className="view-button" onClick={() => openFirm(firm)}>View <ArrowRight size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="firm-mobile-list">
              {filteredFirms.slice(0, visibleCount).map((firm) => {
                const isCompared = compareIds.includes(firm.id);
                return (
                  <article className="firm-mobile-card" key={firm.id}>
                    <div className="mobile-card-top">
                      <button className="firm-identity" onClick={() => openFirm(firm)}><FirmLogo firm={firm} large /><span><strong>{firm.name} {firm.verified && <BadgeCheck size={14} />}</strong><small>{firm.country} · Since {firm.founded}</small></span></button>
                      <Rating firm={firm} />
                    </div>
                    <div className="mobile-metrics">
                      <div><span>Allocation</span><strong>{firm.allocationLabel}</strong></div>
                      <div><span>Profit split</span><strong>{firm.profitSplit}</strong></div>
                      <div><span>Drawdown</span><strong>{firm.drawdown}</strong></div>
                    </div>
                    <div className="platform-list">{firm.platforms.map((item) => <span key={item}>{item}</span>)}</div>
                    {isAffiliateTrackingReady(firm) ? <button className="mobile-reward-action" onClick={() => onActivateCashback(firm)}><BadgePercent size={15} /> Activate {cashbackRateFor(firm)}% PropApex cashback <ArrowUpRight size={14} /></button> : <p className="mobile-tracking-unavailable">Cashback setup in progress.</p>}
                    <div className="mobile-card-bottom">
                      <button className={`compare-text-button ${isCompared ? "selected" : ""}`} onClick={() => toggleCompare(firm)}><GitCompareArrows size={16} />{isCompared ? "Added" : "Compare"}</button>
                      {(firm.apexCode || firm.code) && <button className="code-button" onClick={() => handleCopy(firm)}>{copied === firm.id ? <Check size={14} /> : <Copy size={14} />}{firm.apexCode || firm.code}</button>}
                      <button className="view-button" onClick={() => openFirm(firm)}>Details <ArrowRight size={15} /></button>
                    </div>
                  </article>
                );
              })}
            </div>

            {visibleCount < filteredFirms.length && (
              <button className="load-more" onClick={() => setVisibleCount((count) => count + 7)}>
                <Plus size={17} /> Show more firms <span>{filteredFirms.length - visibleCount} remaining</span>
              </button>
            )}
          </>
        ) : (
          <div className="empty-state">
            <Search size={28} />
            <h3>No firms match those filters</h3>
            <p>Try another platform, market or search term.</p>
            <button className="button button-lime" onClick={resetFilters}>Reset filters</button>
          </div>
        )}
      </div>

      {compareIds.length > 0 && (
        <div className="compare-tray" role="region" aria-label="Firm comparison selection">
          <div className="compare-tray-inner">
            <div className="compare-tray-label"><GitCompareArrows size={19} /><span><strong>Compare firms</strong><small>{compareIds.length}/3 selected</small></span></div>
            <div className="compare-selected">
              {compareFirms.map((firm) => <button key={firm.id} onClick={() => toggleCompare(firm)} title={`Remove ${firm.name}`}><FirmLogo firm={firm} /><span>{firm.name}</span><X size={13} /></button>)}
            </div>
            <div className="compare-tray-actions">
              <button className="text-button" onClick={() => setCompareIds([])}>Clear</button>
              <button className="button button-lime button-small" disabled={compareIds.length < 2} onClick={() => setCompareOpen(true)}>
                {compareIds.length < 2 ? "Select one more" : "Compare now"} <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal open={Boolean(selectedFirm)} onClose={closeFirm} title={selectedFirm?.name ?? "Firm details"} eyebrow="FIRM INTELLIGENCE" wide>
        {selectedFirm && (
          <div className="firm-detail">
            <div className="firm-detail-intro">
              <FirmLogo firm={selectedFirm} large />
              <div>
                <div className="detail-badges"><span>{selectedFirm.market}</span>{selectedFirm.verified && <span><BadgeCheck size={13} /> Listed & reviewed</span>}<span>Since {selectedFirm.founded}</span></div>
                <p>{selectedFirm.summary}</p>
              </div>
              <a className="button button-outline button-small" href={selectedFirm.website} target="_blank" rel="noreferrer">Official website <ExternalLink size={15} /></a>
            </div>
            <div className="detail-metric-grid">
              {[
                ["Max allocation", selectedFirm.allocationLabel],
                ["Profit split", selectedFirm.profitSplit],
                ["Leverage", selectedFirm.leverage],
                ["Max drawdown", selectedFirm.drawdown],
                ["Payout rhythm", selectedFirm.payout],
                ["Country", selectedFirm.country],
              ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div>
            <div className="detail-two-column">
              <div className="detail-block"><h3>Account models</h3><div className="detail-pills">{selectedFirm.models.map((item) => <span key={item}>{item}</span>)}</div></div>
              <div className="detail-block"><h3>Platforms</h3><div className="detail-pills">{selectedFirm.platforms.map((item) => <span key={item}>{item}</span>)}</div></div>
              <div className="detail-block detail-assets"><h3>Available assets</h3><div className="detail-pills">{selectedFirm.assets.map((item) => <span key={item}>{item}</span>)}</div></div>
              <div className="detail-block"><h3>Trader rating</h3><div className="detail-rating"><Star size={21} fill="currentColor" /><strong>{selectedFirm.rating}</strong><span>/ 5 · {formatReviews(selectedFirm.reviews)} reviews</span></div></div>
            </div>
            <div className="detail-offer">
              <div className="detail-offer-icon"><BadgePercent size={23} /></div>
              <div><p className="eyebrow">OFFER CONTEXT</p><h3>{selectedFirm.promo}</h3><p>{selectedFirm.offerDetails}</p></div>
              {(selectedFirm.apexCode || selectedFirm.code) && <button className="copy-code-large" onClick={() => handleCopy(selectedFirm)}><span>{selectedFirm.apexCode ? "PropApex code" : "Offer code"}</span><strong>{selectedFirm.apexCode || selectedFirm.code}</strong>{copied === selectedFirm.id ? <Check size={17} /> : <Copy size={17} />}</button>}
            </div>
            <div className="detail-footer">
              <p><ShieldCheck size={16} /> Rules and offers can change. Confirm all terms directly with the firm before purchasing.</p>
              <div className="detail-footer-actions">
                <button className="detail-review-link" onClick={() => { const firm = selectedFirm; closeFirm(); onWriteReview(firm); }}><Star size={15} /> Write review</button>
                <button className="button button-outline" onClick={() => toggleCompare(selectedFirm)}><GitCompareArrows size={16} />{compareIds.includes(selectedFirm.id) ? "Remove" : "Compare"}</button>
                {isAffiliateTrackingReady(selectedFirm) ? <button className="button button-lime" onClick={() => { const firm = selectedFirm; closeFirm(); onActivateCashback(firm); }}><BadgePercent size={16} /> Earn {cashbackRateFor(selectedFirm)}% cashback</button> : <span className="tracking-pending-label">Cashback link coming soon</span>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title="Side-by-side comparison" eyebrow={`${compareFirms.length} FIRMS SELECTED`} wide>
        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <thead><tr><th>Decision factor</th>{compareFirms.map((firm) => <th key={firm.id}><FirmLogo firm={firm} /><strong>{firm.name}</strong><button onClick={() => openFirm(firm)}>Full details <ArrowUpRight size={13} /></button></th>)}</tr></thead>
            <tbody>
              {[
                ["PropApex rating", (firm: Firm) => `${firm.rating} / 5`],
                ["Market", (firm: Firm) => firm.market],
                ["Max allocation", (firm: Firm) => firm.allocationLabel],
                ["Profit split", (firm: Firm) => firm.profitSplit],
                ["Leverage", (firm: Firm) => firm.leverage],
                ["Max drawdown", (firm: Firm) => firm.drawdown],
                ["Payout rhythm", (firm: Firm) => firm.payout],
                ["Platforms", (firm: Firm) => firm.platforms.join(", ")],
                ["Account models", (firm: Firm) => firm.models.join(", ")],
                ["Listed promotion", (firm: Firm) => `${firm.promo}${firm.code ? ` · ${firm.code}` : ""}`],
              ].map(([label, getter]) => <tr key={label as string}><th>{label as string}</th>{compareFirms.map((firm) => <td key={firm.id}>{(getter as (firm: Firm) => string)(firm)}</td>)}</tr>)}
              <tr><th>Official source</th>{compareFirms.map((firm) => <td key={firm.id}><a href={firm.website} target="_blank" rel="noreferrer">Visit {firm.name} <ExternalLink size={13} /></a></td>)}</tr>
            </tbody>
          </table>
        </div>
      </Modal>

      <div className={`toast ${notice ? "is-visible" : ""}`} role="status"><Check size={16} />{notice}</div>
    </section>
  );
}
