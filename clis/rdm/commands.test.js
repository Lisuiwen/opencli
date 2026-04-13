import { describe, expect, it } from 'vitest';
import { getRegistry } from '@jackwener/opencli/registry';
import './workload.js';
import './worklist.js';
import './issue-detail.js';

describe('rdm command registration', () => {
  it('registers all planned rdm commands', () => {
    for (const name of ['workload', 'worklist', 'issue-detail']) {
      expect(getRegistry().get(`rdm/${name}`)).toBeDefined();
    }
  });

  it('keeps issue-detail issue-id as positional arg', () => {
    const command = getRegistry().get('rdm/issue-detail');
    const arg = command?.args.find((item) => item.name === 'issue-id');

    expect(command?.browser).toBe(true);
    expect(command?.strategy).toBeDefined();
    expect(command?.domain).toBe('rdm.changan.com.cn');
    expect(arg?.required).toBe(true);
    expect(arg?.positional).toBe(true);
  });

  it('preserves workload and worklist columns', () => {
    expect(getRegistry().get('rdm/workload')?.columns).toEqual([
      'from',
      'to',
      'memberName',
      'memberId',
      'dailyCount',
      'itemCount',
      'totalEstimatedHours',
      'unplannedIssueCount',
    ]);
    expect(getRegistry().get('rdm/worklist')?.columns).toEqual([
      'projectName',
      'issueNum',
      'summary',
      'typeName',
      'status',
      'statusType',
      'priority',
      'estimateTime',
      'remainingTime',
      'spentWorkTime',
      'creationDate',
      'lastUpdateDate',
      'estimatedStartTime',
      'estimatedEndTime',
      'featureName',
    ]);
  });
});
