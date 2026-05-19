// Phase 2 — every inquiry, from any channel, lands here. Deliverables
// #82-#109. Built now behind stubbed channel adapters; the model is final.

export const lead = {
  name: "lead",
  title: "Lead / Inquiry",
  type: "document",
  fields: [
    { name: "contact", title: "Contact", type: "reference", to: [{ type: "contact" }] },
    {
      name: "channel",
      title: "Channel",
      type: "string",
      options: { list: ["website", "email", "whatsapp"] },
    },
    {
      name: "property",
      title: "About property",
      type: "reference",
      to: [{ type: "property" }],
      description: "Set if the inquiry mentioned a specific property.",
    },
    { name: "message", title: "Message", type: "text" },
    {
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: ["new", "assigned", "responded", "follow_up", "closed"],
      },
      initialValue: "new",
    },
    { name: "assignedTo", title: "Assigned to", type: "reference", to: [{ type: "user" }] },
    { name: "receivedAt", title: "Received at", type: "datetime" },
    { name: "lastTeamReplyAt", title: "Last team reply at", type: "datetime" },
  ],
};
