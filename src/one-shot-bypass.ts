export class OneShotBypass<TTarget extends object> {
	private readonly entries = new WeakMap<TTarget, Set<string>>();

	arm(target: TTarget, path: string): void {
		const paths = this.entries.get(target) ?? new Set<string>();
		paths.add(path);
		this.entries.set(target, paths);
	}

	consume(target: TTarget, path: string): boolean {
		const paths = this.entries.get(target);
		if (!paths?.delete(path)) {
			return false;
		}
		if (paths.size === 0) {
			this.entries.delete(target);
		}
		return true;
	}

	clear(target: TTarget, path: string): void {
		const paths = this.entries.get(target);
		paths?.delete(path);
		if (paths?.size === 0) {
			this.entries.delete(target);
		}
	}
}
