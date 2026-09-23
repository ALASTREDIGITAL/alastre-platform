# Alastre Platform Engineering Rules

Estas regras se aplicam exclusivamente à programação e à implementação técnica neste repositório.

## Limites do projeto

- Trabalhe somente na **Alastre Platform**. Não misture código, dados, credenciais ou migrations do Alastre Reports, `project-lumina` ou outro projeto.
- Preserve isolamento por tenant em toda leitura, escrita, consulta, cache, log e integração.
- Nunca exponha segredos, tokens ou credenciais no browser, logs, respostas ou arquivos versionados.
- Supabase autorizado: **Alastre Platform Homologação**, project ref `fifbtwbndutbvwnbzgtz`. Nunca altere outro projeto Supabase.
- Mantenha `ALASTRE_WRITE_MODE=disabled` salvo autorização explícita e específica.
- Efeitos externos exigem aprovação humana. Não publique, ative campanha, altere orçamento ou escreva em Google, Meta ou outro provider sem autorização.
- Não execute ações destrutivas, altere migrations aplicadas, exclua dados, faça deploy, push, aplique migrations remotas ou publique Edge Functions sem autorização explícita.
- O repositório é conectado ao Lovable: preserve o histórico publicado e mantenha a branch em estado funcional.

## Arquitetura

- `agency_id` é a fronteira de tenant. Toda leitura, escrita, consulta, cache, job, log, integração e auditoria deve respeitar a agência autenticada.
- Operações de cliente também devem validar `client_id` dentro da agência autenticada.
- Cliente e DNA são a fonte compartilhada de contexto. Não duplique fatos em módulos sem necessidade de domínio.
- Reutilize workflows, aprovações, auditoria, Connection Hub e serviços por cliente existentes. Não crie mecanismos paralelos.
- Integrações pertencem ao Connection Hub. Módulos funcionais não armazenam credenciais OAuth.
- Valide inputs e respostas de API na fronteira. A interface não pode assumir o formato de payload desconhecido.
- Effects assíncronos devem ser canceláveis quando necessário e não podem atualizar estado após desmontagem.

## Segurança

- Nunca exponha chaves secretas, service role, tokens OAuth, refresh tokens ou segredos internos no frontend, logs, respostas, testes, fixtures ou arquivos versionados.
- Service role é exclusivamente server-side.
- Toda tabela exposta no Supabase deve possuir RLS e policies adequadas ao modelo real de autorização.
- Funções privilegiadas devem revogar execução de `public`, `anon` e `authenticated`, salvo necessidade explícita e revisada.
- Nunca use metadados editáveis pelo usuário para autorização.
- Não invente persistência, sincronização, publicação, ranking, conversão ou sucesso de provider.
- Não apresente dados sintéticos como evidência operacional real.

## Fluxo de implementação

1. Leia a tarefa e apenas os arquivos diretamente relacionados.
2. Inspecione tipos, APIs, migrations, testes e mecanismos reutilizáveis antes de criar estruturas.
3. Declare o menor escopo implementável e as premissas relevantes.
4. Implemente somente o incremento solicitado e evite refatorações não relacionadas.
5. Adicione ou atualize testes para regras de negócio, isolamento, autorização, transições e falhas.
6. Execute validações focadas durante o desenvolvimento.
7. Antes de concluir, execute TypeScript, lint, testes relevantes e build quando a mudança for estrutural ou publicável.
8. Informe o que mudou, o que foi validado, os riscos restantes e ações que ainda exigem autorização.

## Banco de dados

- Crie mudanças de schema como novas migrations. Nunca edite migration já aplicada.
- Inclua constraints, FKs, índices de apoio, grants, RLS e policies quando aplicável.
- Não aplique migrations remotamente sem autorização explícita.
- Mudanças destrutivas não fazem parte de implementação comum.
- Quando houver mudança de banco, mantenha migrations, tipos e testes alinhados.

## Interface

- O Modo Simples é a experiência padrão e deve usar linguagem compreensível para operadores não técnicos.
- IDs, scopes, diagnósticos de provider, payloads e logs sanitizados pertencem ao Modo Avançado.
- Toda experiência remota deve tratar loading, vazio, parcial, indisponível, sem permissão e erro.
- Não apresente fixture, demonstração, inferência ou dado antigo como informação ao vivo.
- Preserve acessibilidade, teclado, foco visível, legibilidade, responsividade e áreas de clique adequadas.
- Reutilize o design system e o registro de ajuda existentes antes de criar novos padrões.

## Comportamento do produto

- Diferencie entregáveis controláveis, indicadores influenciáveis e resultados externos.
- Nunca prometa ranking, leads, ligações, receita ou publicação sem evidência verificada.
- Preparação, revisão, aprovação, execução e verificação são estados distintos.
- Aprovação não implica execução externa automática.
- IA e automação podem preparar, classificar, recomendar e validar; efeitos externos sensíveis permanecem sob controle humano.

## Definition of Done

Uma tarefa de programação só está concluída quando:

- o comportamento solicitado foi implementado sem expansão desnecessária de escopo;
- isolamento por agência e cliente foi preservado;
- validação e estados seguros de falha foram implementados;
- regras críticas possuem testes automatizados;
- TypeScript e lint passam na área afetada;
- testes relevantes passam;
- o build passa em mudanças estruturais ou voltadas a release;
- migrations e tipos estão alinhados quando o banco mudou;
- nenhum segredo ou efeito externo inseguro foi introduzido;
- tudo que não foi realmente validado é informado no relatório final.
