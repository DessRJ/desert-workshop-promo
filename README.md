# Desert Workshop · Registro Promo Santos (PWA)

Formulario instalable (PWA) hospedado en **Netlify**, que guarda cada registro en **Supabase (Postgres)** a través de una función serverless. Las llaves de la base de datos nunca llegan al navegador.

```
public/                     ← sitio estático (lo que ve el cliente)
  index.html, styles.css, app.js
  sw.js, manifest.webmanifest, icons/
netlify/functions/register.js   ← valida y guarda en Supabase
supabase/schema.sql             ← tabla `registros`
netlify.toml
```

## 1. Base de datos (Supabase, gratis)
1. Crea un proyecto en https://supabase.com.
2. **SQL Editor → New query**, pega `supabase/schema.sql` → **Run**.
3. **Project Settings → API** y copia:
   - **Project URL**
   - **service_role key** (secreta, solo va en Netlify, nunca en el código)

## 2. Netlify
1. Sube esta carpeta a un repo de GitHub (o arrastra la carpeta completa en Netlify → *Add new site → Deploy manually*; para que las funciones se desplieguen es mejor usar GitHub).
2. **Site configuration → Environment variables** y agrega:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | tu Project URL |
| `SUPABASE_SERVICE_KEY` | tu service_role key |
| `REGISTRATION_DEADLINE` | (opcional) `2026-11-21T18:00:00-06:00`, ajústala a la hora del silbatazo |

3. Redeploy. Prueba en `https://TU-SITIO.netlify.app`.

## 3. Ver y exportar registros
Supabase → **Table Editor → registros**. Ahí puedes filtrar, cambiar `estatus` (pendiente / confirmado / cancelado / canjeado) y exportar a CSV.

## 4. Links para redes (medir qué post funciona)
El parámetro `?o=` se guarda en la columna `origen`:
- Instagram (bio): `https://TU-SITIO.netlify.app/?o=ig`
- Facebook (1er comentario): `https://TU-SITIO.netlify.app/?o=fb`
- WhatsApp / estados: `?o=wa`

## 5. Personalizar
- **Botón de WhatsApp en el boleto**: en `public/app.js`, pon tu número en `WHATSAPP_NUMBER` (con lada país, ej. `'528711234567'`).
- **Actualizar la app**: si cambias archivos de `public/`, sube `VERSION` en `public/sw.js` (`dw-v2`, `dw-v3`…) para que los celulares descarguen la versión nueva.
- **Probar como app**: en Android/Chrome aparece "Instalar la app"; en iPhone: Compartir → *Agregar a pantalla de inicio*.

## Qué mejoré respecto al formulario original
- El formulario ahora **sí envía y guarda** los datos (antes no hacía nada).
- Se corrigió el script de Tailwind (la URL era incorrecta); ahora es CSS propio, ligero y funciona sin internet.
- Validación en el celular **y** en el servidor; el WhatsApp se acepta con o sin +52.
- Folio único (`DW-XXXXXX`) que ya prometen los posts; si alguien se registra dos veces con el mismo auto recibe su folio original, no un duplicado.
- Casilla de permiso para contactar por WhatsApp y aviso de privacidad.
- Anti-spam (campo trampa) y cierre automático de la promo en la fecha límite.
- Funciona sin internet: guarda el registro en el celular y lo envía al reconectar.
- Identidad Santos: verde `#008066`, dorado `#FDB927`, negro `#211F1F` y blanco.
