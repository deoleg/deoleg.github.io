# История христианства · History of Christianity

Интерактивная хронология на чистом HTML, CSS и JavaScript: без фреймворков, сборки и npm. Страница входит в admin-блок сайта (вкладка **History** в `admin.html`) и открывается напрямую по адресу `/history/`.

```
history/
  index.html      разметка
  css/style.css   стили, светлая и тёмная темы
  js/app.js       логика и словарь i18n (ru/en)
  README.md
data/events.json  данные (общая папка data/ в корне репозитория)
```

## Запуск локально

Страница загружает `data/events.json` через `fetch()`, поэтому как файл (`file://`) она не работает. Её нужно открывать через локальный сервер из **корня репозитория**:

```bash
python3 -m http.server 8000
# затем откройте http://localhost:8000/history/
```

Второй вариант: расширение **Live Server** в VS Code. Откройте `history/index.html` и нажмите «Go Live».

## Публикация на GitHub Pages

1. Закоммитьте изменения и отправьте их в `main`.
2. В репозитории на GitHub откройте **Settings → Pages**.
3. В разделе **Build and deployment → Source** выберите «Deploy from a branch», ветку `main` и папку `/ (root)`.
4. Через минуту-две страница появится по адресу `https://<user>.github.io/history/`.

## Ссылки

- `#event/<id>` открывает событие, например `#event/hellenization-323bc`.
- `#era/<id>` прокручивает к эпохе, например `#era/reformation`.
- Язык и фильтры хранятся в параметрах URL: `?lang=en&cat=council,schism&imp=2&q=arius`.
  - `imp=2` — только важные события (importance 2 и 3);
  - без `imp` — все события.
- Кнопка со скрепкой в шапке копирует ссылку на текущий вид.

## Структура `data/events.json`

```jsonc
{
  "meta": {
    "title_ru": "…", "title_en": "…",
    "note_ru": "…",  "note_en": "…",      // текст в подвале
    "count": 263,
    "generated": "2026-09-28",
    "eras":       [{ "id": "apostolic", "from": 30, "to": 99, "ru": "…", "en": "…" }],
    "categories": [{ "id": "council", "ru": "Собор", "en": "Council" }],
    "books":      [{ "id": "pelikan1", "ru": "…", "en": "…" }]
  },
  "events": [{
    "id": "nicaea-325",                  // уникальный, латиница, цифры и дефис
    "year_start": 325, "year_end": 325,  // целые; до н. э. — отрицательные
    "date_label_ru": "325 г.", "date_label_en": "325",   // показывается на карточке
    "era": "imperial",                   // id из meta.eras
    "category": "council",               // id из meta.categories
    "importance": 3,                     // 3 — поворотный момент, 2 — важное, 1 — дополнительное
    "title_ru": "…", "title_en": "…",
    "summary_ru": "…", "summary_en": "…",
    "key_points_ru": ["…"], "key_points_en": ["…"],
    "people_ru": ["…"], "people_en": ["…"],
    "place_ru": "…", "place_en": "…",
    "date_note_ru": "", "date_note_en": "",   // пусто, если расхождений нет
    "sources": [{ "book": "lebedev1", "pages": "стр. 10–12" }]  // book — id из meta.books
  }]
}
```

Как добавить событие вручную:

1. Вставьте объект в массив `events` так, чтобы массив остался отсортирован по `year_start`. Сайт выводит события в порядке файла.
2. Поля `era`, `category` и `sources[].book` должны ссылаться на существующие `id` из `meta`.
3. Заполните обе языковые версии (`_ru` и `_en`). Пустые массивы и пустые строки допустимы.
4. Обновите `meta.count`.
5. Проверьте, что JSON валиден: `python3 -m json.tool data/events.json > /dev/null`.

Иконки и цвета категорий задаются в коде: иконки в `ICONS` в `js/app.js`, цвета в переменных `--cat-<id>` в `css/style.css`. Если добавите категорию в `meta.categories`, добавьте ей иконку и цвет в обеих темах.
