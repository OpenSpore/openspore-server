# openspore-server

REST API бэкенд для мультиплеера Spore Space Stage. Написан на Bun + ElysiaJS, хранит состояние галактики в SQLite.

## Быстрый старт

```bash
bun install
bun run src/index.ts
```

Сервер запустится на `http://localhost:8080` (или `PORT`).

### Переменные окружения

| Переменная      | По умолчанию     | Описание                  |
|-----------------|------------------|---------------------------|
| `PORT`          | `8080`           | Порт сервера              |
| `DATABASE_PATH` | `openspore.db`   | Путь к файлу SQLite       |

### Docker

```bash
docker compose up
```

## Тесты

```bash
bun test          # запустить все тесты
bun test --watch  # watch режим
```

## API

### Аутентификация

Эндпоинты, которые изменяют данные, требуют заголовок:

```
Authorization: Bearer <token>
```

Токен выдаётся при регистрации империи (`POST /empire/register`).

---

### Empire

#### `POST /empire/register`

Зарегистрировать новую империю. Один `playerId` = одна империя (409 если уже существует).

**Body:**
```json
{
  "playerId": "string",
  "name": "string",
  "homeWorld": "string",
  "color": [255, 0, 0]
}
```

**Response `200`:**
```json
{
  "success": true,
  "empire": { "id": "...", "playerId": "...", "name": "...", "homeWorld": "...", "color": [255,0,0], "online": true, "lastSeen": "..." },
  "token": "uuid"
}
```

**Errors:** `422` — невалидные поля, `409` — playerId уже занят

---

#### `GET /empire/:id`

Получить империю по ID.

**Response `200`:** объект `Empire`  
**Errors:** `404` — не найдена

---

#### `PATCH /empire/:id/heartbeat` 🔒

Обновить статус онлайн и время `lastSeen`. Требует Bearer токен владельца.

**Response `200`:** `{ "success": true }`  
**Errors:** `404`, `401`, `403`

---

### Galaxy

#### `GET /galaxy/empires`

Список всех империй (включая offline). Поддерживает пагинацию.

**Query params:**

| Параметр | По умолчанию | Описание          |
|----------|--------------|-------------------|
| `page`   | `1`          | Номер страницы    |
| `limit`  | `50`         | Размер страницы (макс. 100) |

**Response `200`:**
```json
{
  "empires": [ ... ],
  "total": 42,
  "page": 1,
  "limit": 50
}
```

---

### Diplomacy

#### `POST /diplomacy/offer` 🔒

Создать дипломатический оффер. Требует Bearer токен отправителя.

**Body:**
```json
{
  "fromId": "empire-id",
  "toId": "empire-id",
  "type": "alliance" | "war" | "trade"
}
```

**Response `200`:** `{ "success": true, "offer": { ... } }`  
**Errors:** `404` (fromId/toId не найден), `401`, `403`

---

#### `GET /diplomacy/offers/:empireId`

Входящие офферы для указанной империи.

**Response `200`:** массив `DiplomacyOffer`

---

#### `PATCH /diplomacy/offer/:id/accept` 🔒

Принять оффер. Требует Bearer токен получателя.

**Response `200`:** `{ "success": true, "status": "accepted" }`  
**Errors:** `401`, `404`, `403`

---

#### `PATCH /diplomacy/offer/:id/reject` 🔒

Отклонить оффер. Требует Bearer токен получателя.

**Response `200`:** `{ "success": true, "status": "rejected" }`  
**Errors:** `401`, `404`, `403`

---

### Events (SSE)

#### `GET /events/stream`

Server-Sent Events стрим событий галактики. Ping каждые 15 секунд.

**События:**

| Событие              | Когда                          |
|----------------------|--------------------------------|
| `empire:joined`      | Новая империя зарегистрирована |
| `diplomacy:offer`    | Новый дипломатический оффер    |
| `diplomacy:accepted` | Оффер принят                   |
| `diplomacy:rejected` | Оффер отклонён                 |

---

### Relay (WebSocket)

#### `WS /relay`

Лобби и relay для двух игроков (мод использует его, чтобы обменяться UDP endpoint'ами для
hole punching или гонять кадры через сервер, если прямое P2P невозможно). Текстовые кадры — JSON:

| Клиент → сервер | Ответ / эффект |
|---|---|
| `{"t":"host","name":"alice"}` | `{"t":"hosted","code":"AB12CD"}` |
| `{"t":"join","code":"AB12CD","name":"bob"}` | `{"t":"joined","code","peer":{"name"}}`, хосту `{"t":"peer","name":"bob"}` |
| `{"t":"endpoint","ip":"1.2.3.4","port":7777}` | второму пиру `{"t":"endpoint","from":"client","ip","port"}` |
| `{"t":"relay","data":...}` | второму пиру `{"t":"relay","from":"host","data"}` |
| бинарный кадр | пересылается второму пиру как есть |
| `{"t":"leave"}` | `{"t":"left"}`, второму пиру `{"t":"peer_left","closed":bool}` |
| `{"t":"ping"}` | `{"t":"pong"}` |

Ошибки: `{"t":"error","code":"not_found"|"full"|"no_session"|"already_in_session"|"bad_message"}`.
Сессия живёт, пока жив хост; выход хоста закрывает её.

#### `GET /relay/stats`

`{ "sessions": 1 }`

---

## Структура проекта

```
src/
├── index.ts           # Entrypoint
├── auth.ts            # resolveToken() — Bearer auth helper
├── db/index.ts        # SQLite соединение и схема
├── routes/
│   ├── empire.ts      # /empire/*
│   ├── galaxy.ts      # /galaxy/empires
│   ├── diplomacy.ts   # /diplomacy/*
│   ├── events.ts      # /events/stream (SSE)
│   └── relay.ts       # WS /relay, GET /relay/stats
├── store/
│   ├── empire.ts      # empireStore
│   ├── diplomacy.ts   # diplomacyStore
│   └── relay.ts       # relayStore (in-memory lobby sessions)
└── types/index.ts     # Empire, DiplomacyOffer, ...
tests/
├── empire.test.ts
├── galaxy.test.ts
├── diplomacy.test.ts
├── auth.test.ts
├── events.test.ts
└── relay.test.ts
```
