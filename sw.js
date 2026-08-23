/* ============================================================
   Service Worker — Entreno
   Subir a la RAÍZ del repo (junto a index.html).

   Hace dos cosas:
   1. Recibe las notificaciones push y las muestra.
   2. Cachea la app para que abra sin conexión.
   ============================================================ */

const CACHE = "entreno-v1";
const ESENCIALES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./badge-96.png",
];

// --- Instalación: guardar lo esencial en caché ---
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ESENCIALES).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// --- Activación: limpiar cachés viejos ---
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// --- Fetch: red primero, caché como respaldo ---
// Así siempre ves la versión más nueva si hay conexión,
// y la app igual abre si estás sin señal.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // No tocar las llamadas a Supabase ni a APIs: siempre red.
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
  );
});

// --- Push: mostrar la notificación ---
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {}; }

  const titulo = d.titulo || "Entreno";
  const opciones = {
    body: d.cuerpo || "",
    icon: "./icon-192.png",
    badge: "./badge-96.png",
    tag: d.tag || "entreno",
    renotify: false,
    data: { url: d.url || "./" },
    actions: d.acciones || [],
  };
  e.waitUntil(self.registration.showNotification(titulo, opciones));
});

// --- Click en la notificación: abrir la app en el lugar correcto ---
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || "./";

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((lista) => {
        // Si la app ya está abierta, enfocarla y avisarle a dónde ir
        for (const c of lista) {
          if ("focus" in c) {
            c.postMessage({ tipo: "notif-click", url: destino });
            return c.focus();
          }
        }
        // Si no, abrirla
        if (self.clients.openWindow) return self.clients.openWindow(destino);
      })
  );
});
