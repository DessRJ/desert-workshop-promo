-- Desert Workshop · Promo Liguilla Apertura 2026
-- Pega esto en Supabase → SQL Editor → Run

create table if not exists public.registros (
  id            bigint generated always as identity primary key,
  folio         text        not null unique,
  nombre        text        not null,
  whatsapp      text        not null,          -- 10 dígitos, sin lada país
  vehiculo      text        not null,          -- marca / modelo
  vehiculo_key  text generated always as (lower(btrim(vehiculo))) stored,
  anio          smallint    not null,
  origen        text,                          -- ig, fb, wa, etc. (viene de ?o=)
  estatus       text        not null default 'pendiente'
                check (estatus in ('pendiente','confirmado','cancelado','canjeado')),
  notas         text,
  creado_en     timestamptz not null default now()
);

-- Un mismo WhatsApp puede registrar varios autos, pero no el mismo auto dos veces
create unique index if not exists registros_unico_auto
  on public.registros (whatsapp, vehiculo_key, anio);

create index if not exists registros_creado_en_idx on public.registros (creado_en desc);

-- Seguridad: nadie puede leer/escribir desde el navegador.
-- Solo la función de Netlify (con la service key) toca la tabla.
alter table public.registros enable row level security;
