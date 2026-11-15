const MAP: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-300 border-amber-400/30", under_review: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  more_info_required: "bg-orange-400/10 text-orange-300 border-orange-400/30", approved: "bg-lime/10 text-lime border-lime/30",
  fulfilled: "bg-lime/10 text-lime border-lime/30", processing: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  rejected: "bg-red-400/10 text-red-300 border-red-400/30", cancelled: "bg-white/5 text-white/60 border-line",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${MAP[status] ?? "border-line text-mute"}`}>{status.replaceAll("_", " ")}</span>;
}
