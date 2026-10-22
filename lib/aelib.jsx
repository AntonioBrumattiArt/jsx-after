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
        if (f.fsName.length >= 260) AE.warn("Caminho com mais de 259 caracteres (limite do Windows): mova o projeto para uma pasta mais curta");
        f = AE.silent ? null : File.openDialog("Localize o arquivo: " + rel);
        if (!f) { AE.warn("Arquivo nao encontrado: " + rel); return null; }
    }
    var item = app.project.importFile(new ImportOptions(f));
    if (folder) item.parentFolder = folder;
    return item;
};

// Marcador geral na comp (use para cenas). evt = nome do acontecimento (pinta o marcador).
AE.marker = function (comp, t, label, evt) {
    var m = new MarkerValue(label || "");
    if (evt) { try { m.label = AE.evt(evt); } catch (e) {} }
    comp.markerProperty.setValueAtTime(AE.t(t), m);
};

// ---------------------------------------------------------------- acontecimentos e cores
// Cada acontecimento (cena, clique, entrada de um grupo...) ganha uma cor de label.
// Registre os acontecimentos em ordem de tempo com AE.events([...]): vizinhos nunca repetem cor.
// Cores reservadas (fora da rotacao): controladores, fundo, audio/locucao e guia.
AE.LABEL = { ctrl: 1, bg: 15, audio: 9, guia: 12 };  // Vermelho (CTRL_GERAL), Arenito, Verde, Marrom
// Cor "parecida, mas nao igual" para o controlador de um grupo (label do grupo -> label do controlador).
AE.SIMILAR = { 1: 4, 2: 11, 3: 14, 4: 13, 5: 10, 6: 11, 7: 16, 8: 14, 9: 16, 10: 5, 11: 6, 12: 15, 13: 4, 14: 3, 15: 12, 16: 7 };
AE.EVT_ROT = [2, 8, 6, 3, 13, 7, 11, 5, 14, 4, 10, 16]; // ordem com bom contraste entre vizinhos
AE._evts = {};
AE._evtN = 0;
AE.evt = function (name) {
    if (AE._evts[name] == null) { AE._evts[name] = AE.EVT_ROT[AE._evtN % AE.EVT_ROT.length]; AE._evtN++; }
    return AE._evts[name];
};
AE.events = function (names) { for (var i = 0; i < names.length; i++) AE.evt(names[i]); };

// Metadados da camada guardados no comentario ("jsx-after|chave=valor|...").
AE._meta = function (l, key, val) {
    var c = String(l.comment || ""), parts = c.substr(0, 9) === "jsx-after" ? c.split("|") : ["jsx-after"], i;
    for (i = 1; i < parts.length; i++) {
        var kv = parts[i].split("=");
        if (kv[0] === key) { if (val === undefined) return kv[1]; parts[i] = key + "=" + val; l.comment = parts.join("|"); return val; }
    }
    if (val === undefined) return null;
    parts.push(key + "=" + val);
    l.comment = parts.join("|");
    return val;
};

AE.PREFIX = { ctrl: "CTRL_", bg: "BG_", matte: "MATTE_", guia: "GUIA_", audio: "AUDIO_" };
AE._prefix = function (name, role) {
    var p = AE.PREFIX[role];
    return (p && String(name).substr(0, p.length) !== p) ? p + name : name;
};

// Muda o inicio da camada sem mexer no fim. (No After, mudar o inPoint empurra o outPoint junto;
// as keyframes nao se movem.) Sempre ajuste o inicio antes do fim.
AE._setIn = function (l, a) {
    var o = l.outPoint;
    l.inPoint = a;
    l.outPoint = Math.max(o, a + l.containingComp.frameDuration);
};

