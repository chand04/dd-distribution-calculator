import { describe, expect, it } from 'vitest';
import { calculate, parseStrictNumber, type CalcRequest } from '../../src/calc';

const BASE: CalcRequest = {
  distribution: 'normal',
  mode: 'probability',
  region: 'left',
  valueText: '1.96',
  probabilityText: '0.05',
  dfText: '10',
};

const req = (over: Partial<CalcRequest> = {}): CalcRequest => ({ ...BASE, ...over });

function statement(over: Partial<CalcRequest> = {}): string {
  const r = calculate(req(over));
  if (!r.ok) throw new Error(`expected success, got: ${r.message}`);
  return [r.statement, ...r.detail].join(' | ');
}

function failure(over: Partial<CalcRequest>) {
  const r = calculate(req(over));
  if (r.ok) throw new Error(`expected failure, got: ${r.statement}`);
  return r;
}

describe('parseStrictNumber', () => {
  it('accepts plain and scientific notation', () => {
    expect(parseStrictNumber('1.96')).toBe(1.96);
    expect(parseStrictNumber('-2.5')).toBe(-2.5);
    expect(parseStrictNumber('+0.5')).toBe(0.5);
    expect(parseStrictNumber('.5')).toBe(0.5);
    expect(parseStrictNumber('1e-24')).toBe(1e-24);
    expect(parseStrictNumber('1.5E+3')).toBe(1500);
    expect(parseStrictNumber('  1.96  ')).toBe(1.96);
  });

  it('rejects what parseFloat would silently accept', () => {
    for (const bad of ['1.96abc', '1,96', '1 2', '--1', '1e', '0x10', 'Infinity',
      '-Infinity', 'NaN', '', '   ', 'e5', '1..2', '1e999']) {
      expect(parseStrictNumber(bad), bad).toBeNull();
    }
  });
});

describe('probability from a value', () => {
  it('states the region it actually computed', () => {
    expect(statement()).toBe('P(Z ≤ 1.96) = 0.975002');
    expect(statement({ region: 'right' })).toBe('P(Z ≥ 1.96) = 0.0249979');
    expect(statement({ region: 'central' }))
      .toBe('P(-1.96 ≤ Z ≤ 1.96) = 0.950004');
    expect(statement({ region: 'twoTails' }))
      .toBe('P(Z ≤ -1.96 or Z ≥ 1.96) = 0.0499958');
  });

  it('uses T and names the degrees of freedom', () => {
    expect(statement({ distribution: 't', valueText: '2.228138852', region: 'right' }))
      .toBe('P(T ≥ 2.22814) = 0.025 with df = 10');
    expect(statement({ distribution: 't', dfText: '7.5', valueText: '2' }))
      .toContain('with df = 7.5');
  });

  it('never prints a near-certain probability as 1', () => {
    expect(statement({ valueText: '10' })).toBe('P(Z ≤ 10) = 1 - 7.61985e-24');
  });

  it('reports an underflowing tail as a bound', () => {
    expect(statement({ valueText: '45', region: 'right' }))
      .toBe('P(Z ≥ 45) < 1e-308');
  });

  it('treats the degenerate c = 0 cases as exact', () => {
    expect(statement({ region: 'central', valueText: '0' }))
      .toBe('P(0 ≤ Z ≤ 0) = 0');
    expect(statement({ region: 'twoTails', valueText: '0' }))
      .toBe('P(Z ≤ 0 or Z ≥ 0) = 1');
  });
});

describe('value from a probability', () => {
  it('left and right tails', () => {
    expect(statement({ mode: 'value', probabilityText: '0.975' }))
      .toBe('Z = 1.95996 gives P(Z ≤ 1.95996) = 0.975');
    expect(statement({ mode: 'value', region: 'right', probabilityText: '0.025' }))
      .toBe('Z = 1.95996 gives P(Z ≥ 1.95996) = 0.025');
  });

  it('gives the cutoff and both endpoints for a central area', () => {
    expect(statement({ mode: 'value', region: 'central', probabilityText: '0.95' }))
      .toBe(
        'c = 1.95996 gives P(-1.95996 ≤ Z ≤ 1.95996) = 0.95'
        + ' | Interval endpoints: -1.95996 and 1.95996',
      );
  });

  it('says explicitly that a two-tail probability is the total', () => {
    const s = statement({ mode: 'value', region: 'twoTails', probabilityText: '0.05' });
    expect(s).toContain('= 0.05 in total');
    expect(s).toContain('Interval endpoints: -1.95996 and 1.95996');
    expect(s).toContain('Each tail has probability 0.025');
  });

  it('matches the specification benchmark for t', () => {
    expect(statement({
      distribution: 't', mode: 'value', region: 'twoTails',
      probabilityText: '0.05', dfText: '10',
    })).toContain('c = 2.22814');
  });

  it('handles extreme probabilities', () => {
    expect(statement({ mode: 'value', region: 'right', probabilityText: '1e-12' }))
      .toContain('Z = 7.03448');
    expect(statement({ mode: 'value', region: 'right', probabilityText: '1e-24' }))
      .toContain('Z = 10.1992');
  });
});

describe('rejected input', () => {
  it('rejects malformed values', () => {
    for (const bad of ['', ' ', '1.96abc', 'NaN', 'Infinity', '1,96']) {
      expect(failure({ valueText: bad }).field).toBe('value');
    }
  });

  it('rejects a negative symmetric cutoff', () => {
    const f = failure({ region: 'central', valueText: '-1' });
    expect(f.message).toContain('0 or greater');
    expect(failure({ region: 'twoTails', valueText: '-0.5' }).field).toBe('value');
  });

  it('rejects values beyond the supported magnitude', () => {
    expect(failure({ valueText: '1e9' }).message).toContain('magnitude at most');
  });

  it('rejects probabilities outside (0, 1)', () => {
    for (const bad of ['0', '1', '-0.1', '1.5', '2', '']) {
      expect(failure({ mode: 'value', probabilityText: bad }).field).toBe('probability');
    }
  });

  it('rejects nonpositive, malformed and unsupported degrees of freedom', () => {
    for (const bad of ['0', '-1', '-0.5', 'abc', '', '10x']) {
      expect(failure({ distribution: 't', dfText: bad }).field).toBe('df');
    }
    expect(failure({ distribution: 't', dfText: '1e9' }).message)
      .toContain('outside the supported range');
    expect(failure({ distribution: 't', dfText: '0.5' }).message)
      .toContain('outside the supported range');
  });

  it('ignores degrees of freedom entirely for the normal distribution', () => {
    expect(statement({ dfText: 'nonsense' })).toBe('P(Z ≤ 1.96) = 0.975002');
  });

  it('declines rather than inventing an answer beyond the supported range', () => {
    // At df = 1 a right-tail probability of 1e-300 needs a cutoff near 1e299,
    // which the library reports as infinite rather than returning.
    const f = failure({
      distribution: 't', dfText: '1', mode: 'value',
      region: 'right', probabilityText: '1e-300',
    });
    expect(f.message).toContain('too extreme');
  });
});
