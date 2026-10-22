---
name: jsx-after
description: Exporta um vídeo para After Effects como um script .jsx limpo e fiel (camadas nativas, eases exatos, efeitos por matchName, camadas cortadas só onde aparecem, coloridas por acontecimento, controladores de grupo estilo Duik, marcadores de cena e de cada frase da locução), para o usuário rodar no After e finalizar lá. Lê o código de origem quando existe (HyperFrames/HTML+GSAP, Remotion, CSS) e, quando só há o arquivo de vídeo, monta a comp com o vídeo e marcadores nos cortes. Use sempre que o usuário pedir para levar, exportar, passar ou abrir um vídeo/animação no After Effects, gerar "jsx", "script do After", "projeto do After", "abrir no After para finalizar", mesmo sem citar a skill, e também para corrigir um JSX de After que veio bagunçado.
---

# jsx-after

Transforma um vídeo em **um único `.jsx`** que, rodado no After Effects (File > Scripts > Run Script File), cria uma comp organizada e fiel à animação original. O usuário finaliza no After, então o projeto precisa ser **fiel** (mesmos tempos, curvas e posições) e **enxuto** (só o necessário, com nomes claros).

Por que existe: JSX escrito no improviso costuma quebrar efeitos (nomes de efeito traduzidos), achatar easings (curvas do GSAP não convertidas), usar JavaScript moderno que o After não entende e despejar tudo numa comp sem organização. A biblioteca `lib/aelib.jsx` resolve isso de forma testada. Use-a em vez de escrever as chamadas do After na mão.

## 1. Escolha o modo de leitura

Escolha o melhor caminho disponível, nesta ordem:

| Há… | Modo | Fidelidade |
|---|---|---|
| código de origem (HTML/GSAP do HyperFrames, Remotion, CSS) | **Código**: leia a timeline e o layout do código | exata |
| só o arquivo de vídeo (MP4/MOV) | **Vídeo**: comp com o vídeo + marcadores nos cortes | o vídeo é a referência |
| código + clipes de vídeo usados dentro dele | **Código**, com os clipes como camadas de vídeo | exata |

Se o usuário mandar só o MP4 de um vídeo feito por uma skill de código, procure o projeto de origem (pergunte onde está, se não achar). Ler pixels é sempre pior que ler o código.

Em qualquer modo, rode primeiro `node scripts/ler_video.mjs <video>` quando houver um vídeo renderizado. Ele dá resolução, fps, duração, áudio, cortes de cena e um quadro por cena para você olhar e conferir o resultado.

## 2. Modo Vídeo (só o arquivo)

É o caso "coloca o vídeo numa comp e eu subo no After". Seja rápido:
1. `ler_video.mjs` → largura, altura, fps, duração, cortes.
2. Comp com **exatamente** esses valores, vídeo importado por caminho relativo (`AE.importFile`) e `AE.video(comp, item)`.
3. Um marcador por corte (`AE.marker(comp, t, "Cena 2")`), útil para editar.
4. Se o vídeo tiver locução: `node scripts/frases_locucao.mjs video.mp4 [roteiro.txt]` e `AE.phraseMarkers(camadaDoVideo, frases)`, com um marcador no início de cada frase.
5. Nada além disso (sem guia, controladores ou cores por acontecimento), a não ser que o usuário peça para recriar textos/elementos por cima.

O JSX fica ao lado do vídeo. Se o arquivo não estiver lá, o script pede para localizar.

## 3. Modo Código

1. **Inventário.** Leia o código e liste, num comentário no topo do JSX: cenas (início/fim), cada elemento visível (tipo, caixa `x,y,w,h`, estilo, quando aparece e some) e cada tween (propriedade, de, para, início absoluto, duração, ease). Calcule os tempos absolutos da timeline (posições `"<"`, `"+=0.2"`, labels, stagger e repeat). As regras estão em `references/mapeamento.md` §2.
2. **Acontecimentos e grupos.** No mesmo inventário, agrupe as camadas por acontecimento (o que acontece junto ou em consequência: um clique e o que ele dispara, a entrada de um conjunto) e marque os grupos que precisam de controlador e os que pedem precomp. As regras estão em `references/organizacao.md`.
3. **Decida camada por camada.** Cada elemento visível vira uma camada nativa (`AE.rect`, `AE.text`, `AE.image`…) **ou** footage, quando não há equivalente fiel (canvas, WebGL, partículas, SVG complexo). Veja §4 e §7 de `mapeamento.md`.
4. **Escreva o JSX** com o modelo abaixo.
5. **Cheque** e entregue (seção 5).

Leia `references/mapeamento.md` sempre que for converter unidades, um ease incomum, um efeito, uma transição ou SVG. Leia `references/organizacao.md` sempre no Modo Código.

