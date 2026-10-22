// ============================================================================
// aelib.jsx - biblioteca base da skill jsx-after (ExtendScript / ES3)
// Cole este arquivo INTEIRO no topo de cada JSX gerado. Nao edite por projeto.
// Regras ES3: so "var", sem arrow function, sem template string, sem forEach/map,
// sem Array.indexOf, sem JSON. Textos com acento: salve o JSX em UTF-8 com BOM.
// ============================================================================
var AE = {};
AE.warnings = [];
AE.fps = 30;
AE.silent = false;
AE.base = (function () {
    try { return File($.fileName).parent.fsName; } catch (e) { return Folder.desktop.fsName; }
})();

AE.warn = function (msg) { AE.warnings.push(msg); };

// ---------------------------------------------------------------- utilidades
AE.hex = function (h) { // "#rrggbb" -> [r,g,b] (0-1)
    if (h instanceof Array) return h.length > 3 ? [h[0], h[1], h[2]] : h;
    h = String(h).replace("#", "");
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
};
AE.col = function (h) { var c = AE.hex(h); return [c[0], c[1], c[2], 1]; }; // propriedades de cor
AE.t = function (sec) { return Math.round(sec * AE.fps) / AE.fps; };        // encaixa no frame
AE._arr = function (v) { return (v instanceof Array) ? v : [v]; };
AE._clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

// ---------------------------------------------------------------- projeto
AE.folder = function (name, parent) {
    var f = app.project.items.addFolder(name);
    if (parent) f.parentFolder = parent;
    return f;
};

// o = {name, w, h, fps, dur, bg, folder}
AE.comp = function (o) {
    var c = app.project.items.addComp(o.name, o.w, o.h, 1, o.dur, o.fps);
    if (o.bg) c.bgColor = AE.hex(o.bg);
    if (o.folder) c.parentFolder = o.folder;
    AE.fps = o.fps;
    return c;
};

// Importa arquivo relativo a pasta do JSX. Se nao achar, pede para localizar.
AE.importFile = function (rel, folder) {
    var f = new File(AE.base + "/" + rel);
    if (!f.exists) {
        f = AE.silent ? null : File.openDialog("Localize o arquivo: " + rel);
        if (!f) { AE.warn("Arquivo nao encontrado: " + rel); return null; }
    }
    var item = app.project.importFile(new ImportOptions(f));
    if (folder) item.parentFolder = folder;
    return item;
};

AE.marker = function (comp, t, label) {
    comp.markerProperty.setValueAtTime(AE.t(t), new MarkerValue(label || ""));
};

// ---------------------------------------------------------------- camadas
// Comum a todas: name, label (0-16), inT/outT (segundos), opacity, rotation, scale(%)
AE.place = function (l, o) {
    if (o.name) l.name = o.name;
    if (o.label != null) l.label = o.label;
    if (o.inT != null) l.inPoint = AE.t(o.inT);
    if (o.outT != null) l.outPoint = AE.t(o.outT);
    if (o.opacity != null) l.transform.opacity.setValue(o.opacity);
    if (o.rotation != null) l.transform.rotation.setValue(o.rotation);
    if (o.scale != null) l.transform.scale.setValue(AE._sc(o.scale));
    return l;
};
AE._sc = function (s) { return (s instanceof Array) ? s : [s, s]; };

// Posiciona uma camada de tamanho (iw x ih) dentro da caixa CSS {x,y,w,h}.
// origin = transform-origin do CSS em fracao ([0.5,0.5] = centro, padrao).
AE._box = function (l, o, iw, ih, sx, sy) {
    var ox = o.origin ? o.origin[0] : 0.5, oy = o.origin ? o.origin[1] : 0.5;
    l.transform.anchorPoint.setValue([iw * ox, ih * oy]);
    l.transform.position.setValue([o.x + o.w * ox, o.y + o.h * oy]);
    if (sx != null) l.transform.scale.setValue([sx, sy]);
};

