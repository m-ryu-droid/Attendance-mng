// 交通費の対象日ピッカー（script.js は変更せず、ここで上書きする）
const FARE_DATE_PAST_DAYS = 7;

function toInputDate(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function initFareDate() {
  const el = document.getElementById('fare-date');
  if (!el) return;
  const today = new Date();
  const min = new Date(today);
  min.setDate(min.getDate() - FARE_DATE_PAST_DAYS);
  el.max = toInputDate(today);
  el.min = toInputDate(min);
  el.value = toInputDate(today);
}

function getFareDate() {
  const v = document.getElementById('fare-date')?.value || '';
  return v ? v.replace(/-/g, '/') : dateStr;
}

// 交通費更新のときだけ date を対象日に差し替える。
// GAS 側は date で行とSlackスレッドを引くため、これだけで後日入力が正しい日に入る。
const originalSendToGAS = sendToGAS;
sendToGAS = async function(type, location, checkoutExtras) {
  if (type !== '交通費更新') {
    return originalSendToGAS(type, location, checkoutExtras);
  }

  const name = document.getElementById('sel-name').value;
  const extras = checkoutExtras || {};
  const payload = {
    type,
    date: getFareDate(),
    name,
    checkin: '',
    checkout: '',
    breakstart: '',
    breakend: '',
    latitude: '',
    longitude: '',
    locationAccuracy: '',
    fareGo: extras.fareGo || '',
    fareReturn: extras.fareReturn || '',
    fareTotal: extras.fareTotal || '',
    memo: extras.memo || '',
    commuteFiles: extras.files || []
  };

  await fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
};

document.addEventListener('DOMContentLoaded', initFareDate);
