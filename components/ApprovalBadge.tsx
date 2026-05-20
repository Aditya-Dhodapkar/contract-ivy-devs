import type { PropertyApproval } from "@/lib/repo/properties";

const LABEL: Record<PropertyApproval, string> = {
  pending: "Pending review",
  approved: "Approved",
  changes_requested: "Changes requested",
};

const STYLE: Record<PropertyApproval, string> = {
  pending: "bg-gold/15 text-gold-deep",
  approved: "bg-green-100 text-green-800",
  changes_requested: "bg-red-100 text-red-800",
};

export function ApprovalBadge({ approval }: { approval: PropertyApproval }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-eyebrow uppercase ${STYLE[approval]}`}>
      {LABEL[approval]}
    </span>
  );
}
