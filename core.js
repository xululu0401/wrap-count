/* 称完馅再和面 · 计算核心（core.js）
 * 问题：包包子、饺子、馄饨时面和馅分开准备，常常一边剩一边不够。按每张皮多重、每个馅多重，
 *       算面能出几张皮、馅够包几个、哪样先用完、剩多少，以及补多少面（或馅）、皮擀多重能刚好一起用完。
 * 模型（设计选择，页面「怎么算的」写明）：
 *   面团 = 面粉 × (1 + 含水率 + 其他配料) × (1 − 面损耗)
 *   馅   = (肉 + 打水 + 菜 × 挤后剩 + 调料) × (1 − 馅损耗)
 *   皮能出 ⌊面团 ÷ 皮重⌋ 张，馅够 ⌊馅 ÷ 馅重⌋ 个，能包两者里小的那个。
 * 精确计算：克数是整数、百分比最多一位小数（化成千分比整数），面团与馅都写成「微克」整数（× 10^6），
 *   所以个数取整不受浮点误差影响。 */
(function (root) {
  'use strict';
  var U = 1000000;   /* 1 克 = 10^6 个计算单位 */

  function defaultState() {
    return {
      name: '肉包子', flour: '500', hyd: '50', other: '3', dLoss: '3',
      meat: '500', mwater: '100', veg: '150', keep: '100', season: '30', fLoss: '2',
      skin: '50', fill: '40', want: ''
    };
  }
  var FIELDS = ['name', 'flour', 'hyd', 'other', 'dLoss', 'meat', 'mwater', 'veg', 'keep', 'season', 'fLoss', 'skin', 'fill', 'want'];
  var FILL_KEYS = ['meat', 'mwater', 'veg', 'season'];
  var MAXG = { flour: 20000, meat: 20000, mwater: 10000, veg: 20000, season: 5000 };

  function half(s) { return String(s == null ? '' : s).replace(/[\uFF01-\uFF5E]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); }).replace(/\u3000/g, ' ').replace(/\s/g, '').replace(/。/g, '.'); }
  function num(s) { s = half(s); return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; }

  function parse(st) {
    var errs = [], P = {};
    st = st && typeof st === 'object' ? st : {};
    function need(f, lo, hi, label, unit, dec, opt) {
      var s = half(st[f]);
      if (opt && s === '') return null;
      var x = num(s);
      if (isNaN(x)) { errs.push({ field: f, message: label + '要填数字' }); return null; }
      if ((s.split('.')[1] || '').length > (dec || 0)) { errs.push({ field: f, message: label + (dec ? '最多一位小数' : '要填整数') }); return null; }
      if (x < lo || x > hi) { errs.push({ field: f, message: label + '要在 ' + lo + '～' + hi + unit + ' 之间' }); return null; }
      return dec ? Math.round(x * 10) : x;   /* 百分比 → 千分比整数 */
    }
    P.name = String(st.name == null ? '' : st.name).slice(0, 12).trim() || '这一锅';
    P.flour = need('flour', 1, MAXG.flour, '面粉', ' 克');
    P.hyd = need('hyd', 20, 100, '含水率', '%', 1);
    P.other = need('other', 0, 20, '其他配料', '%', 1);
    P.dLoss = need('dLoss', 0, 30, '面的损耗', '%', 1);
    P.meat = need('meat', 0, MAXG.meat, '肉', ' 克');
    P.mwater = need('mwater', 0, MAXG.mwater, '打水', ' 克');
    P.veg = need('veg', 0, MAXG.veg, '菜', ' 克');
    P.keep = need('keep', 10, 100, '菜挤水后剩', '%', 1);
    P.season = need('season', 0, MAXG.season, '调料', ' 克');
    P.fLoss = need('fLoss', 0, 30, '馅的损耗', '%', 1);
    P.skin = need('skin', 1, 500, '每张皮', ' 克');
    P.fill = need('fill', 1, 1000, '每个馅', ' 克');
    P.want = need('want', 1, 2000, '想包几个', ' 个', 0, true);
    if (P.meat === 0 && P.mwater === 0 && P.veg === 0 && P.season === 0) errs.push({ field: 'meat', message: '馅料至少要填一样' });
    return errs.length ? { errors: errs } : { P: P, errors: [] };
  }

  function dough6(P, flour) { return (flour == null ? P.flour : flour) * (1000 + P.hyd + P.other) * (1000 - P.dLoss); }
  function fillRaw(P, q) { q = q || P; return (q.meat * 1000 + q.mwater * 1000 + q.veg * P.keep + q.season * 1000); }
  function filling6(P, q) { return fillRaw(P, q) * (1000 - P.fLoss); }

  function evaluate(P) {
    var D = dough6(P), F = filling6(P), sk = P.skin * U, fl = P.fill * U;
    var nS = Math.floor(D / sk), nF = Math.floor(F / fl), n = Math.min(nS, nF);
    return {
      D: D, F: F, nS: nS, nF: nF, n: n,
      short: nS < nF ? 'dough' : nF < nS ? 'filling' : 'even',
      leftD: D - n * sk, leftF: F - n * fl,
      water6: P.flour * P.hyd * 1000   /* 水 = 面粉 × 含水率（× 10^6） */
    };
  }

  /* —— 反解 —— */
  function minFlour(P, target) {   /* 面粉最少多少克，皮能出 ≥ target 张；做不到返回 null */
    var sk = P.skin * U;
    var f = Math.max(1, Math.ceil(target * sk / ((1000 + P.hyd + P.other) * (1000 - P.dLoss))) - 1);
    for (; f <= MAXG.flour; f++) if (Math.floor(dough6(P, f) / sk) >= target) return f;
    return null;
  }
  function scaleFill(P, pct) {   /* 馅料各项按 pct% 放大，向上取整到克 */
    var q = {};
    FILL_KEYS.forEach(function (k) { q[k] = Math.ceil(P[k] * pct / 100); });
    return q;
  }
  function minFillScale(P, target) {   /* 馅料最少放大到百分之几（整数 %），馅能包 ≥ target 个 */
    var fl = P.fill * U;
    for (var p = 101; p <= 100000; p++) {
      var q = scaleFill(P, p), over = FILL_KEYS.some(function (k) { return q[k] > MAXG[k]; });
      if (over) return null;
      if (Math.floor(filling6(P, q) / fl) >= target) return { pct: p, q: q };
    }
    return null;
  }

  function applyChange(st, a) {
    var s = JSON.parse(JSON.stringify(st));
    Object.keys(a.set).forEach(function (k) { s[k] = String(a.set[k]); });
    return s;
  }

  function actions(st, P, ev) {
    var acts = [];
    function add(id, set, mk) {
      var a = { id: id, set: set }, q = parse(applyChange(st, a));
      if (!q.P) return;
      var x = evaluate(q.P), t = mk(x, q.P);
      if (!t) return;
      a.text = t; a.after = { n: x.n, nS: x.nS, nF: x.nF, leftD: x.leftD, leftF: x.leftF }; acts.push(a);
    }
    function lefts(x) {
      var s = [];
      if (x.leftD >= U / 2) s.push('剩面 ' + g(x.leftD) + ' 克');
      if (x.leftF >= U / 2) s.push('剩馅 ' + g(x.leftF) + ' 克');
      return s.length ? s.join('、') : '面和馅都几乎不剩';
    }
    if (ev.short === 'dough' && ev.nF > 0) {
      var f = minFlour(P, ev.nF);
      if (f !== null) add('act_flour', { flour: f }, function (x, Q) {
        return '面粉加到 ' + fmt(f, 0) + ' 克（水 ' + g(Q.flour * Q.hyd * 1000) + ' 克）：能包 ' + c(x.n) + ' 个，' + lefts(x);   /* minFlour 保证皮 ≥ 馅的个数，所以 x.n = nF */
      });
      var sk = Math.floor(ev.D / (ev.nF * U));
      if (sk >= 1) add('act_skin'   /* 面先用完时 nF > D÷皮，sk 必然比皮轻 */, { skin: sk }, function (x) {
        return x.n === ev.nF ? '皮擀薄到 ' + sk + ' 克一张：能包 ' + c(x.n) + ' 个，' + lefts(x) : null;
      });
      var fb = Math.floor(ev.F / (Math.max(ev.nS, 1) * U));
      if (ev.nS > 0 && fb > P.fill && fb * 2 <= P.fill * 3) add('act_fillbig', { fill: fb }, function (x) {
        return x.n === ev.n ? '每个馅加到 ' + fb + ' 克：还是 ' + c(x.n) + ' 个，' + lefts(x) : null;
      });
    } else if (ev.short === 'filling' && ev.nS > 0) {
      var m = minFillScale(P, ev.nS);
      if (m) add('act_fillmore', { meat: m.q.meat, mwater: m.q.mwater, veg: m.q.veg, season: m.q.season }, function (x) {
        return x.n === ev.nS && x.n > ev.n ? '馅料都放到 ' + (m.pct / 100).toFixed(2) + ' 倍（' + fillList(P, m.q) + '）：能包 ' + c(x.n) + ' 个，' + lefts(x) : null;
      });
      var fs = Math.floor(ev.F / (ev.nS * U));
      if (fs >= 1 && fs < P.fill) add('act_fillsmall', { fill: fs }, function (x) {
        return x.n === ev.nS ? '每个馅少放到 ' + fs + ' 克：能包 ' + c(x.n) + ' 个，' + lefts(x) : null;
      });
      var sb = Math.floor(ev.D / (Math.max(ev.nF, 1) * U));
      if (ev.nF > 0 && sb > P.skin && sb * 2 <= P.skin * 3) add('act_skinbig', { skin: sb }, function (x) {
        return x.n === ev.n ? '皮擀厚到 ' + sb + ' 克一张：还是 ' + c(x.n) + ' 个，' + lefts(x) : null;
      });
    }
    if (P.want && ev.n < P.want) {
      var set = {}, parts = [];
      if (ev.nS < P.want) { var f2 = minFlour(P, P.want); if (f2 === null) return acts; set.flour = f2; parts.push('面粉加到 ' + fmt(f2, 0) + ' 克'); }
      if (ev.nF < P.want) { var m2 = minFillScale(P, P.want); if (!m2) return acts; FILL_KEYS.forEach(function (k) { set[k] = m2.q[k]; }); parts.push('馅料都放到 ' + (m2.pct / 100).toFixed(2) + ' 倍（' + fillList(P, m2.q) + '）'); }
      var same = acts.some(function (a) { return JSON.stringify(a.set) === JSON.stringify(set); });
      if (!same) add('act_want', set, function (x) { return x.n >= P.want ? '要包 ' + c(P.want) + ' 个：' + parts.join('，') + '，' + lefts(x) : null; });
    }
    return acts;
  }
  function fillList(P, q) {
    var nm = { meat: '肉', mwater: '打水', veg: '菜', season: '调料' }, s = [];
    FILL_KEYS.forEach(function (k) { if (P[k]) s.push(nm[k] + ' ' + fmt(q[k], 0)); });
    return s.join('、') + ' 克';
  }

  function compute(st) {
    var q = parse(st);
    if (!q.P) return { ok: false, errors: q.errors };
    var P = q.P, ev = evaluate(P);
    return { ok: true, errors: [], P: P, ev: ev, actions: actions(st, P, ev) };
  }

  /* —— 文字 —— */
  function fmt(x, d) {
    var s = Math.abs(x).toFixed(d), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (x < 0 && Number(s) !== 0 ? '−' : '') + p.join('.');
  }
  function g(x6) { return fmt(Math.round(x6 / U), 0); }   /* 微克整数 → 「1,234」克，四舍五入到 1 克 */
  function c(n) { return fmt(n, 0); }   /* 个数也按千分位写，跟克数一致 */
  function pc(p10) { return fmt(p10 / 10, p10 % 10 ? 1 : 0) + '%'; }

  function headline(o) {
    var P = o.P, e = o.ev;
    if (e.n === 0) return P.name + '：' + (e.nS === 0 ? '面团一共 ' + g(e.D) + ' 克，不够擀一张 ' + P.skin + ' 克的皮' : '馅一共 ' + g(e.F) + ' 克，不够包一个 ' + P.fill + ' 克的馅') + '，一个也包不成。';
    var s = P.name + '：面能出 ' + c(e.nS) + ' 张皮，馅够包 ' + c(e.nF) + ' 个，按 ' + P.skin + ' 克皮 + ' + P.fill + ' 克馅能包 ' + c(e.n) + ' 个，';
    if (e.short === 'dough') return s + '面先用完' + (e.leftD >= U / 2 ? '（剩的 ' + g(e.leftD) + ' 克面不够一张）' : '') + '，剩馅 ' + g(e.leftF) + ' 克（还够 ' + c((e.nF - e.n)) + ' 个）。';
    if (e.short === 'filling') return s + '馅先用完' + (e.leftF >= U / 2 ? '（剩的 ' + g(e.leftF) + ' 克馅不够一个）' : '') + '，剩面 ' + g(e.leftD) + ' 克（还够 ' + c((e.nS - e.n)) + ' 张皮）。';
    return s + '面和馅一起用完。';
  }
  function explain(o) {
    var P = o.P, e = o.ev, s = '面团 ' + g(e.D) + ' 克（面粉 ' + fmt(P.flour, 0) + ' + 水 ' + g(e.water6) + (P.other ? ' + 其他 ' + g(P.flour * P.other * 1000) : '') + '，扣损耗 ' + pc(P.dLoss) + '）；馅 ' + g(e.F) + ' 克（扣损耗 ' + pc(P.fLoss) + '）。';
    s += '一个成品 ' + (P.skin + P.fill) + ' 克，皮馅比 ' + ratio(P.skin, P.fill) + '。';
    if (P.fill > P.skin * 2) s += '馅比皮重一倍以上，皮可能兜不住，自己掂量。';
    if (P.want) s += e.n >= P.want ? '想包 ' + c(P.want) + ' 个：够了' + (e.n > P.want ? '，还能多包 ' + c((e.n - P.want)) + ' 个' : '') + '。' : '想包 ' + c(P.want) + ' 个：还差 ' + c((P.want - e.n)) + ' 个。';
    return s;
  }
  function ratio(a, b) { var x = a, y = b; while (y) { var t = x % y; x = y; y = t; } return (a / x) + ' : ' + (b / x); }

  function csvCell(v) { var x = String(v); if (/^[=+\-@]/.test(x)) x = "'" + x; return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  function row(a) { return a.map(csvCell).join(','); }
  function toCSV(o, when) {
    var P = o.P, e = o.ev, L = [];
    L.push(row(['称完馅再和面', '导出时间', when, '名字', P.name]));
    L.push(row(['项目', '数值', '单位']));
    [['面粉', P.flour, '克'], ['含水率', P.hyd / 10, '%'], ['水', (e.water6 / U).toFixed(1), '克'], ['其他配料', P.other / 10, '%'], ['面的损耗', P.dLoss / 10, '%'], ['面团（扣损耗后）', (e.D / U).toFixed(2), '克'],
      ['肉', P.meat, '克'], ['打水', P.mwater, '克'], ['菜', P.veg, '克'], ['菜挤水后剩', P.keep / 10, '%'], ['调料', P.season, '克'], ['馅的损耗', P.fLoss / 10, '%'], ['馅（扣损耗后）', (e.F / U).toFixed(2), '克'],
      ['每张皮', P.skin, '克'], ['每个馅', P.fill, '克'], ['皮能出', e.nS, '张'], ['馅够包', e.nF, '个'], ['能包', e.n, '个'], ['剩面', (e.leftD / U).toFixed(2), '克'], ['剩馅', (e.leftF / U).toFixed(2), '克'], ['想包', P.want == null ? '' : P.want, '个']
    ].forEach(function (r) { L.push(row(r)); });
    L.push('');
    L.push(row(['改法', '改完能包', '剩面 克', '剩馅 克']));
    o.actions.forEach(function (a) { L.push(row([a.text, a.after.n, (a.after.leftD / U).toFixed(2), (a.after.leftF / U).toFixed(2)])); });
    return L.join('\r\n') + '\r\n';
  }
  function toMD(o, when) {
    var P = o.P, e = o.ev, L = [];
    L.push('# 称完馅再和面 · ' + P.name, '', '_导出：' + when + '_', '', '**' + headline(o) + '**', '', explain(o), '');
    L.push('| 一步 | 用料 | 得到 |', '|---|---|---|');
    L.push('| 和面 | 面粉 ' + fmt(P.flour, 0) + ' 克、水 ' + g(e.water6) + ' 克（含水率 ' + pc(P.hyd) + '）、其他 ' + pc(P.other) + '，损耗 ' + pc(P.dLoss) + ' | 面团 ' + g(e.D) + ' 克 → ' + e.nS + ' 张 ' + P.skin + ' 克的皮 |');
    L.push('| 拌馅 | 肉 ' + fmt(P.meat, 0) + '、打水 ' + fmt(P.mwater, 0) + '、菜 ' + fmt(P.veg, 0) + '（挤后剩 ' + pc(P.keep) + '）、调料 ' + fmt(P.season, 0) + ' 克，损耗 ' + pc(P.fLoss) + ' | 馅 ' + g(e.F) + ' 克 → ' + e.nF + ' 份 ' + P.fill + ' 克的馅 |');
    L.push('| 包 | 每个 ' + P.skin + ' + ' + P.fill + ' 克 | ' + e.n + ' 个，剩面 ' + g(e.leftD) + ' 克、剩馅 ' + g(e.leftF) + ' 克 |', '');
    o.actions.forEach(function (a) { L.push('- ' + a.text); });
    if (o.actions.length) L.push('');
    L.push('> 按重量的粗算：不算发酵、蒸煮后的重量变化，菜的出水只按「挤后剩」一项估。默认数字是虚构示例。');
    return L.join('\n') + '\n';
  }

  var api = { U: U, FIELDS: FIELDS, FILL_KEYS: FILL_KEYS, defaultState: defaultState, parse: parse, evaluate: evaluate, dough6: dough6, filling6: filling6,
    minFlour: minFlour, minFillScale: minFillScale, scaleFill: scaleFill, applyChange: applyChange, actions: actions, compute: compute,
    headline: headline, explain: explain, fmt: fmt, g: g, c: c, pc: pc, ratio: ratio, num: num, toCSV: toCSV, toMD: toMD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AppCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
