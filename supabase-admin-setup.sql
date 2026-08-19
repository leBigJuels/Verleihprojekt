-- =====================================================
-- Verleihliste: Reservierung und Adminrechte einrichten
-- Diese Datei einmal vollständig im Supabase SQL Editor
-- ausführen.
-- =====================================================

begin;



-- -----------------------------------------------------
-- 1. Neue Anfrage reserviert den Gegenstand atomar
-- -----------------------------------------------------

create or replace function public.reserve_item_for_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    new.status := 'pending';

    update public.items
    set status = 'reserved'
    where id = new.item_id
      and status = 'available';

    if not found then
        raise exception 'Dieser Gegenstand ist nicht mehr verfügbar.';
    end if;

    return new;
end;
$$;


drop trigger if exists reserve_item_before_request
on public.requests;


create trigger reserve_item_before_request
before insert on public.requests
for each row
execute function public.reserve_item_for_request();


-- Bereits vorhandene offene Testanfragen berücksichtigen

update public.items as item
set status = 'reserved'
where item.status = 'available'
  and exists (
      select 1
      from public.requests as request
      where request.item_id = item.id
        and request.status = 'pending'
  );


-- -----------------------------------------------------
-- 2. Adminentscheidung synchronisiert den Gegenstand
-- -----------------------------------------------------

create or replace function public.sync_item_with_request_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if old.status = 'pending' and new.status = 'approved' then
        update public.items
        set status = 'loaned'
        where id = new.item_id
          and status = 'reserved';

    elsif old.status = 'pending' and new.status = 'rejected' then
        update public.items
        set status = 'available'
        where id = new.item_id
          and status = 'reserved';

    elsif old.status = 'approved' and new.status = 'completed' then
        update public.items
        set status = 'available'
        where id = new.item_id
          and status = 'loaned';

    else
        raise exception 'Dieser Statuswechsel ist nicht erlaubt.';
    end if;

    if not found then
        raise exception 'Der Gegenstandsstatus passt nicht zur Anfrage.';
    end if;

    return new;
end;
$$;


drop trigger if exists sync_item_after_request_update
on public.requests;


create trigger sync_item_after_request_update
after update of status on public.requests
for each row
when (old.status is distinct from new.status)
execute function public.sync_item_with_request_status();


-- -----------------------------------------------------
-- 3. Angemeldeter Admin darf Gegenstände ebenfalls lesen
-- -----------------------------------------------------

alter table public.items enable row level security;

grant select on public.items to authenticated;


drop policy if exists "Angemeldete Nutzer lesen Gegenstände"
on public.items;

create policy "Angemeldete Nutzer lesen Gegenstände"
on public.items
for select
to authenticated
using (true);


-- -----------------------------------------------------
-- 4. Admin darf Anfragen lesen und bearbeiten
-- -----------------------------------------------------

alter table public.requests enable row level security;

grant select, update on public.requests to authenticated;


drop policy if exists "Admin liest Anfragen"
on public.requests;

create policy "Admin liest Anfragen"
on public.requests
for select
to authenticated
using (
    (select auth.uid()) = '99840258-fdff-4a58-b014-478b2bc54b3a'::uuid
);


drop policy if exists "Admin bearbeitet Anfragen"
on public.requests;

create policy "Admin bearbeitet Anfragen"
on public.requests
for update
to authenticated
using (
    (select auth.uid()) = '99840258-fdff-4a58-b014-478b2bc54b3a'::uuid
)
with check (
    (select auth.uid()) = '99840258-fdff-4a58-b014-478b2bc54b3a'::uuid
);


commit;
