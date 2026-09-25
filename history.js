/* ══════════════════════════════════════════
   今月の勤怠タブ
   script.js には手を入れず、この1ファイルで完結させる
   ══════════════════════════════════════════ */

const HIST_GAS_URL = (typeof GAS_URL !== 'undefined')
  ? GAS_URL
  : 'https://script.google.com/macros/s/AKfycbyWKD4_y9s8mwI87wYtXtoM-0bbO-cTGO2mf4xN4DNmv1vNd3e1LmpCJ0iKqVAbDRy5/exec';

const HIST_PIN_KEY = 'kintai_pin_v1';
const HIST_WD = ['日', '月', '火', '水', '木', '金', '土'];

let histName = '';
let histPin = '';
let histLoaded = false;

/* ── タブ切り替え ── */
function switchTab(tab) {
  document.getElementById('tab-btn-punch').classList.toggle('active', tab === 'punch');
  document.getElementById('tab-btn-history').classList.toggle('active', tab === 'history');
  document.getElementById('tab-punch').classList.toggle('active', tab === 'punch');
  document.getElementById('tab-history').classList.toggle('active', tab === 'history');
  window.scrollTo(0, 0);
  if (tab === 'history') enterHistory();
}

function enterHistory() {
  const sel = document.getElementById('sel-name');
  const name = sel ? sel.value : '';

  if (!name) {
    histShow('hist-noname');
    return;
  }

  // 名前が変わったら読み込み状態をリセット
  if (name !== histName) {
    histName = name;
    histLoaded = false;
    histPin = histLoadPin(name);
  }

  document.getElementById('gate-name').textContent = histName;
  document.getElementById('hist-name').textContent = histName + ' さん';

  if (histLoaded) {
    histShow('hist-main');
  } else if (histPin) {
    histLoad();
  } else {
    histShow('hist-gate');
    document.getElementById('gate-err').textContent = '';
  }
}

function histShow(id) {
  ['hist-noname', 'hist-gate', 'hist-loading', 'hist-main'].forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle('hist-hide', v !== id);
  });
}

/* ── 暗証番号の保存 ── */
function histLoadPin(name) {
  try {
    const raw = localStorage.getItem(HIST_PIN_KEY);
    if (!raw) return '';
    const obj = JSON.parse(raw);
    return (obj && obj.name === name) ? obj.pin : '';
  } catch (e) { return ''; }
}

function histSavePin(name, pin) {
  try { localStorage.setItem(HIST_PIN_KEY, JSON.stringify({ name, pin })); } catch (e) {}
}

function histClearPin() {
  try { localStorage.removeItem(HIST_PIN_KEY); } catch (e) {}
}

/* ── JSONP ── */
function histJsonp(params) {
  return new Promise((resolve, reject) => {
    const cb = 'kcb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const s = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 20000);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cb]; } catch (e) { window[cb] = undefined; }
      if (s.parentNode) s.parentNode.removeChild(s);
    }

    window[cb] = (data) => { cleanup(); resolve(data); };
    s.onerror = () => { cleanup(); reject(new Error('network')); };
    s.src = HIST_GAS_URL + '?' + new URLSearchParams(Object.assign({}, params, { callback: cb }));
    document.body.appendChild(s);
  });
}

/* ── 読み込み ── */
async function histLoad() {
  histShow('hist-loading');

  const now = new Date();
  const month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  try {
    const res = await histJsonp({
      action: 'history',
      name: histName,
      pin: histPin,
      month: month
    });

    if (!res || !res.ok) {
      const err = res ? res.error : 'failed';

      if (err === 'unauthorized' || err === 'pin_not_set') {
        histPin = '';
        histClearPin();
        histShow('hist-gate');
        document.getElementById('gate-err').textContent =
          err === 'pin_not_set'
            ? '暗証番号が未設定です。管理者にご連絡ください'
            : '暗証番号が違います';
        document.getElementById('pin-inp').value = '';
        document.getElementById('gate-btn').disabled = true;
        return;
      }
      throw new Error(err);
    }

    histSavePin(histName, histPin);
    histLoaded = true;
    histRender(res, now);
    histShow('hist-main');

  } catch (e) {
    histShow('hist-main');
    document.getElementById('day-list').innerHTML =
      '<div class="hist-empty">読み込みに失敗しました。<br>通信環境を確認して、もう一度お試しください。</div>';
    document.getElementById('list-cnt').textContent = '';
    document.getElementById('fare-alert').classList.add('hist-hide');
  }
}

/* ── 描画 ── */
function histRender(res, now) {
  const rows = res.rows || [];
  const sum = res.summary || {};

  document.getElementById('hist-month').textContent = now.getFullYear() + '年 ' + (now.getMonth() + 1) + '月';
  document.getElementById('s-days').innerHTML  = (sum.days || 0) + '<span class="unit">日</span>';
  document.getElementById('s-hours').innerHTML = histH(sum.hours) + '<span class="unit">h</span>';
  document.getElementById('s-ot').innerHTML    = histH(sum.overtime) + '<span class="unit">h</span>';
  document.getElementById('s-nt').innerHTML    = histH(sum.night) + '<span class="unit">h</span>';
  document.getElementById('list-cnt').textContent = rows.length + '件';

  // 交通費の未入力（確定した日だけを対象にする）
  const noFare = rows.filter(r => r.status === 'done' && r.fare === null);
  const alertEl = document.getElementById('fare-alert');
  if (noFare.length) {
    alertEl.classList.remove('hist-hide');
    document.getElementById('fare-alert-txt').textContent =
      noFare.map(r => histMd(r.date)).join('、') + ' の交通費がまだ送信されていません。';
  } else {
    alertEl.classList.add('hist-hide');
  }

  const list = document.getElementById('day-list');
  if (!rows.length) {
    list.innerHTML = '<div class="hist-empty">今月の記録はまだありません。</div>';
    return;
  }

  list.innerHTML = rows.map(histDayHtml).join('');
  list.querySelectorAll('.day-head').forEach(el => {
    el.addEventListener('click', () => el.parentElement.classList.toggle('open'));
  });
}