// ---------------------------------------------------------------- camadas
// Comum a todas: name, evt (acontecimento -> cor), role ("bg"|"matte"|"guia"|"audio"),
// keep (nao cortar), persist (nao dividir: logo, UI fixa), label (0-16, manual),
// inT/outT (segundos), opacity, rotation, scale(%)
AE.place = function (l, o) {
    if (o.name) l.name = AE._prefix(o.name, o.role);
    if (o.evt) { l.label = AE.evt(o.evt); AE._meta(l, "evt", o.evt); }
    if (o.role) { AE._meta(l, "role", o.role); if (AE.LABEL[o.role]) l.label = AE.LABEL[o.role]; }
    if (o.label != null) l.label = o.label;
    if (o.keep) AE._meta(l, "keep", 1);
    if (o.persist) AE._meta(l, "persist", 1);
    if (o.inT != null) AE._setIn(l, AE.t(o.inT));
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
// Com role "bg" vira um retangulo de forma do tamanho da comp: a cor fica controlavel pelo CTRL_GERAL.
AE.solid = function (comp, o) {
    if (o.role === "bg") {
        return AE.rect(comp, { name: o.name || "Fundo", x: o.x || 0, y: o.y || 0, w: o.w || comp.width, h: o.h || comp.height,
            fill: o.color || "#000000", role: "bg", evt: o.evt, inT: o.inT, outT: o.outT, keep: o.keep });
    }
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
// O matte recebe prefixo MATTE_, a cor do acontecimento da camada, fica em shy e
// passa a existir so enquanto a camada que ele recorta existe (AE.autoTrim).
AE._matteN = 0;
AE.matte = function (layer, matteLayer, type) {
    var tt = type === "alphaInv" ? TrackMatteType.ALPHA_INVERTED : (type === "luma" ? TrackMatteType.LUMA : TrackMatteType.ALPHA);
    try { layer.setTrackMatte(matteLayer, tt); }
    catch (e) { matteLayer.moveBefore(layer); layer.trackMatteType = tt; }
    var id = "m" + (++AE._matteN);
    matteLayer.name = AE._prefix(matteLayer.name, "matte");
    matteLayer.label = layer.label;
    AE._meta(matteLayer, "role", "matte");
    AE._meta(matteLayer, "matteOf", id);
    AE._meta(layer, "matteId", id);
    if (type === "alphaInv") AE._meta(layer, "matteInv", 1);
    matteLayer.shy = true;
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
    if (l.inPoint < AE.t(o.start || 0)) AE._setIn(l, AE.t(o.start || 0)); // antes da revelacao o texto e invisivel
    return l;
};

// ---------------------------------------------------------------- utilidades de propriedades
AE._eachProp = function (g, fn) {
    for (var i = 1; i <= g.numProperties; i++) {
        var p;
        try { p = g.property(i); } catch (e) { continue; }
        if (!p) continue;
        if (p.propertyType === PropertyType.PROPERTY) fn(p); else AE._eachProp(p, fn);
    }
};
AE._hasExpr = function (l) {
    var found = false;
    AE._eachProp(l, function (p) { try { if (p.expressionEnabled && p.expression !== "") found = true; } catch (e) {} });
    return found;
};
AE._lit = function (v) { // valor -> texto de expressao
    if (v instanceof Array) { var s = [], i; for (i = 0; i < v.length; i++) s.push(Math.round(v[i] * 10000) / 10000); return "[" + s.join(", ") + "]"; }
    return String(Math.round(v * 10000) / 10000);
};
AE._same = function (a, b) {
    a = AE._arr(a); b = AE._arr(b);
    for (var i = 0; i < Math.min(a.length, b.length); i++) if (Math.abs(a[i] - b[i]) > 1e-4) return false;
    return true;
};
// Pose de repouso: o valor que fica parado por mais tempo (antes, entre ou depois das keys).
AE._rest = function (l, p) {
    var best = p.keyValue(p.numKeys), bestD = l.outPoint - p.keyTime(p.numKeys), k;
    if (p.keyTime(1) - l.inPoint > bestD) { best = p.keyValue(1); bestD = p.keyTime(1) - l.inPoint; }
    for (k = 1; k < p.numKeys; k++) {
        if (AE._same(p.keyValue(k), p.keyValue(k + 1)) && p.keyTime(k + 1) - p.keyTime(k) > bestD) {
            best = p.keyValue(k); bestD = p.keyTime(k + 1) - p.keyTime(k);
        }
    }
    return best;
};

// ---------------------------------------------------------------- controladores
AE._fxCtrl = function (l, mn, name, v) {
    var e = l.property("ADBE Effect Parade").addProperty(mn);
    e.name = name;
    if (v != null) l.property("ADBE Effect Parade").property(name).property(1).setValue(v);
};

// Controlador de grupo (estilo Duik, nativo). o = {name, x, y (pivo do grupo), evt (acontecimento do grupo),
//   atraso (stagger original em s, so se o grupo tem stagger), cor ("#hex", so se o grupo tem cor unica)}
// Cria CTRL_<name>: mover/escalar/girar o null move o grupo; efeitos Intensidade, Opacidade, Ligado (+ Atraso, Cor).
// Fica logo acima da camada mais alta do grupo, com uma cor parecida (mas nao igual) a do grupo.
AE.ctrl = function (comp, o) {
    var l = comp.layers.addNull();
    l.name = AE._prefix(o.name, "ctrl");
    l.label = o.evt ? AE.SIMILAR[AE.evt(o.evt)] : AE.LABEL.ctrl;
    if (o.evt) AE._meta(l, "labeled", 1);
    AE._meta(l, "role", "ctrl");
    l.transform.position.setValue([o.x != null ? o.x : comp.width / 2, o.y != null ? o.y : comp.height / 2]);
    if (o.atraso != null) { AE._fxCtrl(l, "ADBE Slider Control", "Atraso", o.atraso); AE._meta(l, "atraso0", o.atraso); }
    AE._fxCtrl(l, "ADBE Slider Control", "Intensidade", 100);
    AE._fxCtrl(l, "ADBE Slider Control", "Opacidade", 100);
    AE._fxCtrl(l, "ADBE Checkbox Control", "Ligado", 1);
    if (o.cor) { AE._fxCtrl(l, "ADBE Color Control", "Cor", AE.col(o.cor)); AE._meta(l, "cor", o.cor); }
    return l;
};

// Liga uma camada ao controlador. Com os controles no padrao a animacao fica identica ao original:
// Intensidade escala o movimento em torno da pose de repouso; Atraso muda o espacamento do stagger
// (index = posicao da camada no stagger, 0..n-1); Opacidade e Ligado multiplicam a opacidade.
AE.bind = function (layer, ctrl, o) {
    o = o || {};
    if (!layer.parent) layer.parent = ctrl;
    var mtl = AE._matteOf(layer.containingComp, layer);
    if (mtl && !mtl.parent) mtl.parent = ctrl; // o matte acompanha a camada
    var top = (mtl && mtl.index < layer.index) ? mtl : layer; // controlador logo acima do grupo
    if (ctrl.index > top.index) ctrl.moveBefore(top);
    if (!AE._meta(ctrl, "labeled")) { ctrl.label = AE.SIMILAR[layer.label] || AE.LABEL.ctrl; AE._meta(ctrl, "labeled", 1); }
    var ref = 'thisComp.layer("' + ctrl.name + '")';
    var a0 = AE._meta(ctrl, "atraso0"), idx = o.index || 0;
    var head = "var c = " + ref + ";\nvar k = c.effect(\"Intensidade\")(1) / 100;\n" +
        (a0 != null && idx ? "var t = time - " + idx + " * (c.effect(\"Atraso\")(1) - " + a0 + ");\n" : "var t = time;\n");
    var tr = layer.property("ADBE Transform Group");
    var sep = tr.property("ADBE Position").dimensionsSeparated;
    var names = sep ? ["ADBE Position_0", "ADBE Position_1"] : ["ADBE Position"];
    names = names.concat(["ADBE Scale", "ADBE Rotate Z", "ADBE Opacity"]);
    for (var i = 0; i < names.length; i++) {
        var p = tr.property(names[i]);
        if (!p || !p.canSetExpression) continue;
        var isOp = names[i] === "ADBE Opacity", body;
        if (p.numKeys > 1) {
            var r = AE._lit(AE._rest(layer, p));
            body = head + "var v = valueAtTime(t);\nvar r = " + r + ";\n" +
                ((p.value instanceof Array) ? "var out = add(r, mul(sub(v, r), k));\n" : "var out = r + (v - r) * k;\n");
        } else if (isOp) {
            body = "var c = " + ref + ";\nvar out = value;\n";
        } else continue;
        body += isOp ? "out * c.effect(\"Opacidade\")(1) / 100 * c.effect(\"Ligado\")(1);" : "out;";
        p.expression = body;
    }
    if (AE._meta(ctrl, "cor")) AE._linkColor(layer, AE.hex(AE._meta(ctrl, "cor")), ref + ".effect(\"Cor\")(1)");
    AE._meta(layer, "bound", ctrl.name);
    return layer;
};

// Liga preenchimentos/tracos (formas) e cores de efeitos iguais a 'rgb' a uma expressao de cor.
AE._linkColor = function (layer, rgb, expr) {
    var n = 0;
    AE._eachColor(layer, function (p) { if (AE._same(p.value, rgb)) { p.expression = expr; n++; } });
    return n;
};

// ---- paleta do projeto
AE._hexOf = function (rgb) {
    var s = "#", i;
    for (i = 0; i < 3; i++) { var h = Math.round(AE._clamp(rgb[i], 0, 1) * 255).toString(16).toUpperCase(); s += h.length < 2 ? "0" + h : h; }
    return s;
};
AE._colorName = function (rgb) {
    var r = rgb[0], g = rgb[1], b = rgb[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), li = (mx + mn) / 2, d = mx - mn, h;
    if (d < 0.08) return li > 0.85 ? "Branco" : (li < 0.15 ? "Preto" : "Cinza");
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    // if/else de proposito: o ExtendScript erra ternarios encadeados (a ? b : c ? d : e)
    var n;
    if (h < 15 || h >= 345) n = "Vermelho";
    else if (h < 40) n = "Laranja";
    else if (h < 65) n = "Amarelo";
    else if (h < 160) n = "Verde";
    else if (h < 195) n = "Ciano";
    else if (h < 255) n = "Azul";
    else if (h < 290) n = "Roxo";
    else n = "Rosa";
    if (li < 0.25) return n + " escuro";
    if (li > 0.8) return n + " claro";
    return n;
};
// So as cores visiveis do projeto: conteudo das formas e efeitos. Ignora os estilos de camada e
// os materiais 3D das formas (cores de extrusao escondidas, vermelhas por padrao).
AE._eachColor = function (l, fn) {
    var walk = function (g) {
        for (var i = 1; i <= g.numProperties; i++) {
            var p;
            try { p = g.property(i); } catch (e) { continue; }
            if (!p) continue;
            if (p.propertyType !== PropertyType.PROPERTY) { if (!/Materials/.test(p.matchName)) walk(p); continue; }
            try { if (p.propertyValueType === PropertyValueType.COLOR && p.numKeys === 0 && p.expression === "") fn(p); } catch (e2) {}
        }
    };
    var gs = ["ADBE Root Vectors Group", "ADBE Effect Parade"], i, g;
    for (i = 0; i < gs.length; i++) {
        try { g = l.property(gs[i]); } catch (e) { g = null; }
        if (g) walk(g);
    }
};
AE._textDoc = function (l) {
    var tp = l.property("ADBE Text Properties");
    return tp ? tp.property("ADBE Text Document") : null;
};
// Todas as cores fixas usadas nas comps (formas, tracos, efeitos, controles de grupo e textos),
// da mais usada para a menos usada. Ignora guia, mattes, CTRL_GERAL e cores animadas.
AE._palette = function (comps) {
    var map = {}, order = [], i, j, k;
    var add = function (rgb, who) {
        var key = AE._hexOf(rgb);
        if (!map[key]) { map[key] = { rgb: [rgb[0], rgb[1], rgb[2]], users: [], n: 0 }; order.push(key); }
        map[key].n++;
        for (k = 0; k < map[key].users.length; k++) if (map[key].users[k] === who) return;
        map[key].users.push(who);
    };
    for (i = 0; i < comps.length; i++) for (j = 1; j <= comps[i].numLayers; j++) {
        var l = comps[i].layer(j), role = AE._meta(l, "role");
        if (role === "guia" || role === "matte" || l.isTrackMatte || l.name === "CTRL_GERAL") continue;
        var who = l.name.replace("CTRL_", "").replace("BG_", "").replace(/ #\d+$/, "");
        AE._eachColor(l, function (p) { add(p.value, who); });
        var td = AE._textDoc(l);
        if (td && td.expression === "" && td.numKeys === 0) {
            var d = td.value;
            if (d.applyFill) add(d.fillColor, who);
            if (d.applyStroke) add(d.strokeColor, who);
        }
    }
    order.sort(function (a, b) { return map[b].n - map[a].n; });
    var out = [];
    for (i = 0; i < order.length; i++) out.push({ hex: order[i], rgb: map[order[i]].rgb, users: map[order[i]].users });
    return out;
};

// CTRL_GERAL: controla a peca toda e tem TODAS as cores do projeto, uma por controle de cor,
// nomeadas pelo tom e por onde aparecem ("Azul (Botao, Selo)"). o = {comps: [todas as comps],
// cores: {"Primaria": "#2A2AFF"}} (opcional: nomes da marca no codigo, que substituem o nome automatico).
// Crie depois das camadas e dos controladores de grupo; depois chame AE.linkGeral em cada comp.
AE.ctrlGeral = function (comp, o) {
    o = o || {};
    var l = comp.layers.addNull(), i, k;
    l.name = "CTRL_GERAL";
    l.label = AE.LABEL.ctrl;
    AE._meta(l, "role", "ctrl");
    l.transform.position.setValue([comp.width / 2, comp.height / 2]);
    var named = {};
    if (o.cores) for (k in o.cores) if (o.cores.hasOwnProperty(k)) named[AE._hexOf(AE.hex(o.cores[k]))] = k;
    var pal = AE._palette(o.comps || [comp]), used = {};
    AE._brand = [];
    for (i = 0; i < pal.length; i++) {
        var nm = named[pal[i].hex];
        if (!nm) {
            var us = pal[i].users.slice(0, 2).join(", ") + (pal[i].users.length > 2 ? " +" + (pal[i].users.length - 2) : "");
            nm = AE._colorName(pal[i].rgb) + " (" + us + ")";
        }
        if (used[nm]) { used[nm]++; nm += " " + used[nm]; } else used[nm] = 1;
        AE._fxCtrl(l, "ADBE Color Control", nm, AE.col(pal[i].rgb));
        AE._brand.push({ name: nm, rgb: pal[i].rgb });
    }
    l.moveToBeginning();
    return l;
};
// Liga as cores da marca ao CTRL_GERAL e, na comp dele, torna as camadas soltas filhas dele
// (mover/escalar o GERAL mexe na peca toda). Fundo, guia, audio e controladores ficam de fora do parent.
// Chame no fim, para cada comp (principal e precomps). mainComp = comp onde esta o CTRL_GERAL.
AE.linkGeral = function (comp, geral, mainComp) {
    var same = comp.id === mainComp.id, i, j;
    var ref = (same ? "thisComp" : 'comp("' + mainComp.name + '")') + '.layer("CTRL_GERAL")';
    for (i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i), role = AE._meta(l, "role");
        if (same && l.index !== geral.index && !l.parent && role !== "bg" && role !== "guia" && role !== "audio" && !l.isTrackMatte) {
            if (!(role === "ctrl" && l.name === "CTRL_GERAL")) l.parent = geral;
        }
        if (l.name === "CTRL_GERAL" || role === "guia" || role === "matte" || l.isTrackMatte) continue;
        var fill = null, stroke = null, td = AE._textDoc(l);
        var dv = (td && td.expression === "" && td.numKeys === 0) ? td.value : null;
        for (j = 0; j < (AE._brand || []).length; j++) {
            var eref = ref + '.effect("' + AE._brand[j].name + '")(1)';
            AE._linkColor(l, AE._brand[j].rgb, eref);
            if (dv && dv.applyFill && AE._same(dv.fillColor, AE._brand[j].rgb)) fill = eref;
            if (dv && dv.applyStroke && AE._same(dv.strokeColor, AE._brand[j].rgb)) stroke = eref;
        }
        if (fill || stroke) { // cor do texto via expressao de estilo (mantem o texto e a edicao)
            var ex = "var s = text.sourceText.style;\n";
            if (fill) ex += "var f = " + fill + ";\ns = s.setFillColor([f[0], f[1], f[2]]);\n";
            if (stroke) ex += "var k = " + stroke + ";\ns = s.setStrokeColor([k[0], k[1], k[2]]);\n";
            td.expression = ex + "s;";
        }
    }
    for (i = 1; i <= comp.numLayers; i++) { // mattes acompanham o pai da camada que recortam
        var m = comp.layer(i), of = AE._meta(m, "matteOf");
        if (of == null || m.parent) continue;
        for (j = 1; j <= comp.numLayers; j++) {
            var u = comp.layer(j);
            if (AE._meta(u, "matteId") === of && u.parent) m.parent = u.parent;
        }
    }
};

// ---------------------------------------------------------------- essential properties
// Expoe uma propriedade da comp nas Essential Properties (aparece na camada da precomp na comp de cima).
AE.expose = function (prop, comp, name) {
    try { if (prop.canAddToMotionGraphicsTemplate(comp)) { prop.addToMotionGraphicsTemplateAs(comp, name); return true; } } catch (e) {}
    AE.warn("Nao foi possivel expor nas Essential Properties: " + name);
    return false;
};
AE.exposeText = function (textLayer, comp, name) {
    return AE.expose(textLayer.property("ADBE Text Properties").property("ADBE Text Document"), comp, name || textLayer.name);
};
AE.exposeCtrl = function (ctrl, comp) {
    var fx = ctrl.property("ADBE Effect Parade"), base = ctrl.name.replace("CTRL_", "");
    for (var i = 1; i <= fx.numProperties; i++) AE.expose(fx.property(i).property(1), comp, base + " " + fx.property(i).name);
    AE._meta(ctrl, "exposed", 1);
};

// ---------------------------------------------------------------- notas dos controladores
// Marcador no inicio de cada controlador: 1a linha "Ex", 2a linha o resumo do que ele controla.
AE._names = function (arr) {
    if (arr.length <= 4) return arr.join(", ");
    return arr.slice(0, 3).join(", ") + " +" + (arr.length - 3);
};
AE._ctrlNote = function (comp, c) {
    var D = " \u00b7 ", fx = c.property("ADBE Effect Parade"), i, s;
    if (c.name === "CTRL_GERAL") {
        s = "Pe\u00e7a toda" + D + "Transformar: move/escala tudo (menos fundo, guia e \u00e1udio)" + D +
            fx.numProperties + " cores do projeto, nomeadas pelo tom e por onde aparecem";
    } else {
        var mem = [];
        for (i = 1; i <= comp.numLayers; i++) if (AE._meta(comp.layer(i), "bound") === c.name) mem.push(comp.layer(i).name);
        mem.reverse(); // de baixo para cima = ordem de criacao
        s = AE._names(mem) + D + "Transformar: o grupo" + D + "Intensidade: for\u00e7a do movimento";
        var get = function (n) { for (var q = 1; q <= fx.numProperties; q++) if (fx.property(q).name === n) return fx.property(q); return null; };
        if (get("Atraso")) s += D + "Atraso: intervalo do stagger (" + AE._meta(c, "atraso0") + " s)";
        s += D + "Opacidade/Ligado: visibilidade";
        var cor = get("Cor");
        if (cor) s += D + "Cor: preenchimento" + (cor.property(1).expression !== "" ? " (vem do CTRL_GERAL; apague a express\u00e3o para cor pr\u00f3pria)" : "");
        if (AE._meta(c, "exposed")) s += D + "Exposto nas Essential Properties";
    }
    var m = new MarkerValue("Ex\r" + s);
    try { m.label = c.label; } catch (e) {}
    c.property("ADBE Marker").setValueAtTime(c.inPoint, m);
};

// ---------------------------------------------------------------- guia e locucao
AE._lockAtEnd = [];
// Render original como camada guia: nao renderiza, sem audio, opacidade baixa, travada no fim.
AE.guide = function (comp, item, o) {
    if (!item) return null;
    o = o || {};
    var l = comp.layers.add(item);
    var s = Math.min(comp.width / item.width, comp.height / item.height) * 100;
    AE._box(l, { x: 0, y: 0, w: comp.width, h: comp.height }, item.width, item.height, s, s);
    l.name = "GUIA_original";
    l.label = AE.LABEL.guia;
    AE._meta(l, "role", "guia");
    l.guideLayer = true;
    l.transform.opacity.setValue(o.opacity || 30);
    if (l.hasAudio) l.audioEnabled = false;
    l.moveToBeginning();
    AE._lockAtEnd.push(l);
    return l;
};

// Locucao com um marcador no inicio exato de cada frase. frases = [{t: segundos no audio, text: "..."}]
// (tempos vindos do projeto ou de scripts/frases_locucao.mjs). o = {name, start (s na comp)}
AE.voice = function (comp, item, frases, o) {
    if (!item) return null;
    o = o || {};
    var l = comp.layers.add(item), st = o.start || 0, i;
    l.name = AE._prefix(o.name || "Locucao", "audio");
    l.label = AE.LABEL.audio;
    AE._meta(l, "role", "audio");
    l.startTime = AE.t(st);
    AE.phraseMarkers(l, frases, st);
    l.moveToEnd();
    return l;
};
// Marcadores de frase numa camada que ja existe (ex.: o video no Modo Video, com a fala embutida).
AE.phraseMarkers = function (l, frases, st) {
    var fps = l.containingComp.frameRate;
    st = st || 0;
    for (var i = 0; i < frases.length; i++) {
        var t = Math.floor((st + frases[i].t) * fps + 0.01) / fps; // nunca depois do inicio da fala
        l.property("ADBE Marker").setValueAtTime(t, new MarkerValue(frases[i].text));
    }
};

// ---------------------------------------------------------------- corte das camadas
AE._posAt = function (tr, t) {
    if (tr.property("ADBE Position").dimensionsSeparated)
        return [tr.property("ADBE Position_0").valueAtTime(t, false), tr.property("ADBE Position_1").valueAtTime(t, false)];
    return tr.property("ADBE Position").valueAtTime(t, false);
};
AE._visAt = function (comp, l, t, offscreen) {
    var tr = l.property("ADBE Transform Group");
    if (tr.property("ADBE Opacity").valueAtTime(t, false) <= 0.05) return false;
    var s = tr.property("ADBE Scale").valueAtTime(t, false);
    if (Math.abs(s[0]) < 0.05 || Math.abs(s[1]) < 0.05) return false;
    if (offscreen && !l.parent) {
        var r = l.sourceRectAtTime(t, false);
        if (r.width <= 0 || r.height <= 0) return false;
        var a = tr.property("ADBE Anchor Point").valueAtTime(t, false), p = AE._posAt(tr, t);
        var rot = tr.property("ADBE Rotate Z").valueAtTime(t, false) * Math.PI / 180, cs = Math.cos(rot), sn = Math.sin(rot);
        var xs = [r.left, r.left + r.width], ys = [r.top, r.top + r.height], x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, i, j;
        for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
            var dx = (xs[i] - a[0]) * s[0] / 100, dy = (ys[j] - a[1]) * s[1] / 100;
            var X = p[0] + dx * cs - dy * sn, Y = p[1] + dx * sn + dy * cs;
            x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
        }
        if (x1 < 0 || x0 > comp.width || y1 < 0 || y0 > comp.height) return false;
    }
    return true;
};
AE._matteOf = function (comp, l) {
    var id = AE._meta(l, "matteId");
    if (id == null) return null;
    for (var i = 1; i <= comp.numLayers; i++) if (AE._meta(comp.layer(i), "matteOf") === id) return comp.layer(i);
    return null;
};
// Trechos (em s) em que a camada aparece, quadro a quadro.
AE._runs = function (comp, l, mt, inv) {
    var fd = comp.frameDuration, runs = [], cur = null, n;
    var off = AE._meta(l, "role") !== "bg";
    var n0 = Math.round(l.inPoint / fd), n1 = Math.round(l.outPoint / fd);
    for (n = n0; n < n1; n++) {
        var t = n * fd;
        var v = AE._visAt(comp, l, t, off) && (!mt || inv || AE._visAt(comp, mt, t, false));
        if (v) { if (!cur) cur = [t, t + fd]; else cur[1] = t + fd; }
        else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    return runs;
};
// Remove keys que ficaram inteiras fora da camada (mantem as que definem o valor nas bordas).
AE._trimKeys = function (l) {
    var a = l.inPoint, b = l.outPoint;
    AE._eachProp(l, function (p) {
        try {
            if (p.matchName === "ADBE Marker" || p.numKeys < 2) return;
            var k;
            for (k = p.numKeys; k >= 2; k--) if (p.keyTime(k) > b && p.keyTime(k - 1) >= b) p.removeKey(k);
            for (k = p.numKeys - 1; k >= 1; k--) if (p.keyTime(k) < a && p.keyTime(k + 1) <= a) p.removeKey(k);
        } catch (e) {}
    });
};

AE._stats = { cuts: 0, splits: 0 };
// Corta cada camada para existir so onde aparece na tela e divide em camadas separadas quando ela
// some e volta depois de o.gap segundos (padrao 1). Nao divide (so corta as pontas): persist,
// fundo, camada com expressao, ligada a controlador ou com matte. Nao toca: keep, nulls,
// controladores, guia, audio, ajuste. Os mattes seguem a camada que recortam.
// Rode depois de criar tudo e ANTES de AE.bind/AE.linkGeral (sem expressoes as keys sao podadas).
AE.autoTrim = function (comp, o) {
    o = o || {};
    var gap = o.gap != null ? o.gap : 1, i, j, list = [];
    for (i = 1; i <= comp.numLayers; i++) list.push(comp.layer(i));
    for (i = 0; i < list.length; i++) {
        var l = list[i], role = AE._meta(l, "role");
        if (l instanceof CameraLayer || l instanceof LightLayer || l.nullLayer || l.adjustmentLayer || l.guideLayer || !l.hasVideo) continue;
        if (role === "ctrl" || role === "guia" || role === "audio" || role === "matte" || AE._meta(l, "keep") || l.isTrackMatte) continue;
        var mt = AE._matteOf(comp, l), inv = AE._meta(l, "matteInv") ? true : false;
        var runs = AE._runs(comp, l, mt, inv);
        if (!runs.length) { AE.warn("Camada nunca aparece: " + l.name + " (" + comp.name + ")"); continue; }
        var hasExpr = AE._hasExpr(l);
        var noSplit = AE._meta(l, "persist") || AE._meta(l, "bound") || mt || hasExpr || role === "bg";
        var merged = [runs[0]];
        for (j = 1; j < runs.length; j++) {
            var last = merged[merged.length - 1];
            if (noSplit || runs[j][0] - last[1] < gap) last[1] = runs[j][1]; else merged.push(runs[j]);
        }
        var base = l.name;
        for (j = merged.length - 1; j >= 1; j--) {
            var d = l.duplicate();
            d.name = base + " #" + (j + 1);
            d.inPoint = merged[j][0];
            d.outPoint = merged[j][1];
            if (!hasExpr) AE._trimKeys(d);
            AE._stats.splits++;
        }
        if (merged[0][0] > l.inPoint + 1e-6 || merged[0][1] < l.outPoint - 1e-6) AE._stats.cuts++;
        l.inPoint = merged[0][0];
        l.outPoint = merged[0][1];
        if (!hasExpr) AE._trimKeys(l);
    }
    for (i = 1; i <= comp.numLayers; i++) { // mattes acompanham a camada que recortam
        var m = comp.layer(i), of = AE._meta(m, "matteOf");
        if (of == null) continue;
        for (j = 1; j <= comp.numLayers; j++) {
            var u = comp.layer(j);
            if (AE._meta(u, "matteId") === of) { m.inPoint = u.inPoint; m.outPoint = u.outPoint; AE._trimKeys(m); }
        }
    }
};

// ---------------------------------------------------------------- inicio e fim
// AE.begin() no comeco: anota o que ja existia no projeto (a limpeza nunca toca nisso).
AE.begin = function () {
    AE._pre = {};
    for (var i = 1; i <= app.project.numItems; i++) AE._pre[app.project.item(i).id] = true;
};
// AE.finish(root, [comps]) no fim: remove so itens criados pelo script e nao usados, guarda os
// solidos na pasta raiz, esconde camadas shy, trava as guias e monta o resumo.
AE.finish = function (root, comps) {
    var removed = 0, i, it, created = [];
    if (AE._pre) {
        for (i = 1; i <= app.project.numItems; i++) { it = app.project.item(i); if (!AE._pre[it.id]) created.push(it); }
        for (i = 0; i < created.length; i++) {
            it = created[i];
            if (!(it instanceof FootageItem)) continue;
            if (it.usedIn.length === 0) { it.remove(); removed++; }
            else if (root && it.mainSource instanceof SolidSource) {
                if (!AE._solidsF) AE._solidsF = AE.folder("Solidos", root);
                it.parentFolder = AE._solidsF;
            }
        }
        for (i = app.project.numItems; i >= 1; i--) {
            it = app.project.item(i);
            if (!AE._pre[it.id] && it instanceof FolderItem && it.numItems === 0) { it.remove(); removed++; }
        }
    }
    var nl = 0, nc = 0, j;
    comps = comps || [];
    for (i = 0; i < comps.length; i++) {
        comps[i].hideShyLayers = true;
        nl += comps[i].numLayers;
        for (j = 1; j <= comps[i].numLayers; j++) {
            if (AE._meta(comps[i].layer(j), "role") !== "ctrl") continue;
            nc++;
            AE._ctrlNote(comps[i], comps[i].layer(j));
        }
    }
    for (i = 0; i < AE._lockAtEnd.length; i++) AE._lockAtEnd[i].locked = true;
    AE._summary = "Camadas: " + nl + " | cortadas: " + AE._stats.cuts + " | divididas: " + AE._stats.splits +
        " | controladores: " + nc + " | acontecimentos: " + AE._evtN + " | itens limpos: " + removed;
};

AE.report = function (title) {
    if (AE.silent) return;
    var msg = title + " pronto.";
    if (AE._summary) msg += "\n" + AE._summary;
    if (AE.warnings.length) msg += "\n\nAvisos:\n- " + AE.warnings.join("\n- ");
    alert(msg);
};
// ============================== fim aelib.jsx ==============================
