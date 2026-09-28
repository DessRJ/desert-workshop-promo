// POST /.netlify/functions/register
// Valida el registro y lo guarda en Supabase con la service key (nunca llega al navegador).

const crypto = require('crypto');

const DEADLINE = new Date(process.env.REGISTRATION_DEADLINE || '2026-11-21T23:59:59-06:00');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para evitar confusiones

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const newFolio = () =>
  'DW-' + [...crypto.randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('');

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function validate(input) {
  const errors = {};
  const nombre = clean(input.nombre, 80);
  if (nombre.length < 3) errors.nombre = 'Escribe tu nombre completo.';

  let tel = String(input.whatsapp ?? '').replace(/\D/g, '');
  if (tel.length === 12 && tel.startsWith('52')) tel = tel.slice(2);
  if (tel.length !== 10) errors.whatsapp = 'Escribe los 10 dígitos de tu WhatsApp.';

  const vehiculo = clean(input.vehiculo, 60);
  if (vehiculo.length < 2) errors.vehiculo = 'Escribe la marca y el modelo.';

  const anio = Number(input.anio);
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(anio) || anio < 1980 || anio > maxYear)
    errors.anio = `Escribe un año entre 1980 y ${maxYear}.`;

  if (input.acepta !== true) errors.acepta = 'Necesitamos tu permiso para contactarte.';

  const origen = clean(input.origen, 20).toLowerCase().replace(/[^a-z0-9_-]/g, '') || null;

  return { errors, data: { nombre, whatsapp: tel, vehiculo, anio, origen } };
}

async function sb(path, options = {}) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key) throw new Error('Faltan variables SUPABASE_URL / SUPABASE_SERVICE_KEY');
  return fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Método no permitido' });

  let input;
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Datos inválidos' });
  }

  // Honeypot: los bots llenan este campo oculto. Fingimos éxito y no guardamos nada.
  if (input.sitio) return json(200, { ok: true, folio: newFolio() });

  if (Date.now() > DEADLINE.getTime())
    return json(410, { ok: false, error: 'El registro para esta promo ya cerró.' });

  const { errors, data } = validate(input);
  if (Object.keys(errors).length) return json(422, { ok: false, errors });

  try {
    for (let intento = 0; intento < 4; intento++) {
      const folio = newFolio();
      const res = await sb('registros', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ folio, ...data }),
      });

      if (res.status === 201) return json(200, { ok: true, folio });

      if (res.status === 409) {
        // ¿Ya estaba registrado este auto? Devolvemos su folio original.
        const q =
          `registros?select=folio&whatsapp=eq.${data.whatsapp}` +
          `&vehiculo_key=eq.${encodeURIComponent(data.vehiculo.toLowerCase())}` +
          `&anio=eq.${data.anio}&limit=1`;
        const found = await sb(q);
        const rows = found.ok ? await found.json() : [];
        if (rows[0]) return json(200, { ok: true, folio: rows[0].folio, duplicado: true });
        continue; // fue colisión de folio: reintenta con otro
      }

      console.error('Supabase error', res.status, await res.text());
      break;
    }
    return json(502, { ok: false, error: 'No pudimos guardar tu registro. Intenta de nuevo.' });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: 'Error del servidor. Intenta de nuevo en un momento.' });
  }
};
