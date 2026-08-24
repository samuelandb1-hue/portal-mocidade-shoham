# CLAUDE.md — Portal da Mocidade Shoham

> Este arquivo é o contexto oficial do projeto para o Claude Code. Ele deve ser lido antes de qualquer implementação. Se uma solicitação conflitar com este documento, o Claude Code deve avisar antes de prosseguir, não sobrescrever silenciosamente.

---

## 1. Identidade do Projeto

* **Nome:** Portal da Mocidade Shoham
* **Descrição:** Plataforma digital para centralizar comunicação, organização, participação, estudos, eventos e gestão das atividades da mocidade.
* **Premissa:** A tecnologia é uma ferramenta de apoio à comunhão, aprendizado, serviço e participação. Não deve ser tratado apenas como um sistema administrativo ou um conjunto de CRUDs.

---

## 2. Missão

> "Conectar, organizar e desenvolver a Mocidade Shoham, utilizando a tecnologia como ferramenta para fortalecer a comunhão, o aprendizado, o serviço e a participação dos jovens."

---

## 3. Visão

Criar uma plataforma moderna, organizada, intuitiva e acessível que facilite a comunicação e participação. Deve ser **simples o suficiente para qualquer jovem utilizar sem treinamento** e **poderosa o suficiente para ajudar a liderança** na organização das atividades.

---

## 4. Princípios do Projeto

1. Simplicidade
2. Organização
3. Clareza
4. Acessibilidade
5. Experiência mobile
6. Segurança e Privacidade (LGPD)
7. Escalabilidade
8. Manutenibilidade
9. Boa experiência do usuário
10. **Propósito acima de complexidade**

**Pergunta-guia obrigatória antes de qualquer nova feature:**
> *"Essa funcionalidade ajuda a mocidade a se organizar, participar, aprender, servir ou se comunicar melhor?"*
> *Se a resposta for **não**, a funcionalidade deve ser questionada antes de ser implementada.*

---

## 5. Stack Tecnológico

> ⚠️ **Restrição fundamental do projeto:** este projeto será desenvolvido e mantido **inteiramente pelo celular**, via app do Claude Code (sem notebook). Por isso a stack é **deliberadamente simples, sem build step e sem npm**, diferente do NewKar Inventário (que usa Next.js/TypeScript e exige ambiente de build).

| Camada | Tecnologia | Por quê |
| :--- | :--- | :--- |
| Frontend | HTML + CSS + JavaScript puro (vanilla) | Sem compilação, sem bundler — edita o arquivo e já funciona. Editável direto pelo celular. |
| Estilização | CSS puro ou Tailwind via CDN (`<script src="cdn.tailwindcss.com">`) | Tailwind CDN não exige build/PostCSS. |
| Backend/DB | Supabase (Postgres + Auth + RLS + Storage) | Mesmo motor que você já domina; acessado via `@supabase/supabase-js` importado por CDN (`<script type="module">`), sem npm install. |
| Autenticação | Supabase Auth — Phone Auth com OTP via **WhatsApp**, usando Twilio Verify (`channel: whatsapp`) como provedor | Familiar pro público jovem; não exige e-mail. Ver seção 5.1 para requisitos e riscos. |
| Hospedagem | Vercel ou Netlify em modo **estático** (deploy automático a cada `git push`, sem comando de build) | Publica direto, sem CLI local nem terminal complexo. |
| Controle de versão | Git + GitHub, operado via Claude Code (commits/push direto do celular) | Elimina a necessidade de terminal próprio no celular. |
| Notificações | Web Push (nativo do navegador) ou integração WhatsApp (a definir) | Avaliar depois, sem impacto na stack base. |

### 5.1 Autenticação via WhatsApp — requisitos e riscos

**Como funciona:** o jovem digita o telefone → Supabase Auth aciona o Twilio Verify → Twilio envia o código OTP via WhatsApp → jovem digita o código → Supabase valida e cria a sessão.

**Pré-requisitos antes de começar a implementar (fora do código, precisam ser resolvidos por você/liderança):**
1. Conta Twilio criada e com saldo/cartão configurado.
2. Serviço Twilio Verify configurado com canal WhatsApp habilitado.
3. Número remetente aprovado como WhatsApp Business API pela Meta (via Twilio) — **este passo tem prazo fora do seu controle**, iniciar com antecedência.
4. Chaves do Twilio (Account SID, Auth Token, Verify Service SID) cadastradas no painel do Supabase (Authentication → Providers → Phone), nunca no código.

