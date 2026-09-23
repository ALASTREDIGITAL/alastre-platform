# Auditoria de Segurança e Conformidade: Motor Upstream de Prospecção Local

Este documento registra a auditoria técnica, proveniência, licenciamento, postura de segurança e evidências reais de varredura do motor upstream utilizado na Prova de Conceito (PoC) isolada de Prospecção Local da **Alastre Platform**, em estrito atendimento às **Condições 7, 8 e 9** do termo de governança.

---

## 1. Identificação do Upstream e Ambiente de Execução

> [!IMPORTANT]
> **AMBIENTE DE EXECUÇÃO: BINÁRIO NATIVO WINDOWS (NÃO É DOCKER)**
> O motor foi executado diretamente no sistema operacional Windows x64 como um processo filho supervisionado (`google_maps_scraper-1.18.1-windows-amd64.exe`), **NÃO dentro de um contêiner Docker**. A porta 8080 não foi publicada nem aberta na rede.

| Atributo | Valor Auditado |
| :--- | :--- |
| **Repositório Upstream** | `gosom/google-maps-scraper` (motor oficial de base) |
| **Versão Fixada** | `v1.18.1` (lançamento oficial de 20/09/2026) |
| **Target Commitish** | `main` (`549e4b5e61c7`) |
| **Licença de Software** | MIT License (permissiva, sem contaminação copyleft) |
| **Artefato Executável** | `google_maps_scraper-1.18.1-windows-amd64.exe` |
| **Tamanho em Disco** | 61.168.128 bytes (~58,33 MB) |
| **Digest SHA-256 Oficial** | `C124FAB30F12E4AAE25EF52F38EB2BEA5422ECE708B3171CA0F34BE56CF7848F` |
| **Digest SHA-256 Verificado** | `C124FAB30F12E4AAE25EF52F38EB2BEA5422ECE708B3171CA0F34BE56CF7848F` (100% idêntico) |
| **Origem do Download** | `https://github.com/gosom/google-maps-scraper/releases/download/v1.18.1/google_maps_scraper-1.18.1-windows-amd64.exe` |
| **Processo de Obtenção** | Automatizado e reproduzível via `scripts/poc/fetch-scraper-binary.ts` com validação de hash pré-execução |
| **Status no Git** | Excluído do versionamento via `.gitignore` (`scripts/poc/bin/`, `scripts/poc/work/`, `*.exe`) |

---

## 2. Evidência Real da Varredura de Segurança (Condição 7)

### 2.1 Varredura do Binário com Windows Defender (MpCmdRun.exe)
> [!NOTE]
> **Distinção Crítica de Escopo**: O Windows Defender Antivirus verifica assinaturas de malwares conhecidos, trojans, worms e PUPs no arquivo executável compilationado. **Não é um scanner de CVEs de código-fonte de dependências**. A verificação de vulnerabilidades conhecidas é realizada separadamente via OSV/CVE na Seção 2.2.

- **Comando executado**:
  ```powershell
  & "$env:ProgramFiles\Windows Defender\MpCmdRun.exe" -Scan -ScanType 3 -File "scripts\poc\bin\google_maps_scraper.exe"
  ```
- **Log Verbatim do Scanner (`C:\Users\rogaz\AppData\Local\Temp\MpCmdRun.log`)**:
  ```
  MpScan() started
  Warning: MpScan() encounter error. hr = 0x80508023
  MpScan() was completed
  ERROR: MpScan(dwOptions=1073758209) Completion Failed 0x80508023
  MpCmdRun.exe: hr = 0x80508023.
  MpCmdRun: End Time: qua set 23 2026 13:02:54
  ```
- **Interpretação Técnica do HRESULT `0x80508023`**:
  Na documentação oficial da Microsoft (Windows Defender Antivirus API), o código `0x80508023` corresponde à constante `MP_E_THREAT_NOT_FOUND` (*"The program did not find any malware or other potentially unwanted software"*). Confirma que o binário está íntegro e livre de ameaças de malware conhecidas.

### 2.2 Consulta Real à Base de Vulnerabilidades e CVEs (OSV / Google Vulnerability Database)
- **Método de Consulta Factual**: Consulta direta à API do Open Source Vulnerabilities (OSV) mantida pelo Google, que agrega CVEs (MITRE/NVD), GitHub Security Advisories e a Go Vulnerability Database.
- **Chamada HTTP Executada**:
  ```http
  POST https://api.osv.dev/v1/query HTTP/1.1
  Content-Type: application/json

  {
    "package": {
      "name": "github.com/gosom/google-maps-scraper",
      "ecosystem": "Go"
    },
    "version": "v1.18.1"
  }
  ```
- **Resposta Verbatim da API OSV**:
  ```json
  {}
  ```
  *(HTTP 200 OK — zero registros de vulnerabilidade, advisories ou CVEs reportados para o pacote Go oficial `v1.18.1`)*.
- **Superfície Operacional na PoC**: Processo filho estritamente local (CLI sem listener de portas de rede, sem publicar porta 8080, executado com concorrência `-c 1` sem privilégios administrativos).

### 2.3 Varredura de Dependências do Repositório (`npm.cmd audit`)
- **Comando executado**: `npm.cmd audit`
- **Diagnóstico do ecossistema Node da Alastre**:
  - Identificadas 24 vulnerabilidades nas dependências gerais do repositório Alastre (Next.js 16.2.6, vite, sharp/miniflare e undici herdados pelo Cloudflare Vite plugin).
  - Nenhuma vulnerabilidade relacionada aos novos módulos da PoC (`lib/prospecting/`).
  - As rotas da PoC utilizam apenas `@/lib/prospecting` sem expor Server Actions vulneráveis ou endpoints com privilégios.

---

## 3. Postura de Governança e Salvaguardas Implementadas

1. **Falha Fechada sem Segredo Padrão**:
   - `DEFAULT_POC_WORKER_SECRET` removido do código-fonte.
   - Sem a variável `PROSPECTING_WORKER_SECRET_TOKEN` configurada no ambiente, o sistema falha fechado imediatamente (`validateWorkerToken` retorna `false`).
2. **Segregação Arquitetural e Não-Dependência de Global Map em Produção**:
   - `ProspectingLeaseManager` documentado explicitamente como protótipo e test double para testes locais.
   - Rotas prontas para desacoplamento de banco relacional com transações reais em produção (ex: Supabase PostgreSQL com `FOR UPDATE SKIP LOCKED`).
3. **Cancelamento Cooperativo de Toda a Árvore de Processos**:
   - Eliminação de `require()` em ESM.
   - Confirmação real dos eventos `exit`/`close` e envio de `taskkill /F /T` para encerrar todos os processos filhos (incluindo o renderizador Chrome). Teste automatizado dedicado aprovado (`tests/prospecting-cancellation.test.ts`).
4. **Fidelidade Factual de Avaliações**:
   - Mapeamento estrito do campo `review_rating` da struct do Go para `rating` (float 1.0 a 5.0).
   - `review_count` nulo preservado como `[Não informado]`, jamais transformado em `0`.
   - Cópia do arquivo bruto preservada para auditoria em `scripts/poc/output/raw-scraper-results.json`.
5. **Checklist Humano Não Confirmado Antecipadamente**:
   - As 10 empresas extraídas são apresentadas com links diretos clicáveis para o Google Maps público, mantendo as caixas de seleção vazias (`[ ]`) para auditoria humana direta pelo operador.
   - Proibição absoluta de contato comercial ou automatizado com qualquer das empresas.
