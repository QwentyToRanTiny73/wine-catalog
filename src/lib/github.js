// Минимальный клиент GitHub Contents API для /admin/ (решение Р2).
// Токен передаётся только в заголовке запроса к api.github.com; нигде не сохраняется, кроме sessionStorage.

export const REPO = 'QwentyToRanTiny73/wine-catalog';
export const BRANCH = 'main';
const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(token, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const hint = {
      401: 'токен неверный или истёк',
      403: 'у токена нет прав на этот репозиторий (нужно Contents: Read and write)',
      404: 'репозиторий или файл не найден (проверьте, что токен выдан на этот репозиторий)',
      409: 'файл изменился, пока вы его правили — загрузите заново',
      422: 'файл изменился, пока вы его правили — загрузите заново',
    }[res.status] ?? `ошибка GitHub ${res.status}`;
    throw new GitHubError(res.status, hint);
  }
  return res.json();
}

/** Проверка токена: можно ли писать в репозиторий. */
export async function checkToken(token) {
  const repo = await request(token, `/repos/${REPO}`);
  if (!repo.permissions?.push) throw new GitHubError(403, 'у токена нет права записи (Contents: Read and write)');
  return repo;
}

const toBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

/** Текущая версия файла из main: текст и sha (нужен для сохранения без затирания чужих правок). */
export async function readFile(token, path) {
  const file = await request(token, `/repos/${REPO}/contents/${path}?ref=${BRANCH}`);
  return { text: fromBase64(file.content), sha: file.sha };
}

/** Сохранить файл коммитом в main. Если файл изменился после чтения — ошибка 409, ничего не затирается. */
export async function writeFile(token, path, text, sha, message) {
  const res = await request(token, `/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: toBase64(text), sha, branch: BRANCH }),
  });
  return { sha: res.content.sha, commitUrl: res.commit.html_url };
}
