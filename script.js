const GAS_URL = 'https://script.google.com/macros/s/AKfycbyWKD4_y9s8mwI87wYtXtoM-0bbO-cTGO2mf4xN4DNmv1vNd3e1LmpCJ0iKqVAbDRy5/exec';
const NAME_SPREADSHEET_ID = '1JL_cyEa06mZnyj3Ar-Ie5sbL-QxxSm2X5fHlWKCrWog';
const NAME_SHEET_GID = '0';
const STORAGE_KEY = 'kintai_v2';
const DEFAULT_NAME_KEY = 'kintai_default_name_v1';
const MAX_COMMUTE_FILES = 3;
const MAX_COMMUTE_ORIGINAL_SIZE = 12 * 1024 * 1024;
const MAX_COMMUTE_UPLOAD_SIZE = 2.5 * 1024 * 1024;
const COMMUTE_IMAGE_MAX_SIDE = 1600;
const COMMUTE_IMAGE_QUALITY = 0.72;
const FALLBACK_NAMES = [
  '奥田ロレーン',
  '尾棹大朗',
  'ルイ・ワイチェック'
];

const i18n = {
  ja: {
    title: '勤怠管理', selectStaff: 'スタッフ選択', name: '名前',
    attendance: '打刻', todayStatus: '本日の打刻状況',
    currentStatus: '現在の状態', nextAction: '次の操作',
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
    toastCommuteRequired: '交通費・画像は後からでも送信できます',
    toastSupplementalRequired: '交通費・画像・メモのいずれかを入力してください',
    toastSupplementalSent: '交通費・メモを送信しました',
    toastFileLimit: '画像は3枚まで、1枚12MBまでです',
    loadFail: '読み込み失敗'
  },
  en: {
    title: 'Attendance', selectStaff: 'Select Staff', name: 'Name',
    attendance: 'Clock In/Out', todayStatus: "Today's Record",
    currentStatus: 'Current Status', nextAction: 'Next Action',
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
    toastCommuteRequired: 'Commute fare and images can be sent later.',
    toastSupplementalRequired: 'Enter fare, attach an image, or add a memo.',
    toastSupplementalSent: 'Commute info and memo sent.',actionHint: 'Highlighted buttons are available now.',
    toastFileLimit: 'Up to 3 images, 12MB each.',commuteTitle: 'Commute & Notes',
    loadFail: 'Load failed',actionTitle: 'Actions',actionHint: 'Highlighted buttons are available now.',
    commuteSubtitle: 'Can be sent after clocking out',fareGo: 'To work',fareAttach: 'Attachment',
    fileSummaryDefault: 'Up to 3 images, auto-compressed',memoLabel: 'Notes',memoPlaceholder: 'Add a note (optional)',
    supplementalSend: 'Send commute info only',checkoutNote: 'Enter 0 for fare if you had no commute costs.',
  }
};

let lang = localStorage.getItem('lang') || 'ja';
let times = { '出勤': null, '退勤': null, '休憩開始': null, '休憩終了': null };
let savedName = localStorage.getItem(DEFAULT_NAME_KEY) || '';
let selectedCommuteFiles = [];

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
  const supplementalReady = isSupplementalReady();

  const btnCheckin = document.getElementById('btn-checkin');
  const btnCheckout = document.getElementById('btn-checkout');
  const btnBreak = document.getElementById('btn-break');
  const btnBreakend = document.getElementById('btn-breakend');
  const supplementalSend = document.getElementById('supplemental-send');
  [btnCheckin, btnCheckout, btnBreak, btnBreakend].forEach(btn => btn.classList.remove('done-state'));

  btnCheckin.disabled = !hasName || checkedIn;
  btnCheckout.disabled = !checkedIn || checkedOut;
  btnBreak.disabled = !checkedIn || breakStarted;
  btnBreakend.disabled = !breakStarted || breakEnded || checkedOut;

  if (checkedIn) { btnCheckin.classList.add('done-state'); btnCheckin.disabled = true; }
  if (checkedOut) { btnCheckout.classList.add('done-state'); btnCheckout.disabled = true; }
  if (breakStarted) { btnBreak.classList.add('done-state'); btnBreak.disabled = true; }
  if (breakEnded) { btnBreakend.classList.add('done-state'); btnBreakend.disabled = true; }
  if (supplementalSend) supplementalSend.disabled = !hasName || !supplementalReady;

  updateSteps(checkedIn, breakStarted, breakEnded, checkedOut);
  updatePrimaryAction(hasName, checkedIn, breakStarted, breakEnded, checkedOut);
  updateCheckoutPanelState(checkedIn, checkedOut, isSupplementalReady());
}

