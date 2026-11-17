/* ══════════════════════════════════════════
   打刻画面の改善
   ・状態バッジに経過時間を出す（出勤中 3時間12分 / 休憩中 12分）
   ・休憩ボタンを1つにする（休憩する → 休憩を終わる → 休憩済み）
   ・退勤時に交通費が空なら、その場で確認する
   script.js には手を入れず、関数を包む／差し替えることで実現する。
   ══════════════════════════════════════════ */

Object.assign(i18n.ja, { fareDate: '対象日' });
Object.assign(i18n.en, { fareDate: 'Date' });

function punchById(id) { return document.getElementById(id); }

/* ── 時刻の計算（日をまたぐ勤務を考えて、差は24時間で巻き戻す） ── */
function punchMin(t) {
  const m = /(\d{1,2}):(\d{2})/.exec(t || '');
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}

function punchNowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function punchDiff(from, to) {
  return (to - from + 1440) % 1440;
}

function punchDur(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (lang === 'ja') return h > 0 ? h + '時間' + mm + '分' : mm + '分';
  return h > 0 ? h + 'h ' + mm + 'm' : mm + 'm';
}

/* 休憩を除いた勤務時間（分） */
function punchWorkedMin() {
  const ci = punchMin(times['出勤']);
  if (ci === null) return 0;

  const co = punchMin(times['退勤']);
  const end = co !== null ? co : punchNowMin();
  let total = punchDiff(ci, end);

  const bs = punchMin(times['休憩開始']);
  if (bs !== null) {
    const be = punchMin(times['休憩終了']);
    const brk = punchDiff(bs, be !== null ? be : end);
    total -= Math.min(brk, total);
  }
  return Math.max(0, total);
}

/* ── 状態バッジ（経過時間つき） ── */
updateStateBadge = function() {
  const ci = !!times['出勤'];
  const co = !!times['退勤'];
  const bs = !!times['休憩開始'];
  const be = !!times['休憩終了'];
  const onBreak = bs && !be;
  const badge = punchById('state-badge');
  const txt = punchById('state-badge-text');
  if (!badge || !txt) return;

  badge.className = 'status-badge';
  if (co) {
    badge.classList.add('s-co');
    txt.textContent = lang === 'ja' ? '退勤済み' : 'Clocked Out';
  } else if (onBreak) {
    badge.classList.add('s-br');
    txt.textContent = (lang === 'ja' ? '休憩中 ' : 'On Break ')
      + punchDur(punchDiff(punchMin(times['休憩開始']), punchNowMin()));
  } else if (ci) {
    badge.classList.add('s-ci');
    txt.textContent = (lang === 'ja' ? '出勤中 ' : 'Working ') + punchDur(punchWorkedMin());
  } else {
    badge.classList.add('s-none');
    txt.textContent = lang === 'ja' ? '未出勤' : 'Before Work';
  }
};

/* ── 休憩ボタン（1つ） ── */
function punchBreakTap() {
  const onBreak = !!times['休憩開始'] && !times['休憩終了'];
  record(onBreak ? '休憩終了' : '休憩開始');
}

function punchBreakRender() {
  const btn = punchById('btn-brk');
  if (!btn) return;

  const ci = !!times['出勤'];
  const co = !!times['退勤'];
  const bs = times['休憩開始'];
  const be = times['休憩終了'];
  const onBreak = !!bs && !be;

  let title, sub, go, disabled;
  if (onBreak) {
    title = lang === 'ja' ? '休憩を終わる' : 'End break';
    sub = lang === 'ja' ? bs + ' から休憩中' : 'On break since ' + bs;
    go = lang === 'ja' ? '押して終了 ›' : 'Tap to end ›';
    disabled = co;
  } else if (be) {
    title = lang === 'ja' ? '休憩済み' : 'Break done';
    sub = bs + ' 〜 ' + be;
    go = '✓';
    disabled = true;
  } else {
    title = lang === 'ja' ? '休憩する' : 'Take a break';
    sub = ci && !co
      ? (lang === 'ja' ? 'まだ休憩していません' : 'No break yet')
      : (lang === 'ja' ? '出勤後に押せます' : 'Available after clock-in');
    go = '›';
    disabled = !ci || co;
  }

  btn.disabled = disabled;
  btn.classList.toggle('on', onBreak);
  btn.classList.toggle('done', !!be);
  punchById('brk-t').textContent = title;
  punchById('brk-s').textContent = sub;
  punchById('brk-go').textContent = go;
}

function punchRender() {
  punchBreakRender();

  // 休憩中は退勤できない（休憩終了の押し忘れを防ぐ）
  const onBreak = !!times['休憩開始'] && !times['休憩終了'];
  const co = punchById('btn-co');
  if (co && onBreak) co.disabled = true;
}

const punchPrevUpdateButtonStates = updateButtonStates;
updateButtonStates = function() {
  punchPrevUpdateButtonStates();
  punchRender();
};

const punchPrevApplyTranslations = applyTranslations;
applyTranslations = function() {
  punchPrevApplyTranslations();
  punchRender();
};

/* ── 退勤の確認（交通費が空なら、その場で聞く） ── */

/* 交通費欄の対象日が今日か（空なら今日扱い） */
function punchFareIsToday() {
  const v = (punchById('fare-date') || {}).value || '';
  return !v || v === toInputDate(new Date());
}

