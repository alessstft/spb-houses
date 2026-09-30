SET client_min_messages = warning;
SET search_path TO gis, public;
-- Раскладка ozf_raw по таблицам заказчика: МКД-ОЖФ (дома) и ПомещенияОЖФ (помещения).
-- Названия полей предложены нами и ждут согласования.

-- В managed PostgreSQL расширение иногда включается в консоли провайдера
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Безопасные преобразования: мусор в данных превращается в NULL, а не в ошибку загрузки
CREATE OR REPLACE FUNCTION to_uuid(value text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN value::uuid END
$$;

CREATE OR REPLACE FUNCTION to_num(value text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN replace(value, ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$'
              THEN replace(value, ',', '.')::numeric END
$$;

CREATE OR REPLACE FUNCTION clean_cadastral(value text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN trim(coalesce(value, '')) IN ('', 'нет', '-') THEN NULL ELSE trim(value) END
$$;

-- Правила статусов (те же, что в scripts/*.awk и js/statuses.js)
CREATE OR REPLACE FUNCTION premise_status(kind text, cadastral text, room text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN coalesce(kind, '') = ''                                    THEN 'МКД'
    WHEN kind ILIKE '%машино%'                                      THEN 'ММ'
    WHEN kind = 'Жилое'   AND clean_cadastral(cadastral) IS NOT NULL THEN 'КВ'
    WHEN kind = 'Нежилое' AND clean_cadastral(cadastral) IS NOT NULL THEN 'НЖ'
    WHEN kind = 'Нежилое'                                           THEN 'ОИ'
    WHEN kind = 'Жилое'   AND coalesce(room, '') <> ''              THEN 'ЧКВ'
    ELSE 'ERR'
  END
$$;

-- таблицы предыдущей версии схемы
DROP TABLE IF EXISTS rooms, premises, houses, management_orgs CASCADE;
DROP TABLE IF EXISTS premises_ozf, mkd_ozf CASCADE;

-- МКД-ОЖФ: одна строка на дом. Данные берём из строки самого дома (тип помещения пустой), если она есть
CREATE TABLE mkd_ozf AS
SELECT DISTINCT ON (to_uuid(house_guid))
  to_uuid(house_guid)                  AS house_guid,        -- 21
  address,                                                  -- 1  Адрес МКД
  substring(address FROM '^\s*(\d{6})') AS postal_code,      -- почтовый индекс из адреса
  NULL::text                           AS region_code,       -- код субъекта РФ, заполняется ниже
  NULL::text                           AS cadastral_number,  -- кадастровый номер МКД, заполняется ниже
  nullif(gis_address_code, '')         AS gis_address_code,  -- 2
  to_uuid(fias_house_guid)             AS fias_house_guid,   -- 3
  oktmo,                                                    -- 4
  management_type,                                          -- 5
  nullif(org_ogrn, '')                 AS org_ogrn,          -- 6
  nullif(org_kpp, '')                  AS org_kpp,           -- 7
  org_name,                                                 -- 8
  house_type,                                               -- 9
  house_state,                                              -- 10
  to_num(total_area)                   AS total_area,        -- 11
  to_num(living_area)                  AS living_area,       -- 12
  dorm_region,                                              -- 13
  dorm_municipal,                                           -- 14
  nullif(dorm_type, '-')               AS dorm_type,         -- 15
  nullif(demolition_date, '')          AS demolition_date,   -- 17
  regexp_replace(source_file, '^Сведения по ОЖФ (.*) на [0-9-]+(_[0-9]+)?\.csv$', '\1') AS source_region
FROM ozf_raw
WHERE to_uuid(house_guid) IS NOT NULL
ORDER BY to_uuid(house_guid), (coalesce(premise_type, '') = '') DESC;
ALTER TABLE mkd_ozf ADD PRIMARY KEY (house_guid);

-- ПомещенияОЖФ: все строки выгрузки, включая строку самого дома (МКД) и комнаты
CREATE TABLE premises_ozf (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  house_guid             uuid NOT NULL REFERENCES mkd_ozf,  -- 21
  status                 text NOT NULL,                     -- СТАТУС
  premise_type           text,                              -- 16
  premise_number         text,                              -- 18
  room_number            text,                              -- 19
  cadastral_number       text,                              -- 20
  premise_guid           uuid,                              -- 22
  room_guid              uuid,                              -- 23
  house_cadastral_number text,                              -- кадастровый номер МКД
  premise_address        text,                              -- адрес помещения
  fias_id                uuid                               -- ID-FIAS по статусу
);

INSERT INTO premises_ozf (house_guid, status, premise_type, premise_number, room_number,
                          cadastral_number, premise_guid, room_guid)
SELECT to_uuid(house_guid),
       premise_status(premise_type, cadastral_number, room_number),
       nullif(premise_type, ''),
       nullif(premise_number, ''),
       nullif(room_number, ''),
       clean_cadastral(cadastral_number),
       to_uuid(premise_guid),
       to_uuid(room_guid)
FROM ozf_raw
WHERE to_uuid(house_guid) IS NOT NULL;

-- Кадастровый номер МКД и код субъекта берём из строки дома
UPDATE mkd_ozf m
SET cadastral_number = p.cadastral_number,
    region_code      = substring(p.cadastral_number FROM '^(\d{2}):')
FROM premises_ozf p
WHERE p.house_guid = m.house_guid AND p.status = 'МКД' AND p.cadastral_number IS NOT NULL;

-- Вычисляемые поля помещения
UPDATE premises_ozf p
SET house_cadastral_number = m.cadastral_number,
    fias_id = CASE p.status
                WHEN 'МКД' THEN p.house_guid
                WHEN 'ЧКВ' THEN coalesce(p.room_guid, p.premise_guid)
                ELSE p.premise_guid
              END,
    -- «…, литер А, кв. 3», «…, пом. 1-Н», «…, кв. 17, ком. 2,5»; у МКД — адрес дома
    premise_address = regexp_replace(m.address, '^\s*\d{6},\s*', '')
      || CASE
           WHEN p.status = 'МКД' OR p.premise_number IS NULL THEN ''
           WHEN p.premise_type = 'Жилое' THEN ', кв. ' || p.premise_number
           ELSE ', пом. ' || p.premise_number
         END
      || CASE WHEN p.room_number IS NOT NULL THEN ', ком. ' || p.room_number ELSE '' END
FROM mkd_ozf m
WHERE m.house_guid = p.house_guid;

-- Индексы для поиска и связей
CREATE INDEX ON mkd_ozf (fias_house_guid);
CREATE INDEX ON mkd_ozf (cadastral_number);
CREATE INDEX ON mkd_ozf (region_code);
CREATE INDEX mkd_ozf_address_trgm ON mkd_ozf USING gin (lower(address) gin_trgm_ops);
CREATE INDEX ON premises_ozf (house_guid);
CREATE INDEX ON premises_ozf (cadastral_number);
CREATE INDEX ON premises_ozf (premise_guid);

-- Статистика по дому: сколько объектов каждого статуса (строка МКД не считается)
CREATE OR REPLACE VIEW house_stats AS
SELECT m.house_guid,
       count(*) FILTER (WHERE p.status = 'КВ')  AS kv,
       count(*) FILTER (WHERE p.status = 'НЖ')  AS nzh,
       count(*) FILTER (WHERE p.status = 'ММ')  AS mm,
       count(*) FILTER (WHERE p.status = 'ОИ')  AS oi,
       count(*) FILTER (WHERE p.status = 'ЛК')  AS lk,
       count(*) FILTER (WHERE p.status = 'ЧКВ') AS chkv,
       count(*) FILTER (WHERE p.status = 'ERR') AS err
FROM mkd_ozf m
LEFT JOIN premises_ozf p ON p.house_guid = m.house_guid
GROUP BY m.house_guid;

ANALYZE;