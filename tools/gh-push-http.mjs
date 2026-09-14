#!/usr/bin/env node
/**
 * HTTP-часть пуша: собирает коммит через Git Data API.
 *
 * Парный скрипт — tools/gh-push.ps1. Разделение вынужденное: git и PowerShell
 * в этом окружении не проходят TLS до api.github.com, а Node не может порождать
 * процессы с перехватом вывода (EPERM), чтобы самому вызвать git.
 *
 * Ожидает манифест от PowerShell: { owner, repo, branch, message, author, files[] }
 * Токен — в переменной окружения GITHUB_TOKEN.
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';

const args = process.argv.slice(2);
const mIdx = args.indexOf('--manifest');
if (mIdx === -1 || !args[mIdx + 1]) {
  process.stderr.write('Использование: node tools/gh-push-http.mjs --manifest <файл.json>\n');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(args[mIdx + 1], 'utf8'));
const { owner, repo, branch, message, author, files } = manifest;
const API = 'https://api.github.com';

const token = (process.env.GITHUB_TOKEN ?? '').trim();
if (!token) {
  process.stderr.write('Нет токена: ожидается переменная окружения GITHUB_TOKEN\n');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, endpoint, body, attempt = 1) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'prism-svg-api-push',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    const retryable = res.status >= 500 || res.status === 403 || res.status === 429;
    if (retryable && attempt <= 4) {
      const wait = Math.min(30_000, 1000 * 2 ** attempt);
      process.stdout.write(`  · ответ ${res.status}, повтор через ${wait / 1000}с\n`);
      await sleep(wait);
      return api(method, endpoint, body, attempt + 1);
    }
    throw new Error(`${method} ${endpoint} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function main() {
  process.stdout.write(`Репозиторий: ${owner}/${repo}, ветка ${branch}\n`);

  const user = await api('GET', '/user');
  process.stdout.write(`Токен принадлежит: ${user.login}\n`);

  // На полностью пустом репозитории Git Data API отдаёт 409 "Git Repository is
  // empty": blob-ы создавать некуда. Поэтому сначала сеем ветку одним файлом
  // через Contents API — только он умеет писать в пустой репозиторий.
  let parentSha = null;
  try {
    const ref = await api('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    parentSha = ref.object.sha;
    process.stdout.write(`Родительский коммит: ${parentSha.slice(0, 7)}\n`);
  } catch (err) {
    const m = String(err.message);
    if (m.includes('404') || m.includes('409') || m.includes('is empty')) {
      process.stdout.write('Репозиторий пуст — создаю затравку через Contents API...\n');
      const seed = await api('PUT', `/repos/${owner}/${repo}/contents/.gitignore`, {
        message: 'chore: инициализация репозитория',
        content: Buffer.from(
          '# затравка для первого коммита; перезаписывается основным пушем\nnode_modules/\n',
          'utf8',
        ).toString('base64'),
        branch,
      });
      parentSha = seed.commit.sha;
      process.stdout.write(`Затравка создана: ${parentSha.slice(0, 7)}\n`);
    } else {
      throw err;
    }
  }

  process.stdout.write(`Загружаю blob-ы (${files.length} шт)...\n`);
  const tree = [];
  let done = 0;
  const CONCURRENCY = 4;

  async function worker(slice) {
    for (const file of slice) {
      const blob = await api('POST', `/repos/${owner}/${repo}/git/blobs`, {
        content: file.content,
        encoding: 'base64',
      });
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
      done += 1;
      if (done % 10 === 0 || done === files.length) {
        process.stdout.write(`  · ${done}/${files.length}\n`);
      }
    }
  }

  const chunks = Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => []);
  files.forEach((f, i) => chunks[i % chunks.length].push(f));
  await Promise.all(chunks.map(worker));

  const bytes = files.reduce((s, f) => s + f.size, 0);
  process.stdout.write(`Blob-ов создано: ${tree.length} (${(bytes / 1024 / 1024).toFixed(2)} МБ)\n`);

  process.stdout.write('Собираю дерево...\n');
  const treeBody = { tree };
  if (parentSha) {
    const parent = await api('GET', `/repos/${owner}/${repo}/git/commits/${parentSha}`);
    treeBody.base_tree = parent.tree.sha;
  }
  const newTree = await api('POST', `/repos/${owner}/${repo}/git/trees`, treeBody);

  process.stdout.write('Создаю коммит...\n');
  const commitBody = {
    message,
    tree: newTree.sha,
    author: { ...author, date: new Date().toISOString() },
  };
  if (parentSha) commitBody.parents = [parentSha];
  const commit = await api('POST', `/repos/${owner}/${repo}/git/commits`, commitBody);

  process.stdout.write('Обновляю ветку...\n');
  if (parentSha) {
    await api('PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      sha: commit.sha,
      force: false,
    });
  } else {
    await api('POST', `/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
  }

  process.stdout.write(`\n\u2713 Запушено: https://github.com/${owner}/${repo}/commit/${commit.sha}\n`);
  process.stdout.write(`  файлов в коммите: ${tree.length}\n`);
  process.stdout.write(`  SHA для локального ref: ${commit.sha}\n`);
}

main().catch((err) => {
  process.stderr.write(`\nОшибка: ${err.message}\n`);
  process.exitCode = 1;
});
