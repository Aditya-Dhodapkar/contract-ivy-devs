// #6 Create user — Owner only.

import { redirect } from "next/navigation";
import { actingUser, canDo } from "@/lib/access";
import { Header } from "@/components/Header";
import { UserForm } from "@/components/UserForm";

export default async function NewTeamMemberPage() {
  const user = await actingUser();
  if (!user) redirect("/login");
  if (!canDo(user, "manageUsers")) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-ivory">
      <Header back={{ href: "/team", label: "Team" }} />
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-serif text-3xl">Invite team member</h1>
        <p className="mt-1 text-sm text-ink-mute">
          They'll sign in with the email and password you set here.
        </p>
        <div className="mt-8">
          <UserForm />
        </div>
      </div>
    </div>
  );
}