function updatePrimaryAction(hasName, checkedIn, breakStarted, breakEnded, checkedOut) {
  const stateEl = document.getElementById('current-state');
  const detailEl = document.getElementById('state-detail');
  const primary = document.getElementById('primary-action');
  const label = document.getElementById('primary-label');
  const time = document.getElementById('primary-time');
  const next = getNextAction(hasName, checkedIn, breakStarted, breakEnded, checkedOut);

  primary.classList.remove('is-break', 'is-breakend', 'is-checkout');
  primary.disabled = !next.type;
  primary.onclick = next.handler;
  label.textContent = next.label;
  time.textContent = next.time || getNow();

  if (next.className) primary.classList.add(next.className);

  stateEl.textContent = next.state;
  detailEl.textContent = next.detail;
}

function getNextAction(hasName, checkedIn, breakStarted, breakEnded, checkedOut) {
  const t = i18n[lang];
  const selectedName = document.getElementById('sel-name').value;

  if (!hasName) {
    return {
      type: '',
      label: t.checkin,
      state: lang === 'ja' ? '出勤前' : 'Before Work',
      detail: lang === 'ja' ? '名前を選択してください' : 'Select your name'
    };
  }

  if (checkedOut) {
    return {
      type: '',
      label: t.checkout,
      time: times['退勤'],
      state: lang === 'ja' ? '退勤済み' : 'Clocked Out',
      detail: selectedName + ' / ' + (times['退勤'] || t.notYet)
    };
  }

  if (!checkedIn) {
    return {
      type: '出勤',
      label: t.checkin,
      state: lang === 'ja' ? '出勤前' : 'Before Work',
      detail: selectedName + ' / ' + (lang === 'ja' ? '出勤できます' : 'Ready to clock in'),
      handler: () => record('出勤')
    };
  }

  if (!breakStarted) {
    return {
      type: '休憩開始',
      label: t.breakStart,
      time: times['出勤'],
      state: lang === 'ja' ? '勤務中' : 'Working',
      detail: selectedName + ' / ' + t.checkin + ' ' + times['出勤'],
      className: 'is-break',
      handler: () => record('休憩開始')
    };
  }

  if (!breakEnded) {
    return {
      type: '休憩終了',
      label: t.breakEnd,
      time: times['休憩開始'],
      state: lang === 'ja' ? '休憩中' : 'On Break',
      detail: selectedName + ' / ' + t.breakStart + ' ' + times['休憩開始'],
      className: 'is-breakend',
      handler: () => record('休憩終了')
    };
  }

  return {
    type: '退勤',
    label: t.checkout,
    time: times['休憩終了'] || times['出勤'],
    state: lang === 'ja' ? '勤務中' : 'Working',
    detail: selectedName + ' / ' + (lang === 'ja' ? '退勤できます' : 'Ready to clock out'),
    className: 'is-checkout',
    handler: () => confirmCheckout()
  };
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
  document.getElementById('status-bar').classList.toggle('show', true);
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
    const checkoutExtras = isSupplementalReady()
      ? await collectSupplementalExtras()
      : emptyCheckoutExtras();
    await sendToGAS('退勤', null, checkoutExtras);
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

async function sendToGAS(type, location, checkoutExtras) {
  const name = document.getElementById('sel-name').value;
  const extras = checkoutExtras || {};
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
    locationAccuracy: location ? location.accuracy : '',
    fareGo: extras.fareGo || '',
    fareReturn: extras.fareReturn || '',
    fareTotal: extras.fareTotal || '',
    memo: extras.memo || '',
    commuteFiles: extras.files || []
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

function isSupplementalReady() {
  const fareGo = document.getElementById('fare-go')?.value.trim() || '';
  const fareReturn = document.getElementById('fare-return')?.value.trim() || '';
  const memo = document.getElementById('memo')?.value.trim() || '';
  const fileCount = selectedCommuteFiles.length;
  return fileCount > 0 || memo !== '' || fareGo !== '' || fareReturn !== '';
}

function updateCheckoutPanelState(checkedIn, checkedOut, commuteReady) {
  const panel = document.getElementById('checkout-panel');
  const note = document.getElementById('checkout-note');
  if (!panel || !note) return;

  panel.classList.toggle('is-incomplete', checkedIn && !checkedOut && !commuteReady);
  panel.classList.toggle('is-ready', checkedIn && !checkedOut && commuteReady);
  note.textContent = commuteReady
    ? '入力済みの交通費・メモは退勤時にも送信されます。後から追加送信もできます。'
    : '交通費・メモ・画像は退勤後でも送信できます。';
}

async function sendSupplementalInfo() {
  if (!document.getElementById('sel-name').value) {
    showToast(i18n[lang].toastNoName, 'ng');
    return;
  }

  if (!isSupplementalReady()) {
    showToast(i18n[lang].toastSupplementalRequired, 'ng');
    return;
  }

  document.getElementById('sending-overlay').classList.add('show');
  try {
    const checkoutExtras = await collectSupplementalExtras();
    await sendToGAS('交通費更新', null, checkoutExtras);
    document.getElementById('sending-overlay').classList.remove('show');
    showToast(i18n[lang].toastSupplementalSent, 'ok');
  } catch (e) {
    document.getElementById('sending-overlay').classList.remove('show');
    showToast(i18n[lang].toastFail, 'ng');
  }
}

function collectSupplementalExtras() {
  const fareGoRaw = document.getElementById('fare-go').value.trim();
  const fareReturnRaw = document.getElementById('fare-return').value.trim();
  const fareGo = fareGoRaw === '' ? '' : String(Math.max(0, parseInt(fareGoRaw, 10) || 0));
  const fareReturn = fareReturnRaw === '' ? '' : String(Math.max(0, parseInt(fareReturnRaw, 10) || 0));
  const fareTotal = fareGo !== '' || fareReturn !== ''
    ? String((parseInt(fareGo, 10) || 0) + (parseInt(fareReturn, 10) || 0))
    : '';
  const memo = document.getElementById('memo').value.trim();
  const files = selectedCommuteFiles;

  if (!isSupplementalReady()) {
    throw new Error('Supplemental info is required');
  }

  return readCommuteFiles(files).then(filePayloads => ({
    fareGo,
    fareReturn,
    fareTotal,
    memo,
    files: filePayloads
  }));
}

function emptyCheckoutExtras() {
  return {
    fareGo: '',
    fareReturn: '',
    fareTotal: '',
    memo: '',
    files: []
  };
}

function readCommuteFiles(files) {
  if (files.length > MAX_COMMUTE_FILES || files.some(file => file.size > MAX_COMMUTE_ORIGINAL_SIZE)) {
    showToast(i18n[lang].toastFileLimit, 'ng');
    return Promise.reject(new Error('Invalid commute file count or size'));
  }

  return Promise.all(files.map(file => prepareCommuteFile(file)));
}

async function prepareCommuteFile(file) {
  if (file.type && file.type.indexOf('image/') === 0) {
    return compressImageFile(file);
  }

  if (file.size > MAX_COMMUTE_UPLOAD_SIZE) {
    showToast(i18n[lang].toastFileLimit, 'ng');
    throw new Error('Commute file is too large: ' + file.name);
  }

  return readFileAsPayload(file, file.name, file.type || 'application/octet-stream', file.size);
}

async function compressImageFile(file) {
  const img = await loadImageFromFile(file);
  const scale = Math.min(1, COMMUTE_IMAGE_MAX_SIDE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, 'image/jpeg', COMMUTE_IMAGE_QUALITY);
  if (blob.size > MAX_COMMUTE_UPLOAD_SIZE) {
    blob = await canvasToBlob(canvas, 'image/jpeg', 0.58);
  }
  if (blob.size > MAX_COMMUTE_UPLOAD_SIZE) {
    const smaller = document.createElement('canvas');
    const smallScale = Math.min(1, 1280 / Math.max(width, height));
    smaller.width = Math.max(1, Math.round(width * smallScale));
    smaller.height = Math.max(1, Math.round(height * smallScale));
    smaller.getContext('2d').drawImage(canvas, 0, 0, smaller.width, smaller.height);
    blob = await canvasToBlob(smaller, 'image/jpeg', 0.6);
  }
  if (blob.size > MAX_COMMUTE_UPLOAD_SIZE) {
    showToast('画像を圧縮できませんでした。スクショを小さくして再添付してください', 'ng');
    throw new Error('Compressed image is too large: ' + file.name);
  }

  const filename = makeCompressedImageName(file.name);
  return readFileAsPayload(blob, filename, 'image/jpeg', blob.size);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed: ' + file.name));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Image compression failed'));
    }, mimeType, quality);
  });
}

