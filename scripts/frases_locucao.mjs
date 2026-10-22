// Encontra o inicio exato de cada frase de uma locucao (para os marcadores no After).
// Uso: node frases_locucao.mjs locucao.wav [roteiro.txt] [--ruido=-35] [--pausa=0.3] [--fps=30]
//   roteiro.txt: uma frase por linha, na ordem falada. Com ele, as N-1 maiores pausas
//   viram as fronteiras entre as N frases (pausas curtas dentro de uma frase sao ignoradas).
// Saida (JSON): frases [{t, text}] com t em segundos, arredondado para baixo no frame,
// pronto para AE.voice(comp, item, frases).
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? parseFloat(a.split("=")[1]) : d; };
const [audio, roteiro] = args.filter(a => !a.startsWith("--"));
if (!audio) { console.error("Uso: node frases_locucao.mjs locucao.wav [roteiro.txt] [--ruido=-35] [--pausa=0.3] [--fps=30]"); process.exit(2); }
const noise = opt("ruido", -35), minSil = opt("pausa", 0.3), fps = opt("fps", 30);

// ffmpeg escreve o resultado do silencedetect no stderr
const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", audio, "-af", `silencedetect=noise=${noise}dB:d=${minSil}`, "-f", "null", "-"], { encoding: "utf8" });
if (run.error) { console.error("ffmpeg nao encontrado no PATH"); process.exit(1); }
const log = run.stderr || "";

const dur = (() => { const m = log.match(/Duration: (\d+):(\d+):([\d.]+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; })();
const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]);
const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);

// Trechos de fala = complemento dos silencios
const segs = [];
let cursor = 0, i = 0;
if (starts.length && starts[0] <= 0.02) { cursor = ends[0]; i = 1; }
for (; i < starts.length; i++) { if (starts[i] > cursor) segs.push({ ini: cursor, fim: starts[i] }); cursor = ends[i] ?? dur; }
if (cursor < dur - 0.05) segs.push({ ini: cursor, fim: dur });

const lines = roteiro ? fs.readFileSync(roteiro, "utf8").split(/\r?\n/).map(s => s.trim()).filter(Boolean) : null;
let onsets = segs.map(s => s.ini), avisos = [];
if (lines) {
  if (segs.length < lines.length) {
    avisos.push(`Encontrei ${segs.length} trechos de fala para ${lines.length} frases: ajuste --pausa (menor) ou --ruido.`);
  } else if (segs.length > lines.length) {
    const gaps = segs.slice(1).map((s, k) => ({ k: k + 1, g: s.ini - segs[k].fim }));
    const cortes = new Set(gaps.sort((a, b) => b.g - a.g).slice(0, lines.length - 1).map(x => x.k));
    onsets = segs.filter((s, k) => k === 0 || cortes.has(k)).map(s => s.ini);
  }
}
const fr = t => Math.floor(t * fps + 1e-6) / fps;
const frases = onsets.map((t, k) => ({ t: +fr(t).toFixed(6), text: lines ? (lines[k] ?? `Frase ${k + 1}`) : `Frase ${k + 1}` }));

console.log(JSON.stringify({ arquivo: audio, duracao: +dur.toFixed(3), trechos_de_fala: segs.length, avisos, frases }, null, 2));
