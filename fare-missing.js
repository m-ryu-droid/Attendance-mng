/* ══════════════════════════════════════════
   交通費が未入力の日を、打刻タブの「交通費・備考」に出す
   script.js には手を入れず、updateButtonStates を包んで連動させる。
   データは history.js の取得処理（暗証番号つき）を使う。
   暗証番号を入れていない端末では案内だけを出し、他人の勤怠は一切表示しない。
   ══════════════════════════════════════════ */

const FM_WD = {
  ja: ['日', '月', '火', '水', '木', '金', '土'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
};

let fmName = '';        // いま未入力リストを持っている名前
let fmState = 'idle';   // idle / loading / ready / locked / error
let fmMissing = [];     // 'yyyy/MM/dd'（新しい日が先）

function fmText(ja, en) { return lang === 'ja' ? ja : en; }

function fmToday() {
  return toInputDate(new Date()).replace(/-/g, '/');
}

function fmLabel(s) {
  const d = histDate(s);
  if (!d) return s;
  const wd = FM_WD[lang][d.getDay()];
  const md = (d.getMonth() + 1) + '/' + d.getDate();
  return lang === 'ja' ? md + '（' + wd + '）' : wd + ' ' + md;
}

/* ── 取得 ── */
async function fmFetch() {
  const name = fmName;
  const pin = histLoadPin(name);
  if (!name || !pin) {
    fmState = 'locked';
    fmRender();
    return;
  }

  fmState = 'loading';
  const now = new Date();
  const month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  try {
    const res = await histJsonp({ action: 'history', name, pin, month });
    if (name !== fmName) return;   // 取得中に名前が変わった

    if (res && res.ok) {
      fmApplyRows(name, res.rows || []);
      return;
    }
    if (res && (res.error === 'unauthorized' || res.error === 'pin_not_set')) {
      histClearPin();
      fmState = 'locked';
    } else {
      fmState = 'error';
    }
  } catch (e) {
    if (name !== fmName) return;
    fmState = 'error';
  }
  fmRender();
}

/* 勤怠タブで取得した行も同じ関数で取り込む */
function fmApplyRows(name, rows) {
  if (name !== fmName) return;
  fmMissing = rows
    .filter(histNoFare)
    .map(r => r.date)
    .sort()
    .reverse();
  fmState = 'ready';
  fmRender();
}

/* 少し待ってから取り直す（送信直後はシートへの反映待ちがあるため） */
function fmRefreshSoon() {
  setTimeout(() => { if (fmName) fmFetch(); }, 1500);
}

/* ── 描画 ── */
function fmRender() {
  const card = document.getElementById('commute-card');
  const pill = document.getElementById('fare-pill');
  const box = document.getElementById('miss-box');
  if (!card || !pill || !box) return;

  const hasName = !!fmName;
  const showList = hasName && fmState === 'ready' && fmMissing.length > 0;
  const showHint = hasName && fmState === 'locked';

  pill.hidden = !showList;
  card.classList.toggle('has-miss', showList);
  if (showList) {
    pill.textContent = fmText('未入力 ' + fmMissing.length + '日', fmMissing.length + ' missing');
  }

  box.hidden = !(showList || showHint);

  if (showList) {
    const picked = (document.getElementById('fare-date') || {}).value || '';
    box.innerHTML =
      '<div class="miss-label">' + fmText('未入力の日（押すと対象日に入ります）', 'Days without fare (tap to select)') + '</div>'
      + '<div class="miss-chips">'
      + fmMissing.map(d =>
          '<button type="button" class="miss-chip' + (d.replace(/\//g, '-') === picked ? ' on' : '')
          + '" onclick="fmPick(\'' + d + '\')">' + fmLabel(d) + '</button>').join('')
      + '</div>';
  } else if (showHint) {
    box.innerHTML =
      '<div class="miss-hint">'
      + fmText('未入力の日を表示するには、暗証番号の入力が必要です。', 'Enter your PIN to see days without fare.')
      + ' <button type="button" class="miss-hint-btn" onclick="switchTab(\'history\')">'
      + fmText('入力する', 'Enter PIN') + '</button></div>';
  } else {
    box.innerHTML = '';
  }
}

/* ── 操作 ── */
function fmPick(date) {
  const el = document.getElementById('fare-date');
  if (!el) return;
  el.value = date.replace(/\//g, '-');
  fmRender();
  updateButtonStates();
  const go = document.getElementById('fare-go');
  if (go) go.focus();
}

/* 勤怠タブの一覧から「この日の交通費を入力する」で飛んでくる */
function fmGoEnter(date) {
  switchTab('punch');
  document.getElementById('commute-card').classList.add('open');
  fmPick(date);
  document.getElementById('commute-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* 交通費の送信に成功したとき（fare-date.js から呼ばれる） */
function fmOnFareSent(date, extras) {
  const d = String(date || '').replace(/-/g, '/');
  const sentFare = Number((extras || {}).fareTotal) > 0;

  if (sentFare) {
    fmMissing = fmMissing.filter(x => x !== d);
  }

  // 過去の日の分は、入力欄を空にして対象日を今日に戻す（次の日をすぐ選べるように）。
  // 今日の分は消さない。退勤時に空のまま送ると、シートの交通費が0に戻ってしまうため。
  if (d !== fmToday()) {
    ['fare-go', 'fare-return', 'memo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    selectedCommuteFiles = [];
    const fileInp = document.getElementById('file-inp');
    if (fileInp) fileInp.value = '';
    updateFileSummary();
    renderFilePreviews();
    const picker = document.getElementById('fare-date');
    if (picker) picker.value = toInputDate(new Date());
    updateButtonStates();
  }

  fmRender();
  fmRefreshSoon();
}

/* 退勤できたとき（punch-ui.js から呼ばれる）。交通費なしで退勤したら、今日を未入力に加える */
function fmOnCheckoutDone(hadFare) {
  if (fmState === 'ready' && !hadFare) {
    const t = fmToday();
    if (!fmMissing.includes(t)) fmMissing.unshift(t);
  }
  fmRender();
  fmRefreshSoon();
}

/* ── 状態との連動 ── */
function fmSync() {
  const el = document.getElementById('sel-name');
  const name = el ? el.value : '';
  if (name === fmName) return;

  fmName = name;
  fmMissing = [];
  fmState = 'idle';
  fmRender();   // 前の人の表示を先に消す
  if (name) fmFetch();
}

const fmPrevUpdateButtonStates = updateButtonStates;
updateButtonStates = function() {
  fmPrevUpdateButtonStates();
  fmSync();
};

const fmPrevApplyTranslations = applyTranslations;
applyTranslations = function() {
  fmPrevApplyTranslations();
  fmRender();
};

document.addEventListener('DOMContentLoaded', () => {
  const picker = document.getElementById('fare-date');
  if (picker) picker.addEventListener('change', fmRender);
});

fmSync();
