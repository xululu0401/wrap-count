'use strict';
/* 注入测试：对 core.js 做一处小改动，看核心测试能不能抓到。跑完自动还原。
 * 首轮 25/30：补面粉后「x.n === nF」与面先用完时「sk < 皮」两处守卫恒真（删守卫与变异）；一位小数下 round/floor(x×10) 等价（删变异）；
 * 想包个数正好够、面先用完剩不到半克 → 补测。 */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const F=path.join(__dirname,'../core.js'),src=fs.readFileSync(F,'utf8');
const M=[
["(1000 + P.hyd + P.other) * (1000 - P.dLoss)","(1000 + P.hyd) * (1000 - P.dLoss)"],
["* (1000 - P.dLoss); }","* 1000; }"],
["q.veg * P.keep","q.veg * 1000"],
["q.mwater * 1000 + ",""],
["* (1000 - P.fLoss); }","* (1000 + P.fLoss); }"],
["var nS = Math.floor(D / sk)","var nS = Math.round(D / sk)"],
["n = Math.min(nS, nF)","n = Math.max(nS, nF)"],
["short: nS < nF ? 'dough' : nF < nS ? 'filling' : 'even'","short: nS <= nF ? 'dough' : 'filling'"],
["if (Math.floor(dough6(P, f) / sk) >= target) return f;","if (Math.floor(dough6(P, f) / sk) > target) return f;"],
["Math.ceil(target * sk / ((1000 + P.hyd + P.other) * (1000 - P.dLoss))) - 1","Math.ceil(target * sk / ((1000 + P.hyd + P.other) * (1000 - P.dLoss))) + 1"],
["q[k] = Math.ceil(P[k] * pct / 100)","q[k] = Math.round(P[k] * pct / 100)"],
["for (var p = 101; p <= 100000; p++)","for (var p = 102; p <= 100000; p++)"],
["if (over) return null;",""],
["fb * 2 <= P.fill * 3","fb <= 1000"],
["sb * 2 <= P.skin * 3","sb <= 500"],
["if (P.want && ev.n < P.want)","if (P.want && ev.n <= P.want)"],
["if (!same) add('act_want'","add('act_want'"],
["if (x.leftD >= U / 2) s.push","if (x.leftD > 0) s.push"],
["if ((s.split('.')[1] || '').length > (dec || 0))","if ((s.split('.')[1] || '').length > 1)"],
["if (opt && s === '') return null;","if (opt && s === '') return 0;"],
["if (P.meat === 0 && P.mwater === 0 && P.veg === 0 && P.season === 0)","if (P.meat === 0 && P.veg === 0)"],
[".slice(0, 12).trim() || '这一锅'",".trim() || '这一锅'"],
["if (P.fill > P.skin * 2)","if (P.fill >= P.skin * 2)"],
["(P.other ? ' + 其他 '","(true ? ' + 其他 '"],
["e.leftD >= U / 2 ? '（剩的 '","e.leftD > 0 ? '（剩的 '"],
["if (/^[=+\\-@]/.test(x)) x = \"'\" + x;",""],
["function g(x6) { return fmt(Math.round(x6 / U), 0); }","function g(x6) { return fmt(Math.floor(x6 / U), 0); }"],
];
let caught=0;const rows=[];
for(const [a,b] of M){
  if(src.indexOf(a)<0){rows.push('✗ 找不到原文：'+a.slice(0,80));continue;}
  fs.writeFileSync(F,src.replace(a,b));
  let ok=true;try{execFileSync('node',['--test',path.join(__dirname,'core.test.cjs')],{stdio:'pipe',timeout:120000});}catch(e){ok=false;}
  rows.push((ok?'✗ 没抓到':'✓ 抓到')+'：'+a.slice(0,70)+' → '+b.slice(0,70));if(!ok)caught++;
}
fs.writeFileSync(F,src);
console.log(rows.join('\n'));console.log('合计 '+caught+'/'+M.length);
