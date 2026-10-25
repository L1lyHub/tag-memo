// ====================================================
//  Service Worker
// ====================================================
// つながっていれば最新のファイルを取り、オフラインや通信が遅いときは保存済みのものを返す（ネットワーク優先）。
// HTML を更新するだけなら、このファイルを変える必要はない
const CACHE      = 'tag-memo-v1';
const TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  // 最初に開いたときはページの読み込みがこの登録より先なので、オフライン用の HTML をここで保存しておく
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.add(new Request('./', { cache: 'no-cache' })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // HTML はブラウザのキャッシュを使わず、毎回サーバーに確認する（変わっていなければ 304 の短い返事で済む）
  const network = fetch(req, req.mode === 'navigate' ? { cache: 'no-cache' } : undefined);
  // 時間切れで保存済みのものを返したあとも、届いた最新版は次に開くときのために保存する
  event.waitUntil(network.then(res => {
    if (!res.ok) return;
    const copy = res.clone();
    return caches.open(CACHE).then(cache => cache.put(req, copy));
  }).catch(() => {}));
  event.respondWith(respond(req, network));
});

async function respond(req, network) {
  const timeout = new Promise(resolve => setTimeout(resolve, TIMEOUT_MS));
  const res = await Promise.race([network.catch(() => null), timeout]);
  if (res) return res;

  // オフライン、または TIMEOUT_MS 待っても届かないときは保存済みのものを使う
  const cache  = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true })
    || (req.mode === 'navigate' && await cache.match('./'));
  return cached || network;
}
