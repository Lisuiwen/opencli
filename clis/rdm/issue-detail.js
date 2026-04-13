import { cli, Strategy } from '@jackwener/opencli/registry';
import { fetchProjectsPage } from './shared/common-api.js';
import { buildRdmError } from './shared/errors.js';
import { buildIssueDetailResult } from './shared/issue-detail-mapper.js';
import { extractProjectCode, fetchIssueComments, fetchIssueDataLogs, fetchIssueDetail, fetchIssueIdByNum, fetchIssueWorkLogs } from './shared/issue-detail-api.js';
import { acquireRdmSession } from './shared/session.js';

function parseTrimmedString(value, fieldName) {
  if (typeof value !== 'string') throw new Error(`参数错误：${fieldName} 不能为空。`);
  const trimmedValue = value.trim();
  if (!trimmedValue) throw new Error(`参数错误：${fieldName} 不能为空。`);
  return trimmedValue;
}

function isSnowflakeId(value) {
  return /^\d{15,19}$/.test(value);
}

function buildIssueDetailQuery(kwargs) {
  const rawId = parseTrimmedString(kwargs['issue-id'], 'issue-id');
  const organizationIdValue = kwargs['organization-id'];
  const organizationId = organizationIdValue === undefined ? 4 : Number(organizationIdValue);
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    throw new Error('参数错误：organization-id 必须为正整数。');
  }

  const query = { rawId, isIssueNum: !isSnowflakeId(rawId), projectId: undefined, organizationId };
  if (kwargs['project-id'] !== undefined && kwargs['project-id'] !== null) {
    query.projectId = parseTrimmedString(kwargs['project-id'], 'project-id');
  }
  return query;
}

/**
 * 将输入 ID（issueNum 或 Snowflake issueId）统一解析成可用于 detail 接口的 issueId。
 * 当输入为 issueNum 时，同时返回已定位到的 projectId / projectName。
 */
async function resolveIssueId(context, query) {
  if (!query.isIssueNum) return { issueId: query.rawId };

  const issueNum = query.rawId;
  const projectCode = extractProjectCode(issueNum);
  if (!projectCode) throw new Error(`参数错误：无法从工单编号 "${issueNum}" 中解析项目编码。`);

  const allProjects = await fetchAllProjects(context);
  const matched = allProjects.find((p) => p.code === projectCode);
  if (!matched) {
    throw new Error(`未找到项目编码为 "${projectCode}" 的项目（从工单编号 "${issueNum}" 解析）。`);
  }

  const result = await fetchIssueIdByNum(context, matched.id, issueNum);
  if (!result.ok) throw buildRdmError('LIST_FETCH_FAILED', `（按工单编号查询 HTTP ${result.status ?? 'unknown'}）`);
  if (!result.issueId) throw new Error(`项目 "${matched.name}" 中未找到工单编号 "${issueNum}"。`);

  return { issueId: result.issueId, projectId: matched.id, projectName: matched.name };
}

function normalizeListPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.issues)) return data.issues;
  return [];
}

