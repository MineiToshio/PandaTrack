import Avatar from "@/components/core/Avatar";
import StarRating from "@/components/core/StarRating";

export type ReviewRowProps = {
  /** Reviewer display name. Falls back to anonymous label. */
  authorName: string | null;
  /** Anonymous label when authorName is null. */
  anonymousLabel: string;
  overallRating: number;
  comment: string | null;
  /** Pre-formatted relative timestamp string (e.g. "hace 3 días"). */
  timeAgo: string;
  /** When true, indicates the viewer is the author. Sets a subtle accent. */
  isViewerReview?: boolean;
};

export default function ReviewRow({
  authorName,
  anonymousLabel,
  overallRating,
  comment,
  timeAgo,
  isViewerReview,
}: ReviewRowProps) {
  const displayName = authorName ?? anonymousLabel;
  return (
    <div
      className="flex items-start gap-3 py-3"
      style={isViewerReview ? { borderLeft: "2px solid var(--accent)", paddingLeft: "0.75rem" } : undefined}
    >
      <Avatar user={{ name: displayName }} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="[font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {displayName}
          </span>
          <StarRating value={overallRating} size={14} />
          <span className="ml-auto [font-size:var(--text-caption)] [color:var(--text-muted)]">{timeAgo}</span>
        </div>
        {comment && (
          <p className="mt-1 [font-size:var(--text-body)] [line-height:1.5] [color:var(--text-secondary)]">{comment}</p>
        )}
      </div>
    </div>
  );
}