AE._contents = function (l) {
    return l.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
};
AE._shapeLayer = function (comp, o, def) {
    var l = comp.layers.addShape();
    l.name = o.name || def;
    l.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    l.property("ADBE Root Vectors Group").property(1).name = o.name || def;
    return l;
};
AE._paint = function (l, o) { // traco acima do preenchimento, como no CSS
    if (o.stroke) {
        var s = AE._contents(l).addProperty("ADBE Vector Graphic - Stroke");
        s.property("ADBE Vector Stroke Color").setValue(AE.col(o.stroke));
        s.property("ADBE Vector Stroke Width").setValue(o.strokeW || 1);
    }
    if (o.fill) {
        var f = AE._contents(l).addProperty("ADBE Vector Graphic - Fill");
        f.property("ADBE Vector Fill Color").setValue(AE.col(o.fill));
    }
};

// Retangulo. o = {name, x, y, w, h, fill, stroke, strokeW, radius, origin, ...place}
AE.rect = function (comp, o) {
    var l = AE._shapeLayer(comp, o, "Retangulo");
    var ox = o.origin ? o.origin[0] : 0.5, oy = o.origin ? o.origin[1] : 0.5;
    var r = AE._contents(l).addProperty("ADBE Vector Shape - Rect");
    r.property("ADBE Vector Rect Size").setValue([o.w, o.h]);
    r.property("ADBE Vector Rect Position").setValue([o.w * (0.5 - ox), o.h * (0.5 - oy)]);
    if (o.radius) r.property("ADBE Vector Rect Roundness").setValue(o.radius);
    AE._paint(l, o);
    l.transform.anchorPoint.setValue([0, 0]);
    l.transform.position.setValue([o.x + o.w * ox, o.y + o.h * oy]);
    return AE.place(l, o);
};

// Elipse/circulo. Mesmos campos do rect.
AE.ellipse = function (comp, o) {
    var l = AE._shapeLayer(comp, o, "Elipse");
    var ox = o.origin ? o.origin[0] : 0.5, oy = o.origin ? o.origin[1] : 0.5;
    var e = AE._contents(l).addProperty("ADBE Vector Shape - Ellipse");
    e.property("ADBE Vector Ellipse Size").setValue([o.w, o.h]);
    e.property("ADBE Vector Ellipse Position").setValue([o.w * (0.5 - ox), o.h * (0.5 - oy)]);
    AE._paint(l, o);
    l.transform.anchorPoint.setValue([0, 0]);
    l.transform.position.setValue([o.x + o.w * ox, o.y + o.h * oy]);
    return AE.place(l, o);
};

// Caminho vetorial. o.points = [[x,y],...] em coordenadas da comp;
// o.inT / o.outT = tangentes relativas (opcional); o.closed; o.pivot = [x,y] (padrao: centro).
// o.trim = true adiciona Trim Paths (para "desenhar" a linha com AE.anim(..., "trimEnd", ...)).
AE.path = function (comp, o) {
    var l = AE._shapeLayer(comp, o, "Caminho");
    var i, minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (i = 0; i < o.points.length; i++) {
        minX = Math.min(minX, o.points[i][0]); maxX = Math.max(maxX, o.points[i][0]);
        minY = Math.min(minY, o.points[i][1]); maxY = Math.max(maxY, o.points[i][1]);
    }
    var pv = o.pivot || [(minX + maxX) / 2, (minY + maxY) / 2];
    var verts = [];
    for (i = 0; i < o.points.length; i++) verts.push([o.points[i][0] - pv[0], o.points[i][1] - pv[1]]);
    var s = new Shape();
    s.vertices = verts;
    if (o.inT) s.inTangents = o.inT;
    if (o.outT) s.outTangents = o.outT;
    s.closed = !!o.closed;
    var g = AE._contents(l).addProperty("ADBE Vector Shape - Group");
    g.property("ADBE Vector Shape").setValue(s);
    AE._paint(l, o);
    if (o.trim) AE._contents(l).addProperty("ADBE Vector Filter - Trim");
    l.transform.anchorPoint.setValue([0, 0]);
    l.transform.position.setValue(pv);
    return AE.place(l, o);
};

