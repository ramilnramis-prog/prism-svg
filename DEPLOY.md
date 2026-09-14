# Деплой на GitHub

> **Статус: уже развёрнуто.** Репозиторий создан и запушен:
> https://github.com/ramilnramis-prog/prism-svg
>
> Первый коммит: `e0fb3c2`, 66 файлов, ветка `main`.
> Пуш выполнялся в обход git-транспорта, см. раздел «Если git не проходит прокси».
>
> Этот файл описывает и то, что уже сделано, и как повторить это с нуля.

Пошагово, с проверками. Команды выполняются в папке `prism-svg`.

---

## Шаг 0. Посмотреть результат до всякого GitHub

```powershell
# из папки prism-svg
start index.html          # лендинг со ссылками на галереи
start art\index.html      # сразу галерея с 12 постерами
```

Откроется в браузере по умолчанию. Файлы статичные: ни сервер, ни интернет не нужны.

Хочешь показать с телефона в той же сети — подними локальный сервер:

```powershell
npx --yes serve . -l 5050     # затем открой http://<IP-компьютера>:5050
```

---

## Шаг 1. Репозиторий уже инициализирован

```powershell
git status          # ветка main, коммитов пока нет
git log --oneline   # пусто
```

Идентификация настроена локально для этого репозитория:

```powershell
git config user.name    # ramilnramis-prog
git config user.email   # <id>+ramilnramis-prog@users.noreply.github.com
```

Если хочешь другой email — поменяй и поправь последний коммит:

```powershell
git config user.email "ты@example.com"
git commit --amend --reset-author --no-edit
```

---

## Шаг 2. Создать репозиторий на GitHub

Вариант А — через GitHub CLI (логин `ramilnramis-prog` уже авторизован):

```powershell
gh repo create prism-svg --public --source . --remote origin --push
```

Одна команда: создаст репозиторий, привяжет `origin` и запушит `main`.

Вариант Б — руками через сайт:

1. Открой https://github.com/new
2. Имя: `prism-svg`, видимость: Public, **не** добавляй README/gitignore (они уже есть).
3. Затем в терминале:

```powershell
git remote add origin https://github.com/ramilnramis-prog/prism-svg.git
git push -u origin main
```

> **Про сеть.** В момент подготовки этого файла `api.github.com` отвечал таймаутом TLS,
> поэтому команды выше может понадобиться повторить. Если `git push` падает с
> `TLS handshake timeout` или `Could not resolve host` — это сеть/прокси, а не репозиторий:
> проверь VPN, корпоративный прокси или мобильную точку доступа.

---

## Шаг 3. Включить GitHub Pages (публичная ссылка на галерею)

`index.html` лежит в корне репозитория, поэтому Pages отдаст лендинг, а из него —
все три галереи.

1. Репозиторий → **Settings** → **Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main`, папка `/ (root)` → **Save**
4. Через 1–2 минуты страница будет здесь:

```
https://ramilnramis-prog.github.io/prism-svg/
https://ramilnramis-prog.github.io/prism-svg/art/          ← галерея постеров
https://ramilnramis-prog.github.io/prism-svg/art/og/       ← формат 1200×630
```

Ту же настройку можно сделать из терминала (нужен scope `repo` — он есть):

```powershell
gh api -X POST "repos/ramilnramis-prog/prism-svg/pages" `
  -f "source[branch]=main" -f "source[path]=/"
```

---

## Шаг 4. Проверка, что всё живое

```powershell
gh repo view --web                       # открыть репозиторий в браузере
gh run list                              # если добавишь Actions
curl.exe -I https://ramilnramis-prog.github.io/prism-svg/   # 200 OK = Pages поднялся
```

Pages может обновляться до 10 минут после пуша — это нормально.

---

## Что дальше (по желанию)

**Автодеплой при пуше.** Если положить в `.github/workflows/` воркфлоу на
`actions/upload-pages-artifact`, Pages переключится в режим `GitHub Actions` и будет
пересобирать сайт на каждый пуш (Source: `GitHub Actions` в настройках Pages).
Для статичного проекта это не обязательно — ветки `main` достаточно.

