const API_ORIGIN = 'https://api-rdm.changan.com.cn';

/** issueNum 格式：{projectCode}-{sequenceNum}，projectCode 可含 `-`，序号为纯数字。 */
export function extractProjectCode(issueNum) {
  const lastDash = issueNum.lastIndexOf('-');
  if (lastDash <= 0) return null;
  return issueNum.slice(0, lastDash);
}

/**
 * 通过 worklist API 在指定项目内以 issueNum 精确查找，返回 issueId。
 * 服务端不支持 issueNum 条件过滤，采用分页拉取 + 客户端匹配。
 * 找不到时返回 null。
 */
export async function fetchIssueIdByNum(context, projectId, issueNum) {
  return context.page.evaluate(`async () => {
    const config = ${JSON.stringify({
      organizationId: context.organizationId,
      accessToken: context.accessToken,
      apiOrigin: API_ORIGIN,
      projectId,
      issueNum,
    })};

    try {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'bearer ' + config.accessToken,
        'H-Tenant-Id': config.organizationId,
        'Request-Source': 'choerodon',
      };

      const body = { conditions: [], treeFlag: false, withSubIssues: false };
      const pageSize = 200;
      let page = 0;

      while (true) {
        const url = config.apiOrigin
          + '/agile/v2/projects/' + config.projectId
          + '/issues/work_list?page=' + page + '&size=' + pageSize;

        const response = await fetch(url, {
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) return { ok: false, status: response.status };

        const text = await response.text();
        const json = JSON.parse(text.replace(/:(\\s*)(\\d{16,})/g, ':"$2"'));
        const items = Array.isArray(json?.content) ? json.content : [];

        const found = items.find((item) => item.issueNum === config.issueNum);
        if (found) return { ok: true, issueId: String(found.issueId) };

        if (json?.empty || page + 1 >= (json?.totalPages ?? 1)) break;
        page += 1;
      }

      return { ok: true, issueId: null };
    } catch {
      return { ok: false, status: 0 };
    }
  }`);
}

async function fetchIssueResource(context, url) {
  return context.page.evaluate(`async () => {
    const config = ${JSON.stringify({
      organizationId: context.organizationId,
      accessToken: context.accessToken,
      url,
    })};

    try {
      const headers = {
        Accept: 'application/json',
        Authorization: 'bearer ' + config.accessToken,
        'H-Tenant-Id': config.organizationId,
        'Request-Source': 'choerodon',
      };

      const response = await fetch(config.url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        return { ok: false, url: config.url, status: response.status };
      }

      const text = await response.text();
      try {
        const json = JSON.parse(text.replace(/:(\\s*)(\\d{16,})/g, ':"$2"'));
        // RDM 部分接口在业务异常时仍返回 HTTP 200，但 body 包含 failed:true。
        if (json && json.failed === true) {
          return { ok: false, url: config.url, status: 400 };
        }
        return { ok: true, url: config.url, data: json };
      } catch {
        return { ok: false, url: config.url, status: response.status };
      }
    } catch {
      return { ok: false, url: config.url, status: 0 };
    }
  }`);
}

export function fetchIssueDetail(context, projectId, issueId) {
  const url =
    `${API_ORIGIN}/agile/v1/projects/${projectId}/issues/${issueId}` +
    `?organizationId=${context.organizationId}&instanceProjectId=${projectId}`;
  return fetchIssueResource(context, url);
}

export function fetchIssueComments(context, projectId, issueId) {
  const url =
    `${API_ORIGIN}/agile/v1/projects/${projectId}/issue_comment/issue/${issueId}/page` +
    `?organizationId=${context.organizationId}&instanceProjectId=${projectId}&page=0&size=50`;
  return fetchIssueResource(context, url);
}

export function fetchIssueWorkLogs(context, projectId, issueId) {
  const url = `${API_ORIGIN}/agile/v1/projects/${projectId}/work_log/issue/${issueId}`;
  return fetchIssueResource(context, url);
}

export function fetchIssueDataLogs(context, projectId, issueId) {
  const url =
    `${API_ORIGIN}/agile/v1/projects/${projectId}/data_log` +
    `?issueId=${issueId}&instanceProjectId=${projectId}`;
  return fetchIssueResource(context, url);
}