// Solido. o = {name, color, x, y, w, h, origin}
AE.solid = function (comp, o) {
    var l = comp.layers.addSolid(AE.hex(o.color || "#000000"), o.name || "Solido", o.w || comp.width, o.h || comp.height, 1);
    if (o.x != null) AE._box(l, o, o.w, o.h);
    return AE.place(l, o);
};

// Null (use so quando 2+ camadas compartilham o mesmo movimento).
AE.nullL = function (comp, o) {
    var l = comp.layers.addNull();
    l.name = o.name || "Controle";
    if (o.x != null) l.transform.position.setValue([o.x, o.y]);
    return l;
};

// Imagem (item importado) encaixada na caixa CSS {x,y,w,h}. fit: "fill"(padrao)|"contain"|"cover"
AE.image = function (comp, item, o) {
    if (!item) return null;
    var l = comp.layers.add(item);
    var sx = o.w / item.width * 100, sy = o.h / item.height * 100;
    if (o.fit === "contain") { sx = sy = Math.min(sx, sy); }
    if (o.fit === "cover") { sx = sy = Math.max(sx, sy); }
    AE._box(l, o, item.width, item.height, sx, sy);
    return AE.place(l, o);
};

// Video. o = {name, start (s na comp), trimIn (s no arquivo), dur, fit, x,y,w,h}
// Sem caixa: ocupa a comp inteira (fit "cover" por padrao).
AE.video = function (comp, item, o) {
    if (!item) return null;
    o = o || {};
    if (o.x == null) { o.x = 0; o.y = 0; o.w = comp.width; o.h = comp.height; if (!o.fit) o.fit = "cover"; }
    var l = AE.image(comp, item, o);
    var start = o.start || 0, trimIn = o.trimIn || 0;
    l.startTime = AE.t(start - trimIn);
    l.inPoint = AE.t(start);
    if (o.dur != null) l.outPoint = AE.t(start + o.dur);
    return l;
};

// Texto. o = {name, text, font (nome PostScript), size, color, align "left|center|right",
//   tracking (letter-spacing em * 1000), leading (px), x, y, w, h (caixa CSS), origin}
// Quebra de linha: "\r". O centro visual do texto e alinhado ao ponto de origem da caixa.
AE.text = function (comp, o) {
    var l = comp.layers.addText(o.text);
    var p = l.property("ADBE Text Properties").property("ADBE Text Document");
    var d = p.value;
    d.resetCharStyle();
    d.resetParagraphStyle();
    d.font = o.font;
    d.fontSize = o.size;
    d.applyFill = true;
    d.fillColor = AE.hex(o.color || "#ffffff");
    d.applyStroke = false;
    if (o.tracking != null) d.tracking = o.tracking;
    if (o.leading != null) { d.autoLeading = false; d.leading = o.leading; }
    d.justification = o.align === "center" ? ParagraphJustification.CENTER_JUSTIFY :
        (o.align === "right" ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY);
    p.setValue(d);
    if (p.value.font !== o.font) AE.warn("Fonte nao instalada: " + o.font + " (camada " + (o.name || o.text) + ")");
    var ox = o.origin ? o.origin[0] : 0.5, oy = o.origin ? o.origin[1] : 0.5;
    var r = l.sourceRectAtTime(0, false);
    l.transform.anchorPoint.setValue([r.left + r.width * ox, r.top + r.height * oy]);
    if (o.w != null) l.transform.position.setValue([o.x + o.w * ox, o.y + o.h * oy]);
    else l.transform.position.setValue([o.x, o.y]);
    return AE.place(l, o);
};

// Precomp de cena: cria a comp e coloca na principal no tempo "start".
AE.scene = function (main, o) { // o = {name, start, dur, folder, bg}
    var c = AE.comp({ name: o.name, w: main.width, h: main.height, fps: main.frameRate, dur: o.dur, folder: o.folder });
    var l = main.layers.add(c);
    l.startTime = AE.t(o.start || 0);
    return { comp: c, layer: l };
};

