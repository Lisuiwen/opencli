import { describe, expect, it, vi } from 'vitest';

vi.mock('./shared/common-api.js', () => ({
  fetchProjectsPage: vi.fn(),
}));

vi.mock('./shared/issue-detail-api.js', () => ({
  fetchIssueComments: vi.fn(),
  fetchIssueDataLogs: vi.fn(),
  fetchIssueDetail: vi.fn(),
  fetchIssueWorkLogs: vi.fn(),
}));

vi.mock('./shared/session.js', () => ({
  acquireRdmSession: vi.fn(),
}));

const commonApi = await import('./shared/common-api.js');
const issueApi = await import('./shared/issue-detail-api.js');
const session = await import('./shared/session.js');
const { __test__ } = await import('./issue-detail.js');

describe('rdm issue-detail', () => {
  it('parses positional issue-id query', () => {
    expect(__test__.buildIssueDetailQuery({
      'issue-id': 'RDM-1',
      'organization-id': 4,
      'project-id': '10',
    })).toEqual({
      issueId: 'RDM-1',
      projectId: '10',
      organizationId: 4,
    });
  });

  it('formats comment/worklog/datalog lines', () => {
    const result = __test__.buildIssueDetailResult({
      projectId: '10',
      projectName: '项目A',
      detail: { issues: [{ id: '1', issueNum: 'RDM-1', summary: '标题', typeCode: 'TASK', statusName: '处理中' }] },
      comments: [{ createdAt: '2026-04-01', authorName: '张三', content: '<p>评论</p>' }],
      workLogs: [{ createdAt: '2026-04-02', authorName: '李四', duration: 3 }],
      dataLogs: [{ createdAt: '2026-04-03', authorName: '王五', fieldName: '状态', oldString: '待处理', newString: '处理中' }],
    });

    expect(result.comments).toContain('评论');
    expect(result.workLogs).toContain('3h');
    expect(result.dataLogs).toContain('处理中');
  });

  it('queries issue directly when project-id is provided', async () => {
    vi.mocked(session.acquireRdmSession).mockResolvedValue({
      organizationId: '4',
      userId: '1001',
      targetUrl: 'https://rdm.changan.com.cn/',
      accessToken: 'token',
      page: {},
    });
    vi.mocked(issueApi.fetchIssueDetail).mockResolvedValue({
      ok: true,
      data: { issues: [{ id: '1', issueNum: 'RDM-1', summary: '标题', typeCode: 'TASK', statusName: '处理中' }] },
    });
    vi.mocked(issueApi.fetchIssueComments).mockResolvedValue({ ok: true, data: { issues: [] } });
    vi.mocked(issueApi.fetchIssueWorkLogs).mockResolvedValue({ ok: true, data: { issues: [] } });
    vi.mocked(issueApi.fetchIssueDataLogs).mockResolvedValue({ ok: true, data: { issues: [] } });

    const result = await __test__.executeIssueDetail({}, {
      issueId: 'RDM-1',
      projectId: '10',
      organizationId: 4,
    });

    expect(result).toHaveLength(1);
    expect(issueApi.fetchIssueDetail).toHaveBeenCalledWith(expect.anything(), '10', 'RDM-1');
  });

  it('falls back to accessible project traversal when project-id is absent', async () => {
    vi.mocked(session.acquireRdmSession).mockResolvedValue({
      organizationId: '4',
      userId: '1001',
      targetUrl: 'https://rdm.changan.com.cn/',
      accessToken: 'token',
      page: {},
    });
    vi.mocked(commonApi.fetchProjectsPage).mockResolvedValue({
      ok: true,
      data: {
        content: [{ id: '10', name: '项目A' }],
        empty: false,
        totalPages: 1,
      },
    });
    vi.mocked(issueApi.fetchIssueDetail).mockResolvedValue({
      ok: true,
      data: { issues: [{ id: '1', issueNum: 'RDM-1', summary: '标题', typeCode: 'TASK', statusName: '处理中' }] },
    });
    vi.mocked(issueApi.fetchIssueComments).mockResolvedValue({ ok: true, data: { issues: [] } });
    vi.mocked(issueApi.fetchIssueWorkLogs).mockResolvedValue({ ok: true, data: { issues: [] } });
    vi.mocked(issueApi.fetchIssueDataLogs).mockResolvedValue({ ok: true, data: { issues: [] } });

    const result = await __test__.executeIssueDetail({}, {
      issueId: 'RDM-1',
      organizationId: 4,
    });

    expect(result[0].projectId).toBe('10');
  });
});
