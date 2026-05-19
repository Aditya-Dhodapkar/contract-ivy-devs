// The core record. Deliverables #18-#51. The reference number is the single
// source of truth across website, back office, and brochure (brief, non-neg
// #5). Region values are intentionally free strings for now — the final list
// is an open client question (needs.md #17) and is just data, not code.

export const property = {
  name: "property",
  title: "Property",
  type: "document",
  fields: [
    {
      name: "referenceNumber",
      title: "Reference number",
      type: "string",
      readOnly: true,
      description: "Auto-generated, e.g. SA-2026-001. Never changes.",
    },
    { name: "title", title: "Title", type: "string" },
    { name: "region", title: "Region", type: "string" },
    {
      name: "propertyType",
      title: "Type",
      type: "string",
      options: {
        list: ["house", "apartment", "land", "commercial"],
      },
    },
    { name: "price", title: "Price", type: "number" },
    { name: "bedrooms", title: "Bedrooms", type: "number" },
    { name: "bathrooms", title: "Bathrooms", type: "number" },
    { name: "plotSize", title: "Plot size", type: "string" },
    { name: "description", title: "Description", type: "text" },
    {
      name: "photos",
      title: "Photos",
      type: "array",
      of: [{ type: "image" }],
      description: "First photo is the primary photo.",
    },
    { name: "floorPlan", title: "Floor plan", type: "image" },
    {
      name: "location",
      title: "Map location",
      type: "geopoint",
    },
    {
      name: "assignedAgent",
      title: "Assigned agent",
      type: "reference",
      to: [{ type: "user" }],
    },
    {
      name: "seller",
      title: "Seller / owner",
      type: "reference",
      to: [{ type: "contact" }],
      description: "Links the property to whoever asked her to sell it.",
    },
    {
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Draft", value: "draft" },
          { title: "Active", value: "active" },
          { title: "Sold", value: "sold" },
          { title: "Rented", value: "rented" },
        ],
      },
      initialValue: "draft",
    },
    {
      name: "showOnWebsite",
      title: "Show on website",
      type: "boolean",
      initialValue: false,
      description: "Public visibility toggle. Ignored if private.",
    },
    {
      name: "isPrivate",
      title: "Private listing",
      type: "boolean",
      initialValue: false,
      description: "Never appears in any public list/search. Access code only.",
    },
    {
      name: "accessCode",
      title: "Access code",
      type: "string",
      description: "Required to view a private listing. Format pending client.",
    },
  ],
  preview: {
    select: { title: "title", subtitle: "referenceNumber" },
  },
};
