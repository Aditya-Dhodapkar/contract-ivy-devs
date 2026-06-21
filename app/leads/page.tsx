// Inquiries — placeholder. Lead capture + follow-up tracking is a Phase 2
// feature (and partly moving to the REMS integration), so for now this is an
// elegant "coming soon" screen rather than a broken empty table.

import { redirect } from "next/navigation";
import { MessageSquare, Inbox, Bell, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { permissionsFor } from "@/lib/roles";
import { Header } from "@/components/Header";

const PLANNED: { Icon: React.ComponentType<{ className?: string }>; title: string; desc: string }[] = [
  { Icon: Inbox, title: "Unified inbox", desc: "Website, WhatsApp and email enquiries in one place." },
  { Icon: Users, title: "Auto-routing", desc: "Leads matched to the right agent by city and listing." },
  { Icon: Bell, title: "Follow-up reminders", desc: "Nudges so no buyer ever falls through the cracks." },
];

export default async function LeadsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (permissionsFor(user.role).viewInquiries === false) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-ivory">
      <Header back={{ href: "/dashboard", label: "Dashboard" }} />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center">
        <div className="relative">
          <div className="absolute -inset-6 rounded-full bg-gold/10 blur-2xl" aria-hidden />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-gold/40 bg-paper">
            <MessageSquare className="h-8 w-8 text-gold-deep" />
          </div>
        </div>

        <p className="mt-8 text-eyebrow uppercase tracking-[0.22em] text-gold-deep">
          Coming soon
        </p>
        <h1 className="mt-3 font-serif text-5xl text-ink">Inquiries</h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-mute">
          A home for every enquiry — capturing leads, routing them to the right
          person, and keeping follow-ups on track. We're building it now.
        </p>

        <div className="mt-12 grid w-full gap-4 sm:grid-cols-3">
          {PLANNED.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="border border-hairline/15 bg-paper p-6 text-left"
            >
              <Icon className="h-5 w-5 text-gold-deep" />
              <p className="mt-4 font-serif text-xl text-ink">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-mute">{desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-xs text-ash">
          In the meantime, your properties and brochures are fully live.
        </p>
      </div>
    </div>
  );
}
