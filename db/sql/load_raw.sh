#!/usr/bin/env bash
# Загрузка выгрузки ОЖФ из ГИС ЖКХ в таблицу gis.ozf_raw.
#
# Данные отправляются со стороны клиента (\copy ... FROM STDIN), поэтому скрипт
# одинаково работает с локальной базой в Docker и с облачной (managed) базой,
# где нет доступа к диску сервера.
#
# Откуда брать файлы:
#   IMPORT_DIR=/import       папка с распакованными CSV (по умолчанию)
#   ARCHIVE=/data/ozf.tar.gz архив целиком: читается потоком, без распаковки на диск
#
# Какие регионы: первый аргумент — шаблон имени, по умолчанию Петербург.
#   bash load_raw.sh                 # Санкт-Петербург
#   bash load_raw.sh '*'             # вся Россия
#
# Куда: стандартные переменные psql — PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, PGSSLMODE.
set -euo pipefail

PATTERN="${1:-*Петербург*}"
SQL_DIR="$(cd "$(dirname "$0")" && pwd)"
# внутри контейнера postgres подключаемся от имени пользователя из docker-compose
export PGUSER="${PGUSER:-${POSTGRES_USER:-}}" PGDATABASE="${PGDATABASE:-${POSTGRES_DB:-}}"

COLUMNS="address, gis_address_code, fias_house_guid, oktmo, management_type,
  org_ogrn, org_kpp, org_name, house_type, house_state, total_area, living_area,
  dorm_region, dorm_municipal, dorm_type, premise_type, demolition_date,
  premise_number, room_number, cadastral_number, house_guid, premise_guid, room_guid"

# Загружает один файл, поданный на вход (stdin); $1 — имя файла для source_file
load_stream() {
  local name="$1"
  echo "Загружаю: $name"
  psql -q -v ON_ERROR_STOP=1 -c "ALTER TABLE gis.ozf_raw ALTER COLUMN source_file SET DEFAULT '${name//\'/\'\'}'"
  psql -q -v ON_ERROR_STOP=1 \
    -c "\copy gis.ozf_raw ($COLUMNS) FROM STDIN WITH (FORMAT csv, DELIMITER '|', HEADER true)"
}

psql -q -v ON_ERROR_STOP=1 -f "$SQL_DIR/01_raw.sql"

count=0
if [ -n "${ARCHIVE:-}" ]; then
  # имена файлов берём из оглавления архива и распаковываем по одному прямо в psql
  while IFS= read -r file; do
    tar -xzOf "$ARCHIVE" "$file" | load_stream "$(basename "$file")"
    count=$((count + 1))
  done < <(tar -tzf "$ARCHIVE" | grep -E '\.csv$' | while IFS= read -r f; do
             case "$(basename "$f")" in "Сведения по ОЖФ "$PATTERN.csv) echo "$f" ;; esac
           done)
else
  shopt -s nullglob
  for path in "${IMPORT_DIR:-/import}"/Сведения\ по\ ОЖФ\ $PATTERN.csv; do
    load_stream "$(basename "$path")" < "$path"
    count=$((count + 1))
  done
fi

if [ "$count" -eq 0 ]; then
  echo "Не найдено файлов по шаблону: Сведения по ОЖФ $PATTERN.csv" >&2
  exit 1
fi

psql -q -c "ALTER TABLE gis.ozf_raw ALTER COLUMN source_file DROP DEFAULT"
psql -c "SELECT count(*) AS \"строк загружено\" FROM gis.ozf_raw"
