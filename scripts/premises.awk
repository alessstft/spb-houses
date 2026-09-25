# Раскладывает помещения по 16 файлам p_0.csv ... p_f.csv
# (по первому символу GUID дома), чтобы сайт грузил только нужную часть.
#
# Формат файла:
#   #<GUID дома>
#   СТАТУС|№ помещения|№ комнаты|Кадастровый номер|ФИАС ID
#
# ФИАС ID зависит от статуса: у МКД — GUID дома, у комнат (ЧКВ) — GUID комнаты,
# у остальных — GUID помещения.
#
# Запуск: awk -v out=data/premises -f scripts/premises.awk выгрузка*.csv

BEGIN {
  FS = "|"; OFS = "|"
  if (out == "") out = "premises"
  system("mkdir -p '" out "'")
}

FNR == 1 { next }   # заголовок в каждой части выгрузки

{
  kind   = trim($16)
  number = trim($18)
  room   = trim($19)
  cad    = trim($20)
  if (cad == "нет" || cad == "-") cad = ""

  house = $21; gsub(/[ \t\r]/, "", house)
  if (house == "") house = $1

  shard = (house ~ /^[0-9a-f]/) ? substr(house, 1, 1) : "x"
  file = out "/p_" shard ".csv"

  if (last[shard] != house) {
    print "#" house > file
    last[shard] = house
  }
  st = status(kind, cad, room)
  print st, number, room, cad, fiasId(st, house) > file
  total++
}

END { printf "Помещений разложено: %d\n", total > "/dev/stderr" }

function fiasId(st, house,    id) {
  if (st == "МКД") return (house == $1) ? "" : house
  id = (st == "ЧКВ") ? trim($23) : ""
  if (id == "") id = trim($22)
  return id
}

function trim(s) { gsub(/^[ \t]+|[ \t\r]+$/, "", s); return s }

# Те же правила, что в status.awk
function status(kind, cad, room) {
  if (kind == "")                          return "МКД"
  if (kind == "Жилое"   && cad != "")      return "КВ"
  if (kind == "Нежилое" && cad != "")      return "НЖ"
  if (kind == "Нежилое")                   return "ОИ"
  if (kind == "Жилое"   && room != "")     return "ЧКВ"
  return "?"
}
