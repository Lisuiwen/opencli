const API_ORIGIN = 'https://api-rdm.changan.com.cn';

export async function fetchProjectsPage(context, page, size) {
  return context.page.evaluate(`async () => {
    const config = ${JSON.stringify({
      organizationId: context.organizationId,
      userId: context.userId,
      accessToken: context.accessToken,
      apiOrigin: API_ORIGIN,
      page,
      size,
    })};

    try {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'bearer ' + config.accessToken,
        'H-Tenant-Id': config.organizationId,
        'Request-Source': 'choerodon',
      };

      const url = config.apiOrigin
        + '/cbase/choerodon/v1/organizations/' + config.organizationId
        + '/users/' + config.userId
        + '/projects/paging?page=' + config.page + '&size=' + config.size;

      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers,
        body: JSON.stringify({ name: '', enable: false }),
      });

      if (!response.ok) {
        return { ok: false, error: 'PROJECTS_FETCH_FAILED', status: response.status };
      }

      const text = await response.text();
      const json = JSON.parse(text.replace(/:(\\s*)(\\d{16,})/g, ':"$2"'));
      return { ok: true, data: json, url };
    } catch (error) {
      return {
        ok: false,
        error: 'EVALUATE_EXCEPTION',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }`);
}
