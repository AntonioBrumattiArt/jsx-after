# Organização do projeto no After

Regras para acontecimentos e cores, corte das camadas, controladores, precomps, marcadores e nomes. Leia no Modo Código, antes de escrever o JSX.

## Sumário
1. Acontecimentos e cores
2. Corte das camadas
3. Controladores
4. Precomp ou não
5. Marcadores
6. Nomes, guia, shy e limpeza

---

## 1. Acontecimentos e cores

A cor da label diz **a que acontecimento a camada pertence**, não o tipo dela. Tudo que participa do mesmo momento ou da mesma ação tem a mesma cor, e o acontecimento seguinte tem outra.

**Como encontrar os acontecimentos.** Cruze, nesta ordem:
1. **Timeline:** labels do GSAP, timelines aninhadas e tweens em cadeia (`"<"`, `"+=0.1"`, mesmo início).
2. **Causa e efeito:** o clique que abre o card, o botão que dispara o texto. A ação e a reação são um acontecimento só.
3. **Hierarquia:** elementos dentro do mesmo grupo no código (`.card` e seus filhos).
4. **Tempo e espaço:** camadas que se sobrepõem no tempo e ocupam a mesma região da tela.

Um acontecimento costuma ter de 1 a ~8 camadas. Se ficar enorme (a cena inteira), divida pelos itens 1 e 2. Se ficar com uma camada só, veja se ela não pertence ao acontecimento vizinho.

**Na lib:**
- `AE.events(["Abertura", "Clique botao", "Cards", ...])` logo no início, **em ordem de tempo**. Assim vizinhos nunca repetem cor (rotação de 12 cores contrastantes).
- `evt: "Cards"` em cada camada. Mattes herdam a cor da camada que recortam. Precomps: `layer.label = AE.evt("...")`.
- Cores reservadas, fora da rotação: controladores (Vermelho), fundo (Arenito, `role: "bg"`), áudio/locução (Verde) e guia (Marrom).
- Não renomeie as labels nas preferências do After: o usuário pediu para manter os nomes dele.

## 2. Corte das camadas

Cada camada existe na timeline **só onde o elemento aparece na tela**.

- **Pelo código:** passe `inT/outT` quando souber (entrada e saída da cena, `display:none`, remoção do DOM).
- **Conferência no After:** `AE.autoTrim(comp)` varre quadro a quadro e corta onde a camada está invisível (opacidade 0, escala 0, fora da tela ou escondida pelo matte). Rode em **cada** comp (principal e precomps) depois de criar tudo e **antes** de `AE.bind` e `AE.linkGeral`.
- **Aparições separadas viram camadas separadas** ("Logo", "Logo #2") quando o elemento some e volta depois de mais de 1 s (`AE.autoTrim(comp, {gap: 1})`).
- **Exceções que não dividem** (só cortam as pontas):
  - elementos persistentes que só piscam: logo fixo, UI fixa, barra de topo → `persist: true`;
  - fundo (`role: "bg"`);
  - camada com loop ou expressão;
  - camada ligada a controlador ou com matte (dividir quebraria a ligação).
- `keep: true` deixa a camada intocada (use raramente, ex.: elemento que o usuário vai reaproveitar inteiro).
- Keyframes inteiramente fora do trecho visível são removidas. As keys que definem o valor nas bordas ficam.
- **Atenção no After:** mudar o início de uma camada empurra o fim junto (as keys não se movem). A lib já trata isso. Se escrever ExtendScript direto, ajuste sempre o início antes do fim.

## 3. Controladores

O objetivo: quando há muitas coisas agrupadas, animadas e se relacionando, o usuário controla o grupo de um ponto só, no estilo Duik mas nativo (nulls, Expression Controls e expressões, sem plugin).

**Quando criar (decida sozinho):**
- grupo com stagger (cards, itens de lista, letras em camadas separadas) → controlador com `atraso`;
- grupo que se move junto (pai animado no código, conjunto que entra e sai junto) → controlador;
- grupo com uma cor única que o usuário provavelmente vai trocar → `cor`;
- a peça inteira → sempre um `CTRL_GERAL`, com as cores da marca encontradas no código.

**Quando não criar:** elemento isolado, camada única, fundo, guia, áudio.

