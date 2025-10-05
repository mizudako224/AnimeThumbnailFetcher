// ===============================
// --- 言語切替 ---
const langText = {
  ja: {
    fetch: '取得',
    download: 'すべてダウンロード',
    id_placeholder: 'コンテンツID / FODカテゴリID',
    ep_placeholder: 'エピソード（Videx/FOD）',
    hash_placeholder: 'FOD ep_hash_id',
    noThumbs: 'ダウンロードできる画像がありません。',
    downloaded: c => `${c} 枚の画像をダウンロードしました。`,
    requires: 'IDとエピソードを入力してください。',
    code: 'IDはこちら',
    prompt: '保存するZipファイルの名前を入力してください'
  },
  en: {
    fetch: 'Fetch',
    download: 'Download All',
    id_placeholder: 'Content ID / FOD Category',
    ep_placeholder: 'Episode (Videx/FOD)',
    hash_placeholder: 'FOD ep_hash_id',
    noThumbs: 'No thumbnails to download.',
    downloaded: c => `Downloaded ${c} images.`,
    requires: 'Please enter ID and Episode.',
    code: 'ID Here',
    prompt: 'Enter a name for the saved Zip file'
  }
};
let currentLang = 'ja';

function applyLanguage() {
  const params = new URLSearchParams(location.search);
  currentLang = params.get('lang') || 'ja';
  const t = langText[currentLang];
  document.getElementById('fetchBtn').textContent = t.fetch;
  document.getElementById('downloadBtn').textContent = t.download;
  document.getElementById('id').placeholder = t.id_placeholder;
  document.getElementById('episode').placeholder = t.ep_placeholder;
  document.getElementById('hash').placeholder = t.hash_placeholder;
  document.getElementById('code-link').textContent = t.code;
  document.getElementById('copyright-ja').style.display =
    currentLang === 'ja' ? 'block' : 'none';
  document.getElementById('copyright-en').style.display =
    currentLang === 'en' ? 'block' : 'none';
}
function switchLang(lang) {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  window.location.href = url.toString();
}
applyLanguage();

// ===============================
// showModal / hideModal の改良版（アニメーション対応）
function showModal(src, type = 'img') {
  const modal = document.getElementById('modal');
  const content = document.getElementById('modal-content');

  // 既存の中身をクリアして新しく入れる
  content.innerHTML = '';

  if (type === 'img') {
    const img = document.createElement('img');
    img.src = src;
    img.loading = 'eager'; // 重要：モーダル表示時は積極的に読み込む（必要なら 'lazy' に）
    img.alt = '';
    content.appendChild(img);
  } else {
    const vid = document.createElement('video');
    vid.src = src;
    vid.controls = true;
    vid.autoplay = true;
    vid.playsInline = true;
    content.appendChild(vid);
  }

  // モーダル内クリックは親に伝播しない（中身クリックで閉じないように）
  content.addEventListener('click', (e) => e.stopPropagation());

  // force reflow（要素を DOM に追加したあと、ブラウザのレイアウトを強制してからクラスを付ける）
  // これで transition が確実に発火します
  modal.classList.remove('show');
  void modal.offsetWidth; // reflow（ブラウザに変更を認識させる）
  modal.classList.add('show');
}

