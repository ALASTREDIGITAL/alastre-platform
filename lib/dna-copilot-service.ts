function getEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env?.[name]) {
    const val = process.env[name]?.trim();
    if (val && val.length > 0) return val;
  }
  return undefined;
}

function cleanLocation(text: string): string {
  const res = text.trim();
  const emMatch = res.match(/em\s+([A-Za-zÀ-ÿ\s]+)$/i);
  if (emMatch && emMatch[1].trim().length >= 3) {
    return emMatch[1].trim();
  }
  return res.replace(/^(na cidade de|em|no|na)\s+/i, "").trim();
}

function cleanSegment(text: string): string {
  const res = text.trim();
  return res
    .replace(/\s+é\s+especializada.*$/i, "")
    .replace(/\s+em\s+.*$/i, "")
    .trim();
}

export type DnaCopilotContext = {
  client_name?: string;
  segment?: string;
  city?: string;
  services?: string[];
  primary_service?: string;
  competitors?: string[];
  keywords?: string[];
};

export type DnaCopilotChatParams = {
  functionUrl: string;
  bridgeSecret: string;
  email: string;
  clientId: string;
  copilotType: "keywords" | "competitors" | "voice" | "faq";
  message: string;
  context?: DnaCopilotContext;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type DnaCopilotChatResult = {
  content: string;
  copilot_type: string;
  provider?: "gemini" | "openai" | "local_rules";
};

export async function handleDnaCopilotChat({
  functionUrl,
  bridgeSecret,
  email,
  clientId,
  copilotType,
  message,
  context,
  history,
}: DnaCopilotChatParams): Promise<DnaCopilotChatResult> {
  let clientName = context?.client_name?.trim() || "Empresa";
  let segment = cleanSegment(context?.segment?.trim() || "Negócio Local");
  let city = cleanLocation(context?.city?.trim() || "São Paulo");
  let services: string[] = Array.isArray(context?.services) ? context.services : [];
  let primaryService = context?.primary_service?.trim() || "";
  let competitors: string[] = Array.isArray(context?.competitors) ? context.competitors : [];
  let existingKeywords: string[] = Array.isArray(context?.keywords) ? context.keywords : [];

  // 1. Busca dados reais do DNA via ação workspace da ponte se faltar dados essenciais
  if ((segment === "Negócio Local" || city === "São Paulo") && clientId && clientId !== "fake") {
    try {
      const wsRes = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-alastre-user-email": email,
          "x-alastre-bridge-secret": bridgeSecret,
          "x-alastre-write-mode": "disabled",
        },
        body: JSON.stringify({ action: "workspace", client_id: clientId }),
      });

      if (wsRes.ok) {
        const ws = await wsRes.json();
        if (ws?.client?.name && clientName === "Empresa") clientName = String(ws.client.name).trim();
        const b = ws?.dna?.business_data ?? {};
        if (b.segment) segment = String(b.segment).trim();
        if (b.city) city = String(b.city).trim();
        else if (Array.isArray(b.cities) && b.cities[0]) city = String(b.cities[0]).trim();
        if (Array.isArray(b.services) && services.length === 0) {
          services = b.services.map((s: unknown) => String(s).trim()).filter(Boolean);
        }
        if (b.primary_service && !primaryService) primaryService = String(b.primary_service).trim();

        const loc = ws?.dna?.local_intelligence ?? {};
        if (Array.isArray(loc.competitors) && competitors.length === 0) {
          competitors = loc.competitors.map((c: unknown) => String(c).trim()).filter(Boolean);
        }
        if (Array.isArray(loc.keywords) && existingKeywords.length === 0) {
          existingKeywords = loc.keywords.map((k: unknown) => String(k).trim()).filter(Boolean);
        }
      }
    } catch {
      // Fallback defensivo se o fetch do workspace falhar
    }
  }

  // 2. Trava e Guardrail de Escopo Estrito
  const normalizedMsg = message.toLowerCase().trim();
  const isOutOfScope =
    normalizedMsg.includes("receita de") ||
    normalizedMsg.includes("quem ganhou") ||
    normalizedMsg.includes("escreva um poema") ||
    normalizedMsg.includes("conte uma piada") ||
    normalizedMsg.includes("código em python") ||
    normalizedMsg.includes("fale sobre política");

  if (isOutOfScope) {
    const scopeLabel =
      copilotType === "competitors"
        ? "Concorrentes Locais"
        : copilotType === "voice"
        ? "Tom de Voz da Marca"
        : copilotType === "faq"
        ? "Perguntas Frequentes (FAQ)"
        : "Palavras-Chave e SEO Local";

    return {
      content: `Olá! Como Copiloto Especialista em **${scopeLabel}** de **${clientName}**, meu escopo é restrito à inteligência de mercado e buscas locais de **${segment}** em **${city}**.\n\nPor favor, faça perguntas sobre termos de busca, concorrentes ou estratégias locais para este negócio.`,
      copilot_type: copilotType,
    };
  }

  // 3. Tentativa com Provedor de IA Externo se chave estiver configurada
  const geminiKey = getEnv("GEMINI_API_KEY");
  const openaiKey = getEnv("OPENAI_API_KEY");
  const servicesListStr = services.length > 0 ? services.join(", ") : primaryService || segment;

  if (geminiKey) {
    try {
      const model = getEnv("GEMINI_MODEL") || "gemini-3.6-flash";
      const systemPrompt =
        copilotType === "competitors"
          ? `Você é o Copiloto Especialista em Concorrentes Locais da Alastre Digital para ${clientName} (${segment} em ${city}, serviços: ${servicesListStr}).\nSEU ESCOPO É ESTRITO E FECHADO: Você SÓ fala sobre concorrência local, empresas rivais na mesma cidade/região e diferenciais competitivos.\nSE O USUÁRIO PERGUNTAR QUALQUER COISA FORA DESSE CONTEXTO, RECUSE EDUCADAMENTE.\nSempre que sugerir concorrentes para monitorar, formate com marcadores no padrão:\n* [ADICIONAR_CONCORRENTE: Nome da Empresa Concorrente]\nExplique brevemente por que sugeriu cada um. Responda em português do Brasil de forma concisa e prática.`
          : copilotType === "voice"
          ? `Você é o Copiloto Especialista em Tom de Voz da Marca da Alastre Digital para ${clientName} (${segment} em ${city}).\nSEU ESCOPO É ESTRITO: identidade verbal, arquétipos, vocabulário e regras editoriais.\nResponda em português do Brasil.`
          : copilotType === "faq"
          ? `Você é o Copiloto Especialista em FAQ e Dúvidas Frequentes da Alastre Digital para ${clientName} (${segment} em ${city}, serviços: ${servicesListStr}).\nSEU ESCOPO É ESTRITO: dúvidas de clientes locais, objeções e respostas claras.\nResponda em português do Brasil.`
          : `Você é o Copiloto Especialista em Palavras-Chave e SEO Local da Alastre Digital para ${clientName} (${segment} em ${city}, serviços: ${servicesListStr}).\nSEU ESCOPO É ESTRITO E FECHADO: Você SÓ fala sobre termos de busca, intenção local no Google, palavras-chave comerciais e SEO local para esta empresa.\nSE O USUÁRIO PERGUNTAR QUALQUER COISA FORA DESSE CONTEXTO, RECUSE EDUCADAMENTE.\nSempre que sugerir palavras-chave ou termos para o cliente ranquear, formate com marcadores no padrão:\n* [ADICIONAR_PALAVRA: termo aqui]\nDestaque a intenção de cada termo (urgência, conversão, local, preço). Responda em português do Brasil de forma concisa e prática e atenda DIRETAMENTE ao que o usuário perguntou.`;

      // Gemini exige alternância rigorosa entre 'user' e 'model'
      const validContents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
      if (Array.isArray(history) && history.length > 0) {
        let lastRole: "user" | "model" | null = null;
        for (const h of history.slice(-6)) {
          const role: "user" | "model" = h.role === "assistant" ? "model" : "user";
          if (role !== lastRole) {
            validContents.push({ role, parts: [{ text: String(h.content).slice(0, 1000) }] });
            lastRole = role;
          }
        }
        if (lastRole === "user") {
          validContents.pop();
        }
      }
      validContents.push({
        role: "user",
        parts: [{ text: message }],
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: validContents,
            generationConfig: { temperature: 0.4, maxOutputTokens: 1000 },
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const replyText = parts.map((p: { text?: string }) => p.text || "").join("").trim();
        if (replyText) {
          return { content: replyText, copilot_type: copilotType, provider: "gemini" };
        }
      }
    } catch {
      // Fallback para geração local inteligente
    }
  }

  if (openaiKey) {
    try {
      const systemPrompt =
        copilotType === "competitors"
          ? `Você é o Copiloto Especialista em Concorrentes Locais da Alastre Digital para ${clientName} (${segment} em ${city}, serviços: ${servicesListStr}).\nSEU ESCOPO É ESTRITO E FECHADO: Você SÓ fala sobre concorrência local, empresas rivais na mesma cidade/região e diferenciais competitivos.\nSE O USUÁRIO PERGUNTAR QUALQUER COISA FORA DESSE CONTEXTO, RECUSE EDUCADAMENTE.\nSempre que sugerir concorrentes para monitorar, formate com marcadores no padrão:\n* [ADICIONAR_CONCORRENTE: Nome da Empresa Concorrente]\nExplique brevemente por que sugeriu cada um. Responda em português do Brasil de forma concisa e prática.`
          : `Você é o Copiloto Especialista em Palavras-Chave e SEO Local da Alastre Digital para ${clientName} (${segment} em ${city}, serviços: ${servicesListStr}).\nSEU ESCOPO É ESTRITO E FECHADO: Você SÓ fala sobre termos de busca, intenção local no Google, palavras-chave comerciais e SEO local para esta empresa.\nSE O USUÁRIO PERGUNTAR QUALQUER COISA FORA DESSE CONTEXTO, RECUSE EDUCADAMENTE.\nSempre que sugerir palavras-chave ou termos para o cliente ranquear, formate com marcadores no padrão:\n* [ADICIONAR_PALAVRA: termo aqui]\nDestaque a intenção de cada termo (urgência, conversão, local). Responda em português do Brasil de forma concisa e prática e responda exatamente o que o usuário perguntou.`;

      const formattedHistory = Array.isArray(history)
        ? history.slice(-6).map((h) => ({
            role: h.role === "user" ? ("user" as const) : ("assistant" as const),
            content: String(h.content).slice(0, 1000),
          }))
        : [];

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: getEnv("OPENAI_MODEL") || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            ...formattedHistory,
            { role: "user", content: message },
          ],
          temperature: 0.3,
          max_tokens: 800,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const replyText = data?.choices?.[0]?.message?.content?.trim();
        if (replyText) {
          return { content: replyText, copilot_type: copilotType, provider: "openai" };
        }
      }
    } catch {
      // Fallback para geração local inteligente
    }
  }

  // 4. Geração Dinâmica Inteligente de Regras Locais (Modo Offline / Sem Chave de IA)
  const cleanCity = city.trim();
  const cleanSeg = segment.trim();
  const cleanPrim = (primaryService || segment).trim();
  const queryLower = message.toLowerCase().trim();

  const offlineNotice = `\n\n*(ℹ️ Resposta gerada por regras de SEO Local. Para liberar a IA generativa do Google Gemini com diálogo livre, adicione a chave GEMINI_API_KEY no arquivo .env.local)*`;

  if (copilotType === "competitors") {
    let competitorSuggestions = [
      `Líder ${cleanSeg} ${cleanCity}`,
      `Centro Especializado em ${cleanPrim} ${cleanCity}`,
      `${cleanSeg} Prime ${cleanCity}`,
      `Auto Estúdio ${cleanCity}`,
    ];

    if (queryLower.includes("preço") || queryLower.includes("preco")) {
      competitorSuggestions = [
        `${cleanSeg} Popular ${cleanCity}`,
        `Express ${cleanSeg} ${cleanCity}`,
        `Centro Automotivo Econômico ${cleanCity}`,
      ];
    }

    const chips = competitorSuggestions
      .filter((c) => !competitors.some((curr) => curr.toLowerCase() === c.toLowerCase()))
      .slice(0, 4)
      .map((c) => `* [ADICIONAR_CONCORRENTE: ${c}]`)
      .join("\n");

    return {
      content:
        `Analisando a concorrência para **${cleanSeg}** em **${cleanCity}** sobre "${message}":\n\n` +
        `Empresas locais bem posicionadas nesta região destacam agilidade de resposta, fotos reais dos serviços e avaliações semanais no Perfil da Empresa.\n\n` +
        `Concorrentes recomendados para monitoramento:\n${chips}\n\n` +
        `Clique em qualquer um dos concorrentes acima para incluí-lo na sua lista de monitoramento do DNA!` +
        offlineNotice,
      copilot_type: "competitors",
      provider: "local_rules",
    };
  }

  if (copilotType === "voice") {
    return {
      content:
        `Para **${cleanSeg}** em **${cleanCity}**, respondendo sobre "${message}":\n\n` +
        `Diretrizes recomendadas para o tom de voz:\n` +
        `• **Tom Geral:** Especialista, claro e acolhedor.\n` +
        `• **Vocabulário:** Destaque durabilidade, estética, técnica e cuidado com o patrimônio.\n` +
        `• **Chamada para Ação:** Convidar para orçamento transparente e sem compromisso via WhatsApp.` +
        offlineNotice,
      copilot_type: "voice",
      provider: "local_rules",
    };
  }

  if (copilotType === "faq") {
    return {
      content:
        `Dúvidas frequentes mapeadas para **${cleanSeg}** em **${cleanCity}** sobre "${message}":\n\n` +
        `1. **Quanto tempo demora o serviço?**\n` +
        `*Explique que serviços rápidos levam algumas horas e procedimentos completos podem levar 1 a 2 dias.*\n\n` +
        `2. **Quais as garantias e durabilidade?**\n` +
        `*Detalhe os produtos certificados utilizados e o tempo de durabilidade garantido.*\n\n` +
        `3. **Quais formas de pagamento são aceitas?**\n` +
        `*Deixe claro se parcela no cartão em até 10x ou se tem desconto no Pix.*` +
        offlineNotice,
      copilot_type: "faq",
      provider: "local_rules",
    };
  }

  // Padrão: Palavras-Chave Locais - Análise dinâmica da pergunta do usuário
  let responseIntro = "";
  const targetedKeywords: string[] = [];

  if (queryLower.includes("polimento")) {
    responseIntro = `Analisando especificamente a busca pelo serviço de **Polimento** em **${cleanCity}**:\n\nA palavra "polimento" isolada tem volume alto, mas as buscas que mais convertem clientes prontos combinam a técnica e a localização.`;
    targetedKeywords.push(
      `polimento automotivo ${cleanCity.toLowerCase()}`,
      `polimento tecnico ${cleanCity.toLowerCase()}`,
      `polimento comercial ${cleanCity.toLowerCase()}`,
      `polimento e cristalizacao ${cleanCity.toLowerCase()}`,
      `preco polimento automotivo ${cleanCity.toLowerCase()}`,
      `polimento de farois ${cleanCity.toLowerCase()}`
    );
  } else if (queryLower.includes("vitrific")) {
    responseIntro = `Analisando especificamente **Vitrificação de Pintura** em **${cleanCity}**:\n\nTrata-se de um serviço de alto ticket onde o cliente busca proteção e durabilidade.`;
    targetedKeywords.push(
      `vitrificacao de pintura ${cleanCity.toLowerCase()}`,
      `vitrificacao automotiva ${cleanCity.toLowerCase()}`,
      `preco vitrificacao ${cleanCity.toLowerCase()}`,
      `protecao de pintura ceramica ${cleanCity.toLowerCase()}`,
      `melhor vitrificacao ${cleanCity.toLowerCase()}`
    );
  } else if (queryLower.includes("exata") || queryLower.includes("exatas")) {
    responseIntro = `Termos exatos e diretos de busca comercial para **${cleanSeg}** em **${cleanCity}**:\n\nEstes termos correspondem exatamente ao que pessoas prontas para agendar digitam no Google:`;
    targetedKeywords.push(
      `${cleanSeg.toLowerCase()} ${cleanCity.toLowerCase()}`,
      `polimento automotivo ${cleanCity.toLowerCase()}`,
      `lavagem detalhada ${cleanCity.toLowerCase()}`,
      `higienizacao interna ${cleanCity.toLowerCase()}`,
      `estetica automotiva perto de mim`
    );
  } else if (queryLower.includes("preco") || queryLower.includes("preço") || queryLower.includes("quanto custa") || queryLower.includes("valor")) {
    responseIntro = `Termos de pesquisa voltados a **Preço e Orçamento** em **${cleanCity}**:\n\nBuscas com intenção de preço indicam clientes no fundo do funil prontos para comprar:`;
    targetedKeywords.push(
      `preco polimento automotivo ${cleanCity.toLowerCase()}`,
      `quanto custa vitrificacao de pintura`,
      `orcamento estetica automotiva ${cleanCity.toLowerCase()}`,
      `tabela precos lavagem detalhada`,
      `polimento automotivo valor ${cleanCity.toLowerCase()}`
    );
  } else if (queryLower.includes("urgência") || queryLower.includes("urgencia") || queryLower.includes("rapido") || queryLower.includes("rápido")) {
    responseIntro = `Termos de **Atendimento Imediato e Urgência** em **${cleanCity}**:\n\nUsuários que precisam do serviço hoje costumam buscar:`;
    targetedKeywords.push(
      `lavagem automotiva aberta agora ${cleanCity.toLowerCase()}`,
      `estetica automotiva perto de mim`,
      `lavagem rapida ${cleanCity.toLowerCase()}`,
      `higienizacao automotiva domingo ${cleanCity.toLowerCase()}`
    );
  } else {
    // Pergunta livre: combina o segmento, serviços cadastrados e cidade
    responseIntro = `Termos recomendados para "${message}" em **${cleanSeg}** (${cleanCity}):\n\nIdentifiquei termos que combinam relevância local e volume de pesquisa no Google Maps:`;
    targetedKeywords.push(
      `${cleanSeg.toLowerCase()} em ${cleanCity.toLowerCase()}`,
      `melhor ${cleanSeg.toLowerCase()} ${cleanCity.toLowerCase()}`,
      `${cleanPrim.toLowerCase()} ${cleanCity.toLowerCase()}`,
      `estetica automotiva perto de mim`,
      `polimento e vitrificacao ${cleanCity.toLowerCase()}`
    );
    for (const s of services) {
      const term = `${s.toLowerCase()} ${cleanCity.toLowerCase()}`;
      if (!targetedKeywords.includes(term)) targetedKeywords.push(term);
    }
  }

  const chips = targetedKeywords
    .filter((k) => !existingKeywords.some((curr) => curr.toLowerCase() === k.toLowerCase()))
    .slice(0, 5)
    .map((k) => `* [ADICIONAR_PALAVRA: ${k}]`)
    .join("\n");

  return {
    content:
      `${responseIntro}\n\n` +
      `Palavras-chave recomendadas:\n${chips}\n\n` +
      `Clique em qualquer um dos botões abaixo para adicioná-los diretamente ao DNA!` +
      offlineNotice,
    copilot_type: "keywords",
    provider: "local_rules",
  };
}
