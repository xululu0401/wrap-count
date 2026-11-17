/* 称完馅再和面 · 界面（ui.js）：所有读数取自 core.js 同一次 compute 的 out */
'use strict';
(function () {
  var A = window.AppCore, KEY = 'wrap-count:v1', U = A.U;
  var $ = function (id) { return document.getElementById(id); };
  var FIELDS = A.FIELDS;
  var PRESETS = [
    { key: 'def', name: '肉包子', note: '默认（虚构）：面粉 500 克、含水率 50%，肉 500 克打水 100 克、葱 150 克，皮 50 克、馅 40 克。' },
    { key: 'jiaozi', name: '白菜猪肉饺子', note: '虚构示例：白菜 600 克挤水后剩 60%，饺子皮 10 克、馅 12 克。', f: function (s) {
      s.name = '白菜猪肉饺子'; s.flour = '500'; s.hyd = '50'; s.other = '0'; s.dLoss = '3';
      s.meat = '400'; s.mwater = '80'; s.veg = '600'; s.keep = '60'; s.season = '20'; s.fLoss = '2'; s.skin = '10'; s.fill = '12'; s.want = '';
    } },
    { key: 'veg', name: '素菜包', note: '虚构示例：只放菜和调料，菠菜 800 克挤水后剩 40%，想包 20 个。', f: function (s) {
      s.name = '素菜包'; s.flour = '600'; s.hyd = '52'; s.other = '4'; s.dLoss = '3';
      s.meat = '0'; s.mwater = '0'; s.veg = '800'; s.keep = '40'; s.season = '60'; s.fLoss = '3'; s.skin = '45'; s.fill = '35'; s.want = '20';
    } }
  ];
  var state, out, tmr;
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function presetState(k) { var s = A.defaultState(), p = PRESETS.filter(function (q) { return q.key === k; })[0]; if (p && p.f) p.f(s); return s; }
  function str(v, n) { return v == null || typeof v === 'object' ? '' : String(v).slice(0, n); }
  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState();
    FIELDS.forEach(function (k) { if (k in s) d[k] = str(s[k], k === 'name' ? 12 : 16); });
    return d;
  }
  function norm(s) { return JSON.stringify(sanitize(s)); }
  function presetKey(s) { var j = norm(s); for (var i = 0; i < PRESETS.length; i++) if (norm(presetState(PRESETS[i].key)) === j) return PRESETS[i].key; return null; }
  function load() { try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return j && j.state ? sanitize(j.state) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, state: state })); $('saveTag').textContent = '· 已自动存在本机'; } catch (e) { $('saveTag').textContent = '· 这台设备存不了，刷新会丢'; } }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  state = load() || A.defaultState();

  function fill() { FIELDS.forEach(function (k) { $(k).value = state[k]; }); }
  FIELDS.forEach(function (k) { $(k).addEventListener('input', function () { state[k] = this.value; schedule(); }); });
  function schedule() { clearTimeout(tmr); tmr = setTimeout(update, 80); }
  $('presets').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; state = presetState(b.getAttribute('data-p')); fill(); update(); });
  $('acts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !out.ok) return;
    var a = out.actions.filter(function (x) { return x.id === b.getAttribute('data-act'); })[0]; if (!a) return;
    state = A.applyChange(state, a); fill(); update();
  });

  function markErrors() {
    document.querySelectorAll('.bad').forEach(function (e) { e.classList.remove('bad'); });
    if (!out.ok) out.errors.forEach(function (er) { var el = $(er.field); if (el) el.classList.add('bad'); });
  }
  function renderPresets() {
    var key = presetKey(state);
    $('presets').innerHTML = PRESETS.map(function (p) { return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (key === p.key) + '">' + esc(p.name) + '</button>'; }).join('');
    var cur = PRESETS.filter(function (p) { return p.key === key; })[0];
    $('presetNote').textContent = cur ? cur.note : '你自己改过的条件（默认那组是虚构示例）。';
  }

  /* 皮馅配对条：一格一张皮 / 一份馅，按个数对齐；个数多时一格代表 k 个 */
  function pairModel(o) {
    var e = o.ev, P = o.P, mx = Math.max(e.nS, e.nF, 1), per = mx <= 40 ? 1 : Math.ceil(mx / 40);
    var cols = Math.ceil(mx / per) + 1;   /* 多一格放「剩的不够一个」那一截 */
    function lane(n, left, unit) {
      var c = [], full = Math.floor(n / per), part = n % per;
      for (var i = 0; i < cols; i++) c.push(i < full ? 'on' : (i === full && part) ? 'part' : 'x');
      return { cells: c, rest: left / (unit * U) };
    }
    return { per: per, cols: cols, d: lane(e.nS, e.leftD - (e.nS - e.n) * P.skin * U, P.skin), f: lane(e.nF, e.leftF - (e.nF - e.n) * P.fill * U, P.fill) };
  }
  function renderPair() {
    var o = out, e = o.ev, m = pairModel(o);
    function lane(cls, lb, L, n) {
      return '<div class="lane"><span class="lb">' + lb + '</span><div class="cells ' + cls + '">' + L.cells.map(function (c) { return '<i class="' + (c === 'on' ? '' : c) + '"></i>'; }).join('') + '</div><span class="ct">' + A.c(n) + (cls === 'ld' ? ' 张' : ' 个') + '</span></div>';
    }
    $('pair').innerHTML = lane('ld', '皮', m.d, e.nS) + lane('lf', '馅', m.f, e.nF) +
      '<p class="pairNote">一格 = ' + (m.per === 1 ? '1 个' : A.c(m.per) + ' 个（个数多，合并显示；浅色格不满 ' + A.c(m.per) + ' 个）') + '；两行齐的部分能包成，长出来的那截就是剩下的。</p>';
  }
  function renderSteps() {
    var o = out, P = o.P, e = o.ev;
    $('o1').innerHTML = '水 <b>' + A.g(e.water6) + '</b> 克 · 面团 <b>' + A.g(e.D) + '</b> 克<br>能擀 ' + A.c(e.nS) + ' 张 ' + P.skin + ' 克的皮';
    $('o2').innerHTML = '馅 <b>' + A.g(e.F) + '</b> 克<br>能包 ' + A.c(e.nF) + ' 份 ' + P.fill + ' 克的馅';
    $('o3').innerHTML = '能包 <b>' + A.c(e.n) + '</b> 个<br>剩面 ' + A.g(e.leftD) + ' 克 · 剩馅 ' + A.g(e.leftF) + ' 克';
  }
  function clearSteps() { ['o1', 'o2', 'o3'].forEach(function (k) { $(k).innerHTML = '<span class="muted">先改好标红的地方</span>'; }); }

  function render() {
    var o = out;
    $('errBox').classList.toggle('hide', o.ok); $('okBox').classList.toggle('hide', !o.ok);
    if (!o.ok) { clearSteps(); $('errBox').innerHTML = '先改好标红的地方：<ul>' + o.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>'; return; }
    $('headline').textContent = A.headline(o);
    $('why').textContent = A.explain(o);
    renderSteps(); renderPair();
    $('acts').innerHTML = o.actions.length ? o.actions.map(function (a) { return '<button type="button" class="act" id="' + a.id + '" data-act="' + a.id + '">→ ' + esc(a.text) + '</button>'; }).join('')
      : '<span class="muted">' + (o.ev.short === 'even' ? '面和馅一起用完，不用改。' : '在能填的范围里找不到改法。') + '</span>';
  }
  function update() { clearTimeout(tmr); out = A.compute(state); markErrors(); renderPresets(); render(); save(); }

  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function tag() { return out.ok ? '能包' + out.ev.n + '个' : '待改'; }
  $('dlCsv').addEventListener('click', function () { if (out.ok) download('称完馅再和面-用料与改法.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { if (out.ok) download('称完馅再和面-' + tag() + '.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () { download('称完馅再和面-备份.json', new Blob([JSON.stringify({ app: '称完馅再和面', slug: 'wrap-count', version: 1, exported_at: stamp(), state: state }, null, 2)], { type: 'application/json' })); });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { importText(String(rd.result)); }; rd.readAsText(f); this.value = ''; });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s) { $('impMsg').textContent = '这个文件读不出来，没改动。'; return false; }
    $('impMsg').textContent = '已导入。'; state = s; fill(); update(); return true;
  }
  $('reset').addEventListener('click', function () { state = A.defaultState(); $('impMsg').textContent = ''; fill(); update(); });

  /* 结果卡 PNG 1080×1350：文字与配对条取自同一次 out */
  function drawCard() {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), FF = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    g.fillStyle = '#f3efe8'; g.fillRect(0, 0, W, H); g.fillStyle = '#fffdf9'; g.fillRect(50, 50, W - 100, H - 100);
    var L = 100, Rr = W - 100, maxW = Rr - L, y = 150;
    function font(size, bold) { g.font = (bold ? '700 ' : '') + size + 'px ' + FF; }
    function clip(t, w) { t = String(t); if (g.measureText(t).width <= w) return t; while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
    function wrap(t, size, color, bold, lim) {
      font(size, bold); g.fillStyle = color; var cur = '', n = 0;
      var toks = String(t).match(/[0-9.,:]+ ?(?:克|个|张|%|倍)?[）)。，、；：]?|[（(「]?[^\s（(「][）)」。，、；：]?|\s/g) || [];
      for (var i = 0; i < toks.length; i++) { var ch = toks[i]; if (g.measureText(cur + ch).width > maxW && cur) { if (lim && ++n >= lim) { g.fillText(clip(cur + '…', maxW), L, y); y += size * 1.45; return; } g.fillText(cur, L, y); y += size * 1.45; cur = ch.trim() ? ch : ''; } else cur += ch; }
      if (cur) { g.fillText(cur, L, y); y += size * 1.45; }
    }
    font(54, true); g.fillStyle = '#2a2420'; g.fillText('称完馅再和面', L, y); y += 56;
    if (!out.ok) { font(42, true); g.fillStyle = '#a8372b'; g.fillText('还算不了', L, y + 20); y += 90; out.errors.slice(0, 10).forEach(function (e) { wrap('· ' + e.message, 28, '#5a4f47', false, 2); y += 6; }); y += 30; wrap('改好标红的地方，会自动重算。', 26, '#8f847b'); return cv; }
    var o = out, P = o.P, e = o.ev;
    font(26); g.fillStyle = '#8f847b'; g.fillText(clip(P.name + ' · 皮 ' + P.skin + ' 克 + 馅 ' + P.fill + ' 克', maxW), L, y); y += 110;
    font(96, true); g.fillStyle = '#2f6b4f'; var big = '能包 ' + A.c(e.n) + ' 个'; g.fillText(big, L, y);
    var w0 = g.measureText(big).width; font(34); g.fillStyle = '#5a4f47';
    g.fillText(clip(e.short === 'dough' ? '面先用完' : e.short === 'filling' ? '馅先用完' : '面和馅一起用完', maxW - w0 - 30), L + w0 + 30, y); y += 64;
    wrap(A.headline(o), 29, '#2a2420', true, 3); y += 16;
    /* 三步 */
    var bw = (maxW - 40) / 3, rows = [['1 和面', '面团 ' + A.g(e.D) + ' 克', A.c(e.nS) + ' 张皮', '#f7ecd6'], ['2 拌馅', '馅 ' + A.g(e.F) + ' 克', A.c(e.nF) + ' 份馅', '#f1d5c9'], ['3 包', '剩面 ' + A.g(e.leftD) + ' 克', '剩馅 ' + A.g(e.leftF) + ' 克', '#dcefe4']];
    rows.forEach(function (r, i) {
      var x = L + i * (bw + 20); g.fillStyle = r[3]; g.fillRect(x, y, bw, 150);
      font(24, true); g.fillStyle = '#2a2420'; g.fillText(r[0], x + 20, y + 40);
      font(26); g.fillText(clip(r[1], bw - 40), x + 20, y + 86); g.fillText(clip(r[2], bw - 40), x + 20, y + 126);
    });
    y += 200;
    /* 配对条 */
    var m = pairModel(o), cw = (maxW - 160) / m.cols;
    [['皮', m.d, '#e9cf9f', A.c(e.nS) + ' 张'], ['馅', m.f, '#b5583a', A.c(e.nF) + ' 个']].forEach(function (r) {
      font(26, true); g.fillStyle = '#5a4f47'; g.fillText(r[0], L, y + 28);
      r[1].cells.forEach(function (c, i) {
        var x = L + 50 + i * cw;
        if (c === 'x') { g.strokeStyle = '#e2d9cd'; g.setLineDash([4, 4]); g.strokeRect(x + 1, y + 2, cw - 4, 32); g.setLineDash([]); }
        else { g.globalAlpha = c === 'part' ? 0.4 : 1; g.fillStyle = r[2]; g.fillRect(x + 1, y + 2, cw - 4, 32); g.globalAlpha = 1; }
      });
      font(24); g.fillStyle = '#2a2420'; g.fillText(r[3], L + 50 + m.cols * cw + 10, y + 28);
      y += 50;
    });
    font(20); g.fillStyle = '#8f847b'; g.fillText('一格 = ' + A.c(m.per) + ' 个；两行齐的部分能包成', L, y + 10); y += 60;
    if (o.actions.length) { font(28, true); g.fillStyle = '#2a2420'; g.fillText('改一样试试', L, y); y += 44; o.actions.slice(0, 4).forEach(function (a) { wrap('→ ' + a.text, 25, '#2f6b4f', false, 2); y += 4; }); }
    else wrap(A.explain(o), 24, '#5a4f47', false, 4);
    y = Math.max(y + 10, H - 140);
    wrap('按重量的粗算：不算发酵、蒸煮后的重量变化，菜出水只按「挤水后剩」估。默认数字为虚构示例。', 20, '#8f847b', false, 2);
    return cv;
  }
  $('dlPng').addEventListener('click', function () { drawCard().toBlob(function (bl) { if (bl) download('称完馅再和面-' + tag() + '-1080x1350.png', bl); }, 'image/png'); });

  window.__wcUi = { state: function () { return clone(state); }, out: function () { return out; }, importText: importText, drawCard: drawCard, storageKey: KEY };
  fill(); update();
})();
