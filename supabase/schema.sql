-- Reused across this Supabase project (also used by catalogo-motos-site).
-- Safe to re-run: create or replace keeps the existing admin email intact
-- as long as the same value is used everywhere this file is applied.
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
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.parceiros (nome) values
  ('Parceiro Principal'),
  ('Jorge Consórcios')
on conflict (nome) do nothing;

-- Cards scraped from partners by the cartas-sync robot.
-- vencimento is stored as raw "DD/MM/YYYY" text (exactly as scraped) so the
-- public site's existing parseInt(carta.vencimento) day-extraction keeps
-- working unchanged — see cartas-logic.js.
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
  vencimento text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cartas_parceiros_parceiro_id_idx on public.cartas_parceiros (parceiro_id);

create trigger cartas_parceiros_set_updated_at
  before update on public.cartas_parceiros
  for each row execute function public.set_updated_at();

-- Store's own cards, full CRUD via admin.
create table public.cartas_proprias (
  id bigint generated always as identity primary key,
  administradora text not null,
  tipo text not null default 'moto' check (tipo in ('moto','carro')),
  credito numeric(12,2) not null,
  entrada numeric(12,2) not null,
  prazo int not null,
  parcela numeric(12,2) not null,
  vencimento date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cartas_proprias_set_updated_at
  before update on public.cartas_proprias
  for each row execute function public.set_updated_at();

-- Simple key/value settings.
create table public.configuracoes (
  chave text primary key,
  valor text not null
);

insert into public.configuracoes (chave, valor) values ('agio_padrao', '0')
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
