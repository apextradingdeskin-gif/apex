import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Check, MessageSquareText, Star, ThumbsUp } from "lucide-react";
import Modal from "./Modal";
import { type Firm } from "../data/firms";
import { useAccount } from "../context/AccountContext";

type Props = { open: boolean; initialFirm: Firm | null; onClose: () => void; onNotice: (message: string) => void };

export default function ReviewModal({ open, initialFirm, onClose, onNotice }: Props) {
  const { user, firms, reviews, purchases, saveReview } = useAccount();
  const [firmId, setFirmId] = useState(initialFirm?.id ?? firms[0].id);
  const firm = useMemo(() => firms.find((item) => item.id === firmId) ?? firms[0], [firmId]);
  const existing = reviews.find((review) => review.userId === user?.id && review.firmId === firmId);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [accountModel, setAccountModel] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [recommend, setRecommend] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const nextFirmId = initialFirm?.id ?? firms[0].id;
    const current = reviews.find((review) => review.userId === user?.id && review.firmId === nextFirmId);
    setFirmId(nextFirmId); setRating(current?.rating ?? 0); setAccountModel(current?.accountModel ?? "");
    setTitle(current?.title ?? ""); setBody(current?.body ?? ""); setRecommend(current?.recommend ?? true); setError("");
  }, [open, initialFirm, user?.id]);

  const changeFirm = (nextFirmId: string) => {
    const current = reviews.find((review) => review.userId === user?.id && review.firmId === nextFirmId);
    setFirmId(nextFirmId); setRating(current?.rating ?? 0); setAccountModel(current?.accountModel ?? "");
    setTitle(current?.title ?? ""); setBody(current?.body ?? ""); setRecommend(current?.recommend ?? true); setError("");
  };

  const verifiedPurchase = purchases.some((purchase) => purchase.firmId === firmId && purchase.status !== "rejected");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = saveReview({ firmId, rating, accountModel, title, body, recommend });
    if (!result.ok) setError(result.message);
    else {
      onNotice(result.message);
      onClose();
      window.setTimeout(() => document.getElementById("community-reviews")?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={existing ? "Update your review" : "Write a trader review"} eyebrow="COMMUNITY EXPERIENCE">
      <form className="review-form" onSubmit={submit}>
        <div className="review-form-intro"><MessageSquareText size={22} /><p>Share specific details about rules, support and payouts. Useful reviews help other traders make a clearer decision.</p></div>
        <label className="form-field"><span>Which firm are you reviewing?</span><div><select value={firmId} onChange={(event) => changeFirm(event.target.value)}>{firms.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div></label>
        <div className="review-rating-field"><span>Your overall rating</span><div className="rating-input" onMouseLeave={() => setHovered(0)}>{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onMouseEnter={() => setHovered(value)} onClick={() => setRating(value)} aria-label={`${value} star${value > 1 ? "s" : ""}`}><Star size={29} fill={(hovered || rating) >= value ? "currentColor" : "none"} /></button>)}<strong>{rating ? `${rating}.0` : "Select"}</strong></div></div>
        <div className="form-grid-two">
          <label className="form-field"><span>Account model <em>Optional</em></span><div><select value={accountModel} onChange={(event) => setAccountModel(event.target.value)}><option value="">Choose a model</option>{firm.models.map((model) => <option value={model} key={model}>{model}</option>)}</select></div></label>
          <div className={`review-verification ${verifiedPurchase ? "verified" : ""}`}><Check size={15} /><span>{verifiedPurchase ? "Matched to a submitted purchase" : "No submitted purchase matched"}</span></div>
        </div>
        <label className="form-field"><span>Review headline</span><div><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Sum up your experience" maxLength={80} required /></div></label>
        <label className="form-field"><span>Your experience</span><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="What account did you use? How were the rules, platform, support and payout process? Include details another trader can verify." rows={5} maxLength={1200} required /><small className={body.length > 0 && body.length < 40 ? "needs-more" : ""}>{body.length}/1200 · minimum 40 characters</small></label>
        <label className="recommend-toggle"><input type="checkbox" checked={recommend} onChange={(event) => setRecommend(event.target.checked)} /><span><ThumbsUp size={16} /></span><p><strong>I would recommend this firm</strong><small>Your recommendation is shown alongside your rating.</small></p></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="review-form-footer"><p>Reviews are stored on this device in this front-end version. Do not include passwords or personal payout documents.</p><button className="button button-lime" type="submit">{existing ? "Update review" : "Publish review"} <ArrowRight size={16} /></button></div>
      </form>
    </Modal>
  );
}