function readFileAsPayload(fileOrBlob, name, mimeType, size) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({
        name,
        mimeType,
        size,
        base64
      });
    };
    reader.onerror = () => reject(reader.error || new Error('File read failed'));
    reader.readAsDataURL(fileOrBlob);
  });
}

function makeCompressedImageName(filename) {
  const stem = String(filename || 'commute_fare')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'commute_fare';
  return stem + '.jpg';
}

function setupCheckoutInputs() {
  ['fare-go', 'fare-return', 'memo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateButtonStates);
  });

  const files = document.getElementById('commute-files');
  if (files) {
    files.addEventListener('change', () => {
      selectedCommuteFiles = mergeCommuteFiles(selectedCommuteFiles, [...files.files]);
      files.value = '';
      updateFileSummary();
      renderFilePreviews();
      updateButtonStates();
    });
  }
}

function updateFileSummary() {
  const summary = document.getElementById('file-summary');
  if (!summary) return;

  const files = selectedCommuteFiles;
  if (files.length === 0) {
    summary.textContent = '画像は3枚まで・送信時に自動圧縮';
    return;
  }

  if (files.length > MAX_COMMUTE_FILES || files.some(file => file.size > MAX_COMMUTE_ORIGINAL_SIZE)) {
    summary.textContent = '画像は3枚まで、1枚12MBまでです';
    summary.style.color = '#fecaca';
    return;
  }

  summary.style.color = '';
  summary.textContent = files.length + '枚選択中（送信時に自動圧縮）';
}

