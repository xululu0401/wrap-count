/* 称完馅再和面 · 核心测试：node --test tests/core.test.cjs
 * 锚点：tests/ref.json（独立 Python 按文字规则用 Fraction 重写，300 组；补料用线性逐个找）、默认场景手算、
 *       整除阈值两侧、零个、非法输入、改法真的重算且最小、导出。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const A = require(path.join(__dirname, '..', 'core.js'));
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref.json'), 'utf8'));
const U = A.U;
const D = () => A.defaultState();
const one = (o) => Object.assign(D(), o);
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, (m || '') + ' ' + a + ' vs ' + b);

test('默认场景：手算读数、标题、说明、改法', () => {
  const o = A.compute(D()); assert.ok(o.ok, JSON.stringify(o.errors));
  const e = o.ev;
  /* 面团 500 × 1.53 × 0.97 = 742.05；馅 (500 + 100 + 150 + 30) × 0.98 = 764.4 */
  assert.equal(e.D, 742.05 * U); assert.equal(e.F, 764.4 * U);
  assert.equal(e.nS, 14); assert.equal(e.nF, 19); assert.equal(e.n, 14); assert.equal(e.short, 'dough');
  assert.equal(e.leftD, 42.05 * U); assert.equal(e.leftF, 204.4 * U);
  assert.equal(A.headline(o), '肉包子：面能出 14 张皮，馅够包 19 个，按 50 克皮 + 40 克馅能包 14 个，面先用完（剩的 42 克面不够一张），剩馅 204 克（还够 5 个）。');
  assert.equal(A.explain(o), '面团 742 克（面粉 500 + 水 250 + 其他 15，扣损耗 3%）；馅 764 克（扣损耗 2%）。一个成品 90 克，皮馅比 5 : 4。');
  /* 19 张要面团 ≥ 950：f × 1.4841 ≥ 950 → f ≥ 640.1… → 641；皮 742.05 ÷ 19 = 39.05 → 39；馅 764.4 ÷ 14 = 54.6 → 54 */
  assert.deepEqual(o.actions.map((a) => a.text), [
    '面粉加到 641 克（水 321 克）：能包 19 个，剩面 1 克、剩馅 4 克',
    '皮擀薄到 39 克一张：能包 19 个，剩面 1 克、剩馅 4 克',
    '每个馅加到 54 克：还是 14 个，剩面 42 克、剩馅 8 克']);
});

test('与独立 Python 实现逐组对拍（300 组）', () => {
  assert.equal(REF.cases.length, 300);
  const st = REF.stats;
  assert.ok(st.dough_short >= 60 && st.fill_short >= 60 && st.want_unmet >= 50, JSON.stringify(st));
  let flourN = 0, scaleN = 0, wantN = 0;
  for (const c of REF.cases) {
    const o = A.compute(c.state), m = JSON.stringify(c.state); assert.ok(o.ok, JSON.stringify(o.errors) + m);
    const x = c.expect, e = o.ev;
    assert.equal(e.nS, x.nS, m); assert.equal(e.nF, x.nF, m); assert.equal(e.n, x.n, m);
    near(e.D / U, x.D, 1e-6, m); near(e.F / U, x.F, 1e-6, m); near(e.leftD / U, x.leftD, 1e-6, m); near(e.leftF / U, x.leftF, 1e-6, m);
    const P = o.P;
    if ('minFlour' in x) { assert.equal(A.minFlour(P, e.nF), x.minFlour, m); flourN++; }
    if ('minScale' in x) { const s = A.minFillScale(P, e.nS); assert.deepEqual(s ? [s.pct, s.q] : null, x.minScale, m); scaleN++; }
    if ('wantFlour' in x) {
      if (x.wantFlour !== 'ok') assert.equal(A.minFlour(P, P.want), x.wantFlour, m);
      if (x.wantScale !== 'ok') { const s = A.minFillScale(P, P.want); assert.deepEqual(s ? [s.pct, s.q] : null, x.wantScale, m); }
      wantN++;
    }
  }
  assert.ok(flourN >= 60 && scaleN >= 60 && wantN >= 50, flourN + ' ' + scaleN + ' ' + wantN);
});

