# Controle de Validades

ATENÇÃO:
O backend desse sistema é exclusivamente o Lovable Cloud.
O app é um PWA e PRECISA funcionar OFFLINE-FIRST.

OBJETIVO PRINCIPAL:
O aplicativo GestãodeValidades deve funcionar normalmente SEM INTERNET.
Usuários devem conseguir acessar, visualizar e manipular dados offline.
A sincronização com a nuvem deve acontecer SEMPRE que houver conexão com internet.
Alteração, cadastro de produtos, lotes de produtos e qualquer alteração global realizada com a ausência da internet devem ser atualizadas no supabase e compartilhada com todos os usuários sempre que o usuário ficar online.
* O Código de barras do produto, deve ser tratado como 
uma chave primária e não será permitido duplicidade.
* Uma vez cadastrado o produto não poderá ser excluído Se tornará um "Produto Pai" e apenas Lotes desse produto poderá ser criado, editado, ou excluído de acordo com previlegios oferecido por um administrador em um menu secreto de configurações administrativas.
* cada lote de produto será composto de duas informações do produto: a quantidade e a data de seu vencimento (essas informações deverão ser vinculada diretamente ao código de barras do produto para garantir unanimidade de registro)
* Cada produto poderá ter vários lotes cadastrados dês de que NÃO exista validade repetida.
* Uma validade duplicada nunca será aceito na criação de lotes por produto.
OBJETIVO: COMPARTILHAMENTO E GARANTIR O CONTROLE FIEL
DAS INFORMAÇÕES DE PRODUTOS E SUAS VALIDADES COM USUÁRIO QUE DESEJAM EVITAR PERCAS

════════════════════════════════════
1️⃣ IDENTIFICAÇÃO DO USUÁRIO (UMA ÚNICA VEZ)
════════════════════════════════════

• A tela "Me Fala Quem Você É" deve aparecer APENAS UMA VEZ por dispositivo.
• Após o primeiro preenchimento, os dados devem ser armazenados LOCALMENTE
  (IndexedDB ou LocalStorage) depois para o supabase onde um administrador poderá Alterar os previlegios desse usuário (Desativar, excluir e editar lotes de terceiros) 

Campos salvos localmente:
- local_user_id (uuid gerado no dispositivo)
- nome
- função
- created_at

REGRAS:
- Se existir usuário local salvo → NUNCA mostrar novamente essa tela
- Recarregar a página NÃO pode apagar esse estado
- Ficar offline NÃO pode apagar esse estado
- Não criar usuário duplicado no banco

════════════════════════════════════
2️⃣ COMPORTAMENTO OFFLINE (OBRIGATÓRIO)
════════════════════════════════════

Quando NÃO houver internet:
✔ Permitir entrar no sistema
✔ Não exibir loading infinito
✔ Não tentar chamadas HTTP
✔ Não exibir erro "Failed to fetch"
✔ Não pedir Nome/Função novamente

O app deve:
- Usar dados armazenados localmente
- Permitir operações conforme permissões do usuário:
  • Cadastrar produtos
  • Editar produtos próprios
  • Gerenciar lotes
  • Visualizar cards e listas
- Bloquear apenas ações administrativas globais

════════════════════════════════════
3️⃣ BANCO LOCAL OFFLINE
════════════════════════════════════

Implementar cache local para:
- Produtos
- Lotes
- Usuários
- Permissões
- Configurações

Regras:
- Todas as ações offline devem ser salvas como "pending_sync = true"
- Nenhuma ação offline pode falhar por falta de internet

════════════════════════════════════
4️⃣ SINCRONIZAÇÃO AUTOMÁTICA
════════════════════════════════════

Quando a internet voltar:
- Detectar conexão automaticamente
- Sincronizar dados locais → Lovable Cloud
- Resolver conflitos usando:
  • updated_at mais recente
  • device_id como referência

Após sync:
- Limpar flags pending_sync
- Atualizar cache local
- NÃO recarregar a página automaticamente

════════════════════════════════════
5️⃣ USUÁRIOS E PERMISSÕES (SEM DUPLICAÇÃO)
════════════════════════════════════

• Usuário local ≠ usuário cloud
• Usuário cloud deve ser criado UMA ÚNICA VEZ
• Usar local_user_id como chave de vínculo

Permissões:
- São carregadas do Lovable Cloud
- Devem ser armazenadas localmente
- Funcionam offline
- Podem ser editadas pelo administrador

════════════════════════════════════
6️⃣ MENU ADMINISTRADOR
════════════════════════════════════

Menu secreto protegido por:
Usuário: Administrador
Senha: ADM102030

Permite:
- Editar permissões
- Ativar/desativar usuários
- Gerenciar tema global
- Ver usuários registrados (sem duplicações)

════════════════════════════════════
7️⃣ PROIBIÇÕES EXPLÍCITAS
════════════════════════════════════

🚫 NÃO bloquear acesso offline
🚫 NÃO pedir identificação novamente
🚫 NÃO depender de fetch para inicializar o app
🚫 NÃO apagar estado ao recarregar página

════════════════════════════════════
8️⃣ RESULTADO ESPERADO
════════════════════════════════════

✔ App abre offline
✔ Usuário entra direto
✔ Dados locais funcionam
✔ Sync ocorre ao reconectar
✔ Nenhuma tela de identificação reaparece
✔ Nenhum erro de internet bloqueia o uso

Este comportamento é CRÍTICO e deve ser tratado como prioridade máxima.

⚠️ DETALHES E MODELAGEM DA HOME:


TELA INICIAL do app (HOME), deve ser copia EXATA da imagem anexada (design futurista).

