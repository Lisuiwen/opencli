import { buildRdmError } from './errors.js';

export async function resolveRdmSessionContext(page, sessionRef, resourceUrl) {
  const details = await page.evaluate(`async () => {
    try {
      const runtime = globalThis;
      const href = String(runtime.location?.href || '');
      const host = String(runtime.location?.host || '');
      if (!host.includes('rdm.changan.com.cn')) {
        return { ok: false, error: 'INVALID_RDM_PAGE' };
      }

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = async (factory, timeoutMs, intervalMs = 150) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
          try {
            const value = factory();
            if (value) return value;
          } catch {}
          await sleep(intervalMs);
        }
        return null;
      };

      const parseCookies = () => {
        const rawCookie = typeof runtime.document?.cookie === 'string' ? runtime.document.cookie : '';
        const pairs = rawCookie ? rawCookie.split('; ') : [];
        return Object.fromEntries(
          pairs.map((pair) => {
            const idx = pair.indexOf('=');
            if (idx === -1) return [pair, ''];
            return [decodeURIComponent(pair.slice(0, idx)), decodeURIComponent(pair.slice(idx + 1))];
          }),
        );
      };

      const userState = await waitFor(
        () => runtime.__choerodonStores__?.AppState?.userInfo || runtime.__choeordonStores__?.AppState?.userInfo || null,
        15000,
      );

      if (!userState) {
        return { ok: false, error: 'USER_CONTEXT_NOT_READY' };
      }

      const userInfo = runtime.__choerodonStores__?.AppState?.userInfo
        || runtime.__choeordonStores__?.AppState?.userInfo
        || {};
      const organizationId = String(
        userInfo.organizationId || runtime.localStorage?.getItem('C7N-ORG-ID') || '',
      );
      if (!organizationId) {
        return { ok: false, error: 'ORGANIZATION_ID_NOT_FOUND' };
      }

      const userId = String(userInfo.id || '');
      if (!userId) {
        return { ok: false, error: 'USER_ID_NOT_FOUND' };
      }

      const cookies = parseCookies();
      const accessToken = String(cookies.access_token || '').trim();
      if (!accessToken) {
        return { ok: false, error: 'ACCESS_TOKEN_NOT_FOUND' };
      }

      return {
        ok: true,
        href,
        organizationId,
        userId,
        accessToken,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'EVALUATE_EXCEPTION',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }`);

  if (!details.ok) return details;

  return {
    ok: true,
    context: {
      sessionId: sessionRef.sessionId,
      targetUrl: details.href || resourceUrl,
      organizationId: details.organizationId,
      userId: details.userId,
      accessToken: details.accessToken,
      accessTokenAvailable: details.accessToken.length > 0,
      page,
    },
  };
}

async function assertRdmHost(page) {
  const isRdmHost = await page.evaluate(`(() => String(globalThis.location?.host || '').includes('rdm.changan.com.cn'))()`);
  if (!isRdmHost) {
    throw buildRdmError('INVALID_RDM_PAGE');
  }
}

export async function acquireRdmSession(page, organizationId = 4) {
  const siteUrl = 'https://rdm.changan.com.cn/';
  const sessionRef = {
    sessionId: `rdm:${organizationId}`,
  };

  await assertRdmHost(page);

  const resolved = await resolveRdmSessionContext(page, sessionRef, siteUrl);
  if (!resolved.ok) {
    throw buildRdmError(
      resolved.error,
      resolved.error === 'EVALUATE_EXCEPTION' && resolved.message ? ` ${resolved.message}` : '',
    );
  }

  return resolved.context;
}
