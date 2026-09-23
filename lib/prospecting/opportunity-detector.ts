export interface LeadOpportunities {
  withoutWebsite: boolean;
  withoutPhone: boolean;
  fewReviews: boolean;
  lowRating: boolean;
  incompleteInfo: boolean;
  unclaimedProfile: boolean;
}

export function detectOpportunities(lead: {
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  rating?: number | null;
  review_count?: number | null;
}): LeadOpportunities {
  const withoutWebsite = !lead.website || lead.website.trim().length === 0;
  const withoutPhone = !lead.phone || lead.phone.trim().length === 0;
  const fewReviews =
    lead.review_count !== null &&
    lead.review_count !== undefined &&
    lead.review_count <= 10;
  const lowRating =
    lead.rating !== null && lead.rating !== undefined && lead.rating < 4.5;
  const incompleteInfo =
    withoutWebsite ||
    withoutPhone ||
    !lead.address ||
    lead.address.trim().length === 0;
  // Perfil não reivindicado: estritamente falso sem evidência pública comprovada
  const unclaimedProfile = false;

  return {
    withoutWebsite,
    withoutPhone,
    fewReviews,
    lowRating,
    incompleteInfo,
    unclaimedProfile,
  };
}
