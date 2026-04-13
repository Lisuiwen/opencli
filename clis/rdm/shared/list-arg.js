export function parseListArg(value) {
  const output = [];

  const append = (item) => {
    if (item === null || item === undefined) return;
    if (Array.isArray(item)) {
      item.forEach(append);
      return;
    }
    if (typeof item === 'number' || typeof item === 'bigint' || typeof item === 'boolean') {
      const text = String(item).trim();
      if (text) output.push(text);
      return;
    }
    if (typeof item !== 'string') return;

    const text = item.trim();
    if (!text) return;

    if (text.startsWith('[') && text.endsWith(']')) {
      try {
        append(JSON.parse(text));
        return;
      } catch {}
    }

    for (const token of text.split(/[,\n;，；]/)) {
      const normalized = token.trim();
      if (normalized) output.push(normalized);
    }
  };

  append(value);
  return Array.from(new Set(output));
}

export function resolveTimeTab(raw) {
  const input = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const tab = input || 'day';
  if (tab === 'day' || tab === 'week' || tab === 'month') return tab;
  throw new Error('参数错误：-time-tab 仅支持 day/week/month。');
}
