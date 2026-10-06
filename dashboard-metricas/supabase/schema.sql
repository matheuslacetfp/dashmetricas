create extension if not exists "pgcrypto";

create table if not exists public.cuts (
  id uuid primary key default gen_random_uuid(),
  file_id text not null unique check (char_length(trim(file_id)) between 1 and 100),
  rendered_on date not null default current_date,
  created_at timestamptz not null default now(),
  created_order bigint generated always as identity
);

alter table public.cuts
  add column if not exists created_order bigint generated always as identity;

create unique index if not exists cuts_created_order_key on public.cuts (created_order);
create index if not exists cuts_rendered_on_idx on public.cuts (rendered_on);

create table if not exists public.ad_progress (
  id smallint primary key default 1 check (id = 1),
  last_ad_id text not null default '' check (char_length(trim(last_ad_id)) between 0 and 100),
  updated_at timestamptz not null default now()
);

alter table public.ad_progress enable row level security;

drop policy if exists "Anyone can read AD progress" on public.ad_progress;
drop policy if exists "Anyone can create AD progress" on public.ad_progress;
drop policy if exists "Anyone can update AD progress" on public.ad_progress;

create policy "Anyone can read AD progress"
  on public.ad_progress for select
  to anon, authenticated
  using (true);

create policy "Anyone can create AD progress"
  on public.ad_progress for insert
  to anon, authenticated
  with check (id = 1);

create policy "Anyone can update AD progress"
  on public.ad_progress for update
  to anon, authenticated
  using (id = 1)
  with check (id = 1);

grant select, insert, update on public.ad_progress to anon, authenticated;

create or replace function public.get_cut_counts_by_day(start_date date, end_date date)
returns table (rendered_on date, cut_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select cuts.rendered_on, count(*)::bigint
  from public.cuts
  where cuts.rendered_on >= start_date
    and cuts.rendered_on < end_date
  group by cuts.rendered_on
  order by cuts.rendered_on;
$$;

revoke all on function public.get_cut_counts_by_day(date, date) from public;
grant execute on function public.get_cut_counts_by_day(date, date) to anon, authenticated;

create or replace function public.get_cut_date_bounds()
returns table (earliest_date date, latest_date date)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(min(cuts.rendered_on), current_date),
    greatest(coalesce(max(cuts.rendered_on), current_date), current_date)
  from public.cuts;
$$;

revoke all on function public.get_cut_date_bounds() from public;
grant execute on function public.get_cut_date_bounds() to anon, authenticated;

create or replace function public.get_cut_counts_by_range(
  start_date date,
  end_date date,
  granularity text
)
returns table (rendered_on date, cut_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case granularity
      when 'year' then date_trunc('year', cuts.rendered_on::timestamp)::date
      when 'month' then date_trunc('month', cuts.rendered_on::timestamp)::date
      when 'week' then date_trunc('week', cuts.rendered_on::timestamp)::date
      when 'day' then cuts.rendered_on
    end,
    count(*)::bigint
  from public.cuts
  where cuts.rendered_on >= start_date
    and cuts.rendered_on < end_date
    and granularity in ('year', 'month', 'week', 'day')
  group by 1
  order by 1;
$$;

revoke all on function public.get_cut_counts_by_range(date, date, text) from public;
grant execute on function public.get_cut_counts_by_range(date, date, text) to anon, authenticated;

create or replace function public.get_cut_counts_by_year()
returns table (rendered_on date, cut_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with yearly_counts as (
    select
      extract(year from cuts.rendered_on)::integer as rendered_year,
      count(*)::bigint as cut_count
    from public.cuts
    group by extract(year from cuts.rendered_on)
  ),
  year_bounds as (
    select min(yearly_counts.rendered_year) as first_year,
      max(yearly_counts.rendered_year) as last_year
    from yearly_counts
  )
  select make_date(years.rendered_year, 1, 1), coalesce(yearly_counts.cut_count, 0)
  from year_bounds
  cross join lateral generate_series(year_bounds.first_year, year_bounds.last_year, 1)
    as years(rendered_year)
  left join yearly_counts using (rendered_year)
  order by years.rendered_year;
$$;

revoke all on function public.get_cut_counts_by_year() from public;
grant execute on function public.get_cut_counts_by_year() to anon, authenticated;

create or replace function public.restore_cut_history_point(p_cut_id uuid)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  selected_order bigint;
  deleted_count bigint;
begin
  lock table public.cuts in share row exclusive mode;

  select cuts.created_order
  into selected_order
  from public.cuts
  where cuts.id = p_cut_id;

  if selected_order is null then
    raise exception 'Selected history point does not exist'
      using errcode = 'P0002';
  end if;

  delete from public.cuts as later_cuts
  where later_cuts.created_order > selected_order;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.restore_cut_history_point(uuid) from public;
grant execute on function public.restore_cut_history_point(uuid) to anon, authenticated;

alter table public.cuts enable row level security;

drop policy if exists "Authenticated users can read cuts" on public.cuts;
drop policy if exists "Authenticated users can create cuts" on public.cuts;
drop policy if exists "Authenticated users can update cuts" on public.cuts;
drop policy if exists "Anyone can read cuts" on public.cuts;
drop policy if exists "Anyone can create cuts" on public.cuts;
drop policy if exists "Anyone can update cuts" on public.cuts;
drop policy if exists "Anyone can delete cuts" on public.cuts;

create policy "Anyone can read cuts"
  on public.cuts for select
  to anon, authenticated
  using (true);

create policy "Anyone can create cuts"
  on public.cuts for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can update cuts"
  on public.cuts for update
  to anon, authenticated
  using (true)
  with check (true);

revoke delete on public.cuts from anon, authenticated;
grant select, insert, update on public.cuts to anon, authenticated;
