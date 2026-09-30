SET client_min_messages = warning;

-- Все таблицы ГИС ЖКХ живут в отдельной схеме gis,
-- чтобы не пересекаться с таблицами бота в той же базе (там тоже есть houses)
CREATE SCHEMA IF NOT EXISTS gis;
SET search_path TO gis, public;
-- Промежуточная таблица: выгрузка ОЖФ как есть, все поля текстом.
-- source_file — имя файла, из него берётся регион.
DROP TABLE IF EXISTS ozf_raw;

CREATE TABLE ozf_raw (
  source_file      text,
  address          text,  -- Адрес ОЖФ
  gis_address_code text,  -- Идентификационный код адреса дома в ГИС ЖКХ
  fias_house_guid  text,  -- ГУИД дома по ФИАС
  oktmo            text,
  management_type  text,  -- Способ управления
  org_ogrn         text,
  org_kpp          text,
  org_name         text,
  house_type       text,
  house_state      text,
  total_area       text,
  living_area      text,
  dorm_region      text,  -- общежитие в собственности субъекта РФ
  dorm_municipal   text,  -- общежитие в муниципальной собственности
  dorm_type        text,
  premise_type     text,  -- Тип помещения (блока)
  demolition_date  text,
  premise_number   text,
  room_number      text,
  cadastral_number text,
  house_guid       text,
  premise_guid     text,
  room_guid        text
);
