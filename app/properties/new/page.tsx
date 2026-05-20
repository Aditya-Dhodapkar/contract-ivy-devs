// #18 create. GM (read-only) is bounced — createProperty is false for them.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { permissionsFor } from "@/lib/roles";
import { PropertyForm } from "@/components/PropertyForm";
import { Header } from "@/components/Header";

export default async function NewPropertyPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!permissionsFor(user.role).createProperty) redirect("/properties");

  return (
    <div className="min-h-screen bg-ivory">
      <Header back={{ href: "/properties", label: "Properties" }} />
      <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-serif text-3xl">New property</h1>
      <p className="mt-1 text-sm text-ink-mute">
        A reference number is assigned automatically on save.
      </p>
      <div className="mt-8">
        <PropertyForm currentUserRole={user.role} />
      </div>
      </div>
    </div>
  );
}