function punchFareFilled() {
  return (punchById('fare-go').value.trim() !== '') || (punchById('fare-return').value.trim() !== '');
}

function punchSummaryText() {
  const worked = punchDur(punchWorkedMin());
  const bs = times['休憩開始'];
  const be = times['休憩終了'];
  const brk = bs && be ? bs + '〜' + be : (lang === 'ja' ? 'なし' : 'none');
  return lang === 'ja'
    ? '勤務 ' + worked + ' ／ 休憩 ' + brk
    : 'Worked ' + worked + ' / Break ' + brk;
}

function punchCoBtn(cls, label, action) {
  return '<button type="button" class="co-btn ' + cls + '" onclick="' + action + '">' + label + '</button>';
}

function punchRenderCheckoutModal(variant) {
  const warn = punchById('co-warn');
  const btns = punchById('co-btns');
  const cancel = punchCoBtn('txt', lang === 'ja' ? 'キャンセル' : 'Cancel', 'closeModal()');

  if (variant === 'ok') {
    warn.hidden = true;
    btns.innerHTML =
      punchCoBtn('red', lang === 'ja' ? '退勤する' : 'Clock Out', 'doCheckout()') + cancel;
    return;
  }

  warn.hidden = false;
  if (variant === 'other') {
    const picked = (punchById('fare-date') || {}).value.replace(/-/g, '/');
    punchById('co-warn-t').textContent = lang === 'ja'
      ? '入力中の交通費は ' + fmLabel(picked) + ' の分です'
      : 'The fare you entered is for ' + fmLabel(picked);
    punchById('co-warn-s').textContent = lang === 'ja' ? 'まだ送信されていません' : 'It has not been sent yet';
    btns.innerHTML =
      punchCoBtn('pri', lang === 'ja' ? '先に送信する' : 'Send it first', 'punchGoSend()')
      + punchCoBtn('sec', lang === 'ja' ? '入力を破棄して退勤する' : 'Discard it and clock out', 'doCheckout()')
      + cancel;
    return;
  }

  punchById('co-warn-t').textContent = lang === 'ja' ? '今日の交通費が未入力です' : "Today's commute fare is empty";
  punchById('co-warn-s').textContent = lang === 'ja' ? 'あとからでも送信できます' : 'You can send it later';
  btns.innerHTML =
    punchCoBtn('pri', lang === 'ja' ? '交通費を入力する' : 'Enter fare', 'punchGoFare()')
    + punchCoBtn('sec', lang === 'ja' ? 'あとで入れて退勤する' : 'Clock out and enter later', 'doCheckout()')
    + cancel;
}

confirmCheckout = function() {
  punchById('modal-time').textContent = getNow();
  punchById('modal-sum').textContent = punchSummaryText();

  let variant = 'none';
  if (punchFareIsToday() && punchFareFilled()) variant = 'ok';
  else if (!punchFareIsToday() && isSupplementalReady()) variant = 'other';

  punchRenderCheckoutModal(variant);
  punchById('modal').classList.add('show');
};

/* 交通費を入力する：対象日を今日に戻して、入力欄を開く */
function punchGoFare() {
  closeModal();
  const picker = punchById('fare-date');
  if (picker) picker.value = toInputDate(new Date());
  punchById('commute-card').classList.add('open');
  fmRender();
  updateButtonStates();
  const go = punchById('fare-go');
  if (go) {
    go.scrollIntoView({ block: 'center', behavior: 'smooth' });
    go.focus();
  }
}

/* 先に送信する：入力欄を開いて送信ボタンまで移動する */
function punchGoSend() {
  closeModal();
  punchById('commute-card').classList.add('open');
  const b = punchById('supp-btn');
  if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/* script.js の doCheckout とほぼ同じ。違いは次の2点だけ。
   ・入力欄が今日以外の日の分なら、今日の退勤には付けない（別の日の行に入ってしまうため）
   ・退勤できたら、交通費の有無を未入力リストに知らせる */
doCheckout = async function() {
  closeModal();
  const t = getNow();
  times['退勤'] = t;
  punchById('sending-overlay').classList.add('show');

  try {
    const attach = isSupplementalReady() && punchFareIsToday();
    const checkoutExtras = attach
      ? await collectSupplementalExtras()
      : emptyCheckoutExtras();
    await sendToGAS('退勤', null, checkoutExtras);
    punchById('sending-overlay').classList.remove('show');
    updateButtonStates();
    updateStatusUI();
    showToast(i18n[lang].toastCheckout, 'ok');
    if (typeof fmOnCheckoutDone === 'function') {
      fmOnCheckoutDone(Number(checkoutExtras.fareTotal) > 0);
    }
    setTimeout(() => resetAll(), 2500);
  } catch (e) {
    punchById('sending-overlay').classList.remove('show');
    times['退勤'] = null;
    showToast(i18n[lang].toastFail, 'ng');
  }
};

/* 退勤後のリセットで、交通費の対象日も今日に戻す（過去の日付が残ると次の入力が別の日に入ってしまう） */
const punchPrevResetAll = resetAll;
resetAll = function() {
  punchPrevResetAll();
  const picker = punchById('fare-date');
  if (picker) picker.value = toInputDate(new Date());
  fmRender();
};

/* 経過時間を1分単位で更新する */
setInterval(() => updateStateBadge(), 20000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateStateBadge();
});

/* 追加した文言と新しい表示を反映する */
applyTranslations();
updateButtonStates();
