# Contributing to openspore-server

## Требования

- Bun >= 1.0
- Git

## Запуск локально

```bash
git clone https://github.com/nsvk13/openspore-server
cd openspore-server
bun install
bun run src/index.ts
```

## Тесты

```bash
bun test
bun test --watch
```

Все тесты должны быть зелёными перед открытием PR. Новый код = новые тесты.

## Структура

```
src/routes/     # эндпоинты, один файл = один домен
src/store/      # логика работы с БД
src/types/      # TypeScript типы
src/db/         # схема SQLite и подключение
tests/          # тесты, зеркалят структуру src/routes/
```

## Как добавить новый эндпоинт

1. Создай или открой файл в `src/routes/`
2. Добавь типы в `src/types/index.ts` если нужно
3. Добавь стор в `src/store/` если нужна новая таблица
4. Подключи роут в `src/index.ts`
5. Напиши тесты в `tests/`
6. Убедись что `bun test` зелёный

## Правила

- TDD — сначала тесты, потом код
- Никакого Drizzle — только `bun:sqlite` напрямую
- Timestamp хранить как `INTEGER` (`Date.now()`), не ISO строку
- `broadcast()` вызывать после каждого мутирующего действия
- Каждый стор должен экспортировать `clear()` для тестов
- Никаких `any` в TypeScript

## Pull Request

- Один PR = одна фича или один фикс
- Название в формате: `feat: добавить торговлю` / `fix: heartbeat тест`
- Описание: что сделал и зачем
- CI должен быть зелёным

## Issues

Используй шаблоны в `.github/ISSUE_TEMPLATE/`:
- **Bug Report** — если что-то сломано
- **Feature Request** — если хочешь новую механику