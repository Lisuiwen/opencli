import { describe, expect, it, vi } from 'vitest';

vi.mock('./shared/member-payload.js', () => ({
  postMemberPayloadList: vi.fn(),
  postMemberPayloadDetail: vi.fn(),
}));

vi.mock('./shared/session.js', () => ({
  acquireRdmSession: vi.fn(),
}));

const memberPayload = await import('./shared/member-payload.js');
const session = await import('./shared/session.js');
const { __test__ } = await import('./workload.js');

describe('rdm workload', () => {
  it('builds normalized query from cli kwargs', () => {
    expect(__test__.buildWorkloadQuery({
      from: '2026-04-01',
      to: '2026-04-10',
      'organization-id': 4,
      'user-ids': 'u1,u2',
      'time-tab': 'week',
    })).toEqual(expect.objectContaining({
      from: '2026-04-01',
      to: '2026-04-10',
      organizationId: 4,
      queryModel: expect.objectContaining({
        userIds: ['u1', 'u2'],
        timeTab: 'week',
      }),
    }));
  });

  it('maps api payload into stable aggregate result', () => {
    const result = __test__.mapWorkloadResult({
      from: '2026-04-01',
      to: '2026-04-10',
      organizationId: '4',
      resourceUrl: 'https://rdm.changan.com.cn/',
      listUrl: 'https://api.example/list',
      detailUrl: 'https://api.example/detail',
      memberUserId: '1001',
      listJson: {
        content: [{
          userId: '1001',
          userInfo: { realName: '张三', loginName: 'zhangsan', email: 'a@example.com' },
          estimateTimeMap: { '2026-04-01': 8, '2026-04-02': 4 },
        }],
      },
      detailJson: {
        unplannedIssueCount: 1,
        issues: [{
          summary: '任务A',
          estimatedStartTime: '2026-04-01 00:00:00',
          estimatedEndTime: '2026-04-03 00:00:00',
          estimateTime: 12,
          project: { name: '项目A' },
          issueNum: 'RDM-1',
          issueId: '1',
          issueTypeVO: { name: '任务' },
          priorityVO: { name: '高' },
          statusVO: { name: '处理中' },
        }],
      },
    });

    expect(result.memberName).toBe('张三');
    expect(result.dailyCount).toBe(2);
    expect(result.itemCount).toBe(1);
    expect(result.totalEstimatedHours).toBe(12);
  });

  it('aggregates list and detail payloads through service flow', async () => {
    vi.mocked(session.acquireRdmSession).mockResolvedValue({
      organizationId: '4',
      userId: '1001',
      targetUrl: 'https://rdm.changan.com.cn/',
      accessToken: 'token',
      page: {},
    });
    vi.mocked(memberPayload.postMemberPayloadList).mockResolvedValue({
      ok: true,
      listUrl: 'https://api.example/list',
      listJson: {
        content: [{
          userId: '1001',
          userInfo: { realName: '张三' },
          estimateTimeMap: { '2026-04-01': 8 },
        }],
      },
    });
    vi.mocked(memberPayload.postMemberPayloadDetail).mockResolvedValue({
      ok: true,
      detailUrl: 'https://api.example/detail',
      detailJson: {
        unplannedIssueCount: 0,
        issues: [{
          summary: '任务A',
          estimatedStartTime: '2026-04-01 00:00:00',
          estimatedEndTime: '2026-04-01 00:00:00',
          estimateTime: 8,
        }],
      },
    });

    const result = await __test__.executeWorkload({}, __test__.buildWorkloadQuery({
      from: '2026-04-01',
      to: '2026-04-01',
    }));

    expect(result.memberName).toBe('张三');
    expect(memberPayload.postMemberPayloadList).toHaveBeenCalledTimes(1);
    expect(memberPayload.postMemberPayloadDetail).toHaveBeenCalledTimes(1);
  });
});
