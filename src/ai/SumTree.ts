/**
 * SumTree: a binary tree where each internal node stores the sum of its
 * children's priorities. Used by Prioritized Experience Replay (PER) to
 * sample experiences proportional to priority in O(log N).
 *
 * Layout for capacity=4:
 *     index:   [0, 1, 2, 3, 4, 5, 6]
 *     role:    [ root , internal, leaves (4 capacity slots)         ]
 *              0 = sum of all leaves
 *              1 = sum of leaves 0..1 (tree[3..4])
 *              2 = sum of leaves 2..3 (tree[5..6])
 *              3..6 = actual leaf priorities
 *
 * For capacity N (power of 2), the tree array has 2N-1 entries.
 * Leaves start at index N-1.
 */
export class SumTree<T> {
	private readonly capacity: number;
	private readonly tree: Float64Array;
	private readonly data: (T | undefined)[];
	private write = 0;
	private count = 0;

	constructor(capacity: number) {
		// Round capacity up to next power of 2 for a complete tree.
		let cap = 1;
		while (cap < capacity) cap *= 2;
		this.capacity = cap;
		this.tree = new Float64Array(2 * cap - 1);
		this.data = new Array(cap);
	}

	get total(): number {
		return this.tree[0];
	}

	get size(): number {
		return this.count;
	}

	/**
	 * Add an item with the given priority. Overwrites oldest item when
	 * the buffer is full (ring-buffer semantics, matches the existing
	 * flat-array behavior in RLAgent).
	 */
	add(priority: number, item: T): void {
		const idx = this.write + this.capacity - 1;
		this.data[this.write] = item;
		this.update(idx, priority);
		this.write = (this.write + 1) % this.capacity;
		if (this.count < this.capacity) this.count++;
	}

	/**
	 * Update the priority of the leaf at tree-index `idx`.
	 * Propagates the delta up to the root.
	 */
	update(idx: number, priority: number): void {
		const delta = priority - this.tree[idx];
		this.tree[idx] = priority;
		let parent = idx;
		while (parent > 0) {
			parent = Math.floor((parent - 1) / 2);
			this.tree[parent] += delta;
		}
	}

	/**
	 * Sample a leaf by walking the tree toward the target sum.
	 * Returns { index, priority, data } where index is the tree-index
	 * (use with update() to change priority later).
	 */
	get(target: number): { index: number; priority: number; data: T } {
		let idx = 0;
		while (true) {
			const left = 2 * idx + 1;
			const right = left + 1;
			if (left >= this.tree.length) break;
			if (target <= this.tree[left]) {
				idx = left;
			} else {
				target -= this.tree[left];
				idx = right;
			}
		}
		const dataIdx = idx - (this.capacity - 1);
		const item = this.data[dataIdx];
		if (item === undefined) {
			throw new Error(`SumTree.get: empty leaf at index ${idx}`);
		}
		return { index: idx, priority: this.tree[idx], data: item };
	}

	/**
	 * Max leaf priority. Used by PER to assign fresh experiences a
	 * priority equal to current-max, ensuring they're sampled at least
	 * once before their TD-error is known.
	 */
	maxLeafPriority(): number {
		let max = 0;
		const start = this.capacity - 1;
		const end = Math.min(start + this.count, this.tree.length);
		for (let i = start; i < end; i++) {
			if (this.tree[i] > max) max = this.tree[i];
		}
		return max;
	}

	clear(): void {
		this.tree.fill(0);
		for (let i = 0; i < this.data.length; i++) this.data[i] = undefined;
		this.write = 0;
		this.count = 0;
	}
}
