import { describe, expect, it, vi } from 'vitest';
import { dispatchOpenBehavior } from '../src/open-dispatch';

describe('dispatchOpenBehavior', () => {
	it('delegates Obsidian and placeholder behavior without launching an app', async () => {
		const open = vi.fn<() => Promise<string | null>>();
		await expect(dispatchOpenBehavior('obsidian', open)).resolves.toEqual({
			target: 'obsidian',
		});
		await expect(dispatchOpenBehavior('placeholder', open)).resolves.toEqual({
			target: 'placeholder',
		});
		expect(open).not.toHaveBeenCalled();
	});

	it('handles a successful default-app launch without opening a view', async () => {
		const open = vi.fn(async () => null);
		await expect(dispatchOpenBehavior('default-app', open)).resolves.toEqual({
			target: 'default-app',
		});
		expect(open).toHaveBeenCalledOnce();
	});

	it('falls back to the placeholder when the default app fails', async () => {
		const open = vi.fn(async () => 'No associated application');
		await expect(dispatchOpenBehavior('default-app', open)).resolves.toEqual({
			target: 'placeholder',
			defaultAppError: 'No associated application',
		});
	});
});