REGRAS IMPORTANTES:
1. NÃO alter a estrutura funcional da tela.
2. Mantenha TODOS os cards nas MESMAS POSIÇÕES e tamanhos com o mesmo efeito degradê na borda dos cards e todos efeitos atuais.
3. NÃO remova funcionalidades.
4. A mudança é APENAS VISUAL (UI/UX).

OBJETIVO DO DESIGN:
- Aparência futurista, moderna e profissional
- Estilo tech / dark / premium
- Sensação de sistema inteligente e confiável

ORIENTAÇÕES VISUAIS:
- Fundo com gradiente escuro (azul profundo, roxo ou preto com nuances futuristas)
- Cards com efeito glassmorphism ou neumorphism leve
- Bordas arredondadas (radius maior)
- Sombras suaves e profundidade (efeito flutuante)
- Ícones minimalistas e consistentes (line ou filled, mas padronizados)
- Destaque visual maior para “Validades Críticas”
- Tipografia moderna, limpa e legível

SOBRE OS CARDS:
Os botões de Exportação para Excel e Sincronizar Dados já devem existem dentro do menu de configurações (clicando no card "configurações").
- Manter exatamente:
  • Produtos Ativos
  • Validades Críticas
  • Cadastrar Produto
  • Consultar Produtos
  • Configurações
  • Chat Global
- Todas as outras telas do app precisa ter cores e detalhes coerentes com a tela principal para dar coerência visual ao app.
manter o tema atual na coleção dos temas já implementados no app mas criar outros trêz novos temas para integrar a galeria de temas, tema atual como padrão e deve ser chamado de "Future_Design".

EXPERIÊNCIA DO USUÁRIO:
- Interface clara mesmo em ambientes escuros
- Boa hierarquia visual
- Layout responsivo e fluido
- Aparência de app corporativo de alto nível

IMPORTANTE:
- Não mude fluxos
- Não dependa de internet para renderização da UI
- Esse será o TEMA PADRÃO do app
- outros Três temas usuais e funcionais devem ser criados para compor uma galeria de temas (Dou liberdade criativa para criação dos temas)

Use as imagens enviadas como base visual principal.

════════════════════════════════════
⚠️ MODELAGEM DE DADOS OBRIGATÓRIA (CRÍTICO)
════════════════════════════════════

O banco de dados DEVE seguir EXATAMENTE estas regras:

TABELA: produtos
- barcode (TEXT) → CHAVE PRIMÁRIA
- name
- sector
- created_at
- updated_at

REGRAS:
- barcode é único e imutável
- produto NÃO pode ser excluído
- produto é entidade PAI

TABELA: product_lots
- id (UUID)
- barcode (FK → produtos.barcode)
- expiration_date (DATE)
- quantity (INTEGER)
- status (active | disabled)
- created_at
- updated_at

REGRAS ABSOLUTAS:
- NÃO pode existir mais de UM lote com:
  (barcode + expiration_date)
- Criar CONSTRAINT UNIQUE(barcode, expiration_date)
- Lotes podem ser criados, editados ou excluídos conforme permissões

════════════════════════════════════
⚠️ REGRA DE SINCRONIZAÇÃO (ANTI-DUPLICAÇÃO)
════════════════════════════════════

TODA sincronização DEVE usar UPSERT, NUNCA INSERT simples.

UPSERT OBRIGATÓRIO:
- Produtos → chave: barcode
- Lotes → chave composta: (barcode, expiration_date)

Se o lote já existir:
- Atualizar quantity, status e updated_at
- NÃO criar novo registro

Se não existir:
- Criar novo lote

NUNCA permitir duplicação lógica.

════════════════════════════════════
⚠️ REALTIME OBRIGATÓRIO ENTRE USUÁRIOS
════════════════════════════════════

O sistema DEVE usar realtime do Supabase/Lovable Cloud.

OBRIGATÓRIO:
- Habilitar REPLICA IDENTITY FULL
- Adicionar tabelas à publicação realtime:
  • produtos
  • product_lots

No frontend:
- Assinar eventos realtime (INSERT | UPDATE | DELETE)
- Atualizar IndexedDB imediatamente
- Recalcular cards ao receber eventos

Novos usuários DEVEM:
- Receber dados atuais
- Receber atualizações em tempo real
- Ter contadores idênticos aos demais usuários

════════════════════════════════════
⚠️ CONTADORES (PRODUTOS ATIVOS / VALIDADES CRÍTICAS)
════════════════════════════════════

Regras:
- Contadores NÃO podem ser cache fixo
- Devem ser derivados SEMPRE dos lotes atuais
- Devem reagir a:
  • realtime
  • sync manual
  • retorno da internet

Produtos Ativos:
- Lotes com status = active
- Validade >= data atual

Validades Críticas:
- Lotes ativos
- Validade <= 60 dias

════════════════════════════════════
⚠️ ORDEM DE SINCRONIZAÇÃO (CRÍTICA)
════════════════════════════════════

Ao sincronizar:
1. Sincronizar PRODUTOS
2. Sincronizar LOTES
3. Recalcular TODOS os contadores
4. Atualizar UI sem reload

Nunca inverter essa ordem.

════════════════════════════════════
⚠️ GARANTIA FINAL
════════════════════════════════════

- Todos os usuários DEVEM ver os MESMOS dados
- Nenhuma ação pode gerar duplicação
- Offline-first é obrigatório
- Realtime é obrigatório
- UPSERT é obrigatório

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://theo-gestao-validades.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/98b10afc-34ce-4ee8-a931-f36e30dd997f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
