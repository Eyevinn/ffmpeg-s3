import path from 'node:path';

export function toUrl(url: string) {
  return url.match(/^[a-z0-9]+:.*/)
    ? new URL(url)
    : new URL(`file://${path.resolve(url)}`);
}

export function toLocalDir(url: URL) {
  if (!url.protocol || url.protocol === 'file:') {
    return path.dirname(url.pathname);
  } else {
    throw new Error('Invalid URL: not a file URL');
  }
}

export function toLocalFile(url: URL) {
  return path.basename(url.pathname);
}

export function splitCmdLineArgs(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let escape = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escape) {
      current += char;
      escape = false;
    } else if (char === '\\') {
      escape = true;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (current.length > 0) {
        result.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    result.push(current);
  }

  return result;
}