async function fetchIssueBundle(context, projectId, projectName, issueId) {
  const detailResult = await fetchIssueDetail(context, projectId, issueId);
  if (!detailResult.ok) throw buildRdmError('DETAIL_FETCH_FAILED', `（HTTP ${detailResult.status ?? 'unknown'}）`);

  const [commentsResult, workLogsResult, dataLogsResult] = await Promise.all([
    fetchIssueComments(context, projectId, issueId),
    fetchIssueWorkLogs(context, projectId, issueId),
    fetchIssueDataLogs(context, projectId, issueId),
  ]);

  if (!commentsResult.ok) throw buildRdmError('DETAIL_FETCH_FAILED', `（评论 HTTP ${commentsResult.status ?? 'unknown'}）`);
  if (!workLogsResult.ok) throw buildRdmError('DETAIL_FETCH_FAILED', `（工时 HTTP ${workLogsResult.status ?? 'unknown'}）`);
  if (!dataLogsResult.ok) throw buildRdmError('DETAIL_FETCH_FAILED', `（历史 HTTP ${dataLogsResult.status ?? 'unknown'}）`);

  return buildIssueDetailResult({
    projectId,
    projectName,
    detail: detailResult.data,
    comments: normalizeListPayload(commentsResult.data),
    workLogs: normalizeListPayload(workLogsResult.data),
    dataLogs: normalizeListPayload(dataLogsResult.data),
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

async function findIssueProject(context, issueId) {
  const projects = await fetchAllProjects(context);

  for (const project of projects) {
    const detailResult = await fetchIssueDetail(context, project.id, issueId);
    if (detailResult.ok) {
      return { projectId: project.id, projectName: project.name, detail: detailResult.data };
    }
    if (detailResult.status === 403 || detailResult.status === 404) continue;
    throw buildRdmError('DETAIL_FETCH_FAILED', `（HTTP ${detailResult.status ?? 'unknown'}）`);
  }

  throw buildRdmError('ISSUE_NOT_FOUND_IN_ACCESSIBLE_PROJECTS');
}

async function executeIssueDetail(page, query) {
  const context = await acquireRdmSession(page, query.organizationId);
  const resolved = await resolveIssueId(context, query);
  const issueId = resolved.issueId;

  // 优先使用已解析到的 projectId（issueNum 路径），其次使用用户显式传入的 projectId。
  const knownProjectId = resolved.projectId ?? query.projectId;
  const knownProjectName = resolved.projectName ?? knownProjectId;

  if (knownProjectId) {
    const result = await fetchIssueBundle(context, knownProjectId, knownProjectName, issueId);
    return [result];
  }

  const matched = await findIssueProject(context, issueId);
  const [commentsResult, workLogsResult, dataLogsResult] = await Promise.all([
    fetchIssueComments(context, matched.projectId, issueId),
    fetchIssueWorkLogs(context, matched.projectId, issueId),
    fetchIssueDataLogs(context, matched.projectId, issueId),
  ]);

  if (!commentsResult.ok) throw buildRdmError('DETAIL_FETCH_FAILED', `（评论 HTTP ${commentsResult.status ?? 'unknown'}）`);
  if (!workLogsResult.ok) throw buildRdmError('DETAIL_FETCH_FAILED', `（工时 HTTP ${workLogsResult.status ?? 'unknown'}）`);
  if (!dataLogsResult.ok) throw buildRdmError('DETAIL_FETCH_FAILED', `（历史 HTTP ${dataLogsResult.status ?? 'unknown'}）`);

  return [buildIssueDetailResult({
    projectId: matched.projectId,
    projectName: matched.projectName,
    detail: matched.detail,
    comments: normalizeListPayload(commentsResult.data),
    workLogs: normalizeListPayload(workLogsResult.data),
    dataLogs: normalizeListPayload(dataLogsResult.data),
  })];
}

cli({
  site: 'rdm',
  name: 'issue-detail',
  description: '查看 RDM 单个工单的详情信息',
  domain: 'rdm.changan.com.cn',
  strategy: Strategy.HEADER,
  browser: true,
  timeoutSeconds: 180,
  args: [
    { name: 'issue-id', positional: true, required: true, help: '工单内部 ID（如 697813958349832192）或工单编号（如 cymh-chn-123）' },
    { name: 'project-id', required: false, help: '项目 ID，可选' },
    { name: 'organization-id', type: 'int', default: 4, help: '组织 ID，默认 4' },
  ],
  columns: ['projectId', 'projectName', 'issueId', 'issueNum', 'summary', 'typeCode', 'status', 'reporterName', 'assigneeName', 'versions', 'labels', 'components', 'comments', 'workLogs', 'dataLogs'],
  func: async (page, kwargs) => {
    const query = buildIssueDetailQuery(kwargs);
    return executeIssueDetail(page, query);
  },
});

export const __test__ = { buildIssueDetailQuery, buildIssueDetailResult, executeIssueDetail, normalizeListPayload, isSnowflakeId, resolveIssueId };
