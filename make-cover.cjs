/* 封面 cover.svg（1200×1200）：配对条与读数来自 core.js 同一次 compute；再用浏览器截成 cover.png。 */
const fs = require('node:fs');
const A = require('./core.js');
const o = A.compute(A.defaultState()), e = o.ev, P = o.P;
if (!o.ok || e.n !== 14 || e.nF !== 19 || o.actions[0].set.flour !== 641) throw new Error('默认场景不对');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
const cols = 20, x0 = 210, cw = 40;
const lane = (n, y, c) => Array.from({ length: cols }, (_, i) => i < n ? `<rect x="${x0 + i * cw}" y="${y}" width="${cw - 6}" height="56" rx="6" fill="${c}"/>` : `<rect x="${x0 + i * cw + 1}" y="${y + 1}" width="${cw - 8}" height="54" rx="6" fill="none" stroke="#e2d9cd" stroke-width="2" stroke-dasharray="6 5"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f3efe8"/>
  <rect x="60" y="60" width="1080" height="1080" rx="18" fill="#fffdf9"/>
  <text x="140" y="230" font-family="${F}" font-size="120" font-weight="800" fill="#2a2420">称完馅再和面</text>
  <text x="140" y="305" font-family="${F}" font-size="40" fill="#5a4f47">面能出几张皮、馅够包几个、哪样先用完</text>
  <text x="140" y="420" font-family="${F}" font-size="36" fill="#5a4f47">面粉 ${A.fmt(P.flour, 0)} 克 · 肉 ${P.meat} 克 · 皮 ${P.skin} 克 + 馅 ${P.fill} 克：</text>
  <text x="140" y="500" font-family="${F}" font-size="60" font-weight="800" fill="#2f6b4f">能包 ${e.n} 个　<tspan fill="#b5583a">剩馅 ${A.g(e.leftF)} 克</tspan></text>
  <text x="140" y="628" font-family="${F}" font-size="34" font-weight="700" fill="#5a4f47">皮</text>${lane(e.nS, 588, '#e9cf9f')}
  <text x="1060" y="628" text-anchor="end" font-family="${F}" font-size="30" fill="#2a2420">${e.nS}</text>
  <text x="140" y="708" font-family="${F}" font-size="34" font-weight="700" fill="#5a4f47">馅</text>${lane(e.nF, 668, '#b5583a')}
  <text x="1060" y="708" text-anchor="end" font-family="${F}" font-size="30" fill="#2a2420">${e.nF}</text>
  <rect x="140" y="790" width="920" height="200" rx="14" fill="#dcefe4"/>
  <text x="180" y="860" font-family="${F}" font-size="38" fill="#2f6b4f">→ 面粉加到 ${o.actions[0].set.flour} 克：能包 ${o.actions[0].after.n} 个</text>
  <text x="180" y="935" font-family="${F}" font-size="38" fill="#2f6b4f">→ 或者皮擀薄到 ${o.actions[1].set.skin} 克一张</text>
  <text x="140" y="1090" font-family="${F}" font-size="24" fill="#8f847b">按重量的粗算 · 用料是虚构示例</text>
</svg>`;
fs.writeFileSync('cover.svg', svg);
fs.writeFileSync('/tmp/cover101.html', '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body>' + svg + '</body></html>');
console.log('cover.svg', svg.length);
