const API_ORIGIN = 'https://api-rdm.changan.com.cn';

export async function fetchWorkListPage(context, projectId, requestBody, page, size) {
  return context.page.evaluate(`async () => {
    const config = ${JSON.stringify({
      organizationId: context.organizationId,
      accessToken: context.accessToken,
      apiOrigin: API_ORIGIN,
      projectId,
      requestBody,
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
        + '/agile/v2/projects/' + config.projectId
        + '/issues/work_list?page=' + config.page + '&size=' + config.size;

      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers,
        body: JSON.stringify(config.requestBody),
      });

      if (!response.ok) {
        return { ok: false, error: 'WORK_LIST_FETCH_FAILED', status: response.status };
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
