/**
 * Alastre Local Inspector - Background Service Worker (Manifest V3)
 * Gerencia ciclo de vida, configurações e transferência segura de sessões com modelo de ameaça restrito.
 */

const DEFAULT_PLATFORM_URL = "http://127.0.0.1:5175";
const MAX_PAYLOAD_SIZE = 500 * 1024; // 500 KB
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutos de validade para resgate
const MAX_PENDING_SESSIONS = 10;
const inMemoryPendingSessions = new Map();

const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost:(3000|5173|5174|5175)$/,
  /^http:\/\/127\.0\.0\.1:(3000|5173|5174|5175)$/,
  /^https:\/\/[a-z0-9-]+\.alastre\.digital$/,
  /^https:\/\/alastre\.digital$/,
  /^https:\/\/[a-z0-9-]+\.alastre\.com$/,
  /^https:\/\/alastre\.com$/
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

/**
 * Remove sessões expiradas ou excedentes do storage
 */
async function cleanupSessions() {
  try {
    const { alastre_pending_sessions } = await chrome.storage.local.get("alastre_pending_sessions");
    if (!alastre_pending_sessions || typeof alastre_pending_sessions !== "object") {
      await chrome.storage.local.set({ alastre_pending_sessions: {} });
      return;
    }

    const now = Date.now();
    const cleaned = {};
    const entries = Object.entries(alastre_pending_sessions);

    // Manter apenas sessões não expiradas e não resgatadas
    for (const [id, sess] of entries) {
      if (sess && sess.expiresAt > now && !sess.claimed) {
        cleaned[id] = sess;
      }
    }

    // Se houver mais do que o limite, descartar os mais antigos
    const activeKeys = Object.keys(cleaned);
    if (activeKeys.length > MAX_PENDING_SESSIONS) {
      activeKeys
        .sort((a, b) => cleaned[a].createdAt - cleaned[b].createdAt)
        .slice(0, activeKeys.length - MAX_PENDING_SESSIONS)
        .forEach((k) => delete cleaned[k]);
    }

    await chrome.storage.local.set({ alastre_pending_sessions: cleaned });
  } catch (e) {
    console.error("Erro na limpeza de sessões:", e);
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const { alastre_platform_url } = await chrome.storage.local.get("alastre_platform_url");
  if (!alastre_platform_url || alastre_platform_url.includes("localhost:3000")) {
    await chrome.storage.local.set({ alastre_platform_url: DEFAULT_PLATFORM_URL });
  }
  await cleanupSessions();
  console.log("Alastre Local Inspector inicializado. Versão:", chrome.runtime.getManifest().version);
});