test('每条改法：真的改了输入、重算后读数对得上、补料是最小的', () => {
  let n = 0;
  for (const c of REF.cases.concat([{ state: D() }, { state: one({ want: '30' }) }])) {
    const o = A.compute(c.state), P = o.P, e = o.ev, ids = o.actions.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const a of o.actions) {
      const o2 = A.compute(A.applyChange(c.state, a)); assert.ok(o2.ok, a.text);
      assert.equal(o2.ev.n, a.after.n, a.text); assert.equal(o2.ev.leftD, a.after.leftD); assert.equal(o2.ev.leftF, a.after.leftF);
      if (a.id === 'act_flour') { assert.equal(o2.ev.n, e.nF); const f = a.set.flour; assert.ok(Math.floor(A.dough6(P, f - 1) / (P.skin * U)) < e.nF, '少 1 克就不够'); }
      if (a.id === 'act_skin' || a.id === 'act_fillsmall') { assert.equal(o2.ev.n, Math.max(e.nS, e.nF)); }
      if (a.id === 'act_fillbig' || a.id === 'act_skinbig') { assert.equal(o2.ev.n, e.n); assert.ok(o2.ev.leftD + o2.ev.leftF < e.leftD + e.leftF, '总剩得更少'); }
      if (a.id === 'act_want') assert.ok(o2.ev.n >= P.want);
      if (a.id === 'act_fillmore') {
        assert.equal(o2.ev.n, e.nS);
        const pPrev = Math.round(+a.text.match(/放到 ([\d.]+) 倍/)[1] * 100) - 1;
        if (pPrev > 100) { const q = A.scaleFill(P, pPrev); assert.ok(Math.floor(A.filling6(P, q) / (P.fill * U)) < e.nS, '少 1% 就不够'); }
      }
      n++;
    }
    if (e.short === 'even') assert.ok(!ids.some((i) => i !== 'act_want'));
  }
  assert.ok(n >= 400, String(n));
});

test('整除阈值两侧：正好够一张 / 差一点不够', () => {
  /* 面粉 100、含水 50、其他 0、损耗 0 → 面团 150；皮 50 → 3 张；皮 51 → 2 张 */
  const base = { flour: '100', hyd: '50', other: '0', dLoss: '0', meat: '0', mwater: '0', veg: '120', keep: '100', season: '0', fLoss: '0', fill: '40' };
  let o = A.compute(one(Object.assign({}, base, { skin: '50' })));
  assert.equal(o.ev.nS, 3); assert.equal(o.ev.nF, 3); assert.equal(o.ev.short, 'even'); assert.equal(o.ev.leftD, 0); assert.equal(o.ev.leftF, 0);
  assert.ok(A.headline(o).endsWith('面和馅一起用完。')); assert.equal(o.actions.length, 0);
  o = A.compute(one(Object.assign({}, base, { skin: '51' })));
  assert.equal(o.ev.nS, 2); assert.equal(o.ev.short, 'dough');
  /* 馅 120 → 馅 41 → 2 个 */
  o = A.compute(one(Object.assign({}, base, { skin: '50', fill: '41' })));
  assert.equal(o.ev.nF, 2); assert.equal(o.ev.short, 'filling');
  /* 百分比一位小数：含水 50.1 → 面团 150.1，皮 50 仍 3 张，剩 0.1 克 */
  o = A.compute(one(Object.assign({}, base, { skin: '50', hyd: '50.1' })));
  assert.equal(o.ev.leftD, 0.1 * U);
  assert.ok(A.headline(o).indexOf('剩的') < 0, '剩不到半克不写「剩的…不够」');
  o = A.compute(one(Object.assign({}, base, { skin: '50', hyd: '50.1', veg: '200' })));
  assert.equal(o.ev.short, 'dough'); assert.equal(A.headline(o).indexOf('剩的'), -1, '面先用完、剩 0.1 克也不写');
  o = A.compute(one(Object.assign({}, base, { skin: '50', hyd: '50.4', veg: '200' })));
  assert.equal(o.ev.leftD, 0.4 * U); assert.equal(A.headline(o).indexOf('剩的'), -1);
  o = A.compute(one(Object.assign({}, base, { skin: '50', hyd: '50.5', veg: '200' })));
  assert.ok(A.headline(o).indexOf('面先用完（剩的 1 克面不够一张）') > 0, A.headline(o));
});