**Riscos e pontos de atenção:**
- **Custo recorrente por mensagem** — baixo por unidade, mas escala com o número de jovens ativos e reenvios de OTP (código expirado, erro de digitação). Vale monitorar via dashboard do Twilio.
- **Aprovação do WhatsApp Business pode atrasar o cronograma** — se isso não estiver pronto, a Fase 1 do roadmap (autenticação) trava. Recomendo iniciar esse cadastro **em paralelo**, antes mesmo do primeiro código.
- **Telefone como identificador único** exige validação de formato (DDI+DDD+número) e trata­mento de erro amigável para número digitado errado.
- **Troca de número de telefone** é comum entre jovens — precisa de um fluxo de "atualizar meu número" vinculado à conta existente (não pode virar cadastro novo).
- **Sem WhatsApp instalado/número inválido** → precisa de mensagem de erro clara, não travar o cadastro silenciosamente.

**Dado que falta pra eu (ou o Claude Code) avançar com precisão:** confirmar se a conta Twilio já existe ou se ainda precisa ser criada, e se há orçamento aprovado (mesmo que pequeno) para o custo por mensagem — isso define se dá pra já modelar o cadastro real ou se começamos com mock/simulação de OTP enquanto a aprovação do WhatsApp Business não sai.

### Regras da stack
1. **Proibido introduzir frameworks que exigem build (Next.js, React com Vite/Webpack, etc.)** sem aprovação explícita — quebraria o fluxo de edição pelo celular.
2. Cada módulo pode ser um arquivo `.html` autocontido (HTML+CSS+JS juntos) **ou** arquivos separados e simples (`modulo.html`, `modulo.js`, `modulo.css`) — decidir conforme o tamanho do módulo, mas sempre sem etapa de compilação.
3. Bibliotecas externas: preferir sempre versão **CDN** (script tag), nunca algo que dependa de `npm install`.
4. Qualquer mudança de stack deve ser proposta e justificada, nunca assumida silenciosamente pelo Claude Code.

---

## 6. Perfis de Acesso

| Nível de Acesso | Permissões e Ações Permitidas |
| :--- | :--- |
| **Jovem** | Visualizar eventos, confirmar presença, ver calendário, acessar estudos/materiais, ler comunicados, receber notificações, acompanhar participação e editar o próprio perfil. |
| **Líder** | Criar/editar eventos, publicar comunicados, cadastrar estudos/materiais, acompanhar participantes, registrar presença, visualizar indicadores e organizar atividades. |
| **Administrador** | Gerenciar usuários/permissões/líderes, configurar o sistema, administrar conteúdos e visualizar indicadores gerais. |

**Regra de implementação:** todo controle de acesso deve ser validado via **RLS (Row Level Security)** no Supabase, nunca apenas por lógica de frontend.

---

## 7. Módulos do Sistema

O projeto é estritamente modular:

* Dashboard
* Eventos
* Calendário
* Comunicados
* Estudos
* Materiais
* Participação
* Presença
* Perfil
* Notificações
* Liderança
* Administração
* Indicadores
* Configurações

---

## 8. Diretrizes dos Módulos Principais

### Dashboard
* Apresentar informações de forma resumida e direta (saudação, próximos eventos, avisos, estudos recentes, cards e ações rápidas).
* Evitar excesso de informação e priorizar hierarquia visual.

### Eventos
* Suporte a criação, edição, cancelamento, detalhes, confirmação de presença e lista de participantes.
* Categorias: Culto, Encontro de Jovens, Congresso, Estudo, Retiro, Ação Social, Ensaio, Reunião, Evento Especial.

### Calendário
* Visualizações (futuras/atuais): mensal, semanal, diária e lista.
* Foco total na experiência mobile.

### Comunicados
* Tipos: Aviso, Comunicado, Lembrete, Evento, Estudo, Liderança, Importante.
* Estrutura: Título, Descrição, Autor, Categoria, Imagem, Prioridade e Data de Publicação.

