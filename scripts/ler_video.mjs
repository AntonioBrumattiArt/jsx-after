// Le um video: formato, fps, duracao, audio, cortes de cena e quadros-chave para olhar.
// Uso: node ler_video.mjs video.mp4 [pasta_saida] [limiar_corte=0.3]
// Saida: resumo JSON no terminal + PNGs (um por cena, no meio dela) em pasta_saida.
// Precisa de ffmpeg e ffprobe no PATH.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [, , video, outArg, thrArg] = process.argv;
if (!video) { console.error("Uso: node ler_video.mjs video.mp4 [pasta_saida] [limiar]"); process.exit(2); }
const out = outArg || path.join(path.dirname(video), path.parse(video).name + "_quadros");
const thr = parseFloat(thrArg || "0.3");
fs.mkdirSync(out, { recursive: true });

const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", video], { encoding: "utf8" }));
const v = probe.streams.find(s => s.codec_type === "video");
const a = probe.streams.find(s => s.codec_type === "audio");
const [fn, fd] = (v.avg_frame_rate || v.r_frame_rate).split("/").map(Number);
const fps = Math.round((fn / (fd || 1)) * 1000) / 1000;
const dur = parseFloat(probe.format.duration || v.duration);
let w = v.width, h = v.height;
const rot = Math.abs(parseInt((v.tags && v.tags.rotate) || (v.side_data_list && v.side_data_list[0] && v.side_data_list[0].rotation) || 0, 10));
if (rot === 90 || rot === 270) [w, h] = [h, w];

// Cortes de cena
let cuts = [];
try {
  const log = execFileSync("ffmpeg", ["-hide_banner", "-i", video, "-filter:v", `select='gt(scene,${thr})',showinfo`, "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  cuts = [...log.matchAll(/pts_time:([\d.]+)/g)].map(m => +m[1]);
} catch (e) {
  const log = String(e.stderr || "");
  cuts = [...log.matchAll(/pts_time:([\d.]+)/g)].map(m => +m[1]);
}
const fr = t => Math.round(t * fps) / fps;
const bounds = [0, ...cuts.map(fr), dur];
const scenes = [];
for (let i = 0; i < bounds.length - 1; i++) {
  if (bounds[i + 1] - bounds[i] < 1 / fps) continue;
  scenes.push({ n: scenes.length + 1, start: +bounds[i].toFixed(3), end: +bounds[i + 1].toFixed(3) });
}

// Um quadro no meio de cada cena (para analisar o conteudo visualmente)
for (const s of scenes) {
  const t = (s.start + s.end) / 2;
  s.frame = path.join(out, `cena_${String(s.n).padStart(2, "0")}_${t.toFixed(2)}s.png`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", video, "-frames:v", "1", "-vf", "scale='min(960,iw)':-2", s.frame]);
}

console.log(JSON.stringify({
  arquivo: path.resolve(video), largura: w, altura: h, fps, duracao: +dur.toFixed(3),
  audio: !!a, codec: v.codec_name, alfa: /a$|yuva|rgba|argb/.test(v.pix_fmt || ""),
  cortes: cuts.map(c => +fr(c).toFixed(3)), cenas: scenes,
}, null, 2));