// Listener de mensagens do popup, content scripts e bridge
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  // 1. Obter URL configurada da plataforma
  if (message.action === "GET_PLATFORM_CONFIG") {
    (async () => {
      const config = await chrome.storage.local.get("alastre_platform_url");
      sendResponse({ url: config.alastre_platform_url || DEFAULT_PLATFORM_URL });
    })();
    return true;
  }

  // 2. Salvar URL configurada da plataforma (com validação de allowlist)
  if (message.action === "SAVE_PLATFORM_CONFIG") {
    (async () => {
      try {
        const urlObj = new URL(message.url);
        if (!isOriginAllowed(urlObj.origin)) {
          sendResponse({
            success: false,
            error: `Origem '${urlObj.origin}' não permitida na política de segurança da Alastre Platform.`
          });
          return;
        }
        await chrome.storage.local.set({ alastre_platform_url: urlObj.origin });
        sendResponse({ success: true, url: urlObj.origin });
      } catch (err) {
        sendResponse({ success: false, error: "URL inválida ou malformada." });
      }
    })();
    return true;
  }

  // 3. Iniciar transferência segura: extensão registra sessão e abre nova aba autorizada
  if (message.action === "OPEN_AUDIT_SESSION_IN_PLATFORM") {
    (async () => {
      try {
        await cleanupSessions();

        const { envelope, tabSection } = message;
        if (!envelope || !envelope.sessionId || !envelope.profile) {
          sendResponse({ success: false, error: "Envelope de auditoria inválido ou incompleto." });
          return;
        }

        // Validação de tamanho do payload
        const serialized = JSON.stringify(envelope);
        if (serialized.length > MAX_PAYLOAD_SIZE) {
          sendResponse({
            success: false,
            error: `Payload (${(serialized.length / 1024).toFixed(1)} KB) excede o limite máximo de ${MAX_PAYLOAD_SIZE / 1024} KB.`
          });
          return;
        }

        const config = await chrome.storage.local.get("alastre_platform_url");
        const platformBase = config.alastre_platform_url || DEFAULT_PLATFORM_URL;
        const targetOrigin = new URL(platformBase).origin;

        if (!isOriginAllowed(targetOrigin)) {
          sendResponse({ success: false, error: `Origem de destino '${targetOrigin}' não autorizada.` });
          return;
        }

        // Gerar token efêmero de uso único
        const transferToken = crypto.randomUUID();
        const now = Date.now();
        const sessionId = envelope.sessionId;

        // Construir URL com ID de sessão e token no hash (nunca em query string, não enviado ao servidor HTTP)
        const sectionParam = tabSection ? `&tab=${encodeURIComponent(tabSection)}` : "";
        const targetUrl = `${targetOrigin}/?view=pre-audit&session_id=${encodeURIComponent(sessionId)}${sectionParam}#token=${transferToken}`;

        // 1. Gravar a sessão no storage e memória ANTES de abrir a aba para eliminar condição de corrida
        const sessionRecord = {
          sessionId,
          transferToken,
          targetOrigin,
          authorizedTabId: null, // será preenchido imediatamente após a criação
          createdAt: now,
          expiresAt: now + SESSION_TTL_MS,
          claimed: false,
          payload: envelope
        };

        inMemoryPendingSessions.set(sessionId, sessionRecord);

        const { alastre_pending_sessions } = await chrome.storage.local.get("alastre_pending_sessions");
        const sessions = alastre_pending_sessions || {};
        sessions[sessionId] = sessionRecord;
        await chrome.storage.local.set({ alastre_pending_sessions: sessions });

        // 2. Abrir aba intencional no navegador
        const createdTab = await chrome.tabs.create({ url: targetUrl });
        const authorizedTabId = createdTab.id;

        // 3. Atualizar com authorizedTabId em memória e storage
        sessionRecord.authorizedTabId = authorizedTabId;
        sessions[sessionId] = sessionRecord;
        await chrome.storage.local.set({ alastre_pending_sessions: sessions });

        sendResponse({ success: true, sessionId, tabId: authorizedTabId });
      } catch (err) {
        console.error("Erro ao iniciar sessão na plataforma:", err);
        sendResponse({ success: false, error: err.message || "Falha ao registrar sessão de auditoria." });
      }
    })();
    return true;
  }

  // 4. Reivindicar sessão de auditoria (chamado pelo bridge na aba aberta)
  if (message.action === "CLAIM_AUDIT_SESSION") {
    (async () => {
      try {
        const { sessionId, transferToken, origin } = message;

        // 1. Validar aba remetente
        const senderTabId = sender.tab ? sender.tab.id : null;
        if (!senderTabId) {
          sendResponse({ success: false, error: "Acesso negado: remetente não possui identificador de aba válido." });
          return;
        }

        // 2. Validar origem remetente
        if (!isOriginAllowed(origin)) {
          sendResponse({ success: false, error: `Acesso negado: origem '${origin}' não autorizada.` });
          return;
        }

        // 3. Buscar sessão em memória ou no storage local
        let session = inMemoryPendingSessions.get(sessionId);
        if (!session) {
          const { alastre_pending_sessions } = await chrome.storage.local.get("alastre_pending_sessions");
          const sessions = alastre_pending_sessions || {};
          session = sessions[sessionId];
        }

        // Se a aba acabou de ser criada e authorizedTabId ainda não finalizou a atribuição
        if (session && session.authorizedTabId === null) {
          for (let attempt = 0; attempt < 5; attempt++) {
            await new Promise((r) => setTimeout(r, 40));
            session = inMemoryPendingSessions.get(sessionId) || (await chrome.storage.local.get("alastre_pending_sessions")).alastre_pending_sessions?.[sessionId];
            if (session && session.authorizedTabId !== null) break;
          }
        }

        if (!session) {
          sendResponse({ success: false, error: "Sessão não encontrada ou já expirada." });
          return;
        }

        // 4. Validar se a aba remetente é exatamente a aba autorizada
        if (session.authorizedTabId !== senderTabId) {
          sendResponse({
            success: false,
            error: "Acesso negado: esta sessão pertence a outra aba do navegador."
          });
          return;
        }

        // 5. Validar token de transferência de uso único
        if (!session.transferToken || session.transferToken !== transferToken) {
          sendResponse({ success: false, error: "Token de autorização inválido ou incorreto." });
          return;
        }

        // 6. Validar expiração temporal
        if (Date.now() > session.expiresAt) {
          inMemoryPendingSessions.delete(sessionId);
          const { alastre_pending_sessions } = await chrome.storage.local.get("alastre_pending_sessions");
          const sessions = alastre_pending_sessions || {};
          delete sessions[sessionId];
          await chrome.storage.local.set({ alastre_pending_sessions: sessions });
          sendResponse({ success: false, error: "Sessão expirada (limite de 5 minutos excedido)." });
          return;
        }

        // 7. Validar que não foi reivindicada previamente (Prevenção de Replay)
        if (session.claimed) {
          sendResponse({ success: false, error: "Esta sessão já foi reivindicada e consumida." });
          return;
        }

        // Marcar como consumida e purgar imediatamente do storage e da memória
        const payloadToDeliver = session.payload;
        inMemoryPendingSessions.delete(sessionId);
        const { alastre_pending_sessions } = await chrome.storage.local.get("alastre_pending_sessions");
        const sessions = alastre_pending_sessions || {};
        delete sessions[sessionId];
        await chrome.storage.local.set({ alastre_pending_sessions: sessions });

        sendResponse({
          success: true,
          sessionId,
          envelope: payloadToDeliver
        });
      } catch (err) {
        console.error("Erro ao processar reivindicação de sessão:", err);
        sendResponse({ success: false, error: err.message || "Erro interno na entrega da sessão." });
      }
    })();
    return true;
  }

  return false;
});