// Track matte (clip-path, mascara de revelacao). type: "alpha"|"alphaInv"|"luma"
AE.matte = function (layer, matteLayer, type) {
    var tt = type === "alphaInv" ? TrackMatteType.ALPHA_INVERTED : (type === "luma" ? TrackMatteType.LUMA : TrackMatteType.ALPHA);
    try { layer.setTrackMatte(matteLayer, tt); }
    catch (e) { matteLayer.moveBefore(layer); layer.trackMatteType = tt; }
};

// ---------------------------------------------------------------- efeitos
// Sempre por matchName (funciona em qualquer idioma do After).
// params: {"ADBE Gaussian Blur 2-0001": 20, ...}. Cores aceitam "#hex".
// ATENCAO: adicionar outro efeito invalida referencias antigas; use AE.fxProp para buscar de novo.
AE.fx = function (l, mn, params, name) {
    var parade = l.property("ADBE Effect Parade");
    if (!parade.canAddProperty(mn)) { AE.warn("Efeito indisponivel: " + mn); return null; }
    var e = parade.addProperty(mn);
    if (name) e.name = name;
    if (params) {
        for (var k in params) {
            if (!params.hasOwnProperty(k)) continue;
            var v = params[k];
            if (typeof v === "string" && v.charAt(0) === "#") v = AE.col(v);
            try { e.property(k).setValue(v); } catch (err) { AE.warn("Parametro " + k + " em " + mn + ": " + err.toString()); }
        }
    }
    return e;
};
AE.fxProp = function (l, effectName, paramMN) {
    return l.property("ADBE Effect Parade").property(effectName).property(paramMN);
};

// ---------------------------------------------------------------- easing
// cubic-bezier equivalentes (GSAP power1=quad, power2=cubic, power3=quart, power4=quint)
AE.BEZ = {
    "power1.in": [0.55, 0.085, 0.68, 0.53], "power1.out": [0.25, 0.46, 0.45, 0.94], "power1.inout": [0.455, 0.03, 0.515, 0.955],
    "power2.in": [0.55, 0.055, 0.675, 0.19], "power2.out": [0.215, 0.61, 0.355, 1], "power2.inout": [0.645, 0.045, 0.355, 1],
    "power3.in": [0.895, 0.03, 0.685, 0.22], "power3.out": [0.165, 0.84, 0.44, 1], "power3.inout": [0.77, 0, 0.175, 1],
    "power4.in": [0.755, 0.05, 0.855, 0.06], "power4.out": [0.23, 1, 0.32, 1], "power4.inout": [0.86, 0, 0.07, 1],
    "sine.in": [0.47, 0, 0.745, 0.715], "sine.out": [0.39, 0.575, 0.565, 1], "sine.inout": [0.445, 0.05, 0.55, 0.95],
    "expo.in": [0.95, 0.05, 0.795, 0.035], "expo.out": [0.19, 1, 0.22, 1], "expo.inout": [1, 0, 0, 1],
    "circ.in": [0.6, 0.04, 0.98, 0.335], "circ.out": [0.075, 0.82, 0.165, 1], "circ.inout": [0.785, 0.135, 0.15, 0.86],
    "back.in": [0.6, -0.28, 0.735, 0.045], "back.out": [0.175, 0.885, 0.32, 1.275], "back.inout": [0.68, -0.55, 0.265, 1.55],
    "css.ease": [0.25, 0.1, 0.25, 1], "css.ease-in": [0.42, 0, 1, 1], "css.ease-out": [0, 0, 0.58, 1], "css.ease-in-out": [0.42, 0, 0.58, 1]
};
AE.ALIAS = { quad: "power1", cubic: "power2", quart: "power3", quint: "power4", strong: "power4" };

