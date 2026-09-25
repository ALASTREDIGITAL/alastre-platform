export type LocalSeoDataState =
  | "calculated"
  | "partial"
  | "insufficient"
  | "not_connected"
  | "syncing"
  | "demo"
  | "sync_error";
export type LocalSeoDataSource = "internal" | "mock" | "google_business_profile";
export type LocalSeoDataProvenance = {
  source: LocalSeoDataSource;
  state: LocalSeoDataState;
  label: string;
  detail: string;
  isReal: boolean;
};
export type LocalScorePillarKey =
  | "profile"
  | "relevance"
  | "reputation"
  | "content"
  | "authority"
  | "local_presence"
  | "conversion";
export type LocalScorePillar = {
  key: LocalScorePillarKey;
  label: string;
  score: number | null;
  weight: number;
  state: LocalSeoDataState;
  confidence: "high" | "medium" | "low" | "none";
  signals: string[];
  issues: string[];
  opportunities: string[];
  recommendation: string;
  likelyImpact: string;
};
export type GoogleProfileSnapshot = {
  name: string;
  primaryCategory: string | null;
  secondaryCategories: string[];
  location: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  services: string[];
  attributes: string[];
  hours: string | null;
  photos: number | null;
  completeness: number | null;
};
export type LocalSeoWorkspace = {
  clientId: string;
  clientName: string;
  connection: "connected" | "not_connected";
  provenance: LocalSeoDataProvenance;
  score: {
    value: number | null;
    state: LocalSeoDataState;
    version: string;
    pillars: LocalScorePillar[];
  };
  profile: GoogleProfileSnapshot;
};

export type LocalSeoSection =
  | "overview"
  | "profile"
  | "content"
  | "reputation"
  | "authority"
  | "visibility"
  | "plan"
  | "history"
  // Aliases retrocompatíveis
  | "score"
  | "reviews"
  | "posts"
  | "keywords"
  | "competitors"
  | "opportunities";

export type LocalSeoPostStatus =
  | "idea"
  | "draft"
  | "review"
  | "waiting_approval"
  | "approved"
  | "ready_to_publish"
  | "published"
  | "rejected"
  | "changes_requested";
export type LocalSeoReviewStatus =
  | "new"
  | "response_suggested"
  | "review"
  | "approved"
  | "ready_to_respond"
  | "responded";
export type LocalSeoOpportunityStatus =
  | "detected"
  | "analyzed"
  | "action_prepared"
  | "waiting_approval"
  | "in_progress"
  | "completed"
  | "dismissed";
export type LocalSeoPostType = "standard" | "offer" | "event";
export type LocalSeoCtaAction =
  | "NONE"
  | "LEARN_MORE"
  | "CALL"
  | "BOOK" | "ORDER"
  | "SHOP"
  | "SIGN_UP";
export type SocialChannel = "gbp" | "instagram" | "facebook";
export type ReviewSentiment = "positive" | "neutral" | "negative" | "critical";

export function getReviewSentiment(rating: number): ReviewSentiment {
  return rating >= 4 ? "positive" : rating === 3 ? "neutral" : "critical";
}

export type LocalSeoPostDraft = {
  clientId: string;
  theme?: string;
  objective?: string;
  service?: string;
  locality?: string;
  primaryKeyword?: string;
  relatedKeywords: string[];
  cta?: string;
  body?: string;
  postType?: LocalSeoPostType;
  ctaAction?: LocalSeoCtaAction;
  ctaUrl?: string;
  channels?: SocialChannel[];
  offerTitle?: string;
  couponCode?: string;
  offerTerms?: string;
  eventTitle?: string;
  startDate?: string;
  endDate?: string;
  status: LocalSeoPostStatus;
  origin: "human" | "agent" | "opportunity" | "campaign" | "reused";
  author?: string;
  approvalId?: string;
  createdAt?: string;
  updatedAt?: string;
};
