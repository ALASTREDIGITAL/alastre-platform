# Etapa 12 — Ativação Controlada de Produção

## 1. Decisão do Gate de Produção

**Resultado do Gate**: **`BLOQUEADO`** (Deploy remoto em Produção não executado)
**Decisão do Release Técnico**: **`Aprovado para Ativação quando Infraestrutura estiver Provisionada`**

- **Justificativa**: A Alastre Platform foi perfeitamente preparada, testada e validada em todo o seu escopo técnico. No entanto, em estrita obediência às regras de segurança e às diretrizes da Etapa 12 ("*se o destino de produção, domínio ou variáveis obrigatórias não estiverem disponíveis, pare antes do deploy e entregue uma lista objetiva do que falta. Não tente alternativas improvisadas*"), o deploy remoto foi **interrompido antes da execução**, visto que o destino de hospedagem de produção, o projeto Supabase de produção e o cofre de variáveis de ambiente de produção não se encontram provisionados nem configurados no repositório/ambiente.

---

## 2. Inventário e Gate de Produção (Fase 1)

| Item | Descrição da Verificação | Status | Observações Técnicas |
| :--- | :--- | :---: | :--- |
| **1** | Destino de hospedagem já configurado e método oficial de deploy | **BLOQUEADO** | Nenhum serviço de hospedagem de produção (ex.: Vercel, Cloudflare Pages/Workers, AWS) está configurado com tokens ou rotas no repositório. O repositório possui apenas a CI de validação local (`ci.yml`) e o identificador `.openai/hosting.json` usado para previews locais. |
| **2** | Projeto Supabase de produção existente, identificado e distinto da homologação | **BLOQUEADO** | Não existe projeto Supabase de produção provisionado ou identificado. O Supabase autorizado e ativo é o de **Homologação** (`fifbtwbndutbvwnbzgtz`). A Etapa 11 utilizou temporariamente o projeto isolado `mcnzqmracmcmxbvsttua` apenas para testes de restauração virgem via `db push`. Nenhuma instância de produção foi criada ou inventada. |
| **3** | Variáveis obrigatórias presentes no cofre do ambiente de produção | **BLOQUEADO** | Cofre do ambiente de produção (chaves de servidor, URL Supabase de produção, chaves secretas de produção) inexistente/não configurado. |
| **4** | `ALASTRE_WRITE_MODE=disabled` no ambiente de produção | **BLOQUEADO** | O ambiente de produção não está ativo, porém o código da aplicação e as variáveis de exemplo garantem a trava global `ALASTRE_WRITE_MODE=disabled`. |
| **5** | URL pública/privada pretendida e TLS/domínio configurados | **BLOQUEADO** | Nenhum domínio customizado oficial de produção ou certificado TLS foi provisionado previamente. |
| **6** | Migrations já aplicadas ou plano seguro para banco de produção vazio | **APROVADO** | A esteira de 51 migrations forward-only foi 100% validada na Etapa 11 via `db push` em banco virgem (concluída em 24 segundos), garantindo bootstrap limpo e seguro para quando a instância de produção for provisionada. |
| **7** | Rollback de aplicação disponível para a versão estável anterior | **APROVADO** | O histórico Git está limpo e sincronizado (`main` em `origin/main`), sem rebase ou squash, permitindo rollback imediato de código via commit anterior. |
| **8** | Endpoint público `/api/health` respondendo apenas payload mínimo | **APROVADO** | Endpoint público `GET /api/health` retorna estritamente `{ "status": "ok", "timestamp", "version": "0.1.0" }` sem vazamento de segredos, infraestrutura ou banco. |
| **9** | Readiness detalhado protegido por autenticação e RBAC | **APROVADO** | Endpoint `GET /api/health?detail=true` restrito a atores autenticados com papéis de liderança (`owner`, `admin`, `operations_lead`), retornando HTTP 401 para requisições anônimas e HTTP 403 para não autorizados. |
| **10** | Ausência de dependências vulneráveis (`npm audit` e `npm audit --omit=dev`) | **APROVADO** | Auditado via `npm audit --omit=dev` com resultado de **0 vulnerabilidades em dependências de produção**. |

---

## 3. Lista Objetiva de Itens Faltantes para Deploy em Produção

Para prosseguir com a ativação de produção sem alternativas improvisadas ou violação de segurança, os seguintes passos administrativos e de infraestrutura devem ser providenciados pelo usuário:

1. **Provisionamento da Hospedagem de Produção**:
   - Definir o provedor oficial de hospedagem (ex.: Cloudflare Workers/Pages, Vercel ou AWS).
   - Configurar o repositório ou pipeline de deploy para o ambiente de produção.
2. **Provisionamento do Banco Supabase de Produção**:
   - Criar um novo projeto Supabase exclusivo para Produção (distinto de Homologação `fifbtwbndutbvwnbzgtz`).
   - Aplicar a esteira de 51 migrations versionadas via `npx supabase db push --project-ref <NOVO_PROJECT_REF_PRODUCAO>`.
3. **Injeção de Variáveis no Cofre de Produção**:
   - `NEXT_PUBLIC_SUPABASE_URL` (URL do Supabase de Produção).
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Anon Key de Produção).
   - `SUPABASE_SECRET_KEY` (Service Role Key de Produção).
   - `ALASTRE_WRITE_MODE=disabled` (Trava mantida desativada até validação final).
   - `GOOGLE_PROVIDER_AVAILABILITY=pending_provider_approval` (Mantido pendente até liberação do Google).
4. **Configuração de Domínio e TLS**:
   - Apontamento DNS e emissão de certificado TLS para o domínio oficial da Alastre Platform.

---

## 4. Resultados da Validação Técnica e Build Único

Conforme exigido, a validação técnica local do repositório foi executada:

- **TypeScript (`npx tsc --noEmit`)**: **0 erros de compilação**.
- **ESLint (`npx eslint`)**: **0 erros** nos arquivos do projeto.
- **Suíte de Testes Automatizados (`npm test`)**: **404/404 testes passando (100% de sucesso)**.
- **Auditoria de Dependências de Produção (`npm audit --omit=dev`)**: **0 vulnerabilidades**.
- **Build de Produção (`npm run build` / `vinext build`)**: Executado uma única vez com sucesso.

---

## 5. Plano de Rollback e Preservação de Limites

- **Rollback de Aplicação**:
  - Código fonte versionado e sincronizado no commit estável da branch `main`.
  - Caso um deploy futuro apresente anomalias, o rollback de código deve ser feito apontando o provedor de hospedagem para o commit imediatamente anterior, sem aplicar rollbacks destrutivos no banco de dados.
- **Integrantes e Provedores Externos**:
  - O provedor Google Business Profile permanece administrativamente em `pending_provider_approval` (caso Google `4-5388000041735`).
  - Nenhuma chamada real a provedores externos (Google, Meta), OAuth, envio de mensagens ou publicação foi realizada.
  - A trava `ALASTRE_WRITE_MODE` permanece estritamente em `disabled`.

---

## 6. Resumo da Decisão Final

- **Estado do Gate**: **`BLOQUEADO`** (Parada preventiva antes do deploy em conformidade com as regras da Etapa 12).
- **Estado do Código**: **`PRONTO E VALIDADO`** (Build, TypeScript, Lint, 404 testes e 51 migrations 100% funcionais).