### Estudos e Materiais
* Tipos de Conteúdo: Texto, PDF, Vídeos e Materiais Complementares.
* Categorias: Bíblia, Vida Cristã, Liderança, Evangelismo, Relacionamentos, Família, Propósito, Discipulado, Caráter, Serviço e Fé.
* **Regra Fundamental:** **Não inventar conteúdos bíblicos ou referências.** Preservar o conteúdo original fornecido pela liderança. O Claude Code nunca deve gerar ou completar texto bíblico, citações ou referências por conta própria.

### Participação, Presença e Gamificação
* Mapeamento: `Evento → Participante → Confirmação → Presença`.
* Indicadores devem ser construtivos. **Evitar competição negativa entre os jovens.**
* Gamificação (pontos, conquistas, badges) é uma ferramenta de incentivo e **nunca deve substituir o propósito espiritual**.
* Rankings públicos comparativos entre jovens devem ser evitados ou tratados com extremo cuidado.

---

## 9. Privacidade, Segurança e LGPD

O sistema lida com dados pessoais e deve estar estritamente alinhado à Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018):

* **Minimização de Dados:** Coletar apenas as informações estritamente necessárias para a gestão e participação da mocidade (nome, telefone/WhatsApp — agora identificador principal de login —, data de nascimento; e-mail apenas se for útil para comunicados, não obrigatório para autenticação).
* **Tratamento de Dados de Menores de Idade:** Como a mocidade atende adolescentes, o cadastro de menores de 18 anos deve prever autorização prévia e/ou ciência dos pais ou responsáveis legais.
* **Privacidade por Padrão (*Privacy by Default*):** Dados sensíveis e contatos pessoais (ex: telefone, e-mail, endereço) **nunca** devem ficar visíveis publicamente ou para outros jovens, apenas para a liderança autorizada.
* **Direitos do Titular:** Garantir ao usuário a possibilidade de visualizar, alterar ou solicitar a exclusão de seus dados da plataforma.
* **Uso de Imagem:** A publicação de fotos de eventos, participantes ou comunicados deve contar com termo de consentimento prévio de uso de imagem.
* **Segurança e Validação:**
  * A segurança deve ser validada no **backend e no banco de dados**, não apenas na interface.
  * Proibida a exposição de dados através de APIs desprotegidas ou alteração manual de URLs.
  * **Proibido inserir credenciais, segredos ou chaves de API diretamente no código.** Usar `.env` + variáveis de ambiente, sempre fora do controle de versão (`.gitignore`).

---

## 10. Requisitos de Interface e UX/UI

* **Mobile First:** Prioridade absoluta para Celular > Tablet > Desktop.
* **Identidade Visual:** Moderna, jovem, elegante, limpa, acolhedora e profissional.
* **A Evitar:** Excesso de cores, animações exageradas, aparência infantil e excesso de elementos.
* **Acessibilidade:** Botões acessíveis, áreas de toque confortáveis, feedback visual para ações, estados de carregamento (*loading states*) e telas de estado vazio (*empty states*).

---

## 11. Arquitetura e Engenharia de Software

### Diretrizes de Código
* Componentes reutilizáveis com baixo acoplamento.
* Proibida a duplicação desnecessária de código e a criação de componentes gigantes.
* Separação clara de responsabilidades (UI / lógica de negócio / acesso a dados).
* Nomenclatura consistente em inglês no código (variáveis, funções, componentes); textos visíveis ao usuário em português.

### Estrutura de Pastas (sugerida — sem build, tudo estático)
```
/index.html                → login / entrada
/dashboard.html
/eventos.html
/calendario.html
/comunicados.html
/estudos.html
/participacao.html
/perfil.html
/admin/
  /admin.html
  /usuarios.html
  /configuracoes.html
/js
  /supabase-client.js       → inicialização única do client Supabase (URL + anon key)
  /auth.js                  → funções de login/logout/sessão
  /eventos.js
  /calendario.js
  /comunicados.js
  /estudos.js
  /participacao.js
  /perfil.js
  /utils.js                 → funções compartilhadas (formatação de data, validações, etc.)
/css
  /style.css                → estilos globais compartilhados
/assets
  /img
  /icons
```

**Regra:** cada página HTML importa apenas os `.js`/`.css` que realmente usa. Lógica repetida entre páginas vai para `/js/utils.js`, nunca duplicada arquivo a arquivo.

### Banco de Dados (Entidades Previstas)
* `users` | `profiles` | `roles` | `user_consents`
* `events` | `event_participants` | `announcements`
* `studies` | `study_categories` | `study_materials`
* `attendance` | `notifications` | `groups` | `settings`

