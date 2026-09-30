\set QUIET on
SET search_path TO gis, public;
-- Проверка после загрузки
\echo '--- Сколько строк в таблицах'
SELECT 'ozf_raw' AS "таблица", count(*) AS "строк" FROM ozf_raw
UNION ALL SELECT 'mkd_ozf (МКД-ОЖФ)', count(*) FROM mkd_ozf
UNION ALL SELECT 'premises_ozf (ПомещенияОЖФ)', count(*) FROM premises_ozf;

\echo '--- Статусы'
SELECT status AS "статус", count(*) AS "количество"
FROM premises_ozf GROUP BY status ORDER BY count(*) DESC;

\echo '--- Заполненность вычисляемых полей домов'
SELECT count(*) AS "домов",
       count(postal_code) AS "с индексом",
       count(cadastral_number) AS "с кадномером МКД",
       count(region_code) AS "с кодом субъекта",
       count(gis_address_code) AS "с кодом адреса ГИС ЖКХ"
FROM mkd_ozf;

\echo '--- Контрольные дома: сверка с сайтом и образцом реестра заказчика'
WITH expected (name, address_pattern, kv, nzh, oi, chkv) AS (
  VALUES
    ('Боровая 3',     '191119, Санкт-Петербург г, ул. Боровая, д. 3, литер А',            26,  6,  4,  4),
    ('Марата 8',      '191025, Санкт-Петербург г, ул. Марата, д. 8, литер А',             49,  5, 10, 47),
    ('Фонтанки 32/1', '190000, Санкт-Петербург г, наб. Реки Фонтанки, д. 32/1, литер А', 44, 11,  2, 12)
)
SELECT e.name AS "дом",
       s.kv AS "КВ", s.nzh AS "НЖ", s.oi AS "ОИ", s.chkv AS "ЧКВ",
       concat_ws('/', e.kv, e.nzh, e.oi, e.chkv) AS "ожидалось",
       CASE
         WHEN h.house_guid IS NULL THEN 'НЕ НАЙДЕН'
         WHEN (s.kv, s.nzh, s.oi, s.chkv) = (e.kv, e.nzh, e.oi, e.chkv) THEN 'OK'
         ELSE 'РАСХОЖДЕНИЕ'
       END AS "проверка"
FROM expected e
LEFT JOIN mkd_ozf h ON h.address = e.address_pattern
LEFT JOIN house_stats s ON s.house_guid = h.house_guid
ORDER BY e.name;

\echo '--- Поиск по адресу (проверка индекса)'
EXPLAIN (COSTS OFF)
SELECT address FROM mkd_ozf WHERE lower(address) LIKE '%марата, д. 8,%';