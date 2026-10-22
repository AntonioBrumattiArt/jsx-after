---
name: jsx-after
description: Exporta um vídeo para After Effects como um script .jsx limpo e fiel (camadas nativas, eases exatos, efeitos por matchName, organizado e sem camadas sobrando), para o usuário rodar no After e finalizar lá. Lê o código de origem quando existe (HyperFrames/HTML+GSAP, Remotion, CSS) e, quando só há o arquivo de vídeo, monta a comp com o vídeo e marcadores nos cortes. Use sempre que o usuário pedir para levar, exportar, passar ou abrir um vídeo/animação no After Effects, gerar "jsx", "script do After", "projeto do After", "abrir no After para finalizar", mesmo sem citar a skill, e também para corrigir um JSX de After que veio bagunçado.
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
4. Nada além disso, a não ser que o usuário peça para recriar textos/elementos por cima.

O JSX fica ao lado do vídeo. Se o arquivo não estiver lá, o script pede para localizar.

## 3. Modo Código

1. **Inventário.** Leia o código e liste, num comentário no topo do JSX: cenas (início/fim), cada elemento visível (tipo, caixa `x,y,w,h`, estilo) e cada tween (propriedade, de, para, início absoluto, duração, ease). Calcule os tempos absolutos da timeline (posições `"<"`, `"+=0.2"`, labels, stagger e repeat). As regras estão em `references/mapeamento.md` §2.
2. **Decida camada por camada.** Cada elemento visível vira uma camada nativa (`AE.rect`, `AE.text`, `AE.image`…) **ou** footage, quando não há equivalente fiel (canvas, WebGL, partículas, SVG complexo). Veja §4 e §7 da referência.
3. **Escreva o JSX** com o modelo abaixo.
4. **Cheque** e entregue (seção 5).

Leia `references/mapeamento.md` sempre que for converter unidades, um ease incomum, um efeito, uma transição ou SVG.

### Regras de fidelidade
- **Tempo:** use os segundos exatos do código; a lib encaixa no frame. Comp com o mesmo fps e a mesma duração do vídeo.
- **Ease:** passe o nome do GSAP direto (`"power3.out"`, `"expo.inOut"`, `"back.out(1.7)"`, `"elastic.out(1,0.3)"`), `[x1,y1,x2,y2]` ou uma função. A lib converte para velocidade/influência exatas e, em elastic/bounce/spring, cria keys só nos picos. Não aproxime ease "no olho".
- **Posição:** `x`/`y` animados viram posição separada (X e Y independentes), como no GSAP. Lembre que o `x` do GSAP é deslocamento: valor no After = posição base + x.
- **Âncora:** respeite o `transform-origin` com `origin: [fx, fy]`. Escala e rotação dependem disso.
- **Ordem:** crie as camadas na ordem do DOM (fundo primeiro). Cada nova camada vai para o topo, igual ao empilhamento do HTML.
- **Texto:** uma camada por bloco de texto, com fonte pelo nome PostScript. Letra a letra (SplitText) → `AE.textReveal`, e não uma camada por letra.

### Regras de projeto enxuto
- Uma pasta raiz no projeto com o nome do vídeo. Dentro dela ficam a comp principal, uma precomp por cena **só se houver 2+ cenas** e os arquivos importados.
- Sem null, precomp, sólido de fundo ou expressão que o código original não precise. A cor de fundo vai em `bg` da comp.
- Keyframe só em propriedade que anima. Nada de "assar" quadro a quadro.
- Nomes de camada = nome do elemento no código (`Titulo`, `Card Preco`, `Logo`), não `Shape Layer 7`.
- Rode dentro do projeto que o usuário tem aberto. Nunca use `app.newProject()`.

## 4. Modelo do JSX

```javascript
// <cole aqui o conteúdo inteiro de lib/aelib.jsx>

// ===== INVENTARIO =====
// Cena 1 (0-3s): Fundo #0B0B12 | Titulo "..." Inter-Bold 96px | Card ...
// Tweens: Titulo y +60->0 0.2s 0.8s power3.out | opacity 0->1 0.2s 0.6s ...

(function () {
    app.beginUndoGroup("jsx-after: NOME");
    try {
        var root = AE.folder("NOME");
        var comp = AE.comp({ name: "NOME", w: 1920, h: 1080, fps: 30, dur: 10, bg: "#0B0B12", folder: root });

        var titulo = AE.text(comp, { name: "Titulo", text: "Olá", font: "Inter-Bold", size: 96,
            color: "#ffffff", align: "center", x: 360, y: 400, w: 1200, h: 120 });
        AE.anim(titulo, "y", 460 + 60, 460, 0.2, 0.8, "power3.out");
        AE.anim(titulo, "opacity", 0, 100, 0.2, 0.6, "power1.out");

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
- **Camadas:** `AE.rect`, `AE.ellipse`, `AE.path`, `AE.text`, `AE.image`, `AE.video`, `AE.solid`, `AE.nullL`, `AE.matte`. Todas aceitam `name`, `label`, `inT`, `outT`, `opacity`, `rotation`, `scale`.
- **Animação:** `AE.anim(camada, "x"|"y"|"scale"|"rotation"|"opacity"|"anchor"|"trimEnd", de, para, inicio, dur, ease)`, `AE.tween(prop, …)` para qualquer propriedade, `AE.set` (salto), `AE.loop` (repeat infinito), `AE.textReveal`.
- **Efeitos:** `AE.fx(camada, matchName, {param: valor}, "Nome")` e `AE.fxProp(camada, "Nome", paramMatchName)` para animar.

Antes de usar algo que não existe na lib, prefira compor com o que existe. Se precisar mesmo escrever ExtendScript direto, siga ES3 (só `var`, `function`, laços `for`), use matchNames e, depois de `addProperty`, busque as propriedades de novo (as referências antigas ficam inválidas).

## 5. Checar e entregar

1. Salve como `<pasta-do-projeto>/<nome>.jsx`, com os arquivos importados em caminhos relativos a ele (ex.: `assets/logo.png`, `video.mp4`).
2. Rode `node scripts/checar_jsx.mjs <nome>.jsx --fix`. Ele pega JavaScript moderno, a lib ausente, vírgulas sobrando e acentos sem BOM. Corrija até dar OK.
3. Se o usuário autorizar e o After estiver instalado, rode `powershell -File scripts/rodar_no_after.ps1 <nome>.jsx` para testar de verdade. Isso abre o After e altera o projeto aberto, por isso peça antes.
4. Responda curto:
   - onde está o `.jsx` e como rodar (File > Scripts > Run Script File);
   - o que foi recriado nativo e o que virou footage, e por quê;
   - o que ficou aproximado (ex.: blur, textReveal) e as fontes que precisam estar instaladas.
