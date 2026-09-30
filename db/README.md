# База PostgreSQL для данных ГИС ЖКХ

Таблицы лежат в отдельной схеме `gis`, чтобы не пересекаться с таблицами бота в той же базе:
`gis.houses`, `gis.premises`, `gis.rooms`, `gis.management_orgs`, представление `gis.house_stats`.
Схема таблиц черновая — поля уточняются у заказчика.

Загрузка идёт со стороны клиента (`\copy ... FROM STDIN`), поэтому одни и те же скрипты
работают и с локальной базой в Docker, и с облачной (managed), где нет доступа к диску сервера.

## Локально (Docker, данные Петербурга)

1. Скопировать `.env.example` в `.env`, указать `IMPORT_DIR` — папку с CSV из архива ОЖФ.
2. `docker compose up -d`
3. `docker exec reestr-db bash /sql/load_raw.sh` — сырые данные в `gis.ozf_raw`.
4. `docker exec reestr-db psql -U reestr -d reestr -f /sql/02_tables.sql` — раскладка по таблицам.
5. `docker exec reestr-db psql -U reestr -d reestr -f /sql/03_check.sql` — проверка.

## В облачную базу (вся Россия)

Запускать с сервера в том же облаке, где лежит архив (нужны `psql` и `tar`):

```bash
export PGHOST=... PGPORT=... PGDATABASE=... PGUSER=... PGPASSWORD=... PGSSLMODE=require
ARCHIVE=/data/ozf.tar.gz bash sql/load_raw.sh '*'   # архив читается потоком, без распаковки
psql -f sql/02_tables.sql
psql -f sql/03_check.sql
psql -f sql/04_drop_raw.sql                          # после проверки освободить 40+ ГБ
```

Требования к облачной базе: PostgreSQL 15+, расширение `pg_trgm`, диск от 100 ГБ.
