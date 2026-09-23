/**
 * Alastre Local Inspector - Secure Bridge (Content Script para Alastre Platform)
 * Executado exclusivamente nas origens autorizadas da Alastre Platform.
 * Media a transferência segura e autenticada entre background service worker e a aplicação web.
 */
(function () {
  "use strict";

  const ALLOWED_ORIGIN_PATTERNS = [
    /^http:\/\/localhost:(3000|5173|5174|5175)$/,
    /^http:\/\/127\.0\.0\.1:(3000|5173|5174|5175)$/,
    /^https:\/\/[a-z0-9-]+\.alastre\.digital$/,
    /^https:\/\/alastre\.digital$/,
    /^https:\/\/[a-z0-9-]+\.alastre\.com$/,
    /^https:\/\/alastre\.com$/
  ];

  function isAuthorizedOrigin(origin) {
    return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
  }

  // Verificar se a origem atual é autorizada
  if (!isAuthorizedOrigin(window.location.origin)) {
    return;
  }

  // Notificar a página que a extensão Alastre está instalada e pronta
  window.postMessage(
    {
      type: "ALASTRE_EXTENSION_READY",
      version: chrome.runtime.getManifest().version,
      timestamp: Date.now()
    },
    window.location.origin
  );

  // Escutar solicitações da página da plataforma
  window.addEventListener("message", async (event) => {
    // 1. Validar que a mensagem veio da própria janela e da mesma origem
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== "object") return;

    // A. Reivindicar sessão de auditoria com token de uso único
    if (data.type === "ALASTRE_CLAIM_AUDIT_SESSION") {
      const { sessionId, transferToken } = data;
      if (!sessionId || !transferToken) {
        window.postMessage(
          {
            type: "ALASTRE_AUDIT_SESSION_DELIVERED",
            success: false,
            sessionId,
            error: "sessionId e transferToken são obrigatórios para a reivindicação da sessão."
          },
          window.location.origin
        );
        return;
      }

      try {
        chrome.runtime.sendMessage(
          {
            action: "CLAIM_AUDIT_SESSION",
            sessionId,
            transferToken,
            origin: window.location.origin
          },
          (response) => {
            if (chrome.runtime.lastError) {
              window.postMessage(
                {
                  type: "ALASTRE_AUDIT_SESSION_DELIVERED",
                  success: false,
                  sessionId,
                  error: chrome.runtime.lastError.message || "Erro de comunicação com o service worker da extensão."
                },
                window.location.origin
              );
              return;
            }

            if (!response || !response.success) {
              window.postMessage(
                {
                  type: "ALASTRE_AUDIT_SESSION_DELIVERED",
                  success: false,
                  sessionId,
                  error: (response && response.error) || "Falha na validação do token ou sessão expirada."
                },
                window.location.origin
              );
              return;
            }

            // Entregar o envelope com sucesso para a página (apenas na origem autorizada)
            window.postMessage(
              {
                type: "ALASTRE_AUDIT_SESSION_DELIVERED",
                success: true,
                sessionId,
                envelope: response.envelope
              },
              window.location.origin
            );
          }
        );
      } catch (err) {
        window.postMessage(
          {
            type: "ALASTRE_AUDIT_SESSION_DELIVERED",
            success: false,
            sessionId,
            error: err.message || "Erro inesperado ao solicitar sessão."
          },
          window.location.origin
        );
      }
    }

    // B. Ping de verificação
    if (data.type === "ALASTRE_PING_EXTENSION") {
      window.postMessage(
        {
          type: "ALASTRE_EXTENSION_PONG",
          version: chrome.runtime.getManifest().version,
          timestamp: Date.now()
        },
        window.location.origin
      );
    }
  });
})();
