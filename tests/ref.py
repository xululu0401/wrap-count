#!/usr/bin/env python3
"""称完馅再和面 · 独立参考实现（按需求简报文字规则重写，不读 core.js）。
用 Fraction 直接算克数（百分比 / 100），不用 core.js 的「微克整数」。
生成 300 组随机场景 → tests/ref.json。
规则：
  面团 D = 面粉 × (1 + 含水率 + 其他) × (1 − 面损耗)
  馅 F = (肉 + 打水 + 菜 × 挤后剩 + 调料) × (1 − 馅损耗)
  nS = ⌊D / 皮⌋，nF = ⌊F / 馅⌋，n = min
  补面粉：最小整数 f（≤ 20000）使 ⌊D(f) / 皮⌋ ≥ 目标，用线性逐个找（不用闭式猜测）
  补馅：最小整数百分比 p > 100，各项 ⌈x·p/100⌉ 后 ⌊F / 馅⌋ ≥ 目标，任一项超上限即放弃
"""
import json, random
from fractions import Fraction as F
from math import floor, ceil

MAXG = {'meat': 20000, 'mwater': 10000, 'veg': 20000, 'season': 5000}


def pct(s):
    return F(s) / 100


def dough(st, flour=None):
    fl = F(st['flour'] if flour is None else flour)
    return fl * (1 + pct(st['hyd']) + pct(st['other'])) * (1 - pct(st['dLoss']))


def filling(st, q=None):
    q = q or {k: int(st[k]) for k in MAXG}
    raw = q['meat'] + q['mwater'] + F(q['veg']) * pct(st['keep']) + q['season']
    return raw * (1 - pct(st['fLoss']))


def min_flour(st, target):
    sk = int(st['skin'])
    for f in range(1, 20001):
        if floor(dough(st, f) / sk) >= target:
            return f
    return None


def min_scale(st, target):
    fl = int(st['fill'])
    for p in range(101, 100001):
        q = {k: ceil(F(int(st[k]) * p, 100)) for k in MAXG}
        if any(q[k] > MAXG[k] for k in MAXG):
            return None
        if floor(filling(st, q) / fl) >= target:
            return p, q
    return None


def evaluate(st):
    D, Fi = dough(st), filling(st)
    sk, fl = int(st['skin']), int(st['fill'])
    nS, nF = floor(D / sk), floor(Fi / fl)
    n = min(nS, nF)
    return {'D': D, 'F': Fi, 'nS': nS, 'nF': nF, 'n': n, 'leftD': D - n * sk, 'leftF': Fi - n * fl}


def rnd_pct(r, lo, hi):
    x = r.randint(lo * 10, hi * 10)
    return str(x // 10) if x % 10 == 0 else '%d.%d' % (x // 10, x % 10)


def case(r):
    kind = r.random()
    st = {
        'name': 'x', 'flour': str(r.randint(50, 3000)), 'hyd': rnd_pct(r, 30, 80), 'other': rnd_pct(r, 0, 8) if r.random() < .7 else '0',
        'dLoss': rnd_pct(r, 0, 8), 'meat': str(r.randint(0, 1500)) if kind > .15 else '0', 'mwater': str(r.randint(0, 300)) if r.random() < .6 else '0',
        'veg': str(r.randint(0, 1500)), 'keep': rnd_pct(r, 30, 100), 'season': str(r.randint(0, 120)), 'fLoss': rnd_pct(r, 0, 8),
        'skin': str(r.choice([8, 10, 12, 15, 25, 40, 45, 50, 60, r.randint(1, 120)])), 'fill': str(r.choice([10, 12, 15, 20, 30, 35, 40, 50, r.randint(1, 150)])),
        'want': str(r.randint(1, 200)) if r.random() < .4 else '',
    }
    if all(st[k] == '0' for k in MAXG):
        st['veg'] = '200'
    return st


def main():
    r = random.Random(20261118)
    cases = []
    stats = {'dough_short': 0, 'fill_short': 0, 'even': 0, 'zero': 0, 'want_unmet': 0}
    while len(cases) < 300:
        st = case(r)
        e = evaluate(st)
        x = {'nS': e['nS'], 'nF': e['nF'], 'n': e['n'], 'D': float(e['D']), 'F': float(e['F']), 'leftD': float(e['leftD']), 'leftF': float(e['leftF'])}
        if e['nS'] < e['nF']:
            stats['dough_short'] += 1
            x['minFlour'] = min_flour(st, e['nF'])
        elif e['nF'] < e['nS']:
            stats['fill_short'] += 1
            m = min_scale(st, e['nS'])
            x['minScale'] = m and [m[0], m[1]]
        else:
            stats['even'] += 1
        if e['n'] == 0:
            stats['zero'] += 1
        if st['want'] and e['n'] < int(st['want']):
            stats['want_unmet'] += 1
            w = int(st['want'])
            x['wantFlour'] = min_flour(st, w) if e['nS'] < w else 'ok'
            m = min_scale(st, w) if e['nF'] < w else None
            x['wantScale'] = (m and [m[0], m[1]]) if e['nF'] < w else 'ok'
        cases.append({'state': st, 'expect': x})
    json.dump({'stats': stats, 'cases': cases}, open(__file__.replace('ref.py', 'ref.json'), 'w'), ensure_ascii=False)
    print(stats)


if __name__ == '__main__':
    main()