function hideModal() {
  const modal = document.getElementById('modal');
  const content = document.getElementById('modal-content');

  // クラスを外してフェードアウト開始
  modal.classList.remove('show');

  // CSS の transition-duration と合わせる（ここでは 800ms）
  const TRANSITION_MS = 800;
  setTimeout(() => {
    // トランジション完了後に中身をクリア（見た目のチラつきを防ぐ）
    content.innerHTML = '';
  }, TRANSITION_MS);
}
// ===============================
// --- サムネ取得 ---
function fetchThumbnails() {
  const site = document.getElementById('site').value;
  const id = document.getElementById('id').value.trim();
  const ep = document.getElementById('episode').value.trim();
  const hash = document.getElementById('hash').value.trim();
  const container = document.getElementById('thumbnails');
  container.innerHTML = ''; // クリアして再生成
  let urls = [];

  if (site === 'rakuten') {
    const last2 = id.slice(-2).split('').reverse().join('');
    const mid2 = id.slice(-4, -2).split('').reverse().join('');
    for (let i = 1; i <= 999; i++) {
      const idx = String(i).padStart(4, '0');
      urls.push(`https://im.akimg.tv.rakuten.co.jp/chapter/${mid2}/${last2}/${id}/${idx}.jpg`);
    }
  } else if (site === 'videx') {
    if (!id || !ep) return alert(langText[currentLang].requires);
    urls.push(`https://img.videx.jp/image/capture/${id}_${ep}_01.jpg`);
  } else if (site === 'trueid') {
    for (let i = 1; i <= 999; i++) {
      const frame = String(i * 10).padStart(6, '0');
      urls.push(`https://thumbnail.stm.trueid.net/thumbnail_vod/${id}/${id}_${frame}_large.jpg`);
    }
  } else if (site === 'cubmu') {
    if (!id) return alert(langText[currentLang].requires);
    urls.push(
      `https://cdnjkt913.transvision.co.id:1000/image/snap/${id}/snap_0001.jpg`,
      `https://cdnjkt913.transvision.co.id:1000/image/snap/${id}/snap_0061.jpg`,
      `https://cdnjkt913.transvision.co.id:1000/image/snap/${id}/snap_0121.jpg`
    );
  } else if (site === 'fod') {
    if (!id || !ep || !hash) return alert('カテゴリID、エピソードID、ep_hash_idを入力してください。');
    for (let i = 1; i <= 999; i++) {
      const num = String(i).padStart(5, '0');
      urls.push(`https://i.fod.fujitv.co.jp/thumbnail/${id}/${ep}_${hash}/${ep}_${num}.jpg`);
    }
  }

  urls.forEach(url => {
    const div = document.createElement('div');
    div.className = 'grid-item';
    const img = document.createElement('img');
    img.src = url;
    img.onclick = () => showModal(url, 'img');
    img.onerror = () => div.remove();
    div.appendChild(img);
    container.appendChild(div);
  });
}

// ===============================
// --- ダウンロード ---
async function downloadAll() {
  const imgs = Array.from(document.querySelectorAll('#thumbnails img'));
  const modal = document.getElementById('download-modal');
  const progress = document.getElementById('download-progress');

  if (imgs.length === 0) {
    alert(langText[currentLang].noThumbs);
    return;
  }

  let fileName = prompt(langText[currentLang].prompt, 'thumbnails');
  if (!fileName) fileName = 'thumbnails';

  modal.style.display = 'flex';
  progress.textContent = 'ダウンロード中: 0%';

  const zip = new JSZip();
  let successCount = 0;
  for (let i = 0; i < imgs.length; i++) {
    try {
      const res = await fetch(imgs[i].src);
      const blob = await res.blob();
      zip.file(`image_${String(i + 1).padStart(3, '0')}.jpg`, blob);
      successCount++;
    } catch {}
    progress.textContent = `ダウンロード中: ${Math.round(((i + 1) / imgs.length) * 100)}%`;
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `${fileName}.zip`;
  a.click();
  modal.style.display = 'none';
  alert(langText[currentLang].downloaded(successCount));
}

// ===============================
// --- 動画UI ---
document.getElementById('biliPlayButton').addEventListener('click', () => {
  const url = document.getElementById('biliUrlInput').value.trim();
  const video = document.getElementById('biliVideo');
  if (!url) return;
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
  } else {
    video.src = url;
  }
});

function showPopup() {
  const popup = document.getElementById('bilibiliPopup');
  popup.classList.add('show');
}

function closePopup() {
  const popup = document.getElementById('bilibiliPopup');
  popup.classList.remove('show');

  // 動画を停止
  const video = popup.querySelector('video');
  if (video) video.pause();
}

window.addEventListener('load', showPopup);

// ===============================
// --- メディア切替 ---
document.getElementById('showImages').addEventListener('click', () => {
  document.getElementById('imageUI').style.display = 'flex';
  document.getElementById('videoUI').style.display = 'none';
  document.getElementById('showImages').classList.add('active');
  document.getElementById('showVideos').classList.remove('active');
});
document.getElementById('showVideos').addEventListener('click', () => {
  document.getElementById('imageUI').style.display = 'none';
  document.getElementById('videoUI').style.display = 'flex';
  document.getElementById('showImages').classList.remove('active');
  document.getElementById('showVideos').classList.add('active');
});