function histDayHtml(r) {
  const d = histDate(r.date);
  const wd = d ? HIST_WD[d.getDay()] : '';
  const wdCls = !d ? '' : (d.getDay() === 0 ? ' sun' : (d.getDay() === 6 ? ' sat' : ''));
  const done    = r.status === 'done';
  const working = r.status === 'working';
  const fareOnly = r.status === 'partial' && r.fare !== null;

  const tags = [];
  if (fareOnly) tags.push('<span class="tag br">交通費のみ</span>');
  if (r.overtime > 0) tags.push('<span class="tag ot">残業 ' + histH(r.overtime) + 'h</span>');
  if (r.night > 0)    tags.push('<span class="tag nt">深夜 ' + histH(r.night) + 'h</span>');
  if (r.breakstart && r.breakend) tags.push('<span class="tag br">休憩あり</span>');
  if (done && r.fare === null) tags.push('<span class="tag no-fare">交通費なし</span>');

  const det = [];
  if (!done) {
    det.push('<div class="hist-empty" style="padding:10px 0;font-size:12px;">'
      + (working
          ? '退勤するとこの日の記録が確定します。'
          : '打刻の記録がありません。' + (fareOnly ? '交通費のみ送信されています。' : ''))
      + '</div>');
    if (r.fare !== null) {
      det.push(histRow('var(--blue)', '交通費', histYen(r.fare) + '円'));
    }
  } else {
    det.push(histRow('var(--green)', '出勤', r.checkin || '—'));
    if (r.breakstart) det.push(histRow('#D97706', '休憩開始', histNx(r.breakstart, r.checkin)));
    if (r.breakend)   det.push(histRow('#7C3AED', '休憩終了', histNx(r.breakend, r.checkin)));
    if (!r.breakstart && !r.breakend) det.push(histRow('#D97706', '休憩', '<span class="det-v na">なし</span>', true));
    det.push(histRow('var(--red)', '退勤', histNx(r.checkout, r.checkin)));
    if (r.night > 0) det.push(histRow('#7C3AED', '深夜時間', histH(r.night) + ' h'));
    det.push(histRow('var(--blue)', '交通費',
      r.fare === null ? '<span class="det-v warn">未入力</span>' : histYen(r.fare) + '円',
      r.fare === null));
  }

  const timeTxt = done
    ? (r.checkin || '—') + ' &rarr; ' + histNx(r.checkout, r.checkin)
    : (working ? '<span style="color:var(--green)">勤務中</span>' : '打刻なし');

  return '<div class="day">'
    + '<div class="day-head">'
    +   '<div class="day-date"><div class="day-d">' + (d ? d.getDate() : '—') + '</div>'
    +   '<div class="day-w' + wdCls + '">' + wd + '</div></div>'
    +   '<div class="day-mid">'
    +     '<div class="day-time">' + timeTxt + '</div>'
    +     (tags.length ? '<div class="day-tags">' + tags.join('') + '</div>' : '')
    +   '</div>'
    +   '<div class="day-right"><div class="day-h">'
    +     (done ? (Number(r.hours) || 0).toFixed(2) : '—') + '</div>'
    +   '<div class="day-hu">時間</div></div>'
    +   '<div class="day-chev">&#8964;</div>'
    + '</div>'
    + '<div class="day-body">' + det.join('') + '</div>'
    + '</div>';
}

function histRow(color, label, value, raw) {
  return '<div class="det-row">'
    + '<div class="det-l"><span class="det-dot" style="background:' + color + '"></span>' + label + '</div>'
    + (raw ? value : '<div class="det-v">' + value + '</div>')
    + '</div>';
}

/* ── ヘルパー ── */
function histH(v) {
  const n = Number(v);
  if (!isFinite(n) || n === 0) return '0';
  const s = (Math.round(n * 100) / 100).toFixed(2);
  return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function histYen(v) { return Number(v).toLocaleString('ja-JP'); }

function histDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function histMd(s) {
  const d = histDate(s);
  return d ? (d.getMonth() + 1) + '/' + d.getDate() : s;
}

/* 出勤時刻より前の時刻は翌日扱い */
function histNx(t, ci) {
  if (!t) return '—';
  if (!ci) return t;
  return histMin(t) < histMin(ci) ? '翌 ' + t : t;
}

function histMin(t) {
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : 0;
}

/* ── イベント ── */
document.addEventListener('DOMContentLoaded', () => {
  histShow('hist-noname');

  const pin = document.getElementById('pin-inp');
  const btn = document.getElementById('gate-btn');

  pin.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '');
    btn.disabled = e.target.value.length < 4;
    document.getElementById('gate-err').textContent = '';
  });

  pin.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btn.disabled) { e.preventDefault(); histSubmitPin(); }
  });

  btn.addEventListener('click', histSubmitPin);

  document.getElementById('lock-btn').addEventListener('click', () => {
    histClearPin();
    histPin = '';
    histLoaded = false;
    pin.value = '';
    btn.disabled = true;
    document.getElementById('gate-err').textContent = '';
    histShow('hist-gate');
  });
});

function histSubmitPin() {
  histPin = document.getElementById('pin-inp').value;
  histLoad();
}
