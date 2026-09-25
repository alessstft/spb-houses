#!/usr/bin/env bash
# Готовит данные для сайта из выгрузки ГИС ЖКХ по Санкт-Петербургу.
#
# Запуск из папки проекта:
#   bash scripts/prepare.sh ../            # папка, где лежат CSV из архива
set -euo pipefail

SRC="${1:-.}"
shopt -s nullglob
FILES=("$SRC"/*Петербург*.csv)

if [ ${#FILES[@]} -eq 0 ]; then
  echo "В папке $SRC нет файлов *Петербург*.csv" >&2
  exit 1
fi

echo "Найдено частей выгрузки: ${#FILES[@]}"
mkdir -p data/premises
rm -f data/premises/*.csv

echo "Собираю список домов..."
cat "${FILES[@]}" | awk -f scripts/houses.awk > data/spb_houses.csv

echo "Раскладываю помещения..."
awk -v out=data/premises -f scripts/premises.awk "${FILES[@]}"

echo
echo "Домов: $(($(wc -l < data/spb_houses.csv) - 1))"
ls -lh data/spb_houses.csv data/premises | awk 'NF > 5 { print $5, $NF }'
