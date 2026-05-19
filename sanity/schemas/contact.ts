// A person: a seller, a buyer, a member, or all three. Deliverables #36, #90 —
// the founder can pull up one person and see every property they sell and
// every inquiry they've made.

export const contact = {
  name: "contact",
  title: "Contact",
  type: "document",
  fields: [
    { name: "name", title: "Name", type: "string", validation: (r: any) => r.required() },
    { name: "email", title: "Email", type: "string" },
    { name: "phone", title: "Phone", type: "string" },
    {
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }],
      description: "e.g. seller, buyer, member, beachfront, budget-2M+",
    },
    { name: "notes", title: "Notes", type: "text" },
  ],
};