**Quando perguntar:** só quando não estiver claro se um conjunto é um grupo que deve ser controlado (ex.: elementos próximos no tempo, mas sem relação no código). Pergunte numa linha, com a sua sugestão.

**Na lib:**
- `var c = AE.ctrl(comp, {name: "Cards", x, y, atraso: 0.15, cor: "#FFD400"})` cria `CTRL_Cards` no pivô do grupo (centro do conjunto ou origem do pai no código).
- `AE.bind(camada, c, {index: i})` em cada membro (o `index` é a posição no stagger).
- Efeitos do controlador:
  - mover, escalar e girar o null move o grupo;
  - **Intensidade** escala o movimento em torno da pose de repouso;
  - **Atraso** muda o espaçamento do stagger;
  - **Opacidade** e **Ligado** controlam a visibilidade;
  - **Cor** pinta os preenchimentos que tinham aquela cor.
- `var g = AE.ctrlGeral(comp, {cores: {"Primaria": "#2A2AFF", "Destaque": "#FFD400"}})` e, no fim, `AE.linkGeral(cadaComp, g, compPrincipal)`. As camadas soltas viram filhas do GERAL (fundo, guia e áudio ficam de fora), e as cores iguais às da marca passam a vir dele, inclusive dentro das precomps.
- **Regra de ouro:** com os controles no padrão, a animação é idêntica ao original. Confira com `prop.valueAtTime(t, false)` igual a `valueAtTime(t, true)`.
- Se o usuário aumentar muito o Atraso, a última camada do grupo pode precisar de mais tempo na timeline. Avise isso no relatório quando houver controlador com Atraso.

## 4. Precomp ou não

**Use precomp quando o grupo:**
- precisa de uma máscara ou um matte que recorte o conjunto inteiro;
- se repete na peça (o mesmo card ou ícone várias vezes);
- tem tantas camadas que poluiria a timeline principal;
- é uma cena inteira (com 2 ou mais cenas, uma precomp por cena, como na V1).

**Evite precomp quando** as camadas do grupo precisam se relacionar com camadas de fora (parent, matte ou expressão atravessando comps). Nesse caso, use um controlador na mesma comp.

**Controles de uma precomp:** crie o controlador dentro da precomp e exponha com `AE.exposeCtrl(c, precomp)`. Eles aparecem nas Essential Properties da camada da precomp, na comp de cima. Textos principais: `AE.exposeText(camada, compDela)`.

## 5. Marcadores

- **Cenas:** só marcadores gerais na comp, um por cena, com nome e a cor do acontecimento: `AE.marker(comp, t, "Cena 2 - Clique", "Clique botao")`.
- **Locução:** um marcador por frase, no início exato da fala, com o texto da frase: `AE.voice(comp, item, frases)`.
  - Tempos, nesta ordem de preferência: legendas ou timings do projeto, depois `node scripts/frases_locucao.mjs locucao.wav roteiro.txt`.
  - O script usa as maiores pausas como fronteiras entre as frases do roteiro e arredonda para baixo no frame. Se houver mais ou menos trechos que frases, ele avisa: ajuste `--pausa` ou `--ruido`.
  - No Modo Vídeo, com a fala dentro do próprio vídeo, use `AE.phraseMarkers(camadaDoVideo, frases)`.
- **Marcador em camada:** só em caso muito específico (ex.: um sync pontual que o usuário precisa achar).

## 6. Nomes, guia, shy e limpeza

- **Prefixos:** `CTRL_` (controladores), `MATTE_` (máscaras), `BG_` (fundos), `GUIA_` (referência), `AUDIO_` (áudio). A lib aplica pelo `role`.
- **Shy e trava:** mattes ficam em shy (a comp esconde as shy) e a guia fica travada.
- **Guia:** `AE.guide(comp, AE.importFile("render.mp4", root))` põe o render original no topo como camada guia (não renderiza, sem áudio, 30% de opacidade, travada). Só no Modo Código.
- **Limpeza:** `AE.begin()` no começo e `AE.finish(root, [comps])` no fim. Remove só itens criados pelo script e não usados, guarda os sólidos em `Solidos` e monta o resumo do relatório. Nada que já existia no projeto é tocado.
