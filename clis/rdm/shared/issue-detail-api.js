function buildIssueUrl(targetUrl, projectId, issueId, suffix = '') {
  return `${targetUrl.replace(/\/+$/, '')}/agile/projects/${projectId}/issues/${issueId}${suffix}`;
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
  return fetchIssueResource(context, buildIssueUrl(context.targetUrl, projectId, issueId));
}

export function fetchIssueComments(context, projectId, issueId) {
  return fetchIssueResource(context, buildIssueUrl(context.targetUrl, projectId, issueId, '/comments'));
}

export function fetchIssueWorkLogs(context, projectId, issueId) {
  return fetchIssueResource(context, buildIssueUrl(context.targetUrl, projectId, issueId, '/work-logs'));
}

export function fetchIssueDataLogs(context, projectId, issueId) {
  return fetchIssueResource(context, buildIssueUrl(context.targetUrl, projectId, issueId, '/data-logs'));
}