// Aceita: "power2.out", "Power2.easeOut", "expo.inOut", "back.out(2)", "elastic.out(1,0.3)",
// "bounce.out", "steps(5)", "none"/"linear", "ease-in-out" (CSS), [x1,y1,x2,y2] ou function(p){...}.
AE.resolveEase = function (e) {
    if (e == null) e = "power1.out"; // padrao do GSAP
    if (e instanceof Array) return { bez: e };
    if (typeof e === "function") return { fn: e };
    var s = String(e).replace(/\s/g, "").toLowerCase();
    s = s.replace(".easeinout", ".inout").replace(".easeout", ".out").replace(".easein", ".in");
    if (s === "none" || s === "linear") return { linear: true };
    if (s === "ease" || s === "ease-in" || s === "ease-out" || s === "ease-in-out") return { bez: AE.BEZ["css." + s] };
    var st = s.match(/^steps\((\d+)/);
    if (st) return { steps: parseInt(st[1], 10) };
    var m = s.match(/^(elastic|bounce|back)(\.in|\.out|\.inout)?(\(([^)]*)\))?$/);
    if (m && (m[1] !== "back" || m[4])) return { fn: AE.fnEase(m[1], m[2] || ".out", m[4]) };
    var parts = s.replace(/\(.*\)/, "").split(".");
    var key = (AE.ALIAS[parts[0]] || parts[0]) + "." + (parts[1] || "out");
    if (AE.BEZ[key]) return { bez: AE.BEZ[key] };
    AE.warn("Ease desconhecido: " + e + " (usei power1.out)");
    return { bez: AE.BEZ["power1.out"] };
};

AE.fnEase = function (kind, type, params) {
    var a = params ? params.split(",") : [], out;
    if (kind === "bounce") {
        out = function (p) {
            var n = 7.5625;
            if (p < 1 / 2.75) return n * p * p;
            if (p < 2 / 2.75) { p -= 1.5 / 2.75; return n * p * p + 0.75; }
            if (p < 2.5 / 2.75) { p -= 2.25 / 2.75; return n * p * p + 0.9375; }
            p -= 2.625 / 2.75; return n * p * p + 0.984375;
        };
    } else if (kind === "elastic") {
        var amp = a[0] ? parseFloat(a[0]) : 1, per = a[1] ? parseFloat(a[1]) : 0.3;
        if (amp < 1) amp = 1;
        var p2 = 2 * Math.PI / per, p3 = per / (2 * Math.PI) * Math.asin(1 / amp);
        out = function (p) { return p <= 0 ? 0 : (p >= 1 ? 1 : amp * Math.pow(2, -10 * p) * Math.sin((p - p3) * p2) + 1); };
    } else { // back com overshoot custom
        var ov = a[0] ? parseFloat(a[0]) : 1.70158;
        out = function (p) { p = p - 1; return p * p * ((ov + 1) * p + ov) + 1; };
    }
    if (type === ".in") return function (p) { return 1 - out(1 - p); };
    if (type === ".inout") return function (p) { return p < 0.5 ? (1 - out(1 - p * 2)) / 2 : out(p * 2 - 1) / 2 + 0.5; };
    return out;
};

// ---------------------------------------------------------------- keyframes
AE._key = function (prop, t, v) {
    var k = prop.addKey(t);
    prop.setValueAtKey(k, v);
    return k;
};
AE._fit = function (arr, n) {
    var r = [], i;
    for (i = 0; i < n; i++) r.push(arr[Math.min(i, arr.length - 1)]);
    return r;
};
// Define ease de entrada (inE) e/ou saida (outE) de uma key, preservando o outro lado.
AE._setEase = function (prop, k, inE, outE) {
    var BZ = KeyframeInterpolationType.BEZIER;
    var curIn = prop.keyInTemporalEase(k), curOut = prop.keyOutTemporalEase(k);
    prop.setInterpolationTypeAtKey(k, inE ? BZ : prop.keyInInterpolationType(k), outE ? BZ : prop.keyOutInterpolationType(k));
    prop.setTemporalEaseAtKey(k, AE._fit(inE || curIn, curIn.length), AE._fit(outE || curOut, curOut.length));
    if (prop.isSpatial) { // evita o arco automatico do After em posicao nao separada
        try {
            var z = AE._arr(prop.keyValue(k));
            var zero = []; for (var i = 0; i < z.length; i++) zero.push(0);
            prop.setSpatialAutoBezierAtKey(k, false);
            prop.setSpatialTangentsAtKey(k, zero, zero);
        } catch (e) {}
    }
};
AE._ease = function (speed, infl) { return new KeyframeEase(speed, AE._clamp(infl, 0.1, 100)); };

