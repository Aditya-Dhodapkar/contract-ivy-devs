// /profile — every signed-in user can edit their own name, email, and
// password here. Required after an admin reset (banner prompts).

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/repo/users";
import { Header } from "@/components/Header";
import { ProfileForms } from "@/components/ProfileForms";

export default async function ProfilePage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const u = await getUser(s.id);
  if (!u) redirect("/login");

  return (
    <div className="min-h-screen bg-ivory">
      <Header back={{ href: "/dashboard", label: "Home" }} />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-serif text-3xl">Your profile</h1>
        <p className="mt-1 text-sm text-ink-mute">
          Update your name, email, and password.
        </p>
        <div className="mt-8">
          <ProfileForms
            initial={{ name: u.name, email: u.email }}
            mustChangePassword={!!u.mustChangePassword}
          />
        </div>
      </div>
    </div>
  );
}
