import { cli, Strategy } from '@jackwener/opencli/registry';
import { fetchWorkListPage } from './shared/agile-work-list.js';
import { fetchProjectsPage } from './shared/common-api.js';
import { buildRdmError } from './shared/errors.js';
import { parseListArg } from './shared/index.js';
import { acquireRdmSession } from './shared/session.js';

function buildWorkListQuery(kwargs) {
  const organizationId = Number(kwargs['organization-id'] ?? 4);
  if (!Number.isInteger(organizationId) || organizationId <= 0) throw new Error('参数错误：-organization-id 必须为正整数。');

  const pageSize = Number(kwargs['page-size'] ?? 50);
  if (!Number.isInteger(pageSize) || pageSize <= 0 || pageSize > 200) throw new Error('参数错误：-page-size 必须是 1-200 的整数。');

  return {
    organizationId,
    projectIds: parseListArg(kwargs['project-ids']),
    pageSize,
    statusFilter: parseListArg(kwargs.status),
    summaryKeyword: typeof kwargs.summary === 'string' ? kwargs.summary.trim() : '',
  };
}

function buildWorkListRequestBody(userId) {
  return {
    conditions: [{
      field: { fieldCode: 'assignee', predefined: true, fieldType: 'member', name: '经办人' },
      relationship: 'AND',
      value: { valueIdList: [userId] },
      operation: 'IN',
    }],
    treeFlag: true,
    withSubIssues: false,
  };
}

function toNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function resolveProjectName(name) {
  return /^\d+$/.test(name) ? `项目 ${name}` : name;
}

function mapIssueItem(item, projectName) {
  return {
    projectName: resolveProjectName(projectName),
    issueId: String(item.issueId ?? ''),
    issueNum: String(item.issueNum ?? ''),
    summary: String(item.summary ?? ''),
    typeName: String(item.issueTypeVO?.name ?? item.typeCode ?? ''),
    status: String(item.statusVO?.name ?? item.statusMapVO?.name ?? ''),
    statusType: String(item.statusVO?.type ?? item.statusMapVO?.type ?? ''),
    priority: String(item.priorityVO?.name ?? ''),
    estimateTime: toNumber(item.estimateTime),
    remainingTime: toNumber(item.remainingTime),
    spentWorkTime: toNumber(item.spentWorkTime),
    creationDate: String(item.creationDate ?? ''),
    lastUpdateDate: String(item.lastUpdateDate ?? ''),
    estimatedStartTime: String(item.estimatedStartTime ?? ''),
    estimatedEndTime: String(item.estimatedEndTime ?? ''),
    featureName: String(item.featureName ?? ''),
  };
}

function deduplicateByIssueId(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.issueId)) return false;
    seen.add(item.issueId);
    return true;
  });
}

async function fetchAllProjects(context) {
  const allProjects = [];
  let page = 0;
  const size = 20;
  while (true) {
    const result = await fetchProjectsPage(context, page, size);
    if (!result.ok) throw buildRdmError('LIST_FETCH_FAILED', `（项目列表 HTTP ${result.status ?? 'unknown'}）`);
    const content = Array.isArray(result.data?.content) ? result.data.content : [];
    allProjects.push(...content);
    if (result.data?.empty || page + 1 >= (result.data?.totalPages ?? 1)) break;
    page += 1;
  }
  return allProjects;
}

async function fetchAllWorkListItems(context, projectId, projectName, userId, pageSize) {
  const requestBody = buildWorkListRequestBody(userId);
  const items = [];
  let page = 0;

  while (true) {
    const result = await fetchWorkListPage(context, projectId, requestBody, page, pageSize);
    if (!result.ok) {
      if (result.status === 403 || result.status === 404) break;
      throw buildRdmError('LIST_FETCH_FAILED', `（工作项 ${projectName} HTTP ${result.status ?? 'unknown'}）`);
    }

    const content = Array.isArray(result.data?.content) ? result.data.content : [];
    for (const item of content) items.push(mapIssueItem(item, projectName));
    if (result.data?.empty || page + 1 >= (result.data?.totalPages ?? 1)) break;
    page += 1;
  }

  return items;
}

async function executeWorkList(page, query) {
  const context = await acquireRdmSession(page, query.organizationId);
  const projectList = query.projectIds.length > 0
    ? query.projectIds.map((id) => ({ id, name: id }))
    : (await fetchAllProjects(context)).map((project) => ({ id: project.id, name: project.name }));

  const allItems = [];
  for (const project of projectList) {
    const items = await fetchAllWorkListItems(context, project.id, project.name, context.userId, query.pageSize);
    allItems.push(...items);
  }

  let result = deduplicateByIssueId(allItems);
  if (query.statusFilter.length > 0) result = result.filter((item) => query.statusFilter.includes(item.status));
  if (query.summaryKeyword) {
    const keyword = query.summaryKeyword.toLowerCase();
    result = result.filter((item) => item.summary.toLowerCase().includes(keyword));
  }
  return result;
}

cli({
  site: 'rdm',
  name: 'worklist',
  description: '获取我在 RDM 所有项目中作为经办人的工作项列表，支持多项目合并及字段过滤',
  domain: 'rdm.changan.com.cn',
  strategy: Strategy.HEADER,
  browser: true,
  timeoutSeconds: 180,
  args: [
    { name: 'organization-id', type: 'int', default: 4, help: '组织 ID，默认 4' },
    { name: 'project-ids', required: false, help: '指定项目 ID，逗号分隔；未传则自动拉取所有项目' },
    { name: 'page-size', type: 'int', default: 50, help: '每次请求工作项的分页大小，默认 50，最大 200' },
    { name: 'status', required: false, help: '按状态过滤，逗号分隔；如 "待处理,处理中"' },
    { name: 'summary', required: false, help: '按标题关键字过滤（包含匹配）' },
  ],
  columns: ['projectName', 'issueNum', 'summary', 'typeName', 'status', 'statusType', 'priority', 'estimateTime', 'remainingTime', 'spentWorkTime', 'creationDate', 'lastUpdateDate', 'estimatedStartTime', 'estimatedEndTime', 'featureName'],
  func: async (page, kwargs) => {
    const query = buildWorkListQuery(kwargs);
    return executeWorkList(page, query);
  },
});

export const __test__ = { buildWorkListQuery, buildWorkListRequestBody, deduplicateByIssueId, executeWorkList, mapIssueItem };
