import { describe, expect, it, vi } from 'vitest';

vi.useFakeTimers();
vi.setSystemTime(new Date('2026-04-13T08:00:00.000Z'));

const { clipToRange, parseListArg, resolveDateRange, resolveTimeTab } = await import('./index.js');
const { buildIssueDetailResult } = await import('./issue-detail-mapper.js');

describe('rdm shared utils', () => {
  it('parses list-like args from mixed formats', () => {
    expect(parseListArg('a,b; c\n d')).toEqual(['a', 'b', 'c', 'd']);
    expect(parseListArg('["x","y","x"]')).toEqual(['x', 'y']);
  });

  it('resolves default date range and clips item range', () => {
    expect(resolveDateRange(undefined, undefined)).toEqual({
      from: '2026-03-30',
      to: '2026-04-13',
    });
    expect(clipToRange('2026-04-01', '2026-04-20', '2026-04-05', '2026-04-10')).toEqual({
      from: '2026-04-05',
      to: '2026-04-10',
    });
  });

  it('validates time-tab enum', () => {
    expect(resolveTimeTab('week')).toBe('week');
    expect(() => resolveTimeTab('year')).toThrow(/time-tab/i);
  });

  it('formats issue detail payload into stable output', () => {
    const result = buildIssueDetailResult({
      projectId: '10',
      projectName: '演示项目',
      detail: {
        issueId: '123',
        issueNum: 'RDM-1',
        summary: '标题',
        typeCode: 'TASK',
        statusMapVO: { name: '处理中' },
        reporterName: '张三',
        assigneeName: '李四',
        versionIssueRelVOList: [{ name: 'v1.0' }],
        labelIssueRelVOList: [{ name: '核心' }],
        componentIssueRelVOList: [{ name: '前端' }],
      },
      comments: [{ lastUpdateDate: '2026-04-01', userName: '王五', commentText: '<p>评论内容</p>' }],
      workLogs: [{ startDate: '2026-04-02', userName: '赵六', workTime: 8 }],
      dataLogs: [{ lastUpdateDate: '2026-04-03', name: '孙七', field: '状态', oldString: '待处理', newString: '处理中' }],
    });

    expect(result.issueNum).toBe('RDM-1');
    expect(result.comments).toContain('评论内容');
    expect(result.workLogs).toContain('8h');
    expect(result.dataLogs).toContain('待处理 -> 处理中');
  });
});
