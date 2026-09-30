#!/usr/bin/env bash
# Выгружает один дом и его помещения в CSV для Excel (UTF-8 с BOM, разделитель «;»).
# Дом задаётся кадастровым номером МКД, по умолчанию — Боровая 3.
#   docker exec reestr-db bash /sql/export_house.sh 78:31:0001693:2005
# Файлы появятся в контейнере в /tmp/export: «Дом.csv» (карточка дома) и «Помещения.csv».
set -euo pipefail

CAD="${1:-78:31:0001693:2005}"
if [[ ! "$CAD" =~ ^[0-9:]+$ ]]; then
  echo "Кадастровый номер должен состоять из цифр и двоеточий: $CAD" >&2
  exit 1
fi

export PGUSER="${PGUSER:-$POSTGRES_USER}" PGDATABASE="${PGDATABASE:-$POSTGRES_DB}"
OUT=/tmp/export
BOM=$'\xEF\xBB\xBF'   # метка UTF-8, чтобы Excel правильно показал кириллицу
rm -rf "$OUT" && mkdir -p "$OUT"

export_csv() {
  local file="$1" query="$2"
  { printf '%s' "$BOM"
    psql -v ON_ERROR_STOP=1 -c "\copy ($query) to stdout with (format csv, header, delimiter ';')"
  } > "$OUT/$file"
  echo "$file: $(($(wc -l < "$OUT/$file") - 1)) строк"
}

# Карточка дома вертикально: «поле — значение», как на листе «Дом» в реестре.
# В скобках — название поля в базе, чтобы заказчику было проще согласовать названия.
export_csv "Дом.csv" "
  select f.field as \"Поле\", f.value as \"Значение\"
  from gis.mkd_ozf m
  join gis.house_stats s using (house_guid)
  cross join lateral (values
    (1,  'Адрес МКД (address)',                         m.address),
    (2,  'Почтовый индекс (postal_code)',               m.postal_code),
    (3,  'Код субъекта РФ (region_code)',               m.region_code),
    (4,  'Кадастровый номер МКД (cadastral_number)',    m.cadastral_number),
    (5,  'GUID дома (house_guid)',                      m.house_guid::text),
    (6,  'GUID дома по ФИАС (fias_house_guid)',         m.fias_house_guid::text),
    (7,  'Код адреса в ГИС ЖКХ (gis_address_code)',     m.gis_address_code),
    (8,  'ОКТМО (oktmo)',                               m.oktmo),
    (9,  'Способ управления (management_type)',         m.management_type),
    (10, 'Управляющая организация (org_name)',          m.org_name),
    (11, 'ОГРН УО (org_ogrn)',                          m.org_ogrn),
    (12, 'КПП УО (org_kpp)',                            m.org_kpp),
    (13, 'Тип дома (house_type)',                       m.house_type),
    (14, 'Состояние (house_state)',                     m.house_state),
    (15, 'Общая площадь, м² (total_area)',              replace(m.total_area::text, '.', ',')),
    (16, 'Жилая площадь, м² (living_area)',             replace(m.living_area::text, '.', ',')),
    (17, 'Дата сноса (demolition_date)',                m.demolition_date),
    (20, 'КВ — квартир',                                s.kv::text),
    (21, 'НЖ — нежилых',                                s.nzh::text),
    (22, 'ММ — машино-мест',                            s.mm::text),
    (23, 'ОИ — общее имущество',                        s.oi::text),
    (24, 'ЛК',                                          s.lk::text),
    (25, 'ЧКВ — комнат',                                s.chkv::text),
    (26, 'ERR — не подошло ни одно правило',            s.err::text)
  ) as f(n, field, value)
  where m.cadastral_number = '$CAD'
  order by f.n"

# Помещения: понятные столбцы, статусы в порядке реестра, номера по возрастанию
export_csv "Помещения.csv" "
  select p.status              as \"Статус (status)\",
         p.premise_address     as \"Адрес помещения (premise_address)\",
         p.premise_number      as \"№ помещения (premise_number)\",
         p.room_number         as \"№ комнаты (room_number)\",
         p.premise_type        as \"Тип помещения (premise_type)\",
         p.cadastral_number    as \"Кадастровый номер (cadastral_number)\",
         p.house_cadastral_number as \"Кадномер МКД (house_cadastral_number)\",
         p.fias_id             as \"ID-FIAS (fias_id)\",
         p.premise_guid        as \"GUID помещения (premise_guid)\",
         p.room_guid           as \"GUID комнаты (room_guid)\"
  from gis.premises_ozf p
  join gis.mkd_ozf m using (house_guid)
  where m.cadastral_number = '$CAD'
  order by array_position(array['МКД','КВ','НЖ','ММ','ОИ','ЛК','ЧКВ','ERR'], p.status),
           substring(p.premise_number from '^[0-9]+')::int nulls first,
           p.premise_number,
           substring(p.room_number from '^[0-9]+')::int nulls first,
           p.room_number"