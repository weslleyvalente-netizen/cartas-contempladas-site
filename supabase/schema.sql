-- Reused across this Supabase project (also used by catalogo-motos-site).
-- ⚠️ Substitute SEU_EMAIL_AQUI@exemplo.com below with the real admin email
-- BEFORE running this file — exactly as already done for catalogo-motos-site
-- in this same Supabase project. Pasting this file with the placeholder
-- still in place will overwrite the shared is_admin() function and lock
-- the real admin out of BOTH admin panels.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select (select auth.jwt() ->> 'email') = 'SEU_EMAIL_AQUI@exemplo.com';
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Partners (Parceiro Principal, Jorge Consórcios, ...)
create table public.parceiros (
  id bigint generated always as identity primary key,
  nome text not null unique,
  link text,
  agio_padrao numeric(12,2),
  faixa_inicial int not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.parceiros (nome, faixa_inicial) values
  ('Parceiro Principal', 300),
  ('Jorge Consórcios', 200)
on conflict (nome) do nothing;

-- Cards scraped from partners by the cartas-sync robot.
-- vencimento is stored as raw "DD/MM/YYYY" text (exactly as scraped) so
-- cartas-logic.js's mesclarCartas() can keep doing its
-- parseInt(c.vencimento, 10) day-extraction unchanged.
create table public.cartas_parceiros (
  id bigint generated always as identity primary key,
  parceiro_id bigint not null references public.parceiros(id) on delete cascade,
  codigo text not null,
  administradora text not null default 'YAMAHA',
  tipo text not null default 'moto' check (tipo in ('moto','carro')),
  credito numeric(12,2) not null,
  entrada numeric(12,2) not null,
  agio numeric(12,2),
  prazo int not null,
  parcela numeric(12,2) not null,
  vencimento text not null check (vencimento ~ '^\d{2}/\d{2}/\d{4}$'),
  numero_sequencial int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parceiro_id, codigo)
);

create index cartas_parceiros_parceiro_id_idx on public.cartas_parceiros (parceiro_id);

create trigger cartas_parceiros_set_updated_at
  before update on public.cartas_parceiros
  for each row execute function public.set_updated_at();

-- NOTE: this table already exists in the live Supabase project (from the
-- previous cartas-admin plan). Adding grupo/cota to a live database is a
-- separate ALTER TABLE, run by hand during deployment — see Task 5 of the
-- 2026-08-14-cartas-pdf-import plan. This CREATE TABLE definition only
-- matters for a fresh install of this schema.
-- Store's own cards, full CRUD via admin.
create table public.cartas_proprias (
  id bigint generated always as identity primary key,
  administradora text not null,
  grupo text,
  cota text,
  tipo text not null default 'moto' check (tipo in ('moto','carro')),
  credito numeric(12,2) not null,
  entrada numeric(12,2) not null,
  prazo int not null,
  parcela numeric(12,2) not null,
  vencimento date not null,
  numero_sequencial int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cartas_proprias_set_updated_at
  before update on public.cartas_proprias
  for each row execute function public.set_updated_at();

-- Assigns a short, per-carta-fixed sequential number. Each origin (each
-- partner, and cartas próprias) has its own numeric range, starting at
-- that origin's faixa_inicial (parceiros.faixa_inicial, or the
-- configuracoes 'faixa_inicial_proprias' entry for cartas próprias), and
-- its own independent monthly reset back to the start of its range. Only
-- ever set on INSERT — a carta keeps its number even after the month
-- rolls over. Runs even on rows that end up as no-op UPDATEs via
-- upsert's ON CONFLICT DO UPDATE (the computed value is simply discarded
-- in that case, since it never becomes a persisted row), so it never
-- wastes numbers or leaves gaps.
create or replace function public.atribuir_numero_sequencial()
returns trigger
language plpgsql
as $$
declare
  mes_atual date := date_trunc('month', now());
  faixa int;
  max_atual int;
begin
  if TG_TABLE_NAME = 'cartas_proprias' then
    -- Serializes assignment across concurrent transactions writing
    -- cartas próprias (only admin does this today, but kept for safety).
    perform pg_advisory_xact_lock(hashtext('numero_sequencial_proprias'));

    select coalesce(valor::int, 1) into faixa
      from public.configuracoes where chave = 'faixa_inicial_proprias';

    select coalesce(max(numero_sequencial), faixa - 1) into max_atual
      from public.cartas_proprias
      where date_trunc('month', created_at) = mes_atual;
  else
    -- Serializes per partner (admin + cartas-sync robot writing the same
    -- partner's cards at the same time) without blocking other partners.
    perform pg_advisory_xact_lock(hashtext('numero_sequencial_parceiro_' || new.parceiro_id));

    select faixa_inicial into faixa
      from public.parceiros where id = new.parceiro_id;

    select coalesce(max(numero_sequencial), faixa - 1) into max_atual
      from public.cartas_parceiros
      where parceiro_id = new.parceiro_id
        and date_trunc('month', created_at) = mes_atual;
  end if;

  new.numero_sequencial := greatest(max_atual + 1, faixa);
  return new;
end;
$$;

create trigger cartas_proprias_numero_sequencial
  before insert on public.cartas_proprias
  for each row execute function public.atribuir_numero_sequencial();

create trigger cartas_parceiros_numero_sequencial
  before insert on public.cartas_parceiros
  for each row execute function public.atribuir_numero_sequencial();

-- Simple key/value settings.
create table public.configuracoes (
  chave text primary key,
  valor text not null
);

insert into public.configuracoes (chave, valor) values ('agio_padrao', '0')
on conflict (chave) do nothing;

insert into public.configuracoes (chave, valor) values ('faixa_inicial_proprias', '1')
on conflict (chave) do nothing;

-- Row Level Security
alter table public.parceiros enable row level security;
alter table public.parceiros force row level security;
alter table public.cartas_parceiros enable row level security;
alter table public.cartas_parceiros force row level security;
alter table public.cartas_proprias enable row level security;
alter table public.cartas_proprias force row level security;
alter table public.configuracoes enable row level security;
alter table public.configuracoes force row level security;

-- parceiros: anon reads everything (site needs ativo + nome to merge/filter),
-- admin (is_admin()) can fully manage.
create policy parceiros_public_read on public.parceiros
  for select to anon using (true);

create policy parceiros_admin_all on public.parceiros
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- cartas_parceiros: anon reads everything (site applies the ativo filter
-- client-side via the parceiros join); admin can read all columns but can
-- only ever WRITE the `agio` column — insert/delete stay reserved for the
-- cartas-sync robot, which uses the service_role key and bypasses RLS
-- entirely, so no policy is needed for it.
create policy cartas_parceiros_public_read on public.cartas_parceiros
  for select to anon using (true);

create policy cartas_parceiros_admin_read on public.cartas_parceiros
  for select to authenticated using (public.is_admin());

create policy cartas_parceiros_admin_update on public.cartas_parceiros
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke update on public.cartas_parceiros from authenticated;
grant select on public.cartas_parceiros to authenticated;
grant update (agio) on public.cartas_parceiros to authenticated;

-- cartas_proprias: anon reads everything, admin has full CRUD.
create policy cartas_proprias_public_read on public.cartas_proprias
  for select to anon using (true);

create policy cartas_proprias_admin_all on public.cartas_proprias
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- configuracoes: anon reads (site needs agio_padrao), admin has full CRUD.
create policy configuracoes_public_read on public.configuracoes
  for select to anon using (true);

create policy configuracoes_admin_all on public.configuracoes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
