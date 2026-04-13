import { CommandExecutionError } from '@jackwener/opencli/errors';
import { describe, expect, it } from 'vitest';
import { buildRdmError } from './errors.js';

describe('rdm shared errors', () => {
  it('maps known codes to command execution errors', () => {
    const error = buildRdmError('INVALID_RDM_PAGE');

    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(error.message).toContain('RDM');
  });

  it('appends extra context when provided', () => {
    const error = buildRdmError('DETAIL_FETCH_FAILED', '（HTTP 500）');

    expect(error.message).toContain('HTTP 500');
  });
});
