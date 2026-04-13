import { describe, expect, it, vi } from 'vitest';

vi.mock('./shared/common-api.js', () => ({
  fetchProjectsPage: vi.fn(),
}));

vi.mock('./shared/agile-work-list.js', () => ({
  fetchWorkListPage: vi.fn(),
}));

vi.mock('./shared/session.js', () => ({
  acquireRdmSession: vi.fn(),
}));

const commonApi = await import('./shared/common-api.js');
const agileApi = await import('./shared/agile-work-list.js');
const session = await import('./shared/session.js');
const { __test__ } = await import('./worklist.js');

describe('rdm worklist', () => {
  it('builds query and request body from cli args', () => {
    expect(__test__.buildWorkListQuery({
      'organization-id': 4,
      'project-ids': '1,2',
      'page-size': 100,
      status: '处理中,待处理',
      summary: '关键字',
    })).toEqual({
      organizationId: 4,
      projectIds: ['1', '2'],
      pageSize: 100,
      statusFilter: ['处理中', '待处理'],
      summaryKeyword: '关键字',
    });

    expect(__test__.buildWorkListRequestBody('u1')).toEqual(expect.objectContaining({
      conditions: [expect.objectContaining({
        value: { valueIdList: ['u1'] },
      })],
    }));
  });

  it('maps issue item and deduplicates by issue id', () => {
    const mapped = __test__.mapIssueItem({
      issueId: '1',
      issueNum: 'RDM-1',
      summary: '标题',
      issueTypeVO: { name: '任务' },
      statusVO: { name: '处理中', type: 'DOING' },
      priorityVO: { name: '高' },
    }, '100');

    expect(mapped.projectName).toBe('项目 100');
    expect(__test__.deduplicateByIssueId([mapped, mapped])).toHaveLength(1);
  });

  it('fetches all projects and filters work items', async () => {
    vi.mocked(session.acquireRdmSession).mockResolvedValue({
      organizationId: '4',
      userId: '1001',
      targetUrl: 'https://rdm.changan.com.cn/',
      accessToken: 'token',
      page: {},
    });
    vi.mocked(commonApi.fetchProjectsPage)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          content: [{ id: '10', name: '项目A' }],
          empty: false,
          totalPages: 1,
        },
      });
    vi.mocked(agileApi.fetchWorkListPage)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          content: [{
            issueId: '1',
            issueNum: 'RDM-1',
            summary: '修复关键问题',
            issueTypeVO: { name: '任务' },
            statusVO: { name: '处理中', type: 'DOING' },
          }],
          empty: false,
          totalPages: 1,
        },
      });

    const result = await __test__.executeWorkList({}, __test__.buildWorkListQuery({
      status: '处理中',
      summary: '关键',
    }));

    expect(result).toHaveLength(1);
    expect(result[0].projectName).toBe('项目A');
  });
});
