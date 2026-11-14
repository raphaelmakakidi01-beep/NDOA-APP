-- Devis réservés aux comptes « marié », et notification du marié quand le prestataire répond.

-- 1) Une demande de devis exige un compte connecté (non suspendu).
--    Le couple retrouve ainsi ses demandes et les réponses dans « Mon compte ».
create or replace function public.submit_inquiry_server(
  p_couple_user uuid, p_vendor_slug text, p_couple_names text, p_email text, p_phone text, p_contact_pref text,
  p_wedding_date date, p_city text, p_guests integer, p_package_id uuid, p_option_ids uuid[], p_message text, p_source text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'SERVER_ONLY' using errcode = '42501'; end if;
  if p_couple_user is null or not exists (
    select 1 from public.profiles where id = p_couple_user and suspended_at is null and deleted_at is null
  ) then
    raise exception 'ACCOUNT_REQUIRED' using errcode = '42501';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', p_couple_user, 'role', 'service_role')::text, true);
  new_id := public.submit_inquiry(p_vendor_slug, p_couple_names, p_email, p_phone, p_contact_pref, p_wedding_date,
                                  p_city, p_guests, p_package_id, p_option_ids, p_message, p_source);
  return new_id;
end $$;
revoke execute on function public.submit_inquiry_server(uuid, text, text, text, text, text, date, text, integer, uuid, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.submit_inquiry_server(uuid, text, text, text, text, text, date, text, integer, uuid, uuid[], text, text) to service_role;

-- 2) Messages : le prestataire est prévenu des messages du couple (inchangé),
--    et désormais le couple est prévenu des réponses du prestataire.
create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare i public.inquiries; vname text;
begin
  update public.inquiries
     set last_message_at = new.created_at,
         unread_vendor = unread_vendor + case when new.sender = 'couple' then 1 else 0 end,
         status = case when status = 'new' and new.sender = 'vendor' then 'discussing' else status end
   where id = new.inquiry_id
  returning * into i;
  if new.sender = 'couple' then
    insert into public.notifications (user_id, vendor_id, type, title, body, link)
    select m.user_id, i.vendor_id, 'new_message', 'Nouveau message de ' || i.couple_names,
           left(new.body, 140), '/espace/demandes/' || i.id
      from public.vendor_members m
     where m.vendor_id = i.vendor_id and m.status = 'active' and m.user_id is not null;
  elsif new.sender = 'vendor' and i.couple_user_id is not null then
    select name into vname from public.vendors where id = i.vendor_id;
    insert into public.notifications (user_id, vendor_id, type, title, body, link)
    values (i.couple_user_id, i.vendor_id, 'vendor_reply', 'Réponse de ' || coalesce(vname, 'votre prestataire'),
            left(coalesce(nullif(new.body, ''), 'Nouveau message'), 140), '/mon-compte?demande=' || i.id);
  end if;
  return new;
end $$;

-- 3) Le couple est aussi prévenu quand le statut de sa demande avance (devis envoyé, confirmée)
create or replace function public.on_inquiry_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare vname text;
begin
  if new.couple_user_id is null or new.status is not distinct from old.status or new.status not in ('quote_sent', 'confirmed') then
    return new;
  end if;
  select name into vname from public.vendors where id = new.vendor_id;
  insert into public.notifications (user_id, vendor_id, type, title, body, link)
  values (new.couple_user_id, new.vendor_id, 'inquiry_status',
          case new.status when 'quote_sent' then 'Devis reçu de ' else 'Réservation confirmée avec ' end || coalesce(vname, 'votre prestataire'),
          case new.status when 'quote_sent' then 'Consultez le devis et répondez au prestataire.' else 'Votre date est confirmée.' end,
          '/mon-compte?demande=' || new.id);
  return new;
end $$;
drop trigger if exists inquiries_status_notify on public.inquiries;
create trigger inquiries_status_notify after update of status on public.inquiries
  for each row execute function public.on_inquiry_status();
