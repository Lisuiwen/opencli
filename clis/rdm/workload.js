import { cli, Strategy } from '@jackwener/opencli/registry';
import { buildRdmError } from './shared/errors.js';
import { postMemberPayloadDetail, postMemberPayloadList } from './shared/member-payload.js';
import { acquireRdmSession } from './shared/session.js';
import { asDate, clipToRange, isIsoDate, parseListArg, resolveDateRange, resolveTimeTab } from './shared/index.js';

function buildWorkloadQuery(kwargs) {
  const { from, to } = resolveDateRange(kwargs.from, kwargs.to);
  const organizationId = Number(kwargs['organization-id'] ?? 4);
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    throw new Error('参数错误：-organization-id 必须为正整数。');
  }

  return {
    from,
    to,
    organizationId,
    queryModel: {
      userIds: parseListArg(kwargs['user-ids']),
      userLabels: parseListArg(kwargs['user-labels']),
      userWorkGroupIds: parseListArg(kwargs['user-work-group-ids']),
      timeTab: resolveTimeTab(kwargs['time-tab']),
      issueTypeProject: parseListArg(kwargs['issue-type-project']),
      priority: parseListArg(kwargs.priority),
      status: parseListArg(kwargs.status),
      assignee: parseListArg(kwargs.assignee),
      projectWorkGroupIds: parseListArg(kwargs['project-work-group-ids']),
      projectStatusIds: parseListArg(kwargs['project-status-ids']),
      projectHealthSateIds: parseListArg(kwargs['project-health-state-ids']),
      projectCategoryIds: parseListArg(kwargs['project-category-ids']),
      projectIds: parseListArg(kwargs['project-ids']),
      projectClassficationIds: parseListArg(kwargs['project-classfication-ids']),
    },
  };
}

function buildCondition(fieldCode, values) {
  if (values.length === 0) return null;
  return { field: { fieldCode }, value: values };
}

