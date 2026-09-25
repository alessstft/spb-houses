# Сворачивает выгрузку ГИС ЖКХ (строка = помещение) в список домов.
# Запуск: cat выгрузка*.csv | awk -f scripts/houses.awk > data/spb_houses.csv

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

  # помещение считаем один раз, даже если у него несколько комнат
  if ($22 != "") {
    key = house SUBSEP $22
    if (!(key in seen)) {
      seen[key] = 1
      premises[house]++
      if ($16 == "Жилое") livingCount[house]++
      else nonLiving[house]++
    }
  }
  if ($23 != "") rooms[house]++
}

END {
  print "Адрес", "GUID дома", "GUID ФИАС", "ОКТМО", "Способ управления", "ОГРН УО",
        "Управляющая организация", "Тип дома", "Состояние", "Общая площадь", "Жилая площадь",
        "Дата сноса", "Помещений всего", "Жилых помещений", "Нежилых помещений", "Комнат"
  for (i = 1; i <= count; i++) {
    h = order[i]
    print address[h], h, fias[h], oktmo[h], method[h], ogrn[h], company[h], kind[h], state[h],
          area[h], living[h], demolished[h], premises[h] + 0, livingCount[h] + 0,
          nonLiving[h] + 0, rooms[h] + 0
  }
}
