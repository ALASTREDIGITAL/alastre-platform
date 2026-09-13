# Como usar as skills

Skills são guias de trabalho para a inteligência da Alastre Platform. Elas ajudam o agente a lembrar critérios importantes de produto, segurança, arquitetura e SEO Local.

Você não precisa decorar nomes nem escrever comandos especiais. Peça o resultado normalmente, por exemplo: “melhore o fluxo de cadastro”, “revise a segurança desta integração” ou “evolua o Local Score”. O Codex identifica o assunto e consulta o guia adequado.

Não é preciso ativar uma skill a cada tarefa. Quando uma skill influencia o trabalho, o Codex informa isso durante a execução e pode registrar as skills usadas no resumo da entrega.

## O que elas fazem

- organizam a sequência de trabalho;
- lembram limites e padrões do projeto;
- melhoram a consistência entre módulos;
- ajudam a explicar estados, riscos e próximos passos.

## O que elas não fazem

- não ligam integrações sozinhas;
- não publicam no Google, Meta, GTM ou GA4;
- não habilitam escrita externa;
- não alteram banco, migrations ou segredos por conta própria;
- não substituem uma autorização humana quando ela é necessária.

## Simples e avançado

Na plataforma, abra **Configurações → Inteligência e Skills**. O modo simples explica para que serve cada guia. O modo avançado também mostra origem, versão, escopo e riscos. A tela é um catálogo de governança, não um painel que ativa ações externas.

## Skill, AGENTS.md e MCP

- **Skill** é um guia especializado para um tipo de trabalho.
- **AGENTS.md** reúne as regras gerais e prioridades deste projeto, inclusive qual skill usar em cada situação.
- **MCP** é uma conexão com uma ferramenta ou fonte de dados. Ao contrário de uma skill, ele pode oferecer ações reais e exigir permissões.

## Quando algo mudar

Skills próprias ficam em `.agents/skills` e são revisadas junto com o código. Mudanças importantes devem atualizar `docs/SKILLS_REGISTRY.md`. Skills externas continuam fora do projeto até terem fonte, licença, conteúdo e dependências auditados.

Para adicionar, crie uma pasta em `.agents/skills` com um `SKILL.md`, registre origem, versão, gatilhos e riscos e valide antes de usar. Para remover, retire a pasta e atualize o registro e o roteador. Para atualizar com segurança, compare a nova fonte, licença, scripts, dependências, permissões e diferenças antes de substituir qualquer conteúdo; nunca rode automaticamente instaladores de terceiros.

## Exemplos da segunda leva

**“Crie um agente para SEO Local.”** O Codex aplica automaticamente System Prompt Structure, Template Design, Few-shot Patterns, Constraint Specification, Alastre Local SEO, Trust Calibration e Transparency Patterns. O esqueleto separa identidade, contexto permitido, constraints testáveis, exemplos sanitizados, evidências, confiança, formato de saída e limites de ação.

**“Publique uma resposta de avaliação.”** O Codex aplica Mixed Initiative Flow, Guardrail Design e Alastre Security Review. Pode preparar a resposta e mostrar evidências, mas deve bloquear a execução externa até existir aprovação explícita para aquela ação e todos os controles de servidor estarem válidos. Aprovar um rascunho não publica automaticamente.

**“Analise o SEO Local com dados parciais.”** O Codex aplica Alastre Local SEO, Trust Calibration e Transparency Patterns. Dados ausentes ficam como N/D; ranking e score não são inventados; cada afirmação relevante informa origem, estado e confiança proporcional à evidência.

**“Use meu feedback nas próximas sugestões.”** O Codex aplica Feedback Loops. Preferências podem ser registradas de forma visível e reversível, mas regras críticas, permissões, aprovações e política de publicação nunca mudam silenciosamente.

**“Desenhe uma nova integração.”** O Codex aplica Alastre SaaS Architecture e Alastre Security Review. O desenho mantém tenant isolation, Connection Hub como dono da integração, tokens server-side, IDs validados no backend, idempotência, auditoria e execução externa separada da aprovação.
