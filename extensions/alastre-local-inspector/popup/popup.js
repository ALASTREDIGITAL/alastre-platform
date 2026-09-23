/**
 * Alastre Local Inspector - Popup Controller
 */

const STORAGE_CONFIG_KEY = "alastre_platform_url";
const DEFAULT_PLATFORM_URL = "http://127.0.0.1:5175";

document.addEventListener("DOMContentLoaded", async () => {
  const urlInput = document.getElementById("platform-url-input");
  const saveBtn = document.getElementById("save-url-btn");
  const feedback = document.getElementById("save-feedback");
  const statusDot = document.getElementById("server-status-dot");
  const statusText = document.getElementById("server-status-text");
  const statusDesc = document.getElementById("server-status-desc");
  const statusCard = document.getElementById("connection-status-card");

  // Carregar URL configurada
  const data = await chrome.storage.local.get(STORAGE_CONFIG_KEY);
  let currentUrl = data[STORAGE_CONFIG_KEY] || DEFAULT_PLATFORM_URL;

  // Se estiver setado como 3000 ou localhost, migra automaticamente para 127.0.0.1:5175
  if (currentUrl.includes(":3000") || currentUrl.includes("localhost:5175")) {
    currentUrl = "http://127.0.0.1:5175";
    await chrome.storage.local.set({ [STORAGE_CONFIG_KEY]: currentUrl });
  }

  if (urlInput) {
    urlInput.value = currentUrl;
  }

  // Checar conectividade com o servidor local
  async function checkServerHealth(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      await fetch(url, { mode: "no-cors", signal: controller.signal });
      clearTimeout(timeoutId);

      if (statusDot) statusDot.classList.remove("offline");
      if (statusText) {
        statusText.classList.remove("offline");
        statusText.textContent = "Plataforma Conectada (" + (new URL(url).host) + ")";
      }
      if (statusDesc) {
        statusDesc.textContent = "Pronto para importar e sincronizar dados com 1 clique.";
      }
      if (statusCard) statusCard.classList.remove("offline");
    } catch {
      if (statusDot) statusDot.classList.add("offline");
      if (statusText) {
        statusText.classList.add("offline");
        statusText.textContent = "Plataforma Offline";
      }
      if (statusDesc) {
        statusDesc.textContent = "Inicie o servidor local ('Iniciar Alastre Platform.cmd') para sincronizar.";
      }
      if (statusCard) statusCard.classList.add("offline");
    }
  }

  checkServerHealth(currentUrl);

  // Salvar nova URL
  if (saveBtn && urlInput) {
    saveBtn.onclick = async () => {
      const val = urlInput.value.trim() || DEFAULT_PLATFORM_URL;
      await chrome.storage.local.set({ [STORAGE_CONFIG_KEY]: val });
      if (feedback) {
        feedback.textContent = "✓ Configuração salva!";
        setTimeout(() => {
          feedback.textContent = "";
        }, 2000);
      }
      checkServerHealth(val);
    };
  }

  // Atalhos
  function openUrl(path) {
    chrome.storage.local.get(STORAGE_CONFIG_KEY, (res) => {
      const base = res[STORAGE_CONFIG_KEY] || DEFAULT_PLATFORM_URL;
      const target = `${base.replace(/\/$/, "")}${path}`;
      chrome.tabs.create({ url: target });
    });
  }

  document.getElementById("open-platform-btn")?.addEventListener("click", () => openUrl("/"));
  document.getElementById("open-seo-btn")?.addEventListener("click", () => openUrl("/local-seo"));
  document.getElementById("open-clients-btn")?.addEventListener("click", () => openUrl("/clients"));
  document.getElementById("open-search-btn")?.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.google.com.br/search?q=clinica+odontologica" });
  });

  // Botão de teste direto no Google Maps
  document.getElementById("test-maps-btn")?.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.google.com.br/maps/search/restaurantes" });
  });
});
