// Image provenance labels, safe to import in client components.
// Stored values stay as they are; these are what editors and readers see,
// named after the editorial vision (LICENSED, EDITORIAL, AI_GENERATED, OTHER).
export const IMAGE_SOURCE_TYPES = ["licensed", "own", "permission", "ai", "unverified"] as const;
export type ImageSourceType = (typeof IMAGE_SOURCE_TYPES)[number];

export const PROVENANCE_LABELS: Record<ImageSourceType, { code: string; label: string }> = {
  licensed: { code: "LICENSED", label: "Licensed (stock, agency or free licence)" },
  own: { code: "EDITORIAL", label: "Editorial: our own photo" },
  permission: { code: "EDITORIAL", label: "Editorial: used with permission" },
  ai: { code: "AI_GENERATED", label: "AI-generated illustration" },
  unverified: { code: "OTHER", label: "Other: rights not verified (blocks publishing)" },
};

export const NEWS_COVER_SIZE = { width: 1200, height: 675 } as const;