function renderFilePreviews() {
  const grid = document.getElementById('file-preview-grid');
  if (!grid) return;

  grid.innerHTML = '';
  const files = selectedCommuteFiles.slice(0, MAX_COMMUTE_FILES);
  files.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'file-preview';

    const img = document.createElement('img');
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);

    const caption = document.createElement('span');
    caption.textContent = file.name;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'file-remove';
    remove.setAttribute('aria-label', file.name + 'を削除');
    remove.textContent = '×';
    remove.onclick = () => removeCommuteFile(index);

    item.appendChild(img);
    item.appendChild(remove);
    item.appendChild(caption);
    grid.appendChild(item);
  });
}

function mergeCommuteFiles(currentFiles, newFiles) {
  const merged = currentFiles.concat(newFiles);
  return merged.slice(0, MAX_COMMUTE_FILES);
}

function removeCommuteFile(index) {
  selectedCommuteFiles.splice(index, 1);
  updateFileSummary();
  renderFilePreviews();
  updateButtonStates();
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
  document.getElementById('fare-go').value = '';
  document.getElementById('fare-return').value = '';
  document.getElementById('memo').value = '';
  document.getElementById('commute-files').value = '';
  selectedCommuteFiles = [];
  updateFileSummary();
  renderFilePreviews();
  updateButtonStates();
  updateStatusUI();
}

async function loadNames() {
  try {
    const data = await fetchNamesFromPublicSheet();
    if (!data.names || !Array.isArray(data.names) || data.names.length === 0) {
      throw new Error('No names in public sheet response');
    }
    renderNameOptions(data.names);
  } catch (e) {
    console.warn('公開名前シートからの読み込みに失敗しました。GAS経由を試します:', e);
    try {
      const data = await fetchNamesJsonp();
      if (!data.names || !Array.isArray(data.names) || data.names.length === 0) {
        throw new Error('No names in GAS response');
      }
      renderNameOptions(data.names);
    } catch (gasError) {
      console.error('名前一覧の読み込みに失敗しました:', gasError);
      renderNameOptions(FALLBACK_NAMES);
    }
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

function fetchNamesFromPublicSheet() {
  return new Promise((resolve, reject) => {
    const callbackName = 'loadPublicKintaiNames_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const previousGoogle = window.google;
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Public sheet request timeout'));
    }, 12000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      if (previousGoogle === undefined) {
        delete window.google;
      } else {
        window.google = previousGoogle;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = response => {
      cleanup();
      try {
        resolve({ names: parseNamesFromGvizResponse(response) });
      } catch (e) {
        reject(e);
      }
    };

    window.google = window.google || {};
    window.google.visualization = window.google.visualization || {};
    window.google.visualization.Query = window.google.visualization.Query || {};
    window.google.visualization.Query.setResponse = window[callbackName];

    script.onerror = () => {
      cleanup();
      reject(new Error('Public sheet request failed'));
    };

    const params = new URLSearchParams({
      tqx: 'out:json;responseHandler:' + callbackName,
      gid: NAME_SHEET_GID,
      _: Date.now().toString()
    });
    script.src = 'https://docs.google.com/spreadsheets/d/' + NAME_SPREADSHEET_ID + '/gviz/tq?' + params.toString();
    document.head.appendChild(script);
  });
}

function parseNamesFromGvizResponse(response) {
  const rows = response && response.table && response.table.rows ? response.table.rows : [];
  const names = rows
    .map(row => {
      const cells = row.c || [];
      return {
        name: String((cells[0] && (cells[0].v || cells[0].f)) || '').trim(),
        status: String((cells[2] && (cells[2].v || cells[2].f)) || '').trim()
      };
    })
    .filter(row =>
      row.name !== '' &&
      row.name !== '名前' &&
      row.name !== 'アルバイト氏名' &&
      row.status.indexOf('退職済み') === -1
    )
    .map(row => row.name);
  console.log('公開名前シートの取得結果:', names);
  return names;
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
setupCheckoutInputs();
loadNames();
document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.textContent === lang.toUpperCase()));
