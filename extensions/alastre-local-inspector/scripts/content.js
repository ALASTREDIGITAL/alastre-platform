/**
 * Alastre Local Inspector - Content Script v2.0 (World: ISOLATED)
 * Injeta Drawer de auditoria e integração segura com a Alastre Platform.
 * 
 * Regras Estritas:
 * 1. Sanitização total contra XSS: construção segura de DOM com textContent.
 * 2. Transferência segura Manifest V3 via background.js (sem dados pessoais na query string).
 * 3. Suporte a exportação de contingência em JSON no clipboard e download de arquivo.
 * 4. Zero dados fictícios: sem notas 5.0 ou reviews 3 inventados.
 */
(function () {
  "use strict";

  const STORAGE_CONFIG_KEY = "alastre_platform_url";
  const DEFAULT_PLATFORM_URL = "http://127.0.0.1:5175";

  let activeProfile = null;
  let activeEvaluation = null;
  let activeCompetitors = [];
  let drawerElement = null;
  let floatingTriggerElement = null;
  let scannerOverlayElement = null;
  let isExtractingCompetitors = false;

  // Utilitário de Sanitização e Construção Segura de DOM
  function createEl(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    if (props.className) el.className = props.className;
    if (props.id) el.id = props.id;
    if (props.title) el.title = props.title;
    if (props.textContent !== undefined) el.textContent = props.textContent;
    if (props.type) el.type = props.type;
    if (props.style && typeof props.style === "object") {
      Object.assign(el.style, props.style);
    }
    if (props.attributes && typeof props.attributes === "object") {
      for (const [k, v] of Object.entries(props.attributes)) {
        el.setAttribute(k, v);
      }
    }
    if (props.onClick && typeof props.onClick === "function") {
      el.addEventListener("click", props.onClick);
    }

    if (Array.isArray(children)) {
      for (const child of children) {
        if (typeof child === "string") {
          el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
          el.appendChild(child);
        }
      }
    }

    return el;
  }

  function showToast(message, isError = false) {
    const existing = document.querySelector(".alastre-toast");
    if (existing) existing.remove();

    const toast = createEl("div", {
      className: `alastre-toast ${isError ? "alastre-toast-error" : ""}`,
      textContent: message,
      style: {
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: isError ? "#ef4444" : "#0f172a",
        color: "#ffffff",
        padding: "12px 20px",
        borderRadius: "8px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
        fontSize: "13px",
        fontWeight: "600",
        zIndex: "999999",
        border: isError ? "1px solid #f87171" : "1px solid #334155"
      }
    });

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3200);
  }

  // =========================================================================
  // 1. SCANNER VISUAL COM RADAR
  // =========================================================================

  function runAuditWithScanner(title = "Auditando Perfil Local", onComplete) {
    if (scannerOverlayElement) {
      scannerOverlayElement.remove();
      scannerOverlayElement = null;
    }

    const companyName = (window.AlastreExtractor ? window.AlastreExtractor.extractFullSnapshot().name?.value : "") || "Negócio Local";

    scannerOverlayElement = createEl("div", { id: "alastre-scanner-overlay" });
    const modal = createEl("div", { className: "alastre-scanner-modal" });

    // Radar
    const radarWrapper = createEl("div", { className: "alastre-radar-wrapper" }, [
      createEl("div", { className: "alastre-radar-circle circle-1" }),
      createEl("div", { className: "alastre-radar-circle circle-2" }),
      createEl("div", { className: "alastre-radar-circle circle-3" }),
      createEl("div", { className: "alastre-radar-sweep" }),
      createEl("div", { className: "alastre-radar-center-dot", textContent: "A" })
    ]);

    // Header
    const titleBox = createEl("div", { style: { textAlign: "center" } }, [
      createEl("h3", { className: "alastre-scanner-title", textContent: title }),
      createEl("p", { className: "alastre-scanner-company", textContent: companyName })
    ]);

    // Progresso
    const progressFill = createEl("div", { className: "alastre-scanner-progress-fill", id: "alastre-progress-fill" });
    const progressBar = createEl("div", { className: "alastre-scanner-progress-bar" }, [progressFill]);

    const stepText = createEl("div", {
      className: "alastre-scanner-step-text",
      id: "alastre-step-text",
      textContent: "Iniciando varredura de dados públicos..."
    });

    const checklist = createEl("div", { className: "alastre-scanner-checklist", id: "alastre-scanner-checklist" }, [
      createEl("div", { className: "alastre-scan-item", id: "step-1" }, ["○ Identificando nome, endereço e telefones"]),
      createEl("div", { className: "alastre-scan-item", id: "step-2" }, ["○ Revelando categorias secundárias ocultas"]),
      createEl("div", { className: "alastre-scan-item", id: "step-3" }, ["○ Avaliando nota, reviews e prova social"]),
      createEl("div", { className: "alastre-scan-item", id: "step-4" }, ["○ Verificando status de reivindicação"]),
      createEl("div", { className: "alastre-scan-item", id: "step-5" }, ["○ Gerando Alastre Local Score v2"])
    ]);

    modal.appendChild(radarWrapper);
    modal.appendChild(titleBox);
    modal.appendChild(progressBar);
    modal.appendChild(stepText);
    modal.appendChild(checklist);
    scannerOverlayElement.appendChild(modal);
    document.body.appendChild(scannerOverlayElement);

    const steps = [
      { pct: 20, text: "Capturando dados de contato e endereço...", item: "step-1", delay: 300 },
      { pct: 45, text: "Descobrindo categorias secundárias no Maps...", item: "step-2", delay: 600 },
      { pct: 70, text: "Auditando volume de avaliações e média de estrelas...", item: "step-3", delay: 900 },
      { pct: 90, text: "Checando se a empresa foi reivindicada...", item: "step-4", delay: 1200 },
      { pct: 100, text: "Compilando Local Score v2...", item: "step-5", delay: 1500 }
    ];

    steps.forEach((s) => {
      setTimeout(() => {
        progressFill.style.width = `${s.pct}%`;
        stepText.textContent = s.text;
        const it = document.getElementById(s.item);
        if (it) {
          it.classList.add("completed");
          it.textContent = `✓ ${it.textContent.replace("○ ", "")}`;
        }
      }, s.delay);
    });

    setTimeout(() => {
      if (scannerOverlayElement) {
        scannerOverlayElement.classList.add("fade-out");
        setTimeout(() => {
          if (scannerOverlayElement) scannerOverlayElement.remove();
          scannerOverlayElement = null;
          if (typeof onComplete === "function") onComplete();
        }, 300);
      }
    }, 1800);
  }

  // =========================================================================
  // 2. CONSTRUÇÃO DO ENVELOPE SEGURO DE SESSÃO (SCHEMA V2.0)
  // =========================================================================

  function buildAuditSessionEnvelope() {
    if (!window.AlastreExtractor || !window.AlastreLocalScore) return null;

    activeProfile = window.AlastreExtractor.extractFullSnapshot();
    const startTime = Date.now();

    const targetCoords = activeProfile.coordinates?.value || null;
    activeCompetitors = window.AlastreExtractor.extractMapCompetitors(
      activeProfile.name?.value || "",
      targetCoords
    );

    const reviewsData = window.AlastreExtractor.extractReviewsData
      ? window.AlastreExtractor.extractReviewsData(document, {
          kgmid: activeProfile.kgmid?.value,
          name: activeProfile.name?.value,
          cid: activeProfile.cid?.value
        })
      : { status: "not_implemented", message: "", capturedCount: 0, reviews: [] };

    activeEvaluation = window.AlastreLocalScore.evaluate(activeProfile, activeCompetitors);

    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    return {
      version: "2.0",
      sessionId,
      timestamp: now,
      sourceUrl: window.location.href,
      searchContext: {
        query: document.querySelector("#searchboxinput")?.value || undefined,
        locationLabel: activeProfile.address?.value || undefined,
        sampleSize: activeCompetitors.length
      },
      profile: activeProfile,
      reviews: reviewsData.reviews || [],
      reviewsCollection: {
        status: reviewsData.status,
        message: reviewsData.message,
        capturedCount: reviewsData.capturedCount,
        discardedCount: reviewsData.discardedCount || 0
      },
      competitors: activeCompetitors,
      checklist: activeEvaluation.criteria,
      score: activeEvaluation.scoreSummary,
      metadata: {
        extensionVersion: "2.0.0",
        extractionDurationMs: Date.now() - startTime,
        collectedBy: "alastre_local_inspector",
        collectionMode: "visible_public_dom"
      }
    };
  }

  // =========================================================================
  // 3. TRANSFERÊNCIA SEGURA PARA A ALASTRE PLATFORM
  // =========================================================================

  async function handleOpenInPlatform(tabSection = "report") {
    const envelope = buildAuditSessionEnvelope();
    if (!envelope || !envelope.profile.name.value) {
      showToast("Selecione uma empresa no Google Maps antes de abrir na plataforma.", true);
      return;
    }

    showToast("Iniciando transferência segura com a Alastre Platform...");

    chrome.runtime.sendMessage(
      {
        action: "OPEN_AUDIT_SESSION_IN_PLATFORM",
        envelope,
        tabSection
      },
      (response) => {
        if (chrome.runtime.lastError) {
          showToast(`Erro na extensão: ${chrome.runtime.lastError.message}`, true);
          return;
        }

        if (response && response.success) {
          showToast(`✓ Aberto com segurança na Alastre Platform! (Sessão: ${response.sessionId.slice(0, 8)})`);
        } else {
          showToast(`Falha ao abrir na plataforma: ${(response && response.error) || "Erro desconhecido"}`, true);
        }
      }
    );
  }

  function handleCopyJsonEnvelope() {
    const envelope = buildAuditSessionEnvelope();
    if (!envelope || !envelope.profile.name.value) {
      showToast("Nenhum dado auditado para copiar.", true);
      return;
    }

    const jsonStr = JSON.stringify(envelope, null, 2);
    navigator.clipboard.writeText(jsonStr).then(
      () => showToast("✓ Pacote JSON copiado para a área de transferência!"),
      () => showToast("Erro ao copiar para a área de transferência.", true)
    );
  }

  function handleDownloadJsonEnvelope() {
    const envelope = buildAuditSessionEnvelope();
    if (!envelope || !envelope.profile.name.value) {
      showToast("Nenhum dado auditado para download.", true);
      return;
    }

    const jsonStr = JSON.stringify(envelope, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (envelope.profile.name.value || "prospect").toLowerCase().replace(/[^a-z0-9]/g, "-");
    a.href = url;
    a.download = `auditoria-${safeName}-${envelope.sessionId.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
    showToast("✓ Arquivo JSON de auditoria baixado com sucesso!");
  }

  // =========================================================================
  // 4. VARREDURA AUTOMÁTICA DE CONCORRENTES NO FEED DO GOOGLE MAPS
  // =========================================================================

  async function handleAutoScrollCompetitors() {
    if (isExtractingCompetitors) return;
    isExtractingCompetitors = true;

    showToast("Varrendo feed do Google Maps para carregar concorrência local...");

    const feedContainers = [
      document.querySelector('div[role="feed"]'),
      document.querySelector('.m6QErb[aria-label]'),
      document.querySelector('.m6QErb.DxyBCb'),
      document.querySelector('.DxyBCb')
    ];
    const feed = feedContainers.find((c) => Boolean(c));

    if (!feed) {
      showToast("Painel de resultados de busca não encontrado no Maps.", true);
      isExtractingCompetitors = false;
      return;
    }

    let scrolls = 0;
    const maxScrolls = 4;
    const interval = setInterval(() => {
      feed.scrollTop += 600;
      scrolls++;
      if (scrolls >= maxScrolls) {
        clearInterval(interval);
        setTimeout(() => {
          if (window.AlastreExtractor && activeProfile) {
            activeCompetitors = window.AlastreExtractor.extractMapCompetitors(
              activeProfile.name?.value || "",
              activeProfile.coordinates?.value || null
            );
            updateDrawerContent();
            showToast(`✓ Varredura concluída: ${activeCompetitors.length} concorrentes detectados!`);
          }
          isExtractingCompetitors = false;
        }, 500);
      }
    }, 400);
  }

  // =========================================================================
  // 5. DRAWER LATERAL DE AUDITORIA
  // =========================================================================

  function createDrawer() {
    if (document.getElementById("alastre-inspector-drawer")) return;

    drawerElement = createEl("div", { id: "alastre-inspector-drawer", className: "alastre-drawer" });

    // Header do Drawer
    const closeBtn = createEl("button", {
      className: "alastre-drawer-close",
      textContent: "×",
      title: "Fechar",
      onClick: () => toggleDrawer(false)
    });

    const header = createEl("div", { className: "alastre-drawer-header" }, [
      createEl("div", { className: "alastre-drawer-header-left" }, [
        createEl("div", { className: "alastre-drawer-brand-badge", textContent: "ALASTRE" }),
        createEl("div", {}, [
          createEl("div", { className: "alastre-drawer-title", textContent: "Local Inspector v2.0" }),
          createEl("div", { className: "alastre-drawer-subtitle", textContent: "Auditoria Fidedigna de Perfil & Concorrência" })
        ])
      ]),
      closeBtn
    ]);

    const content = createEl("div", { className: "alastre-drawer-body", id: "alastre-drawer-content" });

    drawerElement.appendChild(header);
    drawerElement.appendChild(content);
    document.body.appendChild(drawerElement);
  }

  function toggleDrawer(forceOpen) {
    if (!drawerElement) createDrawer();
    const shouldOpen = forceOpen !== undefined ? forceOpen : !drawerElement.classList.contains("open");
    if (shouldOpen) {
      updateDrawerContent();
      drawerElement.classList.add("open");
      if (floatingTriggerElement) {
        const arrow = floatingTriggerElement.querySelector(".alastre-trigger-arrow");
        if (arrow) arrow.style.transform = "rotate(180deg)";
      }
    } else {
      drawerElement.classList.remove("open");
      if (floatingTriggerElement) {
        const arrow = floatingTriggerElement.querySelector(".alastre-trigger-arrow");
        if (arrow) arrow.style.transform = "rotate(0deg)";
      }
    }
  }

  function updateDrawerContent() {
    if (!drawerElement) return;
    const content = document.getElementById("alastre-drawer-content");
    if (!content) return;
    content.innerHTML = ""; // Limpar nós com segurança

    if (!window.AlastreExtractor || !window.AlastreLocalScore) {
      content.appendChild(createEl("div", {
        textContent: "Módulos do Alastre Inspector carregando...",
        style: { padding: "20px", color: "#94a3b8" }
      }));
      return;
    }

    activeProfile = window.AlastreExtractor.extractFullSnapshot();
    const targetCoords = activeProfile.coordinates?.value || null;
    activeCompetitors = window.AlastreExtractor.extractMapCompetitors(
      activeProfile.name?.value || "",
      targetCoords
    );
    activeEvaluation = window.AlastreLocalScore.evaluate(activeProfile, activeCompetitors);

    const pName = activeProfile.name?.value;
    if (!pName) {
      const emptyState = createEl("div", {
        style: { textAlign: "center", padding: "50px 20px", color: "#94a3b8" }
      }, [
        createEl("div", { style: { fontSize: "36px", marginBottom: "12px" }, textContent: "🗺️" }),
        createEl("p", {
          style: { fontSize: "15px", fontWeight: "700", color: "#f8fafc", margin: "0 0 8px 0" },
          textContent: "Nenhum perfil identificado"
        }),
        createEl("p", {
          style: { fontSize: "12px", color: "#64748b", margin: "0" },
          textContent: "Selecione uma empresa no Google Maps para ver a auditoria fidedigna instantânea."
        })
      ]);
      content.appendChild(emptyState);
      return;
    }

    // 1. Card de Identidade da Empresa
    const identityCard = createEl("div", { className: "alastre-drawer-card" });
    const claimStatus = activeProfile.isClaimed?.value;
    const claimBadge = createEl("span", {
      className: `alastre-badge ${claimStatus === true ? "alastre-badge-claimed" : claimStatus === false ? "alastre-badge-unclaimed" : "alastre-badge-neutral"}`,
      textContent: claimStatus === true ? "✓ Verificado" : claimStatus === false ? "⚠️ Não Reivindicado" : "○ Reivindicação Desconhecida"
    });

    identityCard.appendChild(createEl("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } }, [
      createEl("h4", { className: "alastre-profile-name", textContent: pName }),
      claimBadge
    ]));

    const metaList = createEl("div", { className: "alastre-profile-meta" });
    if (activeProfile.primaryCategory?.value) {
      metaList.appendChild(createEl("div", { className: "alastre-meta-row" }, [
        createEl("span", { className: "alastre-meta-label", textContent: "Categoria:" }),
        createEl("span", { className: "alastre-meta-value", textContent: activeProfile.primaryCategory.value })
      ]));
    }
    if (activeProfile.phone?.value) {
      metaList.appendChild(createEl("div", { className: "alastre-meta-row" }, [
        createEl("span", { className: "alastre-meta-label", textContent: "Telefone:" }),
        createEl("span", { className: "alastre-meta-value", textContent: activeProfile.phone.value })
      ]));
    }
    if (activeProfile.address?.value) {
      metaList.appendChild(createEl("div", { className: "alastre-meta-row" }, [
        createEl("span", { className: "alastre-meta-label", textContent: "Endereço:" }),
        createEl("span", { className: "alastre-meta-value", textContent: activeProfile.address.value })
      ]));
    }
    if (activeProfile.reviewCount?.value !== null || activeProfile.rating?.value !== null) {
      const rVal = activeProfile.rating?.value !== null ? `★ ${activeProfile.rating.value.toFixed(1)}` : "Sem nota";
      const cVal = activeProfile.reviewCount?.value !== null ? `(${activeProfile.reviewCount.value} avaliações no Google)` : "";
      metaList.appendChild(createEl("div", { className: "alastre-meta-row" }, [
        createEl("span", { className: "alastre-meta-label", textContent: "Reputação:" }),
        createEl("span", { className: "alastre-meta-value", textContent: `${rVal} ${cVal}`.trim() })
      ]));
    }
    identityCard.appendChild(metaList);
    content.appendChild(identityCard);

    // 2. Score de Qualidade Observada vs Cobertura
    const scoreSummary = activeEvaluation.scoreSummary;
    const scoreCard = createEl("div", { className: "alastre-drawer-card alastre-score-card" });
    scoreCard.appendChild(createEl("div", { className: "alastre-score-header" }, [
      createEl("div", {}, [
        createEl("div", { className: "alastre-card-title", textContent: "Local Score v2.0" }),
        createEl("div", { className: "alastre-card-subtitle", textContent: "Baseado apenas nos critérios observáveis" })
      ]),
      createEl("div", { className: `alastre-score-badge alastre-score-${scoreSummary.status}` }, [
        createEl("span", { className: "alastre-score-num", textContent: String(scoreSummary.observableQualityScore) }),
        createEl("span", { className: "alastre-score-total", textContent: "/100" })
      ])
    ]));

    // Barra de Cobertura
    scoreCard.appendChild(createEl("div", { style: { marginTop: "10px", fontSize: "11px", color: "#94a3b8" } }, [
      createEl("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" } }, [
        createEl("span", { textContent: "Cobertura da Coleta Pública:" }),
        createEl("span", { style: { fontWeight: "700", color: "#f8fafc" }, textContent: `${scoreSummary.coverageIndex}%` })
      ]),
      createEl("div", { style: { height: "4px", backgroundColor: "#334155", borderRadius: "2px", overflow: "hidden" } }, [
        createEl("div", { style: { width: `${scoreSummary.coverageIndex}%`, height: "100%", backgroundColor: "#10b981" } })
      ])
    ]));
    content.appendChild(scoreCard);

    // 3. Ações de Exportação e Abertura na Plataforma
    const actionsCard = createEl("div", { className: "alastre-drawer-card" }, [
      createEl("div", { className: "alastre-card-title", textContent: "Ações & Integração com a Plataforma" }),
      createEl("button", {
        className: "alastre-btn alastre-btn-primary",
        textContent: "📑 Abrir Dossiê Executivo na Plataforma",
        onClick: () => handleOpenInPlatform("report")
      }),
      createEl("button", {
        className: "alastre-btn alastre-btn-secondary",
        textContent: "📊 Abrir Análise de Avaliações (GBPCheck)",
        onClick: () => handleOpenInPlatform("reviews")
      }),
      createEl("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, [
        createEl("button", {
          className: "alastre-btn alastre-btn-outline",
          style: { flex: "1", fontSize: "11px" },
          textContent: "📋 Copiar JSON",
          onClick: handleCopyJsonEnvelope
        }),
        createEl("button", {
          className: "alastre-btn alastre-btn-outline",
          style: { flex: "1", fontSize: "11px" },
          textContent: "💾 Baixar .json",
          onClick: handleDownloadJsonEnvelope
        })
      ])
    ]);
    content.appendChild(actionsCard);

    // 4. Concorrentes Coletados
    const competitorsCard = createEl("div", { className: "alastre-drawer-card" });
    competitorsCard.appendChild(createEl("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } }, [
      createEl("div", { className: "alastre-card-title", textContent: `Concorrência Local (${activeCompetitors.length} detectados)` }),
      createEl("button", {
        className: "alastre-btn-link",
        textContent: "Varrer Feed ↻",
        onClick: handleAutoScrollCompetitors
      })
    ]));

    if (activeCompetitors.length === 0) {
      competitorsCard.appendChild(createEl("p", {
        style: { fontSize: "11px", color: "#94a3b8", margin: "4px 0 0 0" },
        textContent: "Nenhum concorrente detectado na amostra visível. Clique em 'Varrer Feed' para rolar os resultados."
      }));
    } else {
      const compList = createEl("div", { className: "alastre-competitors-list" });
      activeCompetitors.slice(0, 6).forEach((comp) => {
        const ratingText = comp.rating !== null ? `★ ${comp.rating.toFixed(1)}` : "Sem nota";
        const revText = comp.reviewsCount !== null ? `(${comp.reviewsCount})` : "";
        const distText = comp.distanceKm !== null ? `• ${comp.distanceKm} km` : "";
        compList.appendChild(createEl("div", { className: `alastre-comp-row ${comp.isCurrentClient ? "alastre-comp-self" : ""}` }, [
          createEl("span", { className: "alastre-comp-rank", textContent: `${comp.rankInVisibleSample}º` }),
          createEl("span", { className: "alastre-comp-name", textContent: comp.name + (comp.isCurrentClient ? " (Auditado)" : "") }),
          createEl("span", { className: "alastre-comp-stats", textContent: `${ratingText} ${revText} ${distText}` })
        ]));
      });
      competitorsCard.appendChild(compList);
    }
    content.appendChild(competitorsCard);
  }

  // =========================================================================
  // 6. GATILHO FLUTUANTE NA TELA DO GOOGLE MAPS
  // =========================================================================

  function createFloatingTrigger() {
    if (document.getElementById("alastre-floating-trigger")) return;

    floatingTriggerElement = createEl("button", {
      id: "alastre-floating-trigger",
      type: "button",
      title: "Abrir Alastre Local Inspector",
      onClick: () => runAuditWithScanner("Auditando Perfil Local", () => toggleDrawer(true))
    }, [
      createEl("span", { className: "alastre-trigger-icon", textContent: "⚡" }),
      createEl("span", { textContent: "Alastre Inspector" }),
      createEl("span", { className: "alastre-trigger-arrow", textContent: "◀" })
    ]);

    document.body.appendChild(floatingTriggerElement);
  }

  // Inicialização no DOM
  function initialize() {
    createFloatingTrigger();
    createDrawer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
