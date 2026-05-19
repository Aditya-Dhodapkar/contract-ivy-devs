// Sensitive legal documents (mandate, title deed, deed plan). Deliverables
// #63-#71. The file itself lives in S3/R2 (not Sanity) — this record holds
// metadata and the immutable access log. Brief non-neg #3: every access logged.

export const propertyDocument = {
  name: "propertyDocument",
  title: "Property Document",
  type: "document",
  fields: [
    {
      name: "property",
      title: "Property",
      type: "reference",
      to: [{ type: "property" }],
      validation: (r: any) => r.required(),
    },
    {
      name: "docType",
      title: "Type",
      type: "string",
      options: {
        list: [
          { title: "Signed mandate", value: "mandate" },
          { title: "Title deed", value: "title_deed" },
          { title: "Deed plan", value: "deed_plan" },
        ],
      },
      validation: (r: any) => r.required(),
    },
    { name: "storageKey", title: "Storage key", type: "string", description: "S3/R2 object key" },
    { name: "fileName", title: "Original file name", type: "string" },
    { name: "uploadedBy", title: "Uploaded by", type: "reference", to: [{ type: "user" }] },
    { name: "uploadedAt", title: "Uploaded at", type: "datetime" },
    {
      name: "accessLog",
      title: "Access log",
      type: "array",
      readOnly: true,
      of: [
        {
          type: "object",
          fields: [
            { name: "user", type: "reference", to: [{ type: "user" }] },
            { name: "action", type: "string" }, // "view" | "download"
            { name: "at", type: "datetime" },
          ],
        },
      ],
    },
  ],
};
