const GAS_URL = 'https://script.google.com/macros/s/AKfycbwFxb8y24H2ZMPpy1dQL56b_VgwtBC4J3fO9LUtkVTO23oZ-aG2M91q98kRhC8htTLy/exec';
const STORAGE_KEY = 'kintai_v2';
const DEFAULT_NAME_KEY = 'kintai_default_name_v1';
const FALLBACK_NAMES = [
  '奥田ロレーン',
  '尾棹大朗',
  'ルイ・ワイチェック'
];

const i18n = {
  ja: {
    title: '勤怠管理', selectStaff: 'スタッフ選択', name: '名前',
    attendance: '打刻', todayStatus: '本日の打刻状況',
    checkin: '出勤', checkout: '退勤', breakStart: '休憩開始', breakEnd: '休憩終了',
    stepIn: '出勤', stepBreak: '休憩', stepBreakEnd: '休憩終了', stepOut: '退勤',
    notYet: '未打刻', loading: '読み込み中...', selectName: '選択してください',
    modalTitle: '退勤しますか？',
    modalBody: '退勤を記録するとデータがリセットされます。\nよろしいですか？',
    cancel: 'キャンセル', confirm: '退勤する', sending: '送信中...',
    locationNotice: '出勤時のみ、現在地情報を取得して送信します。',
    toastCheckin: '出勤しました', toastBreak: '休憩開始しました',
    toastBreakEnd: '休憩終了しました', toastCheckout: '退勤しました！お疲れ様でした 🎉',
    toastFail: '送信失敗。もう一度押してください', toastNoName: '先に名前を選択してください',
    loadFail: '読み込み失敗'
  },
  en: {
    title: 'Attendance', selectStaff: 'Select Staff', name: 'Name',
    attendance: 'Clock In/Out', todayStatus: "Today's Record",
    checkin: 'Clock In', checkout: 'Clock Out', breakStart: 'Break Start', breakEnd: 'Break End',
    stepIn: 'In', stepBreak: 'Break', stepBreakEnd: 'Back', stepOut: 'Out',
    notYet: 'Not yet', loading: 'Loading...', selectName: 'Select name',
    modalTitle: 'Clock Out?',
    modalBody: 'This will record your clock-out time and reset the form.',
    cancel: 'Cancel', confirm: 'Clock Out', sending: 'Sending...',
    locationNotice: 'Location is collected and sent only when clocking in.',
    toastCheckin: 'Clocked in!', toastBreak: 'Break started!',
    toastBreakEnd: 'Break ended!', toastCheckout: 'Clocked out! Good work today 🎉',
    toastFail: 'Failed. Please try again.', toastNoName: 'Please select your name first.',
    loadFail: 'Load failed'
  }
};

let lang = localStorage.getItem('lang') || 'ja';
let times = { '出勤': null, '退勤': null, '休憩開始': null, '休憩終了': null };
let savedName = localStorage.getItem(DEFAULT_NAME_KEY) || '';

const now = new Date();
const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
const weeks = { ja: ['日','月','火','水','木','金','土'], en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] };

function updateDateLabel() {
  if (lang === 'ja') {
    document.getElementById('today-date').textContent =
      now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日（' + weeks.ja[now.getDay()] + '）';
  } else {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    document.getElementById('today-date').textContent =
      weeks.en[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
  }
}

function setLang(l) {
  lang = l;
  localStorage.setItem('lang', l);
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.textContent === l.toUpperCase()));
  applyTranslations();
  updateDateLabel();
}

function applyTranslations() {
  const t = i18n[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = t[key];
  });
  ['time-checkin','time-checkout','time-break','time-breakend'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.recorded) el.textContent = t.notYet;
  });
  const sel = document.getElementById('sel-name');
  if (sel && sel.options[0] && !sel.options[0].value) {
    sel.options[0].textContent = t.selectName;
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.date !== dateStr) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    times = saved.times;
    savedName = saved.name || savedName;
    updateButtonStates();
    updateStatusUI();
  } catch (e) {}
}

function saveToStorage() {
  const name = document.getElementById('sel-name').value;
  if (name) {
    savedName = name;
    localStorage.setItem(DEFAULT_NAME_KEY, name);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: dateStr, name, times }));
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

function updateButtonStates() {
  const hasName = !!document.getElementById('sel-name').value;
  const checkedIn = !!times['出勤'];
  const breakStarted = !!times['休憩開始'];
  const breakEnded = !!times['休憩終了'];
  const checkedOut = !!times['退勤'];

  const btnCheckin = document.getElementById('btn-checkin');
  const btnCheckout = document.getElementById('btn-checkout');
  const btnBreak = document.getElementById('btn-break');
  const btnBreakend = document.getElementById('btn-breakend');
  [btnCheckin, btnCheckout, btnBreak, btnBreakend].forEach(btn => btn.classList.remove('done-state'));

  btnCheckin.disabled = !hasName || checkedIn;
  btnCheckout.disabled = !checkedIn || checkedOut;
  btnBreak.disabled = !checkedIn || breakStarted;
  btnBreakend.disabled = !breakStarted || breakEnded || checkedOut;

  if (checkedIn) { btnCheckin.classList.add('done-state'); btnCheckin.disabled = true; }
  if (checkedOut) { btnCheckout.classList.add('done-state'); btnCheckout.disabled = true; }
  if (breakStarted) { btnBreak.classList.add('done-state'); btnBreak.disabled = true; }
  if (breakEnded) { btnBreakend.classList.add('done-state'); btnBreakend.disabled = true; }

  updateSteps(checkedIn, breakStarted, breakEnded, checkedOut);
}

