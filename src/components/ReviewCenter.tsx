import { useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, MessageSquarePlus, PenLine, ShieldCheck, Star, ThumbsUp } from "lucide-react";
import { type Firm } from "../data/firms";
import { useAccount } from "../context/AccountContext";
import FirmLogo from "./FirmLogo";

export default function ReviewCenter({ onWriteReview }: { onWriteReview: (firm: Firm | null) => void }) {
  const { reviews, user, purchases, firms } = useAccount();
  const [firmFilter, setFirmFilter] = useState("All");
  const publicReviews = reviews.filter((review) => (!review.status || review.status === "published") || review.userId === user?.id);
  const visibleReviews = useMemo(() => publicReviews.filter((review) => firmFilter === "All" || review.firmId === firmFilter), [reviews, firmFilter, user?.id]);
  const average = publicReviews.length ? publicReviews.reduce((sum, review) => sum + review.rating, 0) / publicReviews.length : 0;

  return (
    <section className="review-center" id="community-reviews">
      <div className="container">
        <div className="review-center-heading">
          <div><p className="eyebrow"><span /> TRADER COMMUNITY</p><h2>Experiences worth<br /><em>reading before buying.</em></h2><p>Specific accounts, honest ratings and practical payout context from PropApex members.</p></div>
          <button className="button button-lime button-large" onClick={() => onWriteReview(null)}><PenLine size={17} /> Write a review</button>
        </div>

        <div className="review-summary-bar">
          <div className="review-total"><strong>{publicReviews.length}</strong><span>Published on this device</span></div>
          <div className="review-average"><span><Star size={18} fill="currentColor" /> {average ? average.toFixed(1) : "—"}</span><small>Community average</small></div>
          <div className="review-guidance"><ShieldCheck size={18} /><p>Purchase labels appear only when a review matches an order submitted by the same member.</p></div>
          <label className="review-filter"><span>Filter by firm</span><select value={firmFilter} onChange={(event) => setFirmFilter(event.target.value)}><option value="All">All reviewed firms</option>{firms.filter((firm) => reviews.some((review) => review.firmId === firm.id)).map((firm) => <option key={firm.id} value={firm.id}>{firm.name}</option>)}</select></label>
        </div>

        {visibleReviews.length ? (
          <div className="community-review-grid">
            {visibleReviews.map((review) => {
              const firm = firms.find((item) => item.id === review.firmId);
              if (!firm) return null;
              const verified = purchases.some((purchase) => purchase.userId === review.userId && purchase.firmId === firm.id && purchase.status !== "rejected");
              return <article className="community-review-card" key={review.id}>
                <div className="review-card-top"><FirmLogo firm={firm} /><div><strong>{firm.name}</strong><span>{review.accountModel || firm.market}</span></div><div className="review-card-stars">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={14} fill={star <= review.rating ? "currentColor" : "none"} />)}</div></div>
                <h3>“{review.title}”</h3><p>{review.body}</p>
                <div className="review-author"><span className="review-avatar">{review.userName.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{review.userName}{review.userId === user?.id && <em>You</em>}</strong><span>{new Date(review.updatedAt ?? review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{review.updatedAt ? " · Edited" : ""}</span></div>{verified ? <span className="verified-purchase"><BadgeCheck size={14} /> Purchase submitted</span> : <span className="community-label">Community review</span>}</div>
                {review.recommend && <div className="review-recommends"><ThumbsUp size={13} /> Recommends {firm.name}</div>}
                {review.userId === user?.id && <button className="edit-own-review" onClick={() => onWriteReview(firm)}><PenLine size={13} /> Edit your review</button>}
              </article>;
            })}
          </div>
        ) : (
          <div className="reviews-empty">
            <span><MessageSquarePlus size={32} /></span>
            <div><h3>{reviews.length ? "No reviews for this firm yet" : "Your experience can start the conversation"}</h3><p>{reviews.length ? "Choose another firm or share the first review for this one." : "There are no member reviews on this device yet. Create an account and publish a specific, useful experience—no prefilled testimonials."}</p></div>
            <button className="button button-outline" onClick={() => onWriteReview(firmFilter === "All" ? null : firms.find((firm) => firm.id === firmFilter) ?? null)}>Write the first review <ArrowRight size={15} /></button>
          </div>
        )}
      </div>
    </section>
  );
}
