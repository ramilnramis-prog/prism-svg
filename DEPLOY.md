# Деплой на GitHub

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

## Если что-то сломалось

| Симптом | Причина | Что делать |
|---|---|---|
| `TLS handshake timeout` | сеть/прокси/VPN | сменить сеть, повторить `git push` |
| `remote: Permission denied` | нет прав у токена | `gh auth refresh -s repo,workflow` |
| `failed to push some refs` | на GitHub есть коммиты, которых нет локально | `git pull --rebase origin main` и снова `git push` |
| Pages отдаёт 404 | Pages ещё не собрался или выбран не тот branch | подождать 10 минут, проверить Settings → Pages |
| Галерея пустая | открыл `index.html` из корня, а не из `art/` | открой `art/index.html` или используй лендинг |
| Кириллица в путях мешает | путь `Новая папка` | перенеси проект, например в `C:\dev\prism-svg` |
