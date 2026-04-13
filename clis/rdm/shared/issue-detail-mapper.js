function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeText(value) {
  const withoutTags = String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\r\n/g, '\n');

  return decodeHtmlEntities(withoutTags).trim();
}

function joinLines(lines) {
  return lines.length === 0 ? '' : lines.join('\n');
}

export function stripHtmlToText(html) {
  return normalizeText(html);
}

export function formatCommentLines(lines) {
  return joinLines(
    lines.map((line) => {
      const content = stripHtmlToText(line.content);
      const replySuffix = line.replyToName ? ` (回复 ${line.replyToName})` : '';
      const contentPart = content ? `: ${content}` : '';
      return `${line.createdAt} ${line.authorName}${contentPart}${replySuffix}`;
    }),
  );
}

export function formatWorkLogLines(lines) {
  return joinLines(lines.map((line) => `${line.createdAt} ${line.authorName} ${line.durationText}`));
}

export function formatDataLogLines(lines) {
  return joinLines(
    lines.map((line) => `${line.createdAt} ${line.authorName} ${line.fieldName}: ${line.oldText} -> ${line.newText}`),
  );
}

export function formatDurationToText(minutesOrHours) {
  const numeric = Number(minutesOrHours ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return `${numeric}h`;
}

export function joinNames(items) {
  if (!Array.isArray(items)) return '';
  return items
    .map((item) => String(item?.name ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

export function buildIssueDetailResult(input) {
  const issue = Array.isArray(input.detail?.issues) ? (input.detail.issues[0] ?? {}) : {};

  return {
    projectId: input.projectId,
    projectName: input.projectName,
    issueId: String(issue.id ?? ''),
    issueNum: String(issue.issueNum ?? ''),
    summary: String(issue.summary ?? ''),
    typeCode: String(issue.typeCode ?? ''),
    status: String(issue.statusName ?? ''),
    reporterName: String(issue.reporterName ?? ''),
    assigneeName: String(issue.assigneeName ?? ''),
    versions: joinNames(issue.versions),
    labels: joinNames(issue.labels),
    components: joinNames(issue.components),
    comments: formatCommentLines(
      (Array.isArray(input.comments) ? input.comments : []).map((item) => ({
        createdAt: String(item.createdAt ?? ''),
        authorName: String(item.authorName ?? ''),
        content: String(item.content ?? ''),
        replyToName: item.replyToName ? String(item.replyToName) : undefined,
      })),
    ),
    workLogs: formatWorkLogLines(
      (Array.isArray(input.workLogs) ? input.workLogs : []).map((item) => ({
        createdAt: String(item.createdAt ?? ''),
        authorName: String(item.authorName ?? ''),
        durationText: formatDurationToText(item.duration ?? item.durationHours ?? item.timeSpent),
      })),
    ),
    dataLogs: formatDataLogLines(
      (Array.isArray(input.dataLogs) ? input.dataLogs : []).map((item) => ({
        createdAt: String(item.createdAt ?? ''),
        authorName: String(item.authorName ?? ''),
        fieldName: String(item.fieldName ?? ''),
        oldText: String(item.oldString ?? item.oldValue ?? ''),
        newText: String(item.newString ?? item.newValue ?? ''),
      })),
    ),
  };
}
