import {z} from "zod";
export const postStatuses=["idea","draft","review","waiting_approval","approved","ready_to_publish","published","rejected","changes_requested"] as const;
export const replyStatuses=["draft","review","waiting_approval","approved","ready_to_respond","responded","changes_requested"] as const;
export const opportunityStatuses=["detected","analyzed","action_prepared","waiting_approval","in_progress","completed","dismissed"] as const;
export const transitions={post:{idea:["draft"],draft:["review","waiting_approval"],review:["draft","waiting_approval"],waiting_approval:["approved","changes_requested","rejected"],approved:["ready_to_publish"],ready_to_publish:[],published:[],rejected:["draft"],changes_requested:["draft"]},reply:{draft:["review","waiting_approval"],review:["draft","waiting_approval"],waiting_approval:["approved","changes_requested"],approved:["ready_to_respond"],ready_to_respond:[],responded:[],changes_requested:["draft"]},opportunity:{detected:["analyzed","dismissed"],analyzed:["action_prepared","dismissed"],action_prepared:["waiting_approval","in_progress","dismissed"],waiting_approval:["in_progress","action_prepared"],in_progress:["completed","dismissed"],completed:[],dismissed:["detected"]}} as const;
export type WorkflowKind=keyof typeof transitions;
export function canTransition(kind:WorkflowKind,from:string,to:string){return ((transitions[kind] as Record<string,readonly string[]>)[from]??[]).includes(to)}
const id=z.string().uuid(),text=(max:number)=>z.string().trim().max(max);
export const postTypes = ["standard", "offer", "event"] as const;
export const ctaActions = ["NONE", "LEARN_MORE", "CALL", "BOOK", "ORDER", "SHOP", "SIGN_UP"] as const;
export const socialChannels = ["gbp", "instagram", "facebook"] as const;

export interface GbpComplianceValidation {
  valid: boolean;
  idealLength: boolean;
  length: number;
  warnings: string[];
  errors: string[];
}

export function validateGbpPostContent(body: string, _options?: { ctaAction?: string; postType?: string }): GbpComplianceValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  const length = body.trim().length;

  const phonePattern = /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9\d{4}|\d{4})[\s.-]?\d{4}/;
  if (phonePattern.test(body)) {
    warnings.push("O Google frequentemente rejeita postagens com número de telefone no texto. Utilize o botão de ação 'Ligar agora' em vez de inserir o telefone na legenda.");
  }

  if (length > 1500) {
    errors.push("O texto excede o limite máximo de 1500 caracteres permitido pelo Google.");
  } else if (length > 300) {
    warnings.push("O texto ultrapassa 300 caracteres. No Google Maps e Search, partes do texto serão ocultadas sob 'Ver mais'. Recomenda-se entre 150 e 300 caracteres.");
  } else if (length < 80 && length > 0) {
    warnings.push("Texto muito curto para gerar relevância local e engajamento. Idealmente use pelo menos 150 caracteres.");
  }

  const idealLength = length >= 150 && length <= 300;

  return {
    valid: errors.length === 0,
    idealLength,
    length,
    warnings,
    errors,
  };
}

export const localSeoRequest=z.discriminatedUnion("action",[
  z.object({action:z.literal("local_seo_workspace"),client_id:id}),
  z.object({action:z.literal("local_seo_post_save"),client_id:id,id:id.optional(),payload:z.object({
    theme:text(180),
    objective:text(300).optional(),
    service:text(180).optional(),
    locality:text(180).optional(),
    primary_keyword:text(180).optional(),
    related_keywords:z.array(text(180)).max(20).default([]),
    cta:text(300).optional(),
    body:text(5000),
    post_type:z.enum(postTypes).default("standard"),
    cta_action:z.enum(ctaActions).default("NONE"),
    cta_url:text(1000).optional(),
    channels:z.array(z.enum(socialChannels)).default(["gbp"]),
    offer_title:text(180).optional(),
    coupon_code:text(50).optional(),
    offer_terms:text(2000).optional(),
    event_title:text(180).optional(),
    start_date:z.string().optional(),
    end_date:z.string().optional(),
    origin:z.enum(["human","agent","opportunity","campaign","reused"]).default("human")
  })}),
  z.object({action:z.literal("local_seo_post_generate"),client_id:id,payload:z.object({theme:text(180),objective:text(300).optional(),service:text(180).optional(),locality:text(180).optional(),primary_keyword:text(180).optional()})}),
  z.object({action:z.literal("local_seo_post_transition"),client_id:id,id:id,status:z.enum(postStatuses)}),
  z.object({action:z.literal("local_seo_review_register"),client_id:id,payload:z.object({external_id:text(300).optional(),rating:z.number().int().min(1).max(5),reviewer_name:text(180).optional(),reviewed_at:z.string().datetime().optional(),review_text:text(5000)})}),
  z.object({action:z.literal("local_seo_reply_save"),client_id:id,review_id:id,id:id.optional(),payload:z.object({body:text(5000),origin:z.enum(["human","agent"]).default("human")})}),
  z.object({action:z.literal("local_seo_reply_generate"),client_id:id,review_id:id}),
  z.object({action:z.literal("local_seo_reply_transition"),client_id:id,id:id,status:z.enum(replyStatuses)}),
  z.object({action:z.literal("local_seo_opportunity_save"),client_id:id,id:id.optional(),payload:z.object({origin:text(180),category:z.enum(["profile","reviews","content","ranking","competition","site","conversion"]),priority:z.enum(["critical","high","medium","low"]),title:text(220),diagnosis:text(3000).optional(),recommendation:text(3000).optional(),expected_impact:text(1000).optional(),suggested_action:text(2000).optional()})}),
  z.object({action:z.literal("local_seo_opportunity_transition"),client_id:id,id:id,status:z.enum(opportunityStatuses)})]);