### Regras de fidelidade
- **Tempo:** use os segundos exatos do código; a lib encaixa no frame. Comp com o mesmo fps e a mesma duração do vídeo.
- **Ease:** passe o nome do GSAP direto (`"power3.out"`, `"expo.inOut"`, `"back.out(1.7)"`, `"elastic.out(1,0.3)"`), `[x1,y1,x2,y2]` ou uma função. A lib converte para velocidade/influência exatas e, em elastic/bounce/spring, cria keys só nos picos. Não aproxime ease "no olho".
- **Posição:** `x`/`y` animados viram posição separada (X e Y independentes), como no GSAP. Lembre que o `x` do GSAP é deslocamento: valor no After = posição base + x.
- **Âncora:** respeite o `transform-origin` com `origin: [fx, fy]`. Escala e rotação dependem disso.
- **Ordem:** crie as camadas na ordem do DOM (fundo primeiro). Cada nova camada vai para o topo, igual ao empilhamento do HTML.
- **Texto:** uma camada por bloco de texto, com fonte pelo nome PostScript. Letra a letra (SplitText) → `AE.textReveal`, e não uma camada por letra.

### Regras de projeto enxuto
- Uma pasta raiz no projeto com o nome do vídeo. Dentro dela ficam a comp principal, uma precomp por cena **só se houver 2+ cenas** e os arquivos importados.
- Sem null, precomp, sólido de fundo ou expressão que o código original não precise. A cor de fundo vai em `bg` da comp. **Exceção explícita:** os controladores (`CTRL_`) e a camada guia (`GUIA_`) entram sempre que as regras de `organizacao.md` pedirem. Eles são a estrutura de controle do projeto, não sobra.
- Keyframe só em propriedade que anima. Nada de "assar" quadro a quadro.
- Nomes de camada = nome do elemento no código (`Titulo`, `Card Preco`, `Logo`), não `Shape Layer 7`. Use os prefixos de `organizacao.md` §6.
- Rode dentro do projeto que o usuário tem aberto. Nunca use `app.newProject()`.

### Regras de organização (resumo de `references/organizacao.md`)
- **Camadas só onde aparecem:** `AE.autoTrim(comp)` em cada comp. Aparições separadas por mais de 1 s viram camadas separadas, exceto persistentes (`persist: true`), fundo, camadas com expressão, ligadas a controlador ou com matte.
- **Cor por acontecimento:** `AE.events([...])` em ordem de tempo e `evt: "..."` em cada camada. Cores fixas para controladores, fundo, áudio e guia.
- **Controladores:** decida sozinho pelos critérios de `organizacao.md` §3 e pergunte só quando não ficar claro se um conjunto é um grupo. Cada controlador de grupo fica logo acima do grupo, com cor parecida (não igual) à dele. Sempre um `CTRL_GERAL` com **todas** as cores do projeto. Todo controlador ganha o marcador "Ex" com o resumo do que controla. Com os controles no padrão, a animação é idêntica ao original.
- **Precomp** só quando o grupo pede (matte do conjunto, repetição, excesso de camadas, cena) e nunca quando ele se relaciona com camadas de fora.
- **Marcadores:** cenas na comp; frases na camada da locução; em outras camadas só em caso muito específico.
- **Guia, shy e limpeza:** render original como guia travada, mattes em shy, limpeza só do que o script criou.

## 4. Modelo do JSX

