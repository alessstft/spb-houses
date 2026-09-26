# Сворачивает выгрузку ГИС ЖКХ (строка = помещение) в список домов.
# Запуск: cat выгрузка*.csv | awk -f scripts/houses.awk > data/spb_houses.csv
#
# Статусы помещений считаются по тем же правилам, что в status.awk:
# МКД, КВ, НЖ, ММ, ОИ, ЛК, ЧКВ, ERR.

BEGIN { FS = "|"; OFS = "|" }

$1 == "Адрес ОЖФ" { next }   # заголовки частей выгрузки

{
  house = $21
  if (house == "") house = $1

  if (!(house in address)) {
    order[++count] = house
    address[house] = $1;  fias[house] = $3;    oktmo[house] = $4
    method[house]  = $5;  ogrn[house] = $6;    company[house] = $8
    kind[house]    = $9;  state[house] = $10
    area[house]    = $11; living[house] = $12; demolished[house] = $17
  }

  type = trim($16); room = trim($19); cad = trim($20)
  if (cad == "нет" || cad == "-") cad = ""
  st = status(type, cad, room)

  if (st == "МКД") {
    houseStatus[house] = "МКД"
    houseCad[house] = cad
  } else {
    byStatus[house, st]++
  }

  # помещение считаем один раз, даже если у него несколько комнат
  if ($22 != "" && !((house, $22) in seen)) {
    seen[house, $22] = 1
    premises[house]++
  }

  # квартиры, где учтены отдельные комнаты
  if (st == "ЧКВ" && !((house, "flat", $18) in seen)) {
    seen[house, "flat", $18] = 1
    roomFlats[house]++
  }
}

END {
  print "Адрес", "Статус", "Кадастровый номер", "GUID дома", "GUID ФИАС", "ОКТМО",
        "Способ управления", "ОГРН УО", "Управляющая организация", "Тип дома", "Состояние",
        "Общая площадь", "Жилая площадь", "Дата сноса", "Помещений всего",
        "КВ", "НЖ", "ММ", "ОИ", "ЛК", "ЧКВ", "ERR", "Квартир с комнатами"
  for (i = 1; i <= count; i++) {
    h = order[i]
    print address[h], houseStatus[h], houseCad[h], h, fias[h], oktmo[h],
          method[h], ogrn[h], company[h], kind[h], state[h],
          area[h], living[h], demolished[h], premises[h] + 0,
          byStatus[h, "КВ"] + 0, byStatus[h, "НЖ"] + 0, byStatus[h, "ММ"] + 0,
          byStatus[h, "ОИ"] + 0, byStatus[h, "ЛК"] + 0, byStatus[h, "ЧКВ"] + 0,
          byStatus[h, "ERR"] + 0, roomFlats[h] + 0
  }
}

function trim(s) { gsub(/^[ \t]+|[ \t\r]+$/, "", s); return s }

function status(type, cad, room) {
  if (type == "")                          return "МКД"
  if (type ~ /ашино/)                      return "ММ"
  if (type == "Жилое"   && cad != "")      return "КВ"
  if (type == "Нежилое" && cad != "")      return "НЖ"
  if (type == "Нежилое")                   return "ОИ"
  if (type == "Жилое"   && room != "")     return "ЧКВ"
  return "ERR"
}
