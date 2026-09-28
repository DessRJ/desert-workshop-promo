(() => {
  'use strict';

  // ── Configuración ───────────────────────────────────────────────
  const API = '/.netlify/functions/register';
  // Número de WhatsApp del negocio con lada país, ej. '528711234567'. Vacío = oculta el botón.
  const WHATSAPP_NUMBER = '';

  const KEY_QUEUE = 'dw_cola';
  const KEY_LAST = 'dw_ultimo';
  const origen = (new URLSearchParams(location.search).get('o') || '').slice(0, 20);

  // ── Atajos ──────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const form = $('promoForm');
  const vistaForm = $('vista-form');
  const vistaTicket = $('vista-ticket');
  const btn = $('btn-enviar');
  const fields = ['nombre', 'whatsapp', 'vehiculo', 'anio', 'acepta'];

  const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // ── Teléfono con formato 871 123 4567 ───────────────────────────
  $('whatsapp').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').replace(/^52(?=\d{10})/, '').slice(0, 10);
    e.target.value = [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ');
  });

  // ── Validación ──────────────────────────────────────────────────
  function readForm() {
    const v = Object.fromEntries(new FormData(form));
    return {
      nombre: (v.nombre || '').replace(/\s+/g, ' ').trim(),
      whatsapp: (v.whatsapp || '').replace(/\D/g, ''),
      vehiculo: (v.vehiculo || '').replace(/\s+/g, ' ').trim(),
      anio: Number(v.anio),
      acepta: $('acepta').checked,
      sitio: v.sitio || '',
      origen,
    };
  }

  function validate(p) {
    const e = {};
    const maxYear = new Date().getFullYear() + 1;
    if (p.nombre.length < 3) e.nombre = 'Escribe tu nombre completo.';
    if (p.whatsapp.length !== 10) e.whatsapp = 'Escribe los 10 dígitos de tu WhatsApp.';
    if (p.vehiculo.length < 2) e.vehiculo = 'Escribe la marca y el modelo.';
    if (!Number.isInteger(p.anio) || p.anio < 1980 || p.anio > maxYear) e.anio = `Escribe un año entre 1980 y ${maxYear}.`;
    if (!p.acepta) e.acepta = 'Necesitamos tu permiso para contactarte.';
    return e;
  }

  function showErrors(errors) {
    fields.forEach((f) => {
      const msg = errors[f] || '';
      $('err-' + f).textContent = msg;
      $(f).setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
    const first = fields.find((f) => errors[f]);
    if (first) $(first).focus();
  }

  const setFormError = (msg) => { $('err-form').textContent = msg || ''; };

  // ── Red ─────────────────────────────────────────────────────────
  async function send(payload) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // Cola offline: si no hay internet, guardamos y reenviamos al reconectar
  async function flushQueue() {
    let queue = load(KEY_QUEUE, []);
    if (!queue.length || !navigator.onLine) return;
    const rest = [];
    for (const item of queue) {
      try {
        const { status, data } = await send(item.payload);
        if (status === 200 && data.ok) {
          const last = { folio: data.folio, ...summary(item.payload) };
          save(KEY_LAST, last);
          renderTicket(last);
        } else if (status >= 500) {
          rest.push(item); // error temporal: reintentar después
        } // 4xx: dato inválido o promo cerrada; se descarta
      } catch {
        rest.push(item);
      }
    }
    save(KEY_QUEUE, rest);
  }

  // ── Boleto ──────────────────────────────────────────────────────
  const summary = (p) => ({ nombre: p.nombre, auto: `${p.vehiculo} ${p.anio}` });

  function renderTicket({ folio, nombre, auto, pending }) {
    $('t-folio').textContent = pending ? 'Guardado' : folio;
    $('t-estado').textContent = pending ? 'Sin internet por ahora' : 'Registro recibido';
    $('t-hint').textContent = pending
      ? 'Tu folio llega cuando vuelva la conexión.'
      : 'Toma captura de este folio.';
    $('t-nota').textContent = pending
      ? 'Guardamos tus datos en este celular y los enviamos solos cuando tengas internet. Deja la app abierta.'
      : 'Te escribimos por WhatsApp para confirmar. Tu descuento se activa en cuanto el Santos entre a la liguilla.';
    $('t-nombre').textContent = nombre;
    $('t-auto').textContent = auto;

    const wa = $('btn-wa');
    if (WHATSAPP_NUMBER && !pending) {
      const texto = `Hola, ya me registré en la promo del Santos. Mi folio es ${folio}.`;
      wa.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;
      wa.hidden = false;
    } else {
      wa.hidden = true;
    }

    vistaForm.hidden = true;
    vistaTicket.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('btn-otro').addEventListener('click', () => {
    form.reset();
    showErrors({});
    setFormError('');
    vistaTicket.hidden = true;
    vistaForm.hidden = false;
    $('nombre').focus();
  });

  // ── Envío ───────────────────────────────────────────────────────
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setFormError('');
    const payload = readForm();
    const errors = validate(payload);
    showErrors(errors);
    if (Object.keys(errors).length) return;

    btn.disabled = true;
    btn.textContent = 'Enviando…';

    try {
      const { status, data } = await send(payload);

      if (status === 200 && data.ok) {
        const last = { folio: data.folio, ...summary(payload) };
        save(KEY_LAST, last);
        form.reset();
        renderTicket(last);
      } else if (status === 422 && data.errors) {
        showErrors(data.errors);
      } else if (status === 410) {
        setFormError(data.error || 'El registro para esta promo ya cerró.');
      } else {
        setFormError(data.error || 'No pudimos guardar tu registro. Intenta de nuevo.');
      }
    } catch {
      // Sin conexión: encolamos
      const queue = load(KEY_QUEUE, []);
      queue.push({ payload, en: Date.now() });
      save(KEY_QUEUE, queue);
      form.reset();
      renderTicket({ ...summary(payload), pending: true });
    } finally {
      btn.disabled = false;
      btn.textContent = 'Registrar mi auto';
    }
  });

  // ── Arranque ────────────────────────────────────────────────────
  const last = load(KEY_LAST, null);
  const queued = load(KEY_QUEUE, []);
  if (queued.length) renderTicket({ ...summary(queued[0].payload), pending: true });
  else if (last) renderTicket(last);
  flushQueue();
  window.addEventListener('online', flushQueue);

  // ── PWA: service worker + botón de instalar ─────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('btn-instalar').hidden = false;
  });
  $('btn-instalar').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('btn-instalar').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('btn-instalar').hidden = true; });
})();
