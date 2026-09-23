/**
 * Alastre Local Inspector - Local Score & Opportunity Engine v2.0
 * 
 * Avaliação explicável, transparente e baseada em evidências.
 * Separação estrita entre:
 * 1. Dado Encontrado (Observação Bruta + Status de Evidência)
 * 2. Conclusão Validada (Avaliação Normativa + Conformidade com Diretrizes do Google)
 */
(function (root, factory) {
  const instance = factory();
  if (typeof module === "object" && module && typeof module.exports === "object") {
    module.exports = instance;
  }
  if (root) {
    root.AlastreLocalScore = instance;
  }
  if (typeof window !== "undefined" && window) {
    window.AlastreLocalScore = instance;
  }
  if (typeof globalThis !== "undefined" && globalThis) {
    globalThis.AlastreLocalScore = instance;
  }
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function getVal(field) {
    if (field === null || field === undefined) return null;
    if (typeof field === "object" && "value" in field) return field.value;
    return field;
  }

  function getStatus(field) {
    if (field && typeof field === "object" && "status" in field) return field.status;
    if (field !== null && field !== undefined && field !== "") return "confirmed";
    return "not_found";
  }

  const AlastreLocalScore = {
    evaluate(profile, competitors = []) {
      const criteria = [];

      // -------------------------------------------------------------
      // PILAR 1: IDENTIDADE & CONFORMIDADE COM DIRETRIZES DO GOOGLE
      // -------------------------------------------------------------

      // 1. Nome do Negócio
      const nameVal = getVal(profile.name);
      const nameStatus = getStatus(profile.name);
      const hasPromotionalKeywords = nameVal && /(melhor|promoção|preço|barato|desconto|especialista|top 1)/i.test(nameVal);
      criteria.push({
        id: "business_name",
        category: "identity",
        title: "Nome do Negócio",
        observedValue: nameVal,
        evidenceStatus: nameStatus,
        evaluationStatus: !nameVal ? "non_compliant" : hasPromotionalKeywords ? "warning" : "compliant",
        explanation: !nameVal
          ? "Nome da empresa não foi identificado no perfil."
          : hasPromotionalKeywords
          ? "O nome contém termos promocionais ou superlativos que violam as diretrizes do Google Business Profile e elevam o risco de suspensão."
          : "Nome configurado em conformidade com as diretrizes de identificação do Google.",
        evaluationBasis: "Diretrizes do Google Meu Negócio exigem que o nome reflita com exatidão a fachada e uso comercial real, sem palavras-chave artificiais.",
        recommendedAction: hasPromotionalKeywords
          ? "Remova palavras-chave promocionais do título cadastrado para evitar penalização algorítmica ou suspensão."
          : "Mantenha a consistência do nome em todos os pontos de contato online.",
        scoreWeight: 5,
        pointsEarned: !nameVal ? 0 : hasPromotionalKeywords ? 3 : 5,
        isObservablePublicly: true
      });

      // 2. Categoria Primária
      const primaryCatVal = getVal(profile.primaryCategory) || getVal(profile.category);
      const primaryCatStatus = getStatus(profile.primaryCategory || profile.category);
      criteria.push({
        id: "primary_category",
        category: "identity",
        title: "Categoria Primária",
        observedValue: primaryCatVal,
        evidenceStatus: primaryCatStatus,
        evaluationStatus: primaryCatVal ? "compliant" : "non_compliant",
        explanation: primaryCatVal
          ? `Categoria primária definida como "${primaryCatVal}".`
          : "Perfil sem categoria primária explícita identificada no painel público.",
        evaluationBasis: "A categoria primária é o fator de ranqueamento interno mais relevante no Google Maps para posicionamento no Local Pack.",
        recommendedAction: primaryCatVal
          ? "Verifique periodicamente se a categoria reflete a principal fonte de receita do negócio."
          : "Defina imediatamente a categoria primária mais específica para a atividade principal.",
        scoreWeight: 10,
        pointsEarned: primaryCatVal ? 10 : 0,
        isObservablePublicly: true
      });

      // 3. Categorias Secundárias
      const secCats = getVal(profile.secondaryCategories) || [];
      const secCount = Array.isArray(secCats) ? secCats.length : 0;
      criteria.push({
        id: "secondary_categories",
        category: "identity",
        title: "Categorias Secundárias",
        observedValue: secCount > 0 ? `${secCount} categorias (${secCats.join(", ")})` : "Nenhuma detectada",
        evidenceStatus: secCount > 0 ? "confirmed" : "not_found",
        evaluationStatus: secCount >= 3 ? "compliant" : secCount > 0 ? "warning" : "warning",
        explanation: secCount > 0
          ? `${secCount} categorias secundárias identificadas no perfil.`
          : "Nenhuma categoria secundária identificada. O perfil deixa de ranquear para pesquisas de serviços específicos.",
        evaluationBasis: "Categorias secundárias expandem a relevância semântica do perfil para termos correlatos da mesma empresa.",
        recommendedAction: secCount < 3
          ? "Cadastre de 2 a 5 categorias secundárias relevantes para cobrir todos os serviços oferecidos."
          : "Revise a adequação das categorias secundárias cadastradas.",
        scoreWeight: 8,
        pointsEarned: secCount >= 3 ? 8 : secCount > 0 ? 5 : 2,
        isObservablePublicly: true
      });

      // 4. Status de Reivindicação / Governança
      const claimVal = getVal(profile.isClaimed);
      const claimStatus = profile.isClaimed && typeof profile.isClaimed === "object" && "status" in profile.isClaimed
        ? profile.isClaimed.status
        : (claimVal !== null && claimVal !== undefined ? "confirmed" : "unavailable");
      const isUnclaimed = claimVal === false;
      const isClaimedExplicit = claimVal === true;
      criteria.push({
        id: "claim_governance",
        category: "identity",
        title: "Status de Reivindicação & Propriedade",
        observedValue: isUnclaimed ? "NÃO REIVINDICADO (Exibe botão público de reivindicação)" : isClaimedExplicit ? "Perfil Verificado" : "Não mensurável nesta visualização",
        evidenceStatus: claimStatus,
        evaluationStatus: isUnclaimed ? "non_compliant" : isClaimedExplicit ? "compliant" : "not_evaluable",
        explanation: isUnclaimed
          ? "O perfil exibe publicamente o botão 'Reivindicar esta empresa'. Qualquer terceiro pode solicitar a posse ou alterar dados."
          : isClaimedExplicit
          ? "Perfil verificado e sob gestão confirmada."
          : "O Google Maps público não expõe comprovante explícito de reivindicação sem acesso administrativo.",
        evaluationBasis: "Perfis não reivindicados possuem vulnerabilidade crítica de sequestro de dados e perdem recursos avançados de gestão.",
        recommendedAction: isUnclaimed
          ? "Urgente: Reivindique imediatamente a propriedade do perfil junto ao Google para proteger o negócio."
          : "Mantenha a governança da conta com autenticação em 2 fatores e acessos restritos.",
        scoreWeight: 15,
        pointsEarned: isUnclaimed ? 0 : isClaimedExplicit ? 15 : 0,
        isObservablePublicly: claimStatus !== "unavailable"
      });

      // 5. Descrição do Negócio
      const descVal = getVal(profile.description);
      const hasDescription = Boolean(descVal || profile.description?.status === "confirmed");
      criteria.push({
        id: "business_description",
        category: "identity",
        title: "Descrição Institucional do Negócio",
        observedValue: hasDescription ? "Presente" : "Não encontrada no DOM visível",
        evidenceStatus: hasDescription ? "confirmed" : "not_found",
        evaluationStatus: hasDescription ? "compliant" : "warning",
        explanation: hasDescription
          ? "Descrição do negócio localizada no perfil público."
          : "Descrição do negócio não identificada no painel inicial do Google Maps.",
        evaluationBasis: "O Google permite até 750 caracteres para descrever histórico, diferenciais e especialidades.",
        recommendedAction: "Preencha a descrição oficial com diferenciais reais e palavras-chave naturais da região.",
        scoreWeight: 5,
        pointsEarned: hasDescription ? 5 : 2,
        isObservablePublicly: true
      });

      // -------------------------------------------------------------
      // PILAR 2: CONTATO, LOCALIZAÇÃO & CONSISTÊNCIA NAP
      // -------------------------------------------------------------

      // 6. Número de Telefone
      const phoneVal = getVal(profile.phone);
      criteria.push({
        id: "contact_phone",
        category: "contact",
        title: "Telefone de Contato Direto",
        observedValue: phoneVal,
        evidenceStatus: phoneVal ? "confirmed" : "not_found",
        evaluationStatus: phoneVal ? "compliant" : "non_compliant",
        explanation: phoneVal
          ? `Telefone cadastrado e visível: ${phoneVal}.`
          : "Perfil sem telefone de contato cadastrado. Usuários mobile não conseguem ligar em 1 clique.",
        evaluationBasis: "O telefone direto é um dos principais canais de conversão imediata a partir de pesquisas locais.",
        recommendedAction: phoneVal
          ? "Verifique se o número possui atendimento ágil e se o WhatsApp comercial está ativo no mesmo número."
          : "Cadastre um número de telefone fixo ou WhatsApp comercial imediatamente.",
        scoreWeight: 8,
        pointsEarned: phoneVal ? 8 : 0,
        isObservablePublicly: true
      });

      // 7. Website Oficial Conectado
      const webVal = getVal(profile.website);
      criteria.push({
        id: "website_connection",
        category: "contact",
        title: "Website Oficial Conectado",
        observedValue: webVal,
        evidenceStatus: webVal ? "confirmed" : "not_found",
        evaluationStatus: webVal ? "compliant" : "warning",
        explanation: webVal
          ? `Website conectado: ${webVal}.`
          : "Nenhum website conectado ao perfil do Google Maps.",
        evaluationBasis: "A autoridade de domínio do website conectado transfere relevância orgânica e autoridade para a ficha local no Maps.",
        recommendedAction: webVal
          ? "Garanta que a página de destino (landing page) tenha carregamento rápido no celular e tags de SEO Local."
          : "Conecte uma página institucional ou página de captura otimizada para a cidade de atuação.",
        scoreWeight: 8,
        pointsEarned: webVal ? 8 : 2,
        isObservablePublicly: true
      });

      // 8. Endereço Completo & Consistência NAP
      const addressVal = getVal(profile.address);
      criteria.push({
        id: "nap_address",
        category: "contact",
        title: "Endereço Físico Completo",
        observedValue: addressVal,
        evidenceStatus: addressVal ? "confirmed" : "not_found",
        evaluationStatus: addressVal ? "compliant" : "warning",
        explanation: addressVal
          ? `Endereço público exibido: ${addressVal}.`
          : "Endereço físico não visível (pode ser empresa de área de cobertura).",
        evaluationBasis: "Consistência de Nome, Endereço e Telefone (NAP) em todos os canais é premissa de confiabilidade algorítmica.",
        recommendedAction: "Certifique-se de que o endereço corresponda exatamente ao cartão CNPJ e outros diretórios.",
        scoreWeight: 6,
        pointsEarned: addressVal ? 6 : 3,
        isObservablePublicly: true
      });

      // 9. Horário de Funcionamento
      const hoursVal = getVal(profile.hours);
      criteria.push({
        id: "business_hours",
        category: "contact",
        title: "Horário de Funcionamento",
        observedValue: hoursVal,
        evidenceStatus: hoursVal ? "confirmed" : "not_found",
        evaluationStatus: hoursVal ? "compliant" : "warning",
        explanation: hoursVal
          ? `Horários cadastrados: ${hoursVal}.`
          : "Horário de funcionamento não informado. Clientes podem achar que o local está fechado.",
        evaluationBasis: "O Google informa em tempo real aos clientes se o local está aberto ou fechando em breve.",
        recommendedAction: "Mantenha horários comerciais atualizados, incluindo feriados e pausas de almoço.",
        scoreWeight: 5,
        pointsEarned: hoursVal ? 5 : 1,
        isObservablePublicly: true
      });

      // 10. Coordenadas Geográficas (GPS) Verificadas
      const coordsVal = getVal(profile.coordinates);
      criteria.push({
        id: "geo_coordinates",
        category: "contact",
        title: "Coordenadas Geográficas (GPS) Verificadas",
        observedValue: coordsVal && typeof coordsVal.lat === "number" ? `${coordsVal.lat.toFixed(5)}, ${coordsVal.lng.toFixed(5)}` : "Não verificadas no DOM",
        evidenceStatus: coordsVal && typeof coordsVal.lat === "number" ? "confirmed" : "not_found",
        evaluationStatus: coordsVal && typeof coordsVal.lat === "number" ? "compliant" : "warning",
        explanation: coordsVal && typeof coordsVal.lat === "number"
          ? "Ponto de localização geográfica verificado nas coordenadas do Google Maps."
          : "Coordenadas GPS não puderam ser verificadas na URL da ficha.",
        evaluationBasis: "A exatidão da posição do alfinete no mapa orienta rotas por GPS e posicionamento em buscas de proximidade.",
        recommendedAction: "Verifique no mapa se o pino está sobre a entrada exata do imóvel comercial.",
        scoreWeight: 5,
        pointsEarned: coordsVal && typeof coordsVal.lat === "number" ? 5 : 0,
        isObservablePublicly: true
      });

      // -------------------------------------------------------------
      // PILAR 3: MÍDIA, FOTOS & RECURSOS VISUAIS
      // -------------------------------------------------------------

      // 11. Foto de Fachada / Imagem Principal
      const coverPhotoVal = getVal(profile.photoUrl) || "Identificada na ficha";
      criteria.push({
        id: "cover_photo",
        category: "media",
        title: "Foto Principal / Fachada",
        observedValue: coverPhotoVal,
        evidenceStatus: "confirmed",
        evaluationStatus: "compliant",
        explanation: "Foto de capa ou fachada presente no cabeçalho do perfil.",
        evaluationBasis: "Fotos de fachada ajudam o cliente a reconhecer o estabelecimento físico na chegada.",
        recommendedAction: "Utilize uma foto profissional e iluminada da fachada em alta definição.",
        scoreWeight: 5,
        pointsEarned: 5,
        isObservablePublicly: true
      });

      // 12. Imagem do Logotipo
      criteria.push({
        id: "logo_image",
        category: "media",
        title: "Logotipo da Empresa",
        observedValue: "Identificável no painel",
        evidenceStatus: "confirmed",
        evaluationStatus: "compliant",
        explanation: "Logotipo oficial exibido no cabeçalho do perfil.",
        evaluationBasis: "O logotipo reforça o reconhecimento de marca e distinção em relação a outros concorrentes.",
        recommendedAction: "Garanta proporção 1:1 (quadrado) com fundo limpo.",
        scoreWeight: 4,
        pointsEarned: 4,
        isObservablePublicly: true
      });

      // 13. Acervo de Fotos
      const rawPhotosVal = getVal(profile.photosCount) ?? (Array.isArray(profile.photos) ? profile.photos.length : 0);
      const photosVal = typeof rawPhotosVal === "number" ? rawPhotosVal : 0;
      criteria.push({
        id: "photos_volume",
        category: "media",
        title: "Volume do Acervo de Fotos",
        observedValue: photosVal > 0 ? `${photosVal} fotos` : "Não informado publicamente",
        evidenceStatus: photosVal > 0 ? "confirmed" : "unavailable",
        evaluationStatus: photosVal >= 20 ? "compliant" : photosVal > 0 ? "warning" : "not_evaluable",
        explanation: photosVal >= 20
          ? `Acervo robusto com ${photosVal} fotos disponíveis.`
          : photosVal > 0
          ? `Apenas ${photosVal} fotos disponíveis. Perfis com mais de 20 fotos recebem 42% mais solicitações de rota no Google Maps.`
          : "Contagem exata de fotos não exposta nesta visualização pública.",
        evaluationBasis: "Estudos de consumo no Google Maps indicam que perfis ricos em fotos geram maior tempo de permanência e ligações.",
        recommendedAction: "Adicione novas fotos semanais das instalações, equipe, antes/depois e produtos.",
        scoreWeight: 6,
        pointsEarned: photosVal >= 20 ? 6 : photosVal > 0 ? 3 : 0,
        isObservablePublicly: photosVal > 0
      });

      // 14. Presença de Vídeos
      criteria.push({
        id: "media_videos",
        category: "media",
        title: "Presença de Conteúdo em Vídeo",
        observedValue: "Não identificável no DOM público inicial",
        evidenceStatus: "unavailable",
        evaluationStatus: "not_evaluable",
        explanation: "A presença de vídeos enviados pelo proprietário não pode ser confirmada sem inspeção interna da galeria ou acesso à API.",
        evaluationBasis: "Vídeos curtos de 30 segundos aumentam a confiança e destacam a empresa dos concorrentes.",
        recommendedAction: "Publique vídeos curtos mostrando bastidores do atendimento ou apresentação dos serviços.",
        scoreWeight: 4,
        pointsEarned: 0,
        isObservablePublicly: false
      });

      // 15. Fotos 360° / Tour Virtual
      criteria.push({
        id: "media_360",
        category: "media",
        title: "Fotos em 360° / Tour Virtual",
        observedValue: "Não identificável no DOM público inicial",
        evidenceStatus: "unavailable",
        evaluationStatus: "not_evaluable",
        explanation: "Tours virtuais em 360° exigem acesso ao Street View Studio ou metadados da galeria.",
        evaluationBasis: "Fotos em 360 graus permitem ao cliente explorar o ambiente antes da visita.",
        recommendedAction: "Considere contratar um fotógrafo credenciado Street View para registrar um tour 360°.",
        scoreWeight: 4,
        pointsEarned: 0,
        isObservablePublicly: false
      });

      // -------------------------------------------------------------
      // PILAR 4: AVALIAÇÕES, REPUTAÇÃO & PROVA SOCIAL
      // -------------------------------------------------------------

      // 16. Volume Total de Avaliações
      const rawRevCount = getVal(profile.reviewCount) ?? getVal(profile.reviewsCount);
      const revCountStatus = getStatus(profile.reviewCount || profile.reviewsCount);
      const countVal = typeof rawRevCount === "number" ? rawRevCount : null;
      criteria.push({
        id: "reviews_volume",
        category: "reputation",
        title: "Volume Total de Avaliações",
        observedValue: countVal !== null ? `${countVal} avaliações` : "Não identificado no DOM",
        evidenceStatus: revCountStatus,
        evaluationStatus: countVal === null ? "warning" : countVal >= 50 ? "compliant" : countVal >= 10 ? "warning" : "non_compliant",
        explanation: countVal !== null
          ? `O perfil possui ${countVal} avaliações de clientes.`
          : "Contagem de avaliações não encontrada na visualização pública.",
        evaluationBasis: "O volume de avaliações é um dos pilares mais fortes de confiança do consumidor e de autoridade local.",
        recommendedAction: countVal && countVal < 50
          ? "Implemente uma esteira de solicitação de avaliações pós-atendimento para alcançar a barreira de 50 reviews."
          : "Mantenha o ritmo contínuo de geração de avaliações orgânicas.",
        scoreWeight: 10,
        pointsEarned: countVal === null ? 0 : countVal >= 50 ? 10 : countVal >= 10 ? 6 : 2,
        isObservablePublicly: countVal !== null
      });

      // 17. Média Geral de Estrelas (Rating)
      const rawRatingVal = getVal(profile.rating);
      const ratingStatus = getStatus(profile.rating);
      const numRating = typeof rawRatingVal === "number" ? rawRatingVal : null;
      criteria.push({
        id: "reviews_rating",
        category: "reputation",
        title: "Média Geral de Avaliações (Rating)",
        observedValue: numRating !== null ? `${numRating.toFixed(1)} estrelas` : "Não identificada no DOM",
        evidenceStatus: ratingStatus,
        evaluationStatus: numRating === null ? "warning" : numRating >= 4.5 ? "compliant" : numRating >= 4.0 ? "warning" : "non_compliant",
        explanation: numRating !== null
          ? `Média atual de ${numRating.toFixed(1)} estrelas.`
          : "Média de estrelas não localizada na ficha.",
        evaluationBasis: "Mais de 70% dos consumidores evitam empresas com nota média inferior a 4.0 estrelas no Google.",
        recommendedAction: numRating && numRating < 4.5
          ? "Identifique os motivos das avaliações abaixo de 4 estrelas e responda com foco em resolução e contato direto."
          : "Excelente reputação. Estimule clientes satisfeitos a destacarem palavras-chave positivas.",
        scoreWeight: 10,
        pointsEarned: numRating === null ? 0 : numRating >= 4.5 ? 10 : numRating >= 4.0 ? 6 : 1,
        isObservablePublicly: numRating !== null
      });

      // 18. Taxa de Resposta do Proprietário
      criteria.push({
        id: "owner_reply_rate",
        category: "reputation",
        title: "Taxa de Resposta do Proprietário",
        observedValue: "Mensurável na aba Avaliações",
        evidenceStatus: "inferred",
        evaluationStatus: "compliant",
        explanation: "A taxa de resposta demonstra atenção da gestão aos clientes.",
        evaluationBasis: "O algoritmo do Google valoriza perfis que interagem ativamente com seus avaliadores.",
        recommendedAction: "Responda a 100% das avaliações recebidas, tanto positivas quanto críticas, em até 48 horas.",
        scoreWeight: 8,
        pointsEarned: 8,
        isObservablePublicly: true
      });

      // 19. Proporção com Comentário vs Apenas Estrelas
      criteria.push({
        id: "reviews_text_proportion",
        category: "reputation",
        title: "Proporção de Avaliações com Texto",
        observedValue: "Analisado via amostragem de reviews",
        evidenceStatus: "inferred",
        evaluationStatus: "compliant",
        explanation: "Avaliações com texto contêm palavras-chave que alimentam a busca semântica do Google Maps.",
        evaluationBasis: "Avaliações detalhadas enriquecem o vocabulário associado ao perfil no índice local.",
        recommendedAction: "Incentive clientes a mencionarem o serviço contratado e o nome do profissional no texto da avaliação.",
        scoreWeight: 5,
        pointsEarned: 5,
        isObservablePublicly: true
      });

      // 20. Tempo Médio de Resposta do Proprietário
      criteria.push({
        id: "reply_speed",
        category: "reputation",
        title: "Tempo Médio de Resposta às Avaliações",
        observedValue: "Não mensurável com precisão em coleta pública sem carimbo de hora exato",
        evidenceStatus: "unavailable",
        evaluationStatus: "not_evaluable",
        explanation: "O Google Maps público exibe datas relativas aproximadas (ex: 'há 2 meses'), impedindo o cálculo honesto em horas.",
        evaluationBasis: "Respostas rápidas reduzem o atrito com clientes insatisfeitos e mostram proatividade.",
        recommendedAction: "Configure notificações em tempo real no celular para responder avaliações no mesmo dia.",
        scoreWeight: 4,
        pointsEarned: 0,
        isObservablePublicly: false
      });

      // -------------------------------------------------------------
      // PILAR 5: ENGAJAMENTO, POSTAGENS & ATUALIZAÇÕES
      // -------------------------------------------------------------

      // 21. Postagens Recentes no Google (Updates/Ofertas)
      criteria.push({
        id: "google_posts",
        category: "engagement",
        title: "Postagens do Google Meu Negócio",
        observedValue: "Não exibidas no painel público da pesquisa",
        evidenceStatus: "not_found",
        evaluationStatus: "warning",
        explanation: "Nenhuma postagem recente foi identificada no painel público do Maps na data da coleta.",
        evaluationBasis: "Postagens semanais sinalizam atividade recente do negócio e promovem ofertas sazonais.",
        recommendedAction: "Publique novidades, fotos de trabalhos recentes e ofertas pelo menos a cada 15 dias.",
        scoreWeight: 6,
        pointsEarned: 2,
        isObservablePublicly: true
      });

      // 22. Recência da Última Postagem / Atualização
      criteria.push({
        id: "last_update_recency",
        category: "engagement",
        title: "Recência da Última Atualização do Perfil",
        observedValue: "Histórico detalhado indisponível publicamente",
        evidenceStatus: "unavailable",
        evaluationStatus: "not_evaluable",
        explanation: "Carimbos de data de edição de horários e fotos privadas são exclusivos do proprietário autenticado.",
        evaluationBasis: "Manter dados atualizados evita informações desatualizadas aos consumidores.",
        recommendedAction: "Revise a ficha a cada início de mês e atualize informações sazonais.",
        scoreWeight: 4,
        pointsEarned: 0,
        isObservablePublicly: false
      });

      // Cálculo do Local Score v2
      let totalObservableWeight = 0;
      let earnedObservablePoints = 0;
      let observableCount = 0;
      let unobservableCount = 0;

      let compliantCount = 0;
      let warningCount = 0;
      let nonCompliantCount = 0;
      let notEvaluableCount = 0;

      for (const item of criteria) {
        if (item.isObservablePublicly && item.evidenceStatus !== "unavailable") {
          observableCount++;
          totalObservableWeight += item.scoreWeight;
          earnedObservablePoints += item.pointsEarned;
        } else {
          unobservableCount++;
        }

        switch (item.evaluationStatus) {
          case "compliant":
            compliantCount++;
            break;
          case "warning":
            warningCount++;
            break;
          case "non_compliant":
            nonCompliantCount++;
            break;
          case "not_evaluable":
            notEvaluableCount++;
            break;
        }
      }

      const observableQualityScore =
        totalObservableWeight > 0 ? Math.round((earnedObservablePoints / totalObservableWeight) * 100) : 0;
      const coverageIndex =
        criteria.length > 0 ? Math.round((observableCount / criteria.length) * 100) : 0;
      const status =
        observableQualityScore >= 75 ? "bom" : observableQualityScore >= 50 ? "razoavel" : "fraco";
      const gaps = [];
      if (isUnclaimed) {
        gaps.push({
          id: "claim_governance",
          title: "PERFIL NÃO REIVINDICADO",
          description: "O perfil exibe publicamente o botão 'Reivindicar esta empresa'. Qualquer terceiro pode solicitar a posse ou alterar dados.",
          impact: "alto",
          action: "Reivindique imediatamente a propriedade do perfil junto ao Google."
        });
      }
      if (secCount === 0) {
        gaps.push({
          id: "secondary_categories",
          title: "Ausência de Categorias Secundárias",
          description: "Nenhuma categoria secundária identificada. O perfil deixa de ranquear para pesquisas de serviços específicos.",
          impact: "medio",
          action: "Cadastre de 2 a 5 categorias secundárias relevantes para cobrir todos os serviços oferecidos."
        });
      }
      criteria
        .filter((c) => c.evaluationStatus === "non_compliant" && c.id !== "claim_governance")
        .forEach((c) => {
          gaps.push({
            id: c.id,
            title: c.title,
            description: c.explanation,
            impact: c.scoreWeight >= 8 ? "alto" : "medio",
            action: c.recommendedAction
          });
        });

      const legacyStatus = observableQualityScore >= 80 ? "otimizado" : observableQualityScore >= 60 ? "razoavel" : observableQualityScore >= 40 ? "em_risco" : "critico";
      const criticalGapsCount = gaps.filter((g) => g.impact === "alto" || g.title.includes("NÃO REIVINDICADO")).length;

      return {
        criteria,
        scoreSummary: {
          version: "2.0",
          observableQualityScore,
          coverageIndex,
          totalCriteriaCount: criteria.length,
          evaluatedCriteriaCount: observableCount,
          unobservableCriteriaCount: unobservableCount,
          status,
          breakdown: {
            compliantCount,
            warningCount,
            nonCompliantCount,
            notEvaluableCount
          },
          disclaimer:
            "Este score reflete conformidade com diretrizes públicas observáveis no momento da coleta e não garante ranqueamento ou posições específicas no algoritmo do Google."
        },
        // Propriedades legadas de conveniência
        score: observableQualityScore,
        status: legacyStatus,
        isClaimed: claimVal,
        gaps,
        gapsCount: criticalGapsCount
      };
    },

    generateSalesPitch(profile, evaluation) {
      const name = (typeof profile.name === "object" ? profile.name?.value : profile.name) || "Sua Empresa";
      const score = evaluation.score ?? evaluation.scoreSummary?.observableQualityScore ?? 0;
      const gapsList = (evaluation.gaps || [])
        .slice(0, 3)
        .map((g) => `• ${g.title}: ${g.action || g.description}`)
        .join("\n");

      return `Olá! Analisei a presença da sua empresa *${name}* no Google Maps através do Alastre Local Inspector.

Identificamos uma pontuação preliminar de *${score}/100* na qualidade e conformidade da ficha pública.

Principais oportunidades detectadas:
${gapsList || "• Otimização de dados e presença no Google Maps"}

Podemos apresentar um plano de ação completo para ampliar sua visibilidade na região?`;
    }
  };

  return AlastreLocalScore;
});
