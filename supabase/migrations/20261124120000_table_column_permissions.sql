-- =============================================================================
-- Coluna de tabela travada para o mestre (pedido de 24/11/2026)
--
-- Uma tabela que o jogador edita (as habilidades, em que ele marca "escolhida") pode ter
-- colunas que só o mestre muda (`"editableBy": "gm"` na coluna: custo, nível, efeito). A tela
-- já mostra essas células como texto para o jogador; aqui o banco garante, como faz com os
-- campos inteiros, para ninguém mudar o custo de uma habilidade por fora do app.
--
-- Mesma regra de `changedLockedColumns` em src/renderer/src/lib/sheet/permissions.ts.
-- Modelo sem coluna travada não muda de comportamento.
-- =============================================================================


/*
  O patch desta tabela mexeu numa coluna travada?

  - linha que já existia (mesmo id): a célula travada tem de ficar igual; célula que falta vale
    o padrão da coluna, para uma coluna nova no modelo não parecer mudança;
  - linha nova (o jogador adicionou): a célula travada só pode nascer vazia — sem valor, "",
    0, falso ou a primeira opção da lista;
  - linha removida: não conta (remover linha é regra da tabela, não da coluna).
*/
create or replace function public.table_locked_cells_changed(
  p_component jsonb,
  p_old jsonb,
  p_new jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_column jsonb;
  v_key text;
  v_default jsonb;
  v_row jsonb;
  v_old_row jsonb;
  v_cell jsonb;
begin
  if jsonb_typeof(p_new) is distinct from 'array' then
    return false;
  end if;

  for v_column in
    select c
      from jsonb_array_elements(coalesce(p_component -> 'columns', '[]'::jsonb)) as c
     where c ->> 'editableBy' = 'gm'
       and c ->> 'kind' in ('text', 'number', 'checkbox', 'select')
  loop
    v_key := v_column ->> 'key';
    v_default := case v_column ->> 'kind'
      when 'number' then '0'::jsonb
      when 'checkbox' then 'false'::jsonb
      when 'select' then coalesce(v_column -> 'options' -> 0 -> 'id', '""'::jsonb)
      else '""'::jsonb
    end;

    for v_row in select r from jsonb_array_elements(p_new) as r loop
      v_cell := v_row -> 'cells' -> v_key;

      -- Sem linha, o SELECT INTO deixa a variável nula: é a linha nova.
      select o into v_old_row
        from jsonb_array_elements(
               case when jsonb_typeof(p_old) = 'array' then p_old else '[]'::jsonb end
             ) as o
       where o ->> 'id' = v_row ->> 'id'
       limit 1;

      if v_old_row is null then
        if v_cell is not null
           and v_cell not in ('""'::jsonb, '0'::jsonb, 'false'::jsonb, v_default) then
          return true;
        end if;
      elsif coalesce(v_cell, v_default) is distinct from coalesce(v_old_row -> 'cells' -> v_key, v_default) then
        return true;
      end if;
    end loop;
  end loop;

  return false;
end;
$$;

revoke all on function public.table_locked_cells_changed(jsonb, jsonb, jsonb)
  from public, anon, authenticated;


/*
  Salvamento campo a campo (5.7), igual ao da migração 20261029120000, com uma regra a mais:
  o jogador não grava uma tabela em que mudou uma coluna travada para o mestre.
*/
create or replace function public.patch_sheet(
  p_sheet_id uuid,
  p_changes jsonb,
  p_computed jsonb default null,
  p_gm_computed jsonb default null,
  p_summary jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sheet public.sheets;
  v_is_gm boolean;
  v_schema jsonb;
  v_key text;
  v_value jsonb;
  v_component jsonb;
  v_shared jsonb := '{}'::jsonb;
  v_gm jsonb := '{}'::jsonb;
  v_rejected text[] := '{}';
  v_gm_values jsonb;
begin
  select * into v_sheet from public.sheets where id = p_sheet_id for update;
  if not found then
    raise exception 'Ficha não encontrada.' using errcode = 'P0002';
  end if;

  v_is_gm := public.is_gm(v_sheet.session_id);
  if not v_is_gm and not (
    v_sheet.owner_id = auth.uid()
    and v_sheet.kind = 'character'
    and public.is_member(v_sheet.session_id)
  ) then
    -- Mesma resposta de "não existe": quem não pode ver não descobre que a ficha existe.
    raise exception 'Ficha não encontrada.' using errcode = 'P0002';
  end if;

  select schema into v_schema
    from public.sheet_template_versions
   where template_id = v_sheet.template_id
     and version = v_sheet.template_version;

  for v_key, v_value in select key, value from jsonb_each(coalesce(p_changes, '{}'::jsonb)) loop
    v_component := public.sheet_component(v_schema, v_key);

    -- Campo que não existe nesta versão, ou que não guarda valor: ignorado em silêncio,
    -- como no app.
    if v_component is null
       or v_component ->> 'type' in ('heading', 'computed', 'rollButton') then
      continue;
    end if;

    if not v_is_gm
       and (v_component ->> 'visibleTo' = 'gm' or v_component ->> 'editableBy' = 'gm') then
      v_rejected := v_rejected || v_key;
      continue;
    end if;

    -- Tabela que o jogador edita, mas com coluna só do mestre: compara com o que está gravado.
    if not v_is_gm
       and v_component ->> 'type' = 'table'
       and public.table_locked_cells_changed(v_component, v_sheet."values" -> v_key, v_value) then
      v_rejected := v_rejected || v_key;
      continue;
    end if;

    if v_component ->> 'visibleTo' = 'gm' then
      v_gm := v_gm || jsonb_build_object(v_key, v_value);
    else
      v_shared := v_shared || jsonb_build_object(v_key, v_value);
    end if;
  end loop;

  if cardinality(v_rejected) > 0 then
    raise exception 'Sem permissão para alterar este campo.'
      using errcode = '42501', detail = array_to_string(v_rejected, ',');
  end if;

  update public.sheets
     set "values" = ("values" - array(select jsonb_object_keys(v_gm))) || v_shared,
         computed = coalesce(p_computed, computed),
         summary = coalesce(p_summary, summary),
         updated_at = now()
   where id = p_sheet_id
  returning * into v_sheet;

  if v_is_gm then
    update public.sheet_gm_data
       set "values" = ("values" - array(select jsonb_object_keys(v_shared))) || v_gm,
           computed = coalesce(p_gm_computed, computed),
           updated_at = now()
     where sheet_id = p_sheet_id
    returning "values" into v_gm_values;
  end if;

  return jsonb_build_object(
    'values', v_sheet."values",
    'gm_values', v_gm_values,
    'updated_at', v_sheet.updated_at
  );
end;
$$;