**Regra:** toda nova tabela deve ter RLS habilitado desde a criação. Nenhuma tabela com dados de usuário fica sem policy definida.

---

## 12. Regras Específicas para o Claude Code

1. **Antes de alterar código existente**, ler e entender a estrutura atual — nunca recriar do zero sem necessidade.
2. **Nunca inventar** conteúdo bíblico, dados de usuários, números de indicadores ou funcionalidades não solicitadas.
3. **Nunca commitar** chaves, tokens ou segredos. A `anon key` do Supabase é pública por design (protegida pelo RLS), mas mesmo assim deve ficar isolada em `js/supabase-client.js` para facilitar troca futura.
4. Ao propor uma migration de banco, sempre indicar se é **destrutiva** ou **aditiva**, e pedir confirmação antes de aplicar migrations destrutivas.
5. Ao criar uma feature nova, verificar contra a "pergunta-guia" (seção 4) antes de implementar.
6. Priorizar código testável e documentado sobre soluções "espertas" e difíceis de manter.
7. Qualquer funcionalidade envolvendo dados de menores de idade deve considerar consentimento parental desde o design (não como camada adicional depois).
8. **Nunca sugerir ou introduzir etapa de build/npm/bundler** — o projeto precisa continuar 100% editável e publicável do celular. Se uma lib exigir instalação via npm, buscar alternativa via CDN ou implementar na mão.
9. Cada entrega deve ser feita em **passos pequenos e testáveis** (uma página, uma função por vez) — evitar mudanças gigantes de uma vez, já que a revisão também será feita pelo celular.
10. Ao final de cada módulo entregue, resumir em poucas linhas **o que foi feito, o que falta testar e o que precisa ser configurado no Supabase** (tabela, policy, bucket, etc.) — Samuel não tem terminal local pra conferir sozinho.

---

## 13. Roadmap de Desenvolvimento

> ⚠️ Esta seção estava incompleta no documento original. Preenchida com uma estrutura sugerida em fases — validar prioridades e prazos com a liderança da mocidade antes de seguir.

### Fase 1 — Fundação
- [ ] **(Paralelo, fora do código)** Criar conta Twilio + configurar Verify com canal WhatsApp + iniciar aprovação WhatsApp Business — iniciar o quanto antes, é o item com maior risco de atraso
- [ ] Setup do projeto (HTML/CSS/JS estático + Supabase, sem build)
- [ ] Autenticação via WhatsApp (OTP) e perfis de acesso (Jovem / Líder / Administrador)
- [ ] Modelagem inicial do banco de dados com RLS (telefone como identificador único)
- [ ] Cadastro de usuário com consentimento LGPD (incluindo fluxo para menores)

### Fase 2 — Núcleo Funcional
- [ ] Módulo de Eventos (criação, edição, confirmação de presença)
- [ ] Módulo de Calendário (mensal/semanal/diária/lista)
- [ ] Módulo de Comunicados
- [ ] Dashboard inicial (jovem e líder)

### Fase 3 — Conteúdo e Participação
- [ ] Módulo de Estudos e Materiais
- [ ] Módulo de Presença vinculado a Eventos
- [ ] Indicadores básicos de participação (visão do líder)

### Fase 4 — Engajamento
- [ ] Notificações (push e/ou WhatsApp)
- [ ] Gamificação leve (conquistas, sem rankings competitivos negativos)
- [ ] Perfil do usuário completo

### Fase 5 — Administração e Governança
- [ ] Painel administrativo (usuários, permissões, configurações)
- [ ] Indicadores gerais para liderança
- [ ] Exportação/exclusão de dados (direitos do titular - LGPD)

### Fase 6 — Refino
- [ ] Testes de usabilidade com jovens reais
- [ ] Ajustes de performance e acessibilidade
- [ ] Documentação final do sistema

---

## 14. Checklist de Revisão Antes de Deploy

- [ ] RLS ativo em todas as tabelas com dados sensíveis
- [ ] Nenhuma credencial exposta no código ou no repositório
- [ ] Fluxo de consentimento LGPD testado (adulto e menor de idade)
- [ ] Testado em mobile real (não só em emulador)
- [ ] Estados vazios e de carregamento implementados em todas as telas principais
- [ ] Conteúdo bíblico/estudos revisado e aprovado pela liderança (não gerado por IA)