// Velocidade media por dimensao (ou pela distancia, se a propriedade usa 1 ease so).
AE._avg = function (prop, k, fa, ta, dt) {
    var n = prop.keyInTemporalEase(k).length, r = [], i;
    if (n === 1 && fa.length > 1) {
        var d = 0;
        for (i = 0; i < fa.length; i++) d += (ta[i] - fa[i]) * (ta[i] - fa[i]);
        return [Math.sqrt(d) / dt];
    }
    for (i = 0; i < fa.length; i++) r.push((ta[i] - fa[i]) / dt);
    return r;
};

// Tween estilo GSAP: from -> to entre start e start+dur. from null = valor atual (gsap.to).
AE.tween = function (prop, from, to, start, dur, ease) {
    var t0 = AE.t(start), t1 = AE.t(start + dur);
    if (from == null) from = prop.valueAtTime(t0, true);
    if (from instanceof Array && to instanceof Array && from.length > to.length) from = from.slice(0, to.length);
    if (t1 <= t0) return AE.set(prop, to, t0);
    var E = AE.resolveEase(ease);
    if (E.fn) return AE._tweenFn(prop, from, to, t0, t1, E.fn);
    if (E.steps) return AE._steps(prop, from, to, t0, t1, E.steps);
    var k0 = AE._key(prop, t0, from), k1 = AE._key(prop, t1, to);
    if (E.linear) {
        var LN = KeyframeInterpolationType.LINEAR;
        prop.setInterpolationTypeAtKey(k0, prop.keyInInterpolationType(k0), LN);
        prop.setInterpolationTypeAtKey(k1, LN, prop.keyOutInterpolationType(k1));
        return;
    }
    var b = E.bez;
    var x1 = AE._clamp(b[0], 0.001, 1), y1 = b[1], x2 = AE._clamp(b[2], 0, 0.999), y2 = b[3];
    var avg = AE._avg(prop, k0, AE._arr(from), AE._arr(to), t1 - t0);
    var outE = [], inE = [], i;
    for (i = 0; i < avg.length; i++) {
        outE.push(AE._ease(avg[i] * y1 / x1, x1 * 100));
        inE.push(AE._ease(avg[i] * (1 - y2) / (1 - x2), (1 - x2) * 100));
    }
    AE._setEase(prop, k0, null, outE);
    AE._setEase(prop, k1, inE, null);
};

// Mudanca instantanea (gsap.set no meio da timeline): key em HOLD.
AE.set = function (prop, v, t) {
    var HD = KeyframeInterpolationType.HOLD;
    t = AE.t(t);
    if (prop.numKeys === 0 && t === 0) { prop.setValue(v); return; }
    var before = prop.valueAtTime(Math.max(0, t - 1 / AE.fps), true);
    if (prop.numKeys === 0) AE._key(prop, 0, before);
    var k = AE._key(prop, t, v);
    if (k > 1) prop.setInterpolationTypeAtKey(k - 1, prop.keyInInterpolationType(k - 1), HD);
};

AE._steps = function (prop, from, to, t0, t1, n) {
    var fa = AE._arr(from), ta = AE._arr(to), i, j, HD = KeyframeInterpolationType.HOLD;
    for (i = 0; i <= n; i++) {
        var v = [];
        for (j = 0; j < fa.length; j++) v.push(fa[j] + (ta[j] - fa[j]) * i / n);
        var k = AE._key(prop, t0 + (t1 - t0) * i / n, fa.length === 1 ? v[0] : v);
        prop.setInterpolationTypeAtKey(k, prop.keyInInterpolationType(k), HD);
    }
};

