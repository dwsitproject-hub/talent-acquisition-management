const {
  getAllowedNextStatuses,
  assertAllowedStatusTransition,
} = require('../../src/utils/applicationStatus');

describe('applicationStatus transitions', () => {
  it('allows Withdrawn from On Boarding', () => {
    const allowed = getAllowedNextStatuses('On Boarding');
    expect(allowed).toEqual(['On Boarding', 'Withdrawn']);
  });

  it('accepts ONBOARDING → WITHDRAWN', () => {
    expect(() => assertAllowedStatusTransition('ONBOARDING', 'WITHDRAWN')).not.toThrow();
  });

  it('rejects ONBOARDING → HIRED', () => {
    expect(() => assertAllowedStatusTransition('ONBOARDING', 'HIRED')).toThrow(
      /Cannot change candidate status from "On Boarding"/
    );
  });
});
