# Mapeamento: código de vídeo → After Effects

Consulte quando estiver traduzindo um elemento, ease, efeito ou transição específica.

## Sumário
1. Unidades e coordenadas
2. Timeline do GSAP → tempos absolutos
3. Remotion
4. Elementos → camadas
5. Efeitos (matchNames)
6. Transições prontas
7. O que vira footage (e não camada nativa)

---

## 1. Unidades e coordenadas

| Código | After | Conversão |
|---|---|---|
| `opacity: 0.8` | Opacity | × 100 → `80` |
| `scale: 1.2` / `scaleX`,`scaleY` | Scale (%) | × 100 → `120` / `[sx*100, sy*100]` |
| `rotation: 45` / `rotate(45deg)` | Rotation | igual (os dois giram no sentido horário) |
| `x`, `y` do GSAP / `translate` | Position X/Y | **posição base + deslocamento**. O `x` do GSAP é relativo ao layout. |
| `left`, `top`, `width`, `height` | caixa `{x,y,w,h}` das funções AE.* | a lib calcula âncora e posição |
| `transform-origin: 50% 50%` | `origin: [0.5, 0.5]` | padrão; `top left` → `[0,0]` |
| `letter-spacing: 0.05em` | tracking | em × 1000 → `50` |
| `line-height: 72px` | leading | px direto (`1.2` → 1.2 × font-size) |
| `color: #ff3366` | cor | a lib aceita `"#hex"` em tudo |
| `border-radius: 24px` | `radius: 24` | só em AE.rect |
| `font-family: Inter; font-weight: 700` | `font: "Inter-Bold"` | sempre o **nome PostScript** |

**Fonte PostScript:** `Inter-Bold`, `Inter-SemiBold`, `Montserrat-ExtraBold`, `SFProDisplay-Bold`, `Poppins-Medium`. Se a fonte não estiver instalada, a lib avisa no fim.

**Quebra de linha em texto:** `"\r"`. Para texto com quebra automática (largura fixa no CSS), quebre manualmente nos mesmos pontos do render.

## 2. Timeline do GSAP → tempos absolutos

Calcule o tempo absoluto de cada tween antes de escrever o JSX:

| Parâmetro de posição | Significado |
|---|---|
| (nenhum) | começa no fim da timeline até agora |
| `0.5` | 0,5 s absoluto dentro da timeline |
| `"+=0.3"` / `"-=0.2"` | fim da timeline ± valor |
| `"<"` / `"<0.2"` | início do tween anterior (+ valor) |
| `">"` / `">-0.1"` | fim do tween anterior (± valor) |
| `"label"` / `"label+=0.5"` | tempo do label (+ valor) |

- Timeline aninhada: some o início da timeline-mãe.
- `delay`: soma ao início.
- `gsap.from(el, {y: 50})`: de `base+50` **para** o valor do CSS.
- `gsap.fromTo`: os dois explícitos. `gsap.to`: `from = null` (a lib lê o valor atual).
- `gsap.set` no meio da timeline: `AE.set(prop, valor, t)` (key em hold).
- `stagger: 0.1`: um tween por elemento, com início + i × 0.1. `stagger: {each, from: "center"|"end"|"random"}`: calcule a ordem. Em texto com SplitText, prefira `AE.textReveal`.
- `repeat: 2, yoyo: true`: gere as keys de cada volta. `repeat: -1`: gere 1 ciclo e use `AE.loop(prop, "cycle")` (ou `"pingpong"` com yoyo).
- Ease padrão do GSAP quando omitido: `power1.out`. O padrão de `defaults: {ease: ...}` da timeline vale para todos os tweens dela.
- `duration` padrão do GSAP: 0,5 s.

## 3. Remotion

- `interpolate(frame, [a, b], [v0, v1], {easing})`: tween de `a/fps` a `b/fps`. `Easing.bezier(x1,y1,x2,y2)` → passe `[x1,y1,x2,y2]` como ease. `Easing.ease` / `inOut(ease)` → `"css.ease"` / `"ease-in-out"`.
- `spring({frame, fps, config})`: passe uma `function(p){...}` em ES3 como ease (a lib cria keys só nos picos). A duração é o tempo até assentar (`measureSpring` ou ~1 s).
- `<Sequence from={30} durationInFrames={60}>`: `inT = 30/fps`, `outT = 90/fps`, ou uma cena (`AE.scene`).

## 4. Elementos → camadas

| Elemento | Função | Observação |
|---|---|---|
| `div` com fundo sólido / borda | `AE.rect` | radius, stroke, fill |
| círculo (`border-radius: 50%`) | `AE.ellipse` | |
| texto | `AE.text` | uma camada por bloco de texto, não por letra |
| `img`, PNG, JPG | `AE.importFile` + `AE.image` | `object-fit` → `fit` |
| `video` | `AE.importFile` + `AE.video` | `trimIn` = `currentTime` inicial |
| SVG simples (ícone, linha, seta) | `AE.path` | converta o `d` para pontos absolutos. Para desenhar linha: `trim: true` + `AE.anim(l,"trimEnd",0,100,...)` (stroke-dashoffset) |
| SVG complexo / ilustração | importe o arquivo `.svg` ou um PNG 2× | não reconstrua centenas de paths |
| gradiente (`linear-gradient`) | `AE.solid` + efeito `ADBE Ramp` | |
| fundo de cor da cena | `bg` da comp | não crie um sólido só para isso |
| `overflow: hidden` / `clip-path` | `AE.matte` com um `AE.rect` do tamanho do recorte | |
| grupo que se move junto (`div` pai animado) | `c = AE.ctrl(...)` + `AE.bind(filho, c)` | as regras estão em `organizacao.md` §3 |