test('一个也包不成：面不够一张 / 馅不够一个', () => {
  let o = A.compute(one({ flour: '10', skin: '50' }));
  assert.equal(o.ev.n, 0); assert.equal(A.headline(o), '肉包子：面团一共 15 克，不够擀一张 50 克的皮，一个也包不成。');
  assert.ok(o.actions.some((a) => a.id === 'act_flour'));
  o = A.compute(one({ meat: '0', mwater: '0', veg: '0', season: '5', fill: '40' }));
  assert.equal(o.ev.nF, 0); assert.equal(A.headline(o), '肉包子：馅一共 5 克，不够包一个 40 克的馅，一个也包不成。');
});

test('想包几个：够了 / 还差 / 补料同时补两样', () => {
  let o = A.compute(one({ want: '10' }));
  assert.ok(A.explain(o).endsWith('想包 10 个：够了，还能多包 4 个。'));
  assert.ok(!o.actions.some((a) => a.id === 'act_want'));
  o = A.compute(one({ want: '14' }));
  assert.ok(A.explain(o).endsWith('想包 14 个：够了。'));
  assert.ok(!o.actions.some((x) => x.id === 'act_want'), '正好够不给补料');
  o = A.compute(one({ want: '30' }));
  assert.ok(A.explain(o).endsWith('想包 30 个：还差 16 个。'));
  const w = o.actions.find((a) => a.id === 'act_want');
  /* 30 张皮要面团 1500 → 面粉 ≥ 1010.7 → 1011；馅要 1200 → 原料 ≥ 1224.5，p=157 得 785+157+236+48=1226 */
  assert.equal(w.text, '要包 30 个：面粉加到 1,011 克，馅料都放到 1.57 倍（肉 785、打水 157、菜 236、调料 48 克），剩馅 1 克');
  assert.deepEqual(w.set, { flour: 1011, meat: 785, mwater: 157, veg: 236, season: 48 });
  /* 想包的太多、补料超上限：不给这条 */
  o = A.compute(one({ want: '2000', skin: '500' }));
  assert.ok(!o.actions.some((a) => a.id === 'act_want'));
});

test('改法去重与上限：与已有改法同一组改动不重复给；馅/皮加厚不超过 1.5 倍', () => {
  const o = A.compute(one({ name: '素菜包', flour: '600', hyd: '52', other: '4', dLoss: '3', meat: '0', mwater: '0', veg: '800', keep: '40', season: '60', fLoss: '3', skin: '45', fill: '35', want: '20' }));
  assert.deepEqual(o.actions.map((a) => a.id), ['act_fillmore', 'act_fillsmall']);
  assert.equal(o.actions[0].text, '馅料都放到 1.90 倍（菜 1,520、调料 114 克）：能包 20 个，剩面 8 克');
  /* 默认场景每个馅加到 54 = 1.35 倍 ≤ 1.5，给；馅 40 → 皮 20 时 742/14 加到 53 也给 */
  const o2 = A.compute(one({ fill: '25' }));   /* nF = 30，nS = 14，764.4/14 = 54.6 → 54 > 37.5，不给 */
  assert.ok(!o2.actions.some((a) => a.id === 'act_fillbig'));
});

