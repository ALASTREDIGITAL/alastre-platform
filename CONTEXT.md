# Plataforma Alastre

Sistema operacional da Alastre Digital que organiza conhecimento, propostas, decisões humanas e execuções controladas para cada cliente.

## Language

**Ator**:
Pessoa autenticada que atua pela agência com um papel explícito.
_Avoid_: usuário autorizado, e-mail permitido

**Agência**:
Organização que possui clientes, atores, integrações e políticas de operação.
_Avoid_: conta principal, tenant

**Papel**:
Nível de autoridade de um Ator dentro da Agência: owner, admin, operator ou viewer.
_Avoid_: permissão do e-mail

**Cliente**:
Empresa atendida pela Agência, com conhecimento e operações completamente isolados dos demais Clientes.
_Avoid_: conta, perfil

**DNA do Cliente**:
Conjunto versionado de fatos confirmados, hipóteses, regras comerciais e inteligência utilizados pelos Agentes.
_Avoid_: cadastro, prompt do cliente

**Fonte de Inteligência**:
Origem rastreável de um fato ou hipótese presente no DNA do Cliente.
_Avoid_: dado importado

**Agente**:
Especialista digital que interpreta o DNA do Cliente e produz uma Proposta; não executa efeitos externos diretamente.
_Avoid_: robô, automação

**Proposta**:
Artefato imutável preparado por um Agente ou Ator para revisão humana.
_Avoid_: ação automática

**Aprovação**:
Decisão humana registrada sobre uma Proposta. Aprovar não significa necessariamente executar.
_Avoid_: autorização automática

**Efeito Externo**:
Alteração em Google Ads, Meta Ads, GTM, GBP ou outro sistema fora da Plataforma.
_Avoid_: publicação simples

**Modo de Escrita**:
Política central que define se Efeitos Externos estão desabilitados, limitados a rascunhos ou liberados após Aprovação.
_Avoid_: flag de segurança

**Execução de Agente**:
Ciclo rastreável de uma solicitação, incluindo contexto usado, resposta, consumo, custo e resultado.
_Avoid_: mensagem da IA

**Evento de Auditoria**:
Registro permanente de uma decisão ou mudança relevante, associado ao Ator, Agência, Cliente e correlação.
_Avoid_: log comum
