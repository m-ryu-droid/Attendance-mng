/* ══════════════════════════════════════════
   名前の一覧を、GAS経由だけで読み込む
   script.js の loadNames は、公開スプレッドシート（名簿ブック）を先に読みに行く。
   名簿ブックを社内限定にすると、その読み込みが失敗するまで12秒待ってからGASに切り替わり、
   起動が遅くなる。ここで最初からGASで読み込み、遅れて来る古い処理の結果は無視する。
   script.js には手を入れない。
   ══════════════════════════════════════════ */

const NAMES_CACHE_KEY = 'kintai_names_v1';
let namesAllowRender = false;   // この中から呼んだときだけ、一覧を描画する

/* script.js の描画関数を包む：自分が許可したときだけ描画する（古い処理の遅れた結果を捨てる） */
const namesPrevRender = renderNameOptions;
renderNameOptions = function(names) {
  if (!namesAllowRender) return;
  namesPrevRender(names);
};

function namesRender(names) {
  namesAllowRender = true;
  try { renderNameOptions(names); } finally { namesAllowRender = false; }
  updateButtonStates();
}

function namesReadCache() {
  try {
    const list = JSON.parse(localStorage.getItem(NAMES_CACHE_KEY) || 'null');
    return Array.isArray(list) && list.length ? list : null;
  } catch (e) { return null; }
}

function namesWriteCache(list) {
  try { localStorage.setItem(NAMES_CACHE_KEY, JSON.stringify(list)); } catch (e) {}
}

async function namesLoad() {
  // 1) 前回の一覧があれば、すぐに出す（GASの応答を待たずに、名前を選べるようにする）
  const cached = namesReadCache();
  if (cached) namesRender(cached);

  // 2) GASから最新の一覧を取り、取れたら差し替える
  try {
    const data = await fetchNamesJsonp();
    if (!data || !Array.isArray(data.names) || data.names.length === 0) throw new Error('No names');
    namesWriteCache(data.names);
    namesRender(data.names);
  } catch (e) {
    console.error('名前一覧の読み込みに失敗しました:', e);
    if (!cached) namesRender(FALLBACK_NAMES);   // 前回の一覧もなければ、元の代替表示
  }
}

namesLoad();
