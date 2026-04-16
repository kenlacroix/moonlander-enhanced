import { describe, expect, it } from "vitest";
import { SumTree } from "../src/ai/SumTree";

describe("SumTree", () => {
	it("rounds capacity up to next power of 2", () => {
		const t = new SumTree<string>(5);
		// Can't inspect capacity directly, but we can verify by filling.
		for (let i = 0; i < 8; i++) t.add(1, `item-${i}`);
		expect(t.size).toBe(8);
		// 9th item overwrites slot 0 (ring buffer)
		t.add(1, "item-8");
		expect(t.size).toBe(8);
	});

	it("total matches sum of leaf priorities", () => {
		const t = new SumTree<string>(4);
		t.add(1, "a");
		t.add(2, "b");
		t.add(3, "c");
		expect(t.total).toBe(6);
		t.add(4, "d");
		expect(t.total).toBe(10);
	});

	it("get returns proportional to priority", () => {
		const t = new SumTree<string>(4);
		t.add(1, "a");
		t.add(3, "b"); // 3x more likely
		t.add(1, "c");
		t.add(1, "d");
		// Total = 6. Sample many times.
		const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
		for (let i = 0; i < 6000; i++) {
			const target = Math.random() * t.total;
			counts[t.get(target).data]++;
		}
		// b should be ~3000 (±200 tolerance at 6000 samples), others ~1000
		expect(counts.b).toBeGreaterThan(2500);
		expect(counts.b).toBeLessThan(3500);
		expect(counts.a).toBeGreaterThan(700);
		expect(counts.a).toBeLessThan(1300);
	});

	it("update changes priority and propagates to root", () => {
		const t = new SumTree<string>(4);
		t.add(1, "a");
		t.add(1, "b");
		t.add(1, "c");
		t.add(1, "d");
		expect(t.total).toBe(4);

		const sample = t.get(0); // first leaf
		t.update(sample.index, 5);
		expect(t.total).toBe(8);
	});

	it("maxLeafPriority returns max across populated leaves", () => {
		const t = new SumTree<string>(4);
		t.add(1, "a");
		t.add(3, "b");
		t.add(2, "c");
		expect(t.maxLeafPriority()).toBe(3);
	});

	it("ring-buffer overwrites oldest on overflow", () => {
		const t = new SumTree<string>(4);
		for (let i = 0; i < 4; i++) t.add(1, `old-${i}`);
		// Overflow: writes "new-0" to slot 0, replacing "old-0"
		t.add(10, "new-0");
		// "new-0" should be in the tree now with priority 10
		expect(t.total).toBe(13); // 3 * 1 + 10
		expect(t.maxLeafPriority()).toBe(10);
	});

	it("clear resets all state", () => {
		const t = new SumTree<string>(4);
		t.add(1, "a");
		t.add(2, "b");
		expect(t.size).toBe(2);
		expect(t.total).toBe(3);
		t.clear();
		expect(t.size).toBe(0);
		expect(t.total).toBe(0);
	});
});
