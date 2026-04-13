import { describe, expect, it, vi } from 'vitest';
import { resolveRdmSessionContext } from './session.js';

describe('rdm session context', () => {
  it('returns normalized context for valid rdm page', async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue({
        ok: true,
        href: 'https://rdm.changan.com.cn/#/home',
        organizationId: '4',
        userId: '1001',
        accessToken: 'token-1',
      }),
    };

    const result = await resolveRdmSessionContext(page, { sessionId: 'session-1' }, 'https://rdm.changan.com.cn/');

    expect(result).toEqual({
      ok: true,
      context: expect.objectContaining({
        sessionId: 'session-1',
        organizationId: '4',
        userId: '1001',
        accessToken: 'token-1',
        accessTokenAvailable: true,
      }),
    });
  });

  it('returns explicit error when token is missing', async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue({
        ok: false,
        error: 'ACCESS_TOKEN_NOT_FOUND',
      }),
    };

    const result = await resolveRdmSessionContext(page, { sessionId: 'session-1' }, 'https://rdm.changan.com.cn/');

    expect(result).toEqual({
      ok: false,
      error: 'ACCESS_TOKEN_NOT_FOUND',
    });
  });

  it('returns explicit error when current page is not rdm', async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue({
        ok: false,
        error: 'INVALID_RDM_PAGE',
      }),
    };

    const result = await resolveRdmSessionContext(page, { sessionId: 'session-1' }, 'https://rdm.changan.com.cn/');

    expect(result.error).toBe('INVALID_RDM_PAGE');
  });
});
