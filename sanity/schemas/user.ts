// Team members. Deliverables #6-#9, #14 roles. Passwords are bcrypt hashes,
// never plaintext. `assignedRegions` drives Phase-2 smart routing later.

export const user = {
  name: "user",
  title: "Team Member",
  type: "document",
  fields: [
    { name: "name", title: "Full name", type: "string", validation: (r: any) => r.required() },
    { name: "email", title: "Email", type: "string", validation: (r: any) => r.required() },
    { name: "passwordHash", title: "Password hash", type: "string", hidden: true },
    {
      name: "role",
      title: "Role",
      type: "string",
      options: {
        list: [
          { title: "Owner", value: "owner" },
          { title: "Assistant", value: "assistant" },
          { title: "General Manager", value: "general_manager" },
          { title: "Agent", value: "agent" },
        ],
      },
      validation: (r: any) => r.required(),
    },
    {
      name: "assignedRegions",
      title: "Assigned regions (agents)",
      type: "array",
      of: [{ type: "string" }],
    },
    {
      name: "personalAssistant",
      title: "Personal assistant",
      type: "reference",
      to: [{ type: "user" }],
      description: "If set, this person is also notified for the agent's leads.",
    },
    { name: "active", title: "Active", type: "boolean", initialValue: true },
  ],
};