```javascript
// <cole aqui o conteúdo inteiro de lib/aelib.jsx>

// ===== INVENTARIO =====
// Cena 1 (0-3s): Fundo #0B0B12 | Titulo "..." Inter-Bold 96px | Card ...
// Tweens: Titulo y +60->0 0.2s 0.8s power3.out | opacity 0->1 0.2s 0.6s ...
// Acontecimentos: Abertura (Titulo, Logo) | Clique botao (Cursor, Botao, Onda) | Cards (Card 1-3)
// Controladores: CTRL_Cards (stagger 0.15) | CTRL_GERAL (cores #2A2AFF, #FFD400)

(function () {
    app.beginUndoGroup("jsx-after: NOME");
    try {
        AE.begin();
        var root = AE.folder("NOME");
        var comp = AE.comp({ name: "NOME", w: 1920, h: 1080, fps: 30, dur: 10, bg: "#0B0B12", folder: root });
        AE.events(["Abertura", "Clique botao", "Cards"]);          // ordem de tempo
        AE.marker(comp, 0, "Cena 1 - Abertura", "Abertura");      // so cenas na comp

        // 1) camadas (ordem do DOM), cada uma com seu acontecimento
        var titulo = AE.text(comp, { name: "Titulo", text: "Olá", font: "Inter-Bold", size: 96,
            color: "#ffffff", align: "center", x: 360, y: 400, w: 1200, h: 120, evt: "Abertura" });
        AE.anim(titulo, "y", 460 + 60, 460, 0.2, 0.8, "power3.out");
        AE.anim(titulo, "opacity", 0, 100, 0.2, 0.6, "power1.out");
        var cards = []; // ... AE.rect(comp, {..., evt: "Cards"}) com stagger

        // 2) guia e locucao
        AE.guide(comp, AE.importFile("render.mp4", root));
        AE.voice(comp, AE.importFile("locucao.wav", root), [{ t: 0.7, text: "Primeira frase." }]);

        // 3) corte (antes dos controladores)
        AE.autoTrim(comp);

        // 4) controladores
        var cc = AE.ctrl(comp, { name: "Cards", x: 960, y: 540, evt: "Cards", atraso: 0.15 });
        for (var i = 0; i < cards.length; i++) AE.bind(cards[i], cc, { index: i });
        var geral = AE.ctrlGeral(comp, { comps: [comp], cores: { "Primaria": "#2A2AFF" } }); // todas as cores
        AE.linkGeral(comp, geral, comp);
        AE.exposeText(titulo, comp);

        // 5) fim (limpeza, shy, guias travadas e marcador "Ex" em cada controlador)
        AE.finish(root, [comp]);
        comp.openInViewer();
        AE.report("NOME");
    } catch (e) {
        alert("Erro na linha " + e.line + ": " + e.toString());
    } finally {
        app.endUndoGroup();
    }
})();
```

API da lib (detalhes nos comentários de `aelib.jsx`):
- **Estrutura:** `AE.folder`, `AE.comp`, `AE.scene` (precomp de cena), `AE.importFile`, `AE.marker`.
- **Camadas:** `AE.rect`, `AE.ellipse`, `AE.path`, `AE.text`, `AE.image`, `AE.video`, `AE.solid`, `AE.nullL`, `AE.matte`. Todas aceitam `name`, `evt`, `role`, `persist`, `keep`, `label`, `inT`, `outT`, `opacity`, `rotation`, `scale`.
- **Animação:** `AE.anim(camada, "x"|"y"|"scale"|"rotation"|"opacity"|"anchor"|"trimEnd", de, para, inicio, dur, ease)`, `AE.tween(prop, …)` para qualquer propriedade, `AE.set` (salto), `AE.loop` (repeat infinito), `AE.textReveal`.
- **Efeitos:** `AE.fx(camada, matchName, {param: valor}, "Nome")` e `AE.fxProp(camada, "Nome", paramMatchName)` para animar.
- **Organização:** `AE.begin`, `AE.events`, `AE.autoTrim`, `AE.guide`, `AE.voice`, `AE.phraseMarkers`, `AE.finish`.
- **Controladores:** `AE.ctrl`, `AE.bind`, `AE.ctrlGeral`, `AE.linkGeral`, `AE.expose`, `AE.exposeText`, `AE.exposeCtrl`.
- **Ordem obrigatória:** camadas → guia/locução → `autoTrim` (em cada comp) → controladores e `linkGeral` → `finish`. O corte antes dos controladores garante a pose de repouso certa e a poda de keys.

Antes de usar algo que não existe na lib, prefira compor com o que existe. Se precisar mesmo escrever ExtendScript direto, siga ES3 (só `var`, `function`, laços `for`), use matchNames e, depois de `addProperty`, busque as propriedades de novo (as referências antigas ficam inválidas). Não encadeie ternários (`a ? b : c ? d : e`): o ExtendScript avalia errado. Use `if/else`.

## 5. Checar e entregar

1. Salve como `<pasta-do-projeto>/<nome>.jsx`, com os arquivos importados em caminhos relativos a ele (ex.: `assets/logo.png`, `video.mp4`). Caminhos completos com mais de 259 caracteres não abrem no Windows: a lib avisa, mas prefira pastas curtas.
2. Rode `node scripts/checar_jsx.mjs <nome>.jsx --fix`. Ele pega JavaScript moderno, a lib ausente, vírgulas sobrando e acentos sem BOM. Corrija até dar OK.
3. Se o usuário autorizar e o After estiver instalado, rode `powershell -File scripts/rodar_no_after.ps1 <nome>.jsx` para testar de verdade. Isso abre o After e altera o projeto aberto, por isso peça antes.
4. Responda curto:
   - onde está o `.jsx` e como rodar (File > Scripts > Run Script File);
   - o que foi recriado nativo e o que virou footage, e por quê;
   - o que ficou aproximado (ex.: blur, textReveal) e as fontes que precisam estar instaladas;
   - os acontecimentos (com as cores), os controladores criados e o que cada um controla;
   - se houver controlador com Atraso: aumentar muito o atraso pode exigir esticar a última camada do grupo.