function updateSteps(checkedIn, breakStarted, breakEnded, checkedOut) {
  const set = (id, state) => {
    const el = document.getElementById(id);
    el.classList.remove('done', 'active');
    if (state === 'done') el.classList.add('done');
    if (state === 'active') el.classList.add('active');
  };
  const setLine = (id, done) => document.getElementById(id).classList.toggle('done', done);

  set('step-checkin', checkedIn ? 'done' : 'active');
  set('step-break', breakStarted ? 'done' : (checkedIn ? 'active' : ''));
  set('step-breakend', breakEnded ? 'done' : (breakStarted ? 'active' : ''));
  set('step-checkout', checkedOut ? 'done' : (checkedIn ? 'active' : ''));
  setLine('line-break', checkedIn);
  setLine('line-breakend', breakStarted);
  setLine('line-checkout', checkedIn);
}

function updateStatusUI() {
  const t = i18n[lang];
  const map = {
    '出勤': ['time-checkin','s-checkin'],
    '退勤': ['time-checkout','s-checkout'],
    '休憩開始': ['time-break','s-break'],
    '休憩終了': ['time-breakend','s-breakend']
  };
  let hasAny = false;
  Object.entries(map).forEach(([type, [timeId, statusId]]) => {
    const val = times[type];
    const timeEl = document.getElementById(timeId);
    if (val) {
      timeEl.textContent = val;
      timeEl.dataset.recorded = '1';
      document.getElementById(statusId).textContent = val;
      hasAny = true;
    } else {
      timeEl.textContent = t.notYet;
      delete timeEl.dataset.recorded;
      document.getElementById(statusId).textContent = '—';
    }
  });
  document.getElementById('status-bar').classList.toggle('show', hasAny);
}

function onNameChange() {
  const name = document.getElementById('sel-name').value;
  if (name) {
    savedName = name;
    localStorage.setItem(DEFAULT_NAME_KEY, name);
  }
  updateButtonStates();
  saveToStorage();
}

function getNow() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

async function record(type) {
  const t = getNow();
  times[type] = t;
  saveToStorage();
  updateButtonStates();
  updateStatusUI();

  try {
    const location = type === '出勤' ? await getCurrentLocationForCheckin() : null;
    await sendToGAS(type, location);
    if (type === '出勤') {
      showToast(i18n[lang].toastCheckin + ' ' + t, 'ok');
    } else {
      const toastKey = type === '休憩開始' ? 'toastBreak' : 'toastBreakEnd';
      showToast(i18n[lang][toastKey] + ' ' + t, 'ok');
    }
  } catch (e) {
    showToast(i18n[lang].toastFail, 'ng');
  }
}

function confirmCheckout() {
  document.getElementById('modal-time').textContent = getNow();
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

async function doCheckout() {
  closeModal();
  const t = getNow();
  times['退勤'] = t;
  document.getElementById('sending-overlay').classList.add('show');

  try {
    await sendToGAS('退勤');
    document.getElementById('sending-overlay').classList.remove('show');
    updateButtonStates();
    updateStatusUI();
    showToast(i18n[lang].toastCheckout, 'ok');
    setTimeout(() => resetAll(), 2500);
  } catch (e) {
    document.getElementById('sending-overlay').classList.remove('show');
    times['退勤'] = null;
    showToast(i18n[lang].toastFail, 'ng');
  }
}

async function sendToGAS(type, location) {
  const name = document.getElementById('sel-name').value;
  const payload = {
    type,
    date: dateStr,
    name,
    checkin: times['出勤'] || '',
    checkout: times['退勤'] || '',
    breakstart: times['休憩開始'] || '',
    breakend: times['休憩終了'] || '',
    latitude: location ? location.latitude : '',
    longitude: location ? location.longitude : '',
    locationAccuracy: location ? location.accuracy : ''
  };

  try {
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    console.log('GASへの送信命令を出しました:', payload);
  } catch (e) {
    console.error('送信エラー:', e);
    throw e;
  }
}

function getCurrentLocationForCheckin() {
  if (!navigator.geolocation) return Promise.resolve(null);

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy)
        });
      },
      error => {
        console.warn('位置情報を取得できませんでした:', error);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

function resetAll() {
  times = { '出勤': null, '退勤': null, '休憩開始': null, '休憩終了': null };
  clearStorage();
  document.getElementById('sel-name').value = savedName || '';
  updateButtonStates();
  updateStatusUI();
}

async function loadNames() {
  try {
    const data = await fetchNamesJsonp();
    if (!data.names || !Array.isArray(data.names)) throw new Error('Invalid names response');
    renderNameOptions(data.names);
  } catch (e) {
    console.error('名前一覧の読み込みに失敗しました:', e);
    renderNameOptions(FALLBACK_NAMES);
  }
  updateButtonStates();
}

function renderNameOptions(names) {
  const sel = document.getElementById('sel-name');
  sel.innerHTML = '<option value="">' + i18n[lang].selectName + '</option>';
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  if (savedName && names.includes(savedName)) sel.value = savedName;
}

function fetchNamesJsonp() {
  return new Promise((resolve, reject) => {
    const callbackName = 'loadKintaiNames_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const sep = GAS_URL.includes('?') ? '&' : '?';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Names request timeout'));
    }, 12000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Names request failed'));
    };

    script.src = GAS_URL + sep + 'callback=' + encodeURIComponent(callbackName) + '&_=' + Date.now();
    document.head.appendChild(script);
  });
}

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 3500);
}

loadFromStorage();
applyTranslations();
updateDateLabel();
loadNames();
document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.textContent === lang.toUpperCase()));
