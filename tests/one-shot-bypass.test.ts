import { describe, expect, it } from 'vitest';
import { OneShotBypass } from '../src/one-shot-bypass';

describe('OneShotBypass', () => {
	it('consumes a leaf and path pair exactly once', () => {
		const bypass = new OneShotBypass<object>();
		const leaf = {};
		bypass.arm(leaf, 'Documents/file.pdf');
		expect(bypass.consume(leaf, 'Documents/file.pdf')).toBe(true);
		expect(bypass.consume(leaf, 'Documents/file.pdf')).toBe(false);
	});

	it('isolates paths and leaves', () => {
		const bypass = new OneShotBypass<object>();
		const firstLeaf = {};
		const secondLeaf = {};
		bypass.arm(firstLeaf, 'Documents/first.pdf');
		bypass.arm(firstLeaf, 'Documents/second.pdf');
		bypass.arm(secondLeaf, 'Documents/first.pdf');

		expect(bypass.consume(firstLeaf, 'Documents/first.pdf')).toBe(true);
		expect(bypass.consume(firstLeaf, 'Documents/second.pdf')).toBe(true);
		expect(bypass.consume(secondLeaf, 'Documents/first.pdf')).toBe(true);
	});

	it('can clear an unused bypass after a failed open', () => {
		const bypass = new OneShotBypass<object>();
		const leaf = {};
		bypass.arm(leaf, 'Documents/file.pdf');
		bypass.clear(leaf, 'Documents/file.pdf');
		expect(bypass.consume(leaf, 'Documents/file.pdf')).toBe(false);
	});
});
