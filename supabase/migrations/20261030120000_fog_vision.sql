-- =============================================================================
-- Fase 11 — névoa de guerra
--
-- A névoa em si mora em `maps.fog` (criada na Fase 6) e é desenhada no app. Aqui só a
-- visão do token passa a acompanhar a ficha: o raio que revela a névoa é o papel `vision`
-- da ficha, quando ela tem um (6.4). Antes ele só era copiado quando o token nascia.
--
-- Seções 6.4 e 5.6 da especificação.
-- =============================================================================


/*
  Barras e visão do token acompanhando a ficha (5.6, 6.4). Ficha sem o papel `vision` não
  mexe na visão do token: aí vale o valor que o mestre deu ao token, ou o padrão da mesa.
*/
create or replace function public.sync_token_bars()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bars jsonb := coalesce(new.summary -> 'bars', '{}'::jsonb);
  v_vision double precision :=
    case
      when jsonb_typeof(new.summary -> 'vision') = 'number'
        then least(1000, greatest(0, (new.summary ->> 'vision')::double precision))
    end;
begin
  update public.tokens
     set bars = v_bars,
         vision_m = coalesce(v_vision, vision_m)
   where sheet_id = new.id
     and (
       bars is distinct from v_bars
       or (v_vision is not null and vision_m is distinct from v_vision)
     );
  return null;
end;
$$;

revoke all on function public.sync_token_bars() from public, anon, authenticated;


/*
  O jogador continua sem mexer na visão do token na mão. Mas quando ela muda porque ele
  gravou a própria ficha (gatilho acima, de dentro de outro gatilho), é legítima — como as
  barras desde a Fase 9.
*/
create or replace function public.guard_token_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from_trigger boolean := pg_trigger_depth() > 1;
  v_trusted_bars boolean :=
    v_from_trigger or coalesce(current_setting('cantinho.hp_change', true), '') = 'on';
begin
  if public.is_gm(new.session_id) then
    return new;
  end if;

  if new.hidden is distinct from old.hidden
     or new.show_name is distinct from old.show_name
     or new.show_bars is distinct from old.show_bars
     or (new.vision_m is distinct from old.vision_m and not v_from_trigger)
     or new.sheet_id is distinct from old.sheet_id
     or new.map_id is distinct from old.map_id
     or new.kind is distinct from old.kind
     or new.owner_id is distinct from old.owner_id
     or (new.bars is distinct from old.bars and not v_trusted_bars) then
    raise exception 'Só o mestre altera isso no token.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_token_update() from public, anon, authenticated;
