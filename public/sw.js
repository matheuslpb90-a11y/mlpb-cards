// Service worker mínimo: permite instalar o app. Não guarda páginas em cache
// (preços, estoque e leilões precisam estar sempre atualizados).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="background:#0a0a0a;color:#eee;font-family:sans-serif;text-align:center;padding:40px">📶 Sem internet no momento.<br><br>Verifique a conexão e tente de novo.</body>', { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