// Eases que nao cabem num bezier (elastic, bounce, spring...): keys so nos extremos
// da curva, com a velocidade real de cada lado. Poucas keys, movimento fiel.
AE._tweenFn = function (prop, from, to, t0, t1, fn) {
    var N = 240, h = 1e-4, i, j, ps = [0], f = [];
    for (i = 0; i <= N; i++) f.push(fn(i / N));
    for (i = 1; i < N; i++) {
        if ((f[i] - f[i - 1]) * (f[i + 1] - f[i]) < 0) { // extremo: refina por busca ternaria
            var lo = (i - 1) / N, hi = (i + 1) / N, isMax = f[i] > f[i - 1];
            for (j = 0; j < 40; j++) {
                var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
                if ((fn(m1) < fn(m2)) === isMax) lo = m1; else hi = m2;
            }
            ps.push((lo + hi) / 2);
        }
    }
    ps.push(1);
    // Subdivide trechos em que a curva do After (Hermite, influencia 33%) desviaria > 0,4%
    var dLf = function (p) { return p > 0 ? (fn(p) - fn(Math.max(0, p - h))) / Math.min(h, p) : 0; };
    var dRf = function (p) { return p < 1 ? (fn(Math.min(1, p + h)) - fn(p)) / Math.min(h, 1 - p) : 0; };
    var herr = function (a, b) {
        var w = b - a, fa0 = fn(a), fb0 = fn(b), da = dRf(a) * w, db = dLf(b) * w, worst = 0;
        for (var q = 1; q < 16; q++) {
            var s = q / 16, s2 = s * s, s3 = s2 * s;
            var hv = (2 * s3 - 3 * s2 + 1) * fa0 + (s3 - 2 * s2 + s) * da + (-2 * s3 + 3 * s2) * fb0 + (s3 - s2) * db;
            worst = Math.max(worst, Math.abs(hv - fn(a + w * s)));
        }
        return worst;
    };
    var guard = 0, changed = true;
    while (changed && guard < 6) {
        changed = false; guard++;
        var np = [ps[0]];
        for (i = 1; i < ps.length; i++) {
            if (herr(ps[i - 1], ps[i]) > 0.004) { np.push((ps[i - 1] + ps[i]) / 2); changed = true; }
            np.push(ps[i]);
        }
        ps = np;
    }
    var fa = AE._arr(from), ta = AE._arr(to), dt = t1 - t0;
    var keys = [];
    for (i = 0; i < ps.length; i++) {
        var p = ps[i], v = [];
        for (j = 0; j < fa.length; j++) v.push(fa[j] + (ta[j] - fa[j]) * fn(p));
        keys.push(AE._key(prop, t0 + dt * p, fa.length === 1 ? v[0] : v));
    }
    var n = prop.keyInTemporalEase(keys[0]).length;
    if (n === 1 && fa.length > 1) AE.warn("Ease elastico/bounce em propriedade espacial: separe as dimensoes (" + prop.name + ")");
    for (i = 0; i < ps.length; i++) {
        var pp = ps[i];
        var dL = dLf(pp), dR = dRf(pp);
        var inE = [], outE = [];
        for (j = 0; j < Math.max(n, 1); j++) {
            var dv = (ta[Math.min(j, ta.length - 1)] - fa[Math.min(j, fa.length - 1)]) / dt;
            inE.push(AE._ease(dv * dL, 33.333));
            outE.push(AE._ease(dv * dR, 33.333));
        }
        var k = prop.nearestKeyIndex(t0 + dt * pp);
        AE._setEase(prop, k, i > 0 ? inE : null, i < ps.length - 1 ? outE : null);
    }
};

