function pad(value) {
  return String(value).padStart(2, '0');
}

function parseIsoDateParts(value) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function isIsoDate(value) {
  return typeof value === 'string' && !!parseIsoDateParts(value);
}

export function asDate(value) {
  if (typeof value !== 'string' || value.length < 10) return null;
  const datePart = value.slice(0, 10);
  return isIsoDate(datePart) ? datePart : null;
}

export function clipToRange(startDate, endDate, rangeFrom, rangeTo) {
  const from = startDate < rangeFrom ? rangeFrom : startDate;
  const to = endDate > rangeTo ? rangeTo : endDate;
  if (from > to) return null;
  return { from, to };
}

export function toIsoDateLocal(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function shiftIsoDate(date, dayOffset) {
  const parts = parseIsoDateParts(date);
  if (!parts) throw new Error(`无效日期：${date}`);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  return toIsoDateLocal(shifted);
}

export function resolveDateRange(rawFrom, rawTo) {
  const fromInput = typeof rawFrom === 'string' ? rawFrom.trim() : '';
  const toInput = typeof rawTo === 'string' ? rawTo.trim() : '';

  if (fromInput && !isIsoDate(fromInput)) {
    throw new Error('日期格式错误：-from 需为 YYYY-MM-DD。');
  }
  if (toInput && !isIsoDate(toInput)) {
    throw new Error('日期格式错误：-to 需为 YYYY-MM-DD。');
  }

  const today = toIsoDateLocal(new Date());
  let from = fromInput;
  let to = toInput;

  if (!from && !to) {
    to = today;
    from = shiftIsoDate(to, -14);
  } else if (from && !to) {
    to = today;
  } else if (!from && to) {
    from = shiftIsoDate(to, -14);
  }

  if (!from || !to) {
    throw new Error('日期范围解析失败：未能确定 from/to。');
  }
  if (from > to) {
    throw new Error(`日期范围错误：from(${from}) 不能晚于 to(${to})。`);
  }

  return { from, to };
}
