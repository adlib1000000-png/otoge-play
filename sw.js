// オフラインでも遊べるようにするサービスワーカー。
// ゲーム一式（ページ・Unity のビルド・アイコン）を初回に保存し、以後は保存したものから起動する。
// 5b907c161619 と __ASSETS__ はビルド後にエディタ（PwaBuildPostprocessor）が書き換える。
// 中身が変わるとブラウザが新しい版として入れ直し、古い保存データは消える。

const CACHE_PREFIX = "otoge-";
const CACHE = CACHE_PREFIX + "5b907c161619";
const ASSETS = ["./", "Build/WebGL.data.unityweb", "Build/WebGL.framework.js.unityweb", "Build/WebGL.loader.js", "Build/WebGL.wasm.unityweb", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-192.png", "icons/icon-maskable-512.png", "index.html", "manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // no-cache: 変わっていないファイルはサーバーに確認するだけ（再ダウンロードしない）
    await cache.addAll(ASSETS.map((url) => new Request(url, { cache: "no-cache" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      // 古い版の保存データと、以前の版で Unity 自身が保存していたゲームデータ（今は使わない）を消す
      const stale = (key.startsWith(CACHE_PREFIX) && key !== CACHE) || key.startsWith("UnityCache_");
      if (stale) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // 保存済みならそれを使う（?v=… などのクエリは無視）
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      return await fetch(request);
    } catch (error) {
      // オフラインでページを開いたときは、保存してあるゲーム画面を返す
      if (request.mode === "navigate") {
        const page = await cache.match("./");
        if (page) return page;
      }
      throw error;
    }
  })());
});
