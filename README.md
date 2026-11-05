# wine-catalog

Аналитическая база данных виноматериалов Крыма — Лаборатория биохимии и химии вина ВНИИВиВ «Магарач».

Сайт: https://qwentytorantiny73.github.io/wine-catalog/

## Страницы

- `/` — о базе: ключевые цифры, разделы, графики
- `/baza/` — база образцов: поиск, фильтры, карточка с полным химическим составом
- `/arkhiv/` — сводка по годам урожая

## Запуск локально

```bash
npm ci
npm run dev        # http://localhost:5173/wine-catalog/
npm test           # тесты логики
npm run audit      # доступность (axe-core) и вес страниц
```

Данные собираются из Excel скриптом `scripts/build_data.py` (см. `CLAUDE.md`).

## Деплой

GitHub Actions (`.github/workflows/static.yml`): на каждый pull request — тесты и сборка;
при пуше в `main` — сборка `npm run build` и выкладка папки `dist/` на GitHub Pages.

## Документы проекта

- `docs/spec.md` — техническое задание
- `docs/decisions.md` — принятые решения и открытые вопросы
- `docs/audit.md` — аудит с доказательствами
- `docs/STATUS.md` — текущий статус работ
- `CLAUDE.md` — правила работы с репозиторием
