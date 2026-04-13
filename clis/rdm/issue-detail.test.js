import { describe, expect, it, vi } from 'vitest';

vi.mock('./shared/common-api.js', () => ({
  fetchProjectsPage: vi.fn(),
}));

vi.mock('./shared/issue-detail-api.js', () => ({
  extractProjectCode: vi.fn((issueNum) => {
    const lastDash = issueNum.lastIndexOf('-');
    return lastDash > 0 ? issueNum.slice(0, lastDash) : null;
  }),
  fetchIssueComments: vi.fn(),
  fetchIssueDataLogs: vi.fn(),
  fetchIssueDetail: vi.fn(),
  fetchIssueIdByNum: vi.fn(),
  fetchIssueWorkLogs: vi.fn(),
}));

vi.mock('./shared/session.js', () => ({
  acquireRdmSession: vi.fn(),
}));

const commonApi = await import('./shared/common-api.js');
const issueApi = await import('./shared/issue-detail-api.js');
const session = await import('./shared/session.js');
const mod = await import('./issue-detail.js');
const { __test__ } = mod;

describe('rdm issue-detail', () => {
  it('parses snowflake issue-id correctly', () => {
    expect(__test__.buildIssueDetailQuery({
      'issue-id': '697813958349832192',
      'organization-id': 4,
      'project-id': '10',
    })).toEqual({
      rawId: '697813958349832192',
      isIssueNum: false,
      projectId: '10',
      organizationId: 4,
    });
  });

  it('parses issueNum format and marks isIssueNum=true', () => {
    expect(__test__.buildIssueDetailQuery({ 'issue-id': 'cymh-chn-123' })).toMatchObject({
      rawId: 'cymh-chn-123',
      isIssueNum: true,
    });
  });

  it('isSnowflakeId detects correctly', () => {
    expect(__test__.isSnowflakeId('697813958349832192')).toBe(true);
    expect(__test__.isSnowflakeId('cymh-chn-123')).toBe(false);
    expect(__test__.isSnowflakeId('qianduanzu-202')).toBe(false);
  });

  it('formats comment/worklog/datalog lines', () => {
    const result = __test__.buildIssueDetailResult({
      projectId: '10',
      projectName: '项目A',
      detail: { issueId: '1', issueNum: 'RDM-1', summary: '标题', typeCode: 'TASK', statusMapVO: { name: '处理中' } },
      comments: [{ lastUpdateDate: '2026-04-01', userName: '张三', commentText: '<p>评论</p>' }],
      workLogs: [{ startDate: '2026-04-02', userName: '李四', workTime: 3 }],
      dataLogs: [{ lastUpdateDate: '2026-04-03', name: '王五', field: '状态', oldString: '待处理', newString: '处理中' }],
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
      data: { issueId: '1', issueNum: 'RDM-1', summary: '标题', typeCode: 'TASK', statusMapVO: { name: '处理中' } },
    });
    vi.mocked(issueApi.fetchIssueComments).mockResolvedValue({ ok: true, data: { content: [] } });
    vi.mocked(issueApi.fetchIssueWorkLogs).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(issueApi.fetchIssueDataLogs).mockResolvedValue({ ok: true, data: [] });

    const result = await __test__.executeIssueDetail({}, {
      rawId: '697813958349832192',
      isIssueNum: false,
      projectId: '10',
      organizationId: 4,
    });

    expect(result).toHaveLength(1);
    expect(issueApi.fetchIssueDetail).toHaveBeenCalledWith(expect.anything(), '10', '697813958349832192');
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
      data: { issueId: '1', issueNum: 'RDM-1', summary: '标题', typeCode: 'TASK', statusMapVO: { name: '处理中' } },
    });
    vi.mocked(issueApi.fetchIssueComments).mockResolvedValue({ ok: true, data: { content: [] } });
    vi.mocked(issueApi.fetchIssueWorkLogs).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(issueApi.fetchIssueDataLogs).mockResolvedValue({ ok: true, data: [] });

    const result = await __test__.executeIssueDetail({}, {
      rawId: '697813958349832192',
      isIssueNum: false,
      organizationId: 4,
    });

    expect(result[0].projectId).toBe('10');
  });
});
