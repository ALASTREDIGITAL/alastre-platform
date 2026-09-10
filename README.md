# Alastre Platform

Fundação técnica da Plataforma Autônoma Alastre Digital.

## Estado do Marco 1

- shell privado e responsivo;
- temas claro, escuro e preferência do dispositivo;
- identidade oficial com Poppins e paleta Alastre;
- Bionippon identificado como piloto;
- integrações e escrita externa desativadas;
- projeto isolado de homologação Supabase ativo em São Paulo;
- tabelas multiempresa, RLS e auditoria aplicadas por migrations;
- Alastre Digital e Bionippon cadastradas como agência e cliente piloto;
- revisão automática de segurança sem alertas;
- cliente Supabase tipado e configurado somente com chave publicável.

## Segurança

- nenhum segredo deve ser salvo no repositório;
- o frontend usará somente URL e chave publicável do Supabase;
- chaves secretas permanecem fora do frontend e do repositório;
- efeitos externos permanecem bloqueados enquanto `ALASTRE_WRITE_MODE=disabled`;
- migrations oficiais ficam em `supabase/migrations` e já foram validadas no projeto isolado de homologação.

## Escopo não incluído

Agentes, campanhas, publicação em plataformas, cobrança, migração completa de dados e site institucional não fazem parte deste corte.
