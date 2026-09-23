# Alastre Local Inspector — Extensão Google Chrome (Manifest V3)

Extensão oficial da **Alastre Platform** para auditoria instantânea, engenharia reversa de concorrência e prospecção ativa no **Google Maps** e **Google Search**, **sem necessidade de acesso de administrador** ou autorização prévia da empresa auditada.

---

## 🚀 O que ela faz

1. **Revela Categorias Secundárias Ocultas:**
   O Google Maps mostra publicamente apenas a categoria primária para usuários comuns. O Alastre Local Inspector extrai e exibe todas as categorias secundárias configuradas nos perfis.
2. **Identificadores Técnicos Imediatos:**
   Extração automática de:
   * **CID** (Customer ID decimal convertido do formato hexadecimal do Google).
   * **Place ID** oficial (`ChIJ...`).
   * **Coordenadas GPS** exatas (Latitude e Longitude).
   * **Status de Reivindicação** (Alerta imediato quando a empresa ainda exibe o botão *"Reivindicar esta empresa"*).
3. **Local Score Preliminar (0 a 100):**
   Calcula a completude do perfil com base em 5 pilares comerciais:
   * Perfil & Categorias (Principal + Secundárias).
   * Contato & Conversão (Telefone direto e Website).
   * Governança (Perfil Reivindicado e Protegido).
   * Prova Social (Média de estrelas e volume de reviews).
   * Conteúdo Visual (Acervo de fotos).
4. **Gerador de Pitch para WhatsApp em 1 Clique:**
   Gera um roteiro personalizado com os pontos fracos da empresa para o closer da agência copiar e enviar no WhatsApp do prospect.
5. **Integração 1-Clique com a Alastre Platform:**
   O botão *"Importar para a Alastre Platform"* abre a plataforma com todos os campos do DNA do Cliente e da Esteira de SEO Local já preenchidos.

---

## 📦 Como Instalar no Google Chrome (Modo Desenvolvedor)

1. Abra o Google Chrome e digite na barra de endereços:
   ```text
   chrome://extensions/
   ```
2. No canto superior direito, ative a chave **"Modo do desenvolvedor"** (*Developer mode*).
3. Clique no botão **"Carregar sem compactação"** (*Load unpacked*).
4. Selecione a pasta deste projeto:
   ```text
   c:\Projetos\ALASTRE DIGITAL\ALASTRE-PLATFORM\extensions\alastre-local-inspector
   ```
5. Pronto! O ícone esmeralda do **Alastre Inspector** aparecerá na barra de ferramentas do Chrome.

---

## 🛠️ Como Usar no Dia a Dia

### Cenário 1: Prospecção de Novos Clientes no Google Maps
1. Acesse `https://www.google.com/maps`.
2. Pesquise por qualquer nicho da sua cidade (ex: *"Clínica Odontológica em São Paulo"*).
3. Veja que cada card de resultado recebe automaticamente o **ranking** (1º, 2º, 3º...) e as **categorias do negócio**.
4. Se uma empresa não for reivindicada, você verá a badge **⚠️ Não Reivindicado** em destaque.
5. Clique no botão **"Auditar 🔍"** ou no botão flutuante **Alastre Inspector** no canto inferior direito.
6. A **Gaveta Lateral (Drawer)** abrirá com o diagnóstico completo, Local Score e o botão para copiar o pitch de vendas.

### Cenário 2: Importar para a Carteira da Alastre Platform
1. Com a Gaveta Lateral aberta sobre a empresa desejada, clique em:
   ```text
   🚀 Importar para a Alastre Platform
   ```
2. A plataforma Alastre será aberta na tela de onboarding já com Nome, Segmento, Telefone, Site, Endereço, CID e Place ID preenchidos automaticamente.

---

## ⚙️ Configuração da URL da Plataforma

Por padrão, a extensão conecta com `http://localhost:3000` (desenvolvimento local).
Para alterar a URL para homologação ou produção:
1. Clique no ícone da extensão na barra do Chrome para abrir o Popup.
2. No campo **URL da Alastre Platform**, insira o endereço desejado (ex: `https://app.alastre.digital`).
3. Clique em **Salvar**.

---

## 🔒 Governança e Segurança

* **Manifest V3 nativo:** 100% aderente aos padrões de segurança modernos da Chrome Web Store.
* **Isolamento e Segurança:** Não armazena nem transmite senhas ou dados sensíveis. Somente lê dados públicos abertos que o próprio Google envia ao navegador.
* **Tenant Isolation:** A importação respeita a agência e o usuário autenticado na sessão ativa da Alastre Platform.
