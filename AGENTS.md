# AGENTS.md

## Project: openspore-server

Bun + ElysiaJS REST API сервер для мультиплеера Spore Space Stage.

## Зачем и почему

Оригинальный Spore (2008, EA/Maxis) не имел настоящего мультиплеера — только shared content
("pollination"): существа других игроков появлялись в твоей галактике автоматически через
сервер EA (pollinator.spore.com). Сервера EA отключены в 2013.

Цель проекта — добавить настоящий shared world мультиплеер в Space Stage через два компонента:

1. **openspore-server** (этот репо) — REST API бэкенд, хранит состояние галактики
2. **openspore-mod** (отдельный репо) — C++ мод на SporeModAPI, клиентская часть

Выбран мод-подход (а не реимплементация протокола EA) потому что:
- Полная свобода в механиках, не ограничены тем что EA реализовала
- SporeModAPI уже существует и задокументирован
- Ванильный клиент всё равно не подключится к живым серверам

Space Stage выбран первым потому что:
- Нет синхронизации физики в реальном времени (в отличие от Creature Stage)
- Взаимодействие асинхронное — shared world, а не twitch-мультиплеер
- Проще всего реализовать MVP

## Что сделано

### Сервер (openspore-server)

- [x] Базовая структура проекта (Bun + ElysiaJS + bun:sqlite)
- [x] Empire CRUD: register, get, heartbeat, auto-offline через setInterval
- [x] Galaxy: список всех империй включая offline, с пагинацией (`?page=&limit=`)
- [x] Diplomacy: офферы alliance/war/trade, accept/reject
- [x] SSE стрим событий с broadcast() и ping каждые 15 сек
- [x] SQLite персистентность (timestamp хранится как INTEGER ms)
- [x] Bearer token аутентификация: токен выдаётся при регистрации, защищены heartbeat/offer/accept/reject
- [x] Валидация уникальности: один playerId = одна empire (409 Conflict при дубле)
- [x] 44 теста через bun:test, все зелёные
- [x] README с инструкцией по запуску и API документацией
- [x] AGENTS.md документация

## Что осталось сделать

### Сервер (приоритет)

- [ ] **Docker + deploy** — Dockerfile, docker-compose, деплой на VPS

### Мод (openspore-mod, следующий репо)

- [ ] Настройка окружения: Visual Studio 2022 + SporeModAPI (C++17, только MSVC)
- [ ] Базовый мод: хук на загрузку Space Stage, HTTP клиент для регистрации empire
- [ ] Отображение империй других игроков в галактике
- [ ] UI: список онлайн игроков
- [ ] Дипломатия через in-game интерфейс
- [ ] SSE клиент для получения событий в реальном времени

## Stack

- Runtime: Bun
- Framework: ElysiaJS
- Database: bun:sqlite
- Tests: bun:test

## Structure

```
src/
├── index.ts           # entrypoint
├── db/index.ts        # SQLite schema + connection
├── routes/
│   ├── empire.ts      # POST /empire/register, GET /empire/:id, PATCH /empire/:id/heartbeat
│   ├── galaxy.ts      # GET /galaxy/empires
│   ├── diplomacy.ts   # POST /diplomacy/offer, GET /diplomacy/offers/:id, PATCH accept/reject
│   └── events.ts      # GET /events/stream (SSE), broadcast(), clearClients()
├── store/
│   ├── empire.ts      # empireStore
│   └── diplomacy.ts   # diplomacyStore
└── types/index.ts     # Empire, DiplomacyOffer, DiplomacyType, DiplomacyStatus
tests/
├── empire.test.ts
├── galaxy.test.ts
├── diplomacy.test.ts
└── events.test.ts
```

## Commands

```bash
bun run src/index.ts   # запуск сервера
bun test               # запуск тестов
bun test --watch       # тесты в watch режиме
```

## Rules

- Всегда писать тесты перед кодом (TDD)
- Тесты через bun:test, не jest
- Никакого Drizzle — только bun:sqlite напрямую
- Хранить timestamp как INTEGER (Date.now()), не ISO строку
- Новые роуты добавлять в src/routes/ и подключать в src/index.ts
- Новые сторы добавлять в src/store/ и импортировать в роуты
- broadcast() вызывать после каждого мутирующего действия
- clear() должен быть в каждом сторе для тестов
- clearClients() экспортировать из events.ts для тестов

## API

### Empire
- `POST /empire/register` — регистрация империи `{ playerId, name, homeWorld, color: [r,g,b] }`
- `GET /empire/:id` — получить империю по id
- `PATCH /empire/:id/heartbeat` — обновить online статус и lastSeen

### Galaxy
- `GET /galaxy/empires` — список всех империй включая offline (пагинация: `?page=1&limit=50`)

### Diplomacy
- `POST /diplomacy/offer` — создать оффер `{ fromId, toId, type: alliance|war|trade }`
- `GET /diplomacy/offers/:empireId` — входящие офферы для империи
- `PATCH /diplomacy/offer/:id/accept` — принять оффер
- `PATCH /diplomacy/offer/:id/reject` — отклонить оффер

### Events (SSE)
- `GET /events/stream` — SSE стрим событий

#### SSE события
| Событие | Когда |
|---|---|
| `empire:joined` | новая империя зарегистрирована |
| `diplomacy:offer` | новый дипломатический оффер |
| `diplomacy:accepted` | оффер принят |
| `diplomacy:rejected` | оффер отклонён |

## Data Models

### Empire
```typescript
{
  id: string           // randomUUIDv7
  playerId: string
  name: string
  homeWorld: string
  color: [number, number, number]  // RGB
  online: boolean
  lastSeen: Date       // хранится как INTEGER (timestamp ms)
}
```

### DiplomacyOffer
```typescript
{
  id: string           // randomUUIDv7
  fromId: string       // empire id
  toId: string         // empire id
  type: "alliance" | "war" | "trade"
  status: "pending" | "accepted" | "rejected"
  createdAt: Date      // хранится как INTEGER (timestamp ms)
}
```

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS empires (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  home_world TEXT NOT NULL,
  color_r INTEGER NOT NULL,
  color_g INTEGER NOT NULL,
  color_b INTEGER NOT NULL,
  online INTEGER NOT NULL DEFAULT 1,
  last_seen INTEGER NOT NULL,
  token TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_empires_player_id ON empires(player_id);

CREATE TABLE IF NOT EXISTS diplomacy_offers (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (from_id) REFERENCES empires(id),
  FOREIGN KEY (to_id) REFERENCES empires(id)
);
```

## Test Coverage

44 теста, 0 фейлов.

| Файл | Тестов |
|---|---|
| empire.test.ts | 8 |
| galaxy.test.ts | 7 |
| diplomacy.test.ts | 11 |
| auth.test.ts | 14 |
| events.test.ts | 4 |