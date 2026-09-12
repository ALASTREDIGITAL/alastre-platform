type JsonObject=Record<string,unknown>;
export const LOCAL_POST_PROMPT_VERSION="local_post_v1";
export const LOCAL_REVIEW_REPLY_PROMPT_VERSION="local_review_reply_v1";
const rules="Use somente fatos presentes no DNA e na solicitação. Não invente serviços, locais, resultados, experiências ou dados pessoais. Evite keyword stuffing. Entregue apenas um rascunho em português do Brasil, pronto para revisão humana; não afirme que publicou ou respondeu externamente.";
export function localPostPrompt(context:JsonObject){return `${rules}\nTAREFA: redigir uma única postagem local clara, útil e natural. Retorne somente o texto final.\nCONTEXTO AUTORIZADO: ${JSON.stringify(context).slice(0,12000)}`}
export function localReviewReplyPrompt(context:JsonObject){return `${rules}\nTAREFA: sugerir uma única resposta empática e individual à avaliação. Não revele informações internas. Retorne somente o texto final.\nCONTEXTO AUTORIZADO: ${JSON.stringify(context).slice(0,12000)}`}
