const { getPositionLastStage, NO_ACTIVE_CANDIDATE } = require('../../src/utils/positionLastStage');

describe('positionLastStage', () => {
  it('returns none when there are no applications', () => {
    expect(getPositionLastStage([])).toBe(NO_ACTIVE_CANDIDATE);
  });

  it('picks the furthest non-terminal candidate', () => {
    expect(getPositionLastStage(['SUBMITTED', 'INTERVIEW_COMPLETED', 'SCREENING'])).toBe('Interviewed');
  });

  it('ignores terminal statuses', () => {
    expect(getPositionLastStage(['SUBMITTED', 'REJECTED', 'WITHDRAWN', 'OFFER_REJECTED'])).toBe('Applied');
    expect(getPositionLastStage(['REJECTED', 'WITHDRAWN'])).toBe(NO_ACTIVE_CANDIDATE);
  });

  it('only returns Keep In View when nobody is on the main path', () => {
    expect(getPositionLastStage(['KEEP_IN_VIEW', 'SUBMITTED'])).toBe('Applied');
    expect(getPositionLastStage(['KEEP_IN_VIEW', 'REJECTED'])).toBe('Keep In View');
  });

  it('normalizes aliases to their stepper stage', () => {
    expect(getPositionLastStage(['MEDICAL_CHECKUP_SCHEDULED'])).toBe('MCU');
    expect(getPositionLastStage(['CONTRACT_SIGNED'])).toBe('On Boarding');
  });
});
