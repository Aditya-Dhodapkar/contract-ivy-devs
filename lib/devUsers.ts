// DEV ONLY. Lets us test the full auth + role system before the client's
// Sanity exists. Active only when USE_DEV_USERS=true. All four roles, password
// "password". Delete-safe: production reads real users from Sanity instead.

import type { Role } from "./roles";

const HASH = "$2a$10$TZQCOJ7JFwSjPmx5OAf84uLBSYDRB0e8x/GCD7.USXR7eIgBOkQ3y"; // "password"

interface DevUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
}

export const DEV_USERS: DevUser[] = [
  { id: "dev-owner", name: "Founder (Owner)", email: "owner@test.com", role: "owner", passwordHash: HASH },
  { id: "dev-assistant", name: "Assistant", email: "assistant@test.com", role: "assistant", passwordHash: HASH },
  { id: "dev-gm", name: "General Manager", email: "gm@test.com", role: "general_manager", passwordHash: HASH },
  { id: "dev-agent", name: "Nairobi Agent", email: "agent@test.com", role: "agent", passwordHash: HASH },
];

export const usingDevUsers = process.env.USE_DEV_USERS === "true";

export function findDevUser(email: string) {
  return DEV_USERS.find((u) => u.email === email) || null;
}
