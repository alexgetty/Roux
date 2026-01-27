import { describe, it, expect } from 'vitest';
import { VERSION } from '../../src/index.js';

describe('roux', () => {
  it('exports VERSION as semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
