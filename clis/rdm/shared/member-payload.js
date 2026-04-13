const API_ORIGIN = 'https://api-rdm.changan.com.cn';

export async function postMemberPayloadList(context, requestBody) {
  return context.page.evaluate(`async () => {
    const config = ${JSON.stringify({
      organizationId: context.organizationId,
      accessToken: context.accessToken,
      requestBody,
      apiOrigin: API_ORIGIN,
    })};

    const postJson = async (url, headers, body) => {
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
      });

      let json = null;
      try {
        json = await response.json();
      } catch {}

      return { ok: response.ok, status: response.status, json };
    };

    try {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'bearer ' + config.accessToken,
        'H-Tenant-Id': config.organizationId,
        'Request-Source': 'choerodon',
      };

      const listUrl = config.apiOrigin + '/agile/v2/organizations/' + config.organizationId + '/work_bench/member_payload?page=0&size=20';
      const listResponse = await postJson(listUrl, headers, config.requestBody);
      if (!listResponse.ok) {
        return { ok: false, error: 'LIST_FETCH_FAILED', status: listResponse.status };
      }

      const content = Array.isArray(listResponse.json?.content) ? listResponse.json.content : [];
      if (content.length === 0) {
        return { ok: false, error: 'LIST_CONTENT_EMPTY' };
      }

      return { ok: true, listJson: listResponse.json, listUrl };
    } catch (error) {
      return {
        ok: false,
        error: 'EVALUATE_EXCEPTION',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }`);
}

export async function postMemberPayloadDetail(context, memberUserId, requestBody) {
  return context.page.evaluate(`async () => {
    const config = ${JSON.stringify({
      organizationId: context.organizationId,
      accessToken: context.accessToken,
      requestBody,
      apiOrigin: API_ORIGIN,
      memberUserId,
    })};

    const postJson = async (url, headers, body) => {
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
      });

      let json = null;
      try {
        json = await response.json();
      } catch {}

      return { ok: response.ok, status: response.status, json };
    };

    try {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'bearer ' + config.accessToken,
        'H-Tenant-Id': config.organizationId,
        'Request-Source': 'choerodon',
      };

      const detailUrl =
        config.apiOrigin
        + '/agile/v2/organizations/'
        + config.organizationId
        + '/work_bench/member_payload/'
        + encodeURIComponent(config.memberUserId)
        + '?page=0&size=20';

      const detailResponse = await postJson(detailUrl, headers, config.requestBody);
      if (!detailResponse.ok) {
        return { ok: false, error: 'DETAIL_FETCH_FAILED', status: detailResponse.status };
      }

      return { ok: true, detailJson: detailResponse.json, detailUrl };
    } catch (error) {
      return {
        ok: false,
        error: 'EVALUATE_EXCEPTION',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }`);
}