// ---------------------------------------------------------------- atalhos de transform
// Nomes: x, y (posicao separada), position, scale (%), rotation, opacity (0-100), anchor,
// trimEnd / trimStart (0-100, camadas criadas com AE.path({trim:true})).
AE.P = function (l, n) {
    var tr = l.property("ADBE Transform Group");
    if (n === "x" || n === "y") {
        var pos = tr.property("ADBE Position");
        if (!pos.dimensionsSeparated) pos.dimensionsSeparated = true;
        return tr.property(n === "x" ? "ADBE Position_0" : "ADBE Position_1");
    }
    if (n === "trimEnd" || n === "trimStart") {
        return AE._contents(l).property("ADBE Vector Filter - Trim").property(n === "trimEnd" ? "ADBE Vector Trim End" : "ADBE Vector Trim Start");
    }
    var map = { position: "ADBE Position", scale: "ADBE Scale", rotation: "ADBE Rotate Z", opacity: "ADBE Opacity", anchor: "ADBE Anchor Point" };
    if (map[n]) return tr.property(map[n]);
    AE.warn("Propriedade desconhecida: " + n);
    return null;
};

// AE.anim(camada, "x", de, para, inicio, duracao, ease). de = null -> valor atual.
AE.anim = function (l, n, from, to, start, dur, ease) {
    if (n === "scale") { if (from != null) from = AE._sc(from); to = AE._sc(to); }
    var p = AE.P(l, n);
    if (p) AE.tween(p, from, to, start, dur, ease);
    return l;
};

// Repeticao infinita (repeat:-1) depois das keys: "cycle" ou "pingpong" (yoyo).
AE.loop = function (prop, type) {
    prop.expression = 'loopOut("' + (type || "cycle") + '")';
};

// ---------------------------------------------------------------- texto animado
// Revelacao por caractere/palavra/linha (SplitText + stagger) com 1 camada e 1 animador.
// o = {basedOn: "chars"|"words"|"lines", start, each (duracao de cada unidade),
//      stagger (intervalo entre unidades), opacity: 0, y: 40 (px), scale: 0 (%)}
// Cada unidade sai do estado "de" (opacity/y/scale) e chega ao normal, em cascata.
AE.textReveal = function (l, o) {
    var AN = function () { return l.property("ADBE Text Properties").property("ADBE Text Animators").property("Revelar"); };
    var a = l.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
    a.name = "Revelar";
    if (o.opacity != null) AN().property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity").setValue(o.opacity);
    if (o.y != null) AN().property("ADBE Text Animator Properties").addProperty("ADBE Text Position 3D").setValue([0, o.y, 0]);
    if (o.scale != null) AN().property("ADBE Text Animator Properties").addProperty("ADBE Text Scale 3D").setValue([o.scale, o.scale, 100]);
    AN().property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    var sel = AN().property("ADBE Text Selectors").property(1);
    var basedOn = o.basedOn || "chars";
    var txt = l.property("ADBE Text Properties").property("ADBE Text Document").value.text;
    var n = basedOn === "words" ? txt.split(/\s+/).length : (basedOn === "lines" ? txt.split(/[\r\n]+/).length : txt.length);
    var each = o.each || 0.5, stg = o.stagger || 0.05;
    var W = AE._clamp((each / stg) / Math.max(n, 1) * 100, 1, 100); // largura da onda em %
    sel.property("ADBE Text Range Advanced").property("ADBE Text Range Type2").setValue(basedOn === "words" ? 3 : (basedOn === "lines" ? 4 : 1));
    sel.property("ADBE Text Range Advanced").property("ADBE Text Range Shape").setValue(2); // Ramp Up
    sel.property("ADBE Text Percent Start").setValue(0);
    sel.property("ADBE Text Percent End").setValue(W);
    AE.tween(sel.property("ADBE Text Percent Offset"), -W, 100, o.start || 0, (100 + W) * each / W, "none");
    return l;
};

// ---------------------------------------------------------------- final
AE.report = function (title) {
    if (AE.silent) return;
    var msg = title + " pronto.";
    if (AE.warnings.length) msg += "\n\nAvisos:\n- " + AE.warnings.join("\n- ");
    alert(msg);
};
// ============================== fim aelib.jsx ==============================