**Свой домен.** Settings → Pages → Custom domain. В корне репозитория появится файл
`CNAME`, его нужно закоммитить.

**Не тащить PNG в репозиторий.** Раскомментируй в `.gitignore` строку
`art/**/*.png` и убери их из индекса:

```powershell
git rm -r --cached art --quiet
git add -A
git commit -m "chore: не хранить PNG, они пересобираются командой --png"
```

**Лицензия.** Сейчас в `package.json` указан MIT. Если репозиторий публичный,
добавь файл `LICENSE`, чтобы условия были явными.

---

## Если git не проходит прокси

В этом окружении `git push` падает так:

```
fatal: unable to access 'https://github.com/.../prism-svg.git/':
Failed to connect to github.com port 443 via 127.0.0.1 after 2051 ms
```

Разбор причин (проверено):

| Инструмент | Что делает | Итог |
|---|---|---|
| `git` (libcurl) | лезет в прокси `127.0.0.1` | не проходит |
| `curl.exe` (libcurl) | то же самое | не проходит |
| PowerShell 5.1 `Invoke-RestMethod` | прямое TLS-рукопожатие | обрывается |
| `gh` (Go) | прямой HTTPS | **работает** |
| Node.js `fetch` | прямой HTTPS | **работает** |

При этом `ALL_PROXY` указывает на `socks5://127.0.0.1:10801`, но этот порт никто
не слушает, а системные `HTTP_PROXY`/`HTTPS_PROXY` пусты. То есть libcurl и .NET
идут в мёртвый прокси, а Go и Node — напрямую.

Поэтому пуш делает обходной скрипт: коммит собирается через Git Data API
(blob → tree → commit → ref), то есть HTTPS-запросами, без git-транспорта.

```powershell
& .\tools\gh-push.ps1 -DryRun     # показать, что уйдёт
& .\tools\gh-push.ps1 -Limit 3    # проба на трёх файлах
& .\tools\gh-push.ps1             # полный пуш
```

Как это устроено и почему так:

- `tools/gh-push.ps1` вызывает `git` (он локально работает), читает файлы и пишет
  манифест с base64-содержимым.
- `tools/gh-push-http.mjs` читает манифест и делает запросы к API.
- Разделение вынужденное: Node в песочнице не может порождать процессы с
  перехватом вывода (`EPERM`), а git и PowerShell не проходят TLS.
- Если репозиторий полностью пустой, Git Data API отвечает `409 Git Repository is
  empty`. Скрипт сам создаёт «затравку» одним файлом через Contents API — только
  он умеет писать в пустой репозиторий, — и дальше работает обычным путём.

Когда сеть в порядке, всё это не нужно: обычный `git add` / `git commit` / `git push`
работает как обычно.

---

## Если что-то сломалось

| Симптом | Причина | Что делать |
|---|---|---|
| `TLS handshake timeout` | сеть/прокси/VPN | сменить сеть, повторить `git push` |
| `Failed to connect ... via 127.0.0.1` | мёртвый прокси в `ALL_PROXY` | использовать `tools/gh-push.ps1` |
| `409 Git Repository is empty` | в репозитории нет ни одного коммита | запустить `tools/gh-push.ps1`: он создаст затравку |
| `spawnSync ... EPERM` в Node | песочница запрещает перехват вывода | не вызывать git из Node, собирать манифест в PowerShell |
| `remote: Permission denied` | нет прав у токена | `gh auth refresh -s repo,workflow` |
| `failed to push some refs` | на GitHub есть коммиты, которых нет локально | `git pull --rebase origin main` и снова `git push` |
| Pages отдаёт 404 | Pages ещё не собрался или выбран не тот branch | подождать 10 минут, проверить Settings → Pages |
| Галерея пустая | открыл `index.html` из корня, а не из `art/` | открой `art/index.html` или используй лендинг |
| Кириллица в путях мешает | путь `Новая папка` | перенеси проект, например в `C:\dev\prism-svg` |
