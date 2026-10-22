// Checa se um JSX roda no ExtendScript do After Effects (ES3) antes de entregar.
// Uso: node checar_jsx.mjs arquivo.jsx [--fix]
//   --fix  grava o arquivo em UTF-8 com BOM (necessario quando ha acentos).
import fs from "node:fs";
import vm from "node:vm";

const file = process.argv[2];
const fix = process.argv.includes("--fix");
if (!file) { console.error("Uso: node checar_jsx.mjs arquivo.jsx [--fix]"); process.exit(2); }

let buf = fs.readFileSync(file);
const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
let src = buf.toString("utf8").replace(/^﻿/, "");
const errors = [], warns = [];

// 1) Sintaxe geral
try { new vm.Script(src, { filename: file }); }
catch (e) { errors.push(`Erro de sintaxe: ${e.message}`); }

// 2) Remove comentarios e strings (mantendo quebras de linha) para checar o codigo puro
function strip(s) {
  let out = "", i = 0;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (c === "/" && n === "/") { while (i < s.length && s[i] !== "\n") { out += " "; i++; } continue; }
    if (c === "/" && n === "*") { while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) { out += s[i] === "\n" ? "\n" : " "; i++; } out += "  "; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; out += q; i++;
      while (i < s.length && s[i] !== q) { if (s[i] === "\\") { out += "  "; i += 2; continue; } out += s[i] === "\n" ? "\n" : " "; i++; }
      out += q; i++; continue;
    }
    out += c; i++;
  }
  return out;
}
const code = strip(src);
const lines = code.split("\n");

const rules = [
  [/\blet\s/, "let nao existe no ES3: use var"],
  [/\bconst\s/, "const nao existe no ES3: use var"],
  [/=>/, "arrow function nao existe no ES3: use function(){}"],
  [/`/, "template string nao existe no ES3: concatene com +"],
  [/\.\.\.[A-Za-z_$[]/, "spread/rest nao existe no ES3"],
  [/\bclass\s+[A-Za-z_$]/, "class nao existe no ES3"],
  [/\.(forEach|map|filter|reduce|some|every|find|findIndex|includes)\s*\(/, "metodo de array ES5+ nao existe no ES3: use for"],
  [/\bObject\.(keys|assign|values|entries|create|defineProperty)\b/, "Object.* ES5+ nao existe no ES3"],
  [/\bJSON\./, "JSON nao e garantido no ExtendScript: evite"],
  [/\bArray\.isArray\b/, "Array.isArray nao existe no ES3: use instanceof Array"],
  [/\.trim\s*\(/, ".trim() nao existe no ES3: use replace(/^\\s+|\\s+$/g, \"\")"],
  [/function\s*[A-Za-z_$]*\s*\([^)]*=/, "parametro com valor padrao nao existe no ES3"],
  [/\b(async|await)\b/, "async/await nao existe no ES3"],
  [/,\s*[\]}]/, "virgula sobrando antes de ] ou }: pode criar item vazio no ES3"],
];
lines.forEach((ln, idx) => {
  for (const [re, msg] of rules) if (re.test(ln)) errors.push(`linha ${idx + 1}: ${msg}`);
  if (/\.indexOf\s*\(/.test(ln)) warns.push(`linha ${idx + 1}: indexOf so existe em string no ES3; confira que nao e array`);
  if (/\?[^:;(),]*:[^;(),]*\?[^:;(),]*:/.test(ln)) errors.push(`linha ${idx + 1}: ternario encadeado sem parenteses; o ExtendScript avalia errado: use if/else ou parenteses`);
});

// 3) Estrutura esperada
if (!/var AE = \{\};/.test(src)) errors.push("aelib.jsx nao foi colada no topo do arquivo");
if (!/beginUndoGroup/.test(src)) warns.push("sem app.beginUndoGroup: o usuario nao conseguira desfazer com um Ctrl+Z");
if (/\bapp\.newProject\s*\(/.test(code)) errors.push("nao use app.newProject(): o script deve rodar dentro do projeto aberto");

// 4) Acentos e BOM
const nonAscii = /[^\x00-\x7F]/.test(src);
if (nonAscii && !hasBom) {
  if (fix) { fs.writeFileSync(file, "﻿" + src, "utf8"); warns.push("BOM UTF-8 adicionado (acentos ok)"); }
  else errors.push("ha acentos/caracteres especiais sem BOM UTF-8: rode com --fix");
}

for (const w of warns) console.log("AVISO  " + w);
for (const e of errors) console.log("ERRO   " + e);
console.log(errors.length ? `\n${errors.length} erro(s). Corrija antes de entregar.` : "\nOK: pronto para o After Effects.");
process.exit(errors.length ? 1 : 0);