test('非法输入：逐项报错、可同时多项', () => {
  const cases = [
    [{ flour: 'abc' }, 'flour', '面粉要填数字'], [{ flour: '0' }, 'flour', '面粉要在 1～20000 克 之间'], [{ flour: '1.5' }, 'flour', '面粉要填整数'],
    [{ hyd: '19.9' }, 'hyd', '含水率要在 20～100% 之间'], [{ hyd: '50.25' }, 'hyd', '含水率最多一位小数'], [{ keep: '5' }, 'keep', '菜挤水后剩要在 10～100% 之间'],
    [{ skin: '0' }, 'skin', '每张皮要在 1～500 克 之间'], [{ fill: '1001' }, 'fill', '每个馅要在 1～1000 克 之间'], [{ want: '0' }, 'want', '想包几个要在 1～2000 个 之间'],
    [{ meat: '0', mwater: '0', veg: '0', season: '0' }, 'meat', '馅料至少要填一样'], [{ dLoss: '-1' }, 'dLoss', '面的损耗要填数字'],
  ];
  for (const [o, f, msg] of cases) { const r = A.compute(one(o)); assert.equal(r.ok, false, JSON.stringify(o)); assert.equal(r.errors[0].field, f); assert.equal(r.errors[0].message, msg); }
  const r = A.compute(one({ flour: 'x', skin: '', fill: '0' }));
  assert.deepEqual(r.errors.map((e) => e.field), ['flour', 'skin', 'fill']);
  assert.equal(A.compute(null).ok, false);
});

test('输入宽容：全角数字、句号当小数点、空格、想包几个可空、名字截 12 字', () => {
  const o = A.compute(one({ flour: '５００', hyd: '５０。０', meat: ' 500 ', want: '  ', name: '一二三四五六七八九十甲乙丙丁' }));
  assert.ok(o.ok); assert.equal(o.P.flour, 500); assert.equal(o.P.hyd, 500); assert.equal(o.P.want, null); assert.equal(o.P.name, '一二三四五六七八九十甲乙');
  assert.equal(A.compute(one({ name: '   ' })).P.name, '这一锅');
});

test('格式化与皮馅比', () => {
  assert.equal(A.g(1234.5 * U), '1,235'); assert.equal(A.g(0.49 * U), '0'); assert.equal(A.pc(25), '2.5%'); assert.equal(A.pc(30), '3%');
  assert.equal(A.ratio(50, 40), '5 : 4'); assert.equal(A.ratio(10, 12), '5 : 6'); assert.equal(A.ratio(7, 7), '1 : 1');
  assert.ok(A.explain(A.compute(one({ fill: '101' }))).indexOf('皮可能兜不住') > 0);
  assert.ok(A.explain(A.compute(one({ fill: '100' }))).indexOf('兜不住') < 0);
  assert.ok(A.explain(A.compute(one({ other: '0' }))).indexOf('其他') < 0);
});

test('导出：CSV（BOM 由界面加）防公式注入、MD 内容同口径', () => {
  const o = A.compute(one({ name: '=SUM(A1)' }));
  const csv = A.toCSV(o, '2026-11-18 07:00');
  assert.ok(csv.indexOf("'=SUM(A1)") > 0);
  assert.ok(csv.indexOf('面团（扣损耗后）,742.05,克') > 0); assert.ok(csv.indexOf('能包,14,个') > 0); assert.ok(csv.indexOf('剩馅,204.40,克') > 0);
  assert.equal(csv.split('\r\n').filter((l) => /^(面粉加到|皮擀|每个馅加到)[^,]*：/.test(l)).length, 3);
  const md = A.toMD(A.compute(D()), 'X');
  assert.ok(md.indexOf('**' + A.headline(A.compute(D())) + '**') > 0);
  assert.ok(md.indexOf('| 和面 | 面粉 500 克、水 250 克（含水率 50%）、其他 3%，损耗 3% | 面团 742 克 → 14 张 50 克的皮 |') > 0);
  assert.ok(md.indexOf('| 包 | 每个 50 + 40 克 | 14 个，剩面 42 克、剩馅 204 克 |') > 0);
});