function buildMemberPayloadRequestBody(query, resolvedUserIds) {
  const requestBody = {
    startTime: `${query.from} 00:00:00`,
    endTime: `${query.to} 23:59:59`,
    latitude: 'day',
    resultType: 'estimateTime',
    unit: 'workday',
    timeTab: query.queryModel.timeTab,
    userIds: resolvedUserIds,
  };

  if (query.queryModel.userLabels.length > 0) requestBody.userLabels = query.queryModel.userLabels;
  if (query.queryModel.userWorkGroupIds.length > 0) requestBody.workGroupIds = query.queryModel.userWorkGroupIds;

  const conditions = [
    buildCondition('issueTypeProject', query.queryModel.issueTypeProject),
    buildCondition('priority', query.queryModel.priority),
    buildCondition('status', query.queryModel.status),
    buildCondition('assignee', query.queryModel.assignee),
  ].filter(Boolean);

  if (conditions.length > 0) requestBody.conditions = conditions;

  const cbaseProjectSearchVO = Object.fromEntries(
    Object.entries({
      workGroupIds: query.queryModel.projectWorkGroupIds,
      statusIds: query.queryModel.projectStatusIds,
      healthSateIds: query.queryModel.projectHealthSateIds,
      categoryIds: query.queryModel.projectCategoryIds,
      projectIds: query.queryModel.projectIds,
      projectClassficationIds: query.queryModel.projectClassficationIds,
    }).filter(([, value]) => Array.isArray(value) && value.length > 0),
  );

  if (Object.keys(cbaseProjectSearchVO).length > 0) requestBody.cbaseProjectSearchVO = cbaseProjectSearchVO;
  return requestBody;
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function selectMemberRow(listJson, preferredMemberUserId, fallbackUserId) {
  const content = Array.isArray(listJson?.content) ? listJson.content : [];
  const memberRow =
    content.find((row) => String(row?.userId || '') === preferredMemberUserId)
    || content.find((row) => String(row?.userId || '') === fallbackUserId)
    || content[0];
  const memberUserId = String(memberRow?.userId || preferredMemberUserId || fallbackUserId);

  if (!memberUserId) throw buildRdmError('MEMBER_USER_ID_NOT_FOUND');
  return { memberUserId };
}

function mapWorkloadResult(params) {
  const { from, to, organizationId, resourceUrl, listUrl, detailUrl, listJson, detailJson, memberUserId } = params;
  const content = Array.isArray(listJson?.content) ? listJson.content : [];
  const memberRow = content.find((row) => String(row?.userId || '') === memberUserId) || content[0];
  const userInfo = memberRow?.userInfo || {};
  const estimateMap = memberRow?.estimateTimeMap || {};

  const daily = Object.entries(estimateMap)
    .map(([date, value]) => ({ date, estimatedHours: Number(toNumber(value).toFixed(2)) }))
    .filter((row) => isIsoDate(row.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (daily.length === 0) throw buildRdmError('DAILY_DATA_EMPTY');
  if (!Array.isArray(detailJson?.issues)) throw buildRdmError('DETAIL_STRUCTURE_INVALID');

  const items = detailJson.issues
    .map((issue) => {
      const rawFrom = asDate(issue?.estimatedStartTime);
      const rawTo = asDate(issue?.estimatedEndTime);
      if (!rawFrom || !rawTo) return null;
      const clipped = clipToRange(rawFrom, rawTo, from, to);
      if (!clipped) return null;

      return {
        title: String(issue?.summary || ''),
        from: clipped.from,
        to: clipped.to,
        hours: Number(toNumber(issue?.estimateTime).toFixed(2)),
        project: String(issue?.project?.name || ''),
        issueNum: String(issue?.issueNum || ''),
        issueId: String(issue?.issueId || ''),
        issueType: String(issue?.issueTypeVO?.name || ''),
        priority: String(issue?.priorityVO?.name || ''),
        status: String(issue?.statusVO?.name || ''),
      };
    })
    .filter(Boolean);

  const member = {
    id: memberUserId,
    loginName: String(userInfo?.loginName || ''),
    name: String(userInfo?.realName || userInfo?.name || ''),
    email: String(userInfo?.email || ''),
    workingGroup: Array.isArray(userInfo?.workingGroup) ? userInfo.workingGroup.map((group) => String(group)) : [],
  };

  const totalEstimatedHours = Number(daily.reduce((sum, row) => sum + toNumber(row.estimatedHours), 0).toFixed(2));
  const unplannedIssueCount = Number.isFinite(Number(detailJson?.unplannedIssueCount)) ? Number(detailJson.unplannedIssueCount) : 0;

  return {
    range: { from, to },
    member,
    daily,
    items,
    from,
    to,
    memberId: member.id,
    memberName: member.name,
    dailyCount: daily.length,
    itemCount: items.length,
    totalEstimatedHours,
    unplannedIssueCount,
    organizationId: Number(organizationId),
    source: { resourceUrl, listUrl, detailUrl },
  };
}

async function executeWorkload(page, query) {
  const context = await acquireRdmSession(page, query.organizationId);
  const resolvedUserIds = query.queryModel.userIds.length > 0 ? query.queryModel.userIds : [context.userId];
  const listBody = buildMemberPayloadRequestBody(query, resolvedUserIds);
  const listResponse = await postMemberPayloadList(context, listBody);

  if (!listResponse.ok) {
    if (listResponse.error === 'LIST_FETCH_FAILED') throw buildRdmError('LIST_FETCH_FAILED', `（HTTP ${listResponse.status ?? 'unknown'}）`);
    if (listResponse.error === 'LIST_CONTENT_EMPTY') throw buildRdmError('LIST_CONTENT_EMPTY');
    throw buildRdmError('EVALUATE_EXCEPTION', listResponse.message ? ` ${listResponse.message}` : '');
  }

  const { memberUserId } = selectMemberRow(listResponse.listJson, resolvedUserIds[0] || context.userId, context.userId);
  const detailResponse = await postMemberPayloadDetail(context, memberUserId, { ...listBody, userIds: [memberUserId] });

  if (!detailResponse.ok) {
    if (detailResponse.error === 'DETAIL_FETCH_FAILED') throw buildRdmError('DETAIL_FETCH_FAILED', `（HTTP ${detailResponse.status ?? 'unknown'}）`);
    throw buildRdmError('EVALUATE_EXCEPTION', detailResponse.message ? ` ${detailResponse.message}` : '');
  }

  return mapWorkloadResult({
    from: query.from,
    to: query.to,
    organizationId: context.organizationId,
    resourceUrl: context.targetUrl,
    listUrl: listResponse.listUrl,
    detailUrl: detailResponse.detailUrl,
    listJson: listResponse.listJson,
    detailJson: detailResponse.detailJson,
    memberUserId,
  });
}

cli({
  site: 'rdm',
  name: 'workload',
  description: '导出 RDM 成员工作负载，支持可选筛选参数并保留原有输出结构',
  domain: 'rdm.changan.com.cn',
  strategy: Strategy.HEADER,
  browser: true,
  timeoutSeconds: 120,
  args: [
    { name: 'from', required: false, help: '开始日期，格式 YYYY-MM-DD（闭区间）' },
    { name: 'to', required: false, help: '结束日期，格式 YYYY-MM-DD（闭区间）' },
    { name: 'organization-id', type: 'int', default: 4, help: '组织 ID，默认 4' },
    { name: 'user-ids', required: false, help: '指定成员 userId，逗号分隔；未传默认当前登录用户' },
    { name: 'user-labels', required: false, help: '人员标签 ID，逗号分隔，映射到 userLabels' },
    { name: 'user-work-group-ids', required: false, help: '人员范围工作组 ID，逗号分隔，映射到顶层 workGroupIds' },
    { name: 'time-tab', required: false, default: 'day', help: '时间粒度：day/week/month，默认 day' },
    { name: 'issue-type-project', required: false, help: '工作项类型（issueTypeProject），逗号分隔' },
    { name: 'priority', required: false, help: '工作项优先级，逗号分隔' },
    { name: 'status', required: false, help: '工作项状态，逗号分隔' },
    { name: 'assignee', required: false, help: '经办人，逗号分隔' },
    { name: 'project-work-group-ids', required: false, help: '项目范围工作组 ID，逗号分隔，映射到 cbaseProjectSearchVO.workGroupIds' },
    { name: 'project-status-ids', required: false, help: '项目状态 ID，逗号分隔，映射到 cbaseProjectSearchVO.statusIds' },
    { name: 'project-health-state-ids', required: false, help: '项目健康状态 ID，逗号分隔，映射到 cbaseProjectSearchVO.healthSateIds' },
    { name: 'project-category-ids', required: false, help: '项目分类 ID，逗号分隔，映射到 cbaseProjectSearchVO.categoryIds' },
    { name: 'project-ids', required: false, help: '指定项目 ID，逗号分隔，映射到 cbaseProjectSearchVO.projectIds' },
    { name: 'project-classfication-ids', required: false, help: '项目归类 ID，逗号分隔，映射到 cbaseProjectSearchVO.projectClassficationIds' },
  ],
  columns: ['from', 'to', 'memberName', 'memberId', 'dailyCount', 'itemCount', 'totalEstimatedHours', 'unplannedIssueCount'],
  func: async (page, kwargs) => {
    const query = buildWorkloadQuery(kwargs);
    return executeWorkload(page, query);
  },
});

export const __test__ = { buildMemberPayloadRequestBody, buildWorkloadQuery, executeWorkload, mapWorkloadResult, selectMemberRow };