## 5. Efeitos (matchNames)

Use sempre o matchName: funciona no After em português, inglês ou qualquer idioma. Os parâmetros seguem `"<matchName>-000N"`. Todos os da tabela foram conferidos no After 2026 (26.5). Atenção: a numeração nem sempre segue a ordem do painel (ex.: Fill).

| CSS / intenção | Efeito | matchName | Parâmetros principais |
|---|---|---|---|
| `filter: blur(Npx)` | Gaussian Blur | `ADBE Gaussian Blur 2` | `-0001` Blurriness (≈ 2 × o px do CSS; confira no olho), `-0002` dimensões (1 ambas), `-0003` Repeat Edge Pixels (1 = ligado) |
| `box-shadow`, `drop-shadow` | Drop Shadow | `ADBE Drop Shadow` | `-0001` cor, `-0002` opacidade **em 0–255** (50% = 127.5), `-0003` direção, `-0004` distância, `-0005` suavidade, `-0006` só sombra |
| brilho / glow | Glow | `ADBE Glo2` | `-0002` threshold **em 0–255**, `-0003` raio, `-0004` intensidade, `-0012`/`-0013` cores A/B |
| `linear-gradient` | Gradient Ramp | `ADBE Ramp` | `-0001` ponto inicial, `-0002` cor inicial, `-0003` ponto final, `-0004` cor final, `-0005` forma (1 linear, 2 radial) |
| colorir tudo de uma cor | Fill | `ADBE Fill` | `-0002` cor, `-0005` opacidade (0–1) |
| `filter: grayscale` | Tint | `ADBE Tint` | `-0003` quantidade (0-100) |
| wipe linear | Linear Wipe | `ADBE Linear Wipe` | `-0001` conclusão (%), `-0002` ângulo, `-0003` feather |
| wipe radial | Radial Wipe | `ADBE Radial Wipe` | `-0001` conclusão (%), `-0002` ângulo inicial, `-0003` centro, `-0005` feather |
| blur de movimento direcional | Directional Blur | `ADBE Motion Blur` | `-0001` direção, `-0002` comprimento |
| ruído / grão | Noise | `ADBE Noise` | `-0001` quantidade |
| distorção orgânica | Turbulent Displace | `ADBE Turbulent Displace` | `-0002` quantidade, `-0003` tamanho, `-0006` evolução |

- Direção de sombra: `dir = atan2(dx, -dy)` em graus (0° = para cima, 135° = baixo-direita); `distância = √(dx² + dy²)`.
- Animar parâmetro: `AE.fx(l, mn, params, "Nome")` e depois `AE.tween(AE.fxProp(l, "Nome", mn + "-0001"), de, para, t, dur, ease)`.
- Se um efeito não existir na versão do After, a lib pula e avisa no fim. Não invente matchName: se não estiver nesta tabela nem no [guia de match names](https://after-effects-scripting-guide.readthedocs.io/matchnames/effects/firstparty.html), use a alternativa mais simples ou leve como footage.

## 6. Transições prontas

Todas usam só transformações (com ease exato) e no máximo 1 camada extra. Os tempos `t` e `d` são em segundos.

| Transição no código | Receita no After |
|---|---|
| fade | `AE.anim(l, "opacity", 0, 100, t, d, ease)` |
| slide (entra pela direita) | `AE.anim(l, "x", baseX + 1920, baseX, t, d, ease)` |
| zoom / pop | `AE.anim(l, "scale", 0, 100, t, d, "back.out(1.7)")` |
| revelação com máscara (`clip-path: inset`) | `m = AE.rect(...)` do tamanho final + `AE.matte(l, m)` + animar `scale`/`x` do `m` (ex.: `origin: [0, 0.5]` e scale `[0,100]→[100,100]`) |
| wipe | `AE.fx(l, "ADBE Linear Wipe", {...}, "Wipe")` + tween em `-0001` de 100 → 0 |
| blur in | Gaussian Blur 0001 de 40 → 0 + fade junto |
| troca de cena (cut) | `inT/outT` das cenas, sem nada extra |
| crossfade entre cenas | sobreponha as cenas `d` segundos e faça fade na de cima |
| linha desenhando | `AE.path({trim:true})` + `trimEnd` 0 → 100 |
| texto por letra/palavra | `AE.textReveal(l, {basedOn, start, each, stagger, opacity:0, y:40})` |
| contagem de número | texto + expressão em sourceText (`Math.round(linear(time, t0, t1, a, b))`) |

## 7. O que vira footage (e não camada nativa)

Recrie em camadas nativas só o que fica editável e fiel. Leve como imagem ou vídeo (renderizado à parte, com alfa quando possível):
- canvas, WebGL, three.js, partículas, shaders;
- `backdrop-filter`, `mix-blend-mode` complexo e máscaras SVG elaboradas;
- ilustrações com dezenas de paths ou com animação de morph;
- qualquer coisa em que a recriação ficaria visivelmente diferente.

Avise no relatório final o que virou footage e por quê.
