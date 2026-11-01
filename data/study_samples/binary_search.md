# Binary Search: a compact study note

## Core idea

Binary search finds a target in a **sorted** sequence by repeatedly checking the middle element and keeping only the half that could still contain the target. The sorted-order requirement is essential: without it, the comparison at the midpoint does not tell us which half can be discarded.

## Iterative algorithm

For an array indexed from `0` to `n - 1`, set `low = 0` and `high = n - 1`. While `low <= high`, choose `mid = low + (high - low) // 2` and compare the middle value with the target:

- If they are equal, return `mid`.
- If the middle value is smaller, continue in the right half by setting `low = mid + 1`.
- If the middle value is larger, continue in the left half by setting `high = mid - 1`.
- If the loop ends, the target is not present.

## Example

Search for `24` in `[3, 7, 12, 18, 24, 31, 42]`. The first middle value is `18`. Since `24` is larger, discard the left half including `18`. The next middle value is `31`; since `24` is smaller, keep the left part of the remaining range. The next comparison reaches `24`, so the target is found.

## Correctness intuition

At every step, if the target exists, it remains inside the current inclusive range from `low` to `high`. Each comparison discards only values that cannot be the target, because the array is sorted. When the range becomes empty, no matching value exists.

## Complexity

Each step cuts the remaining search range roughly in half, so the number of comparisons grows logarithmically with the array length: **O(log n)** time. The iterative version stores only a few indices, so its extra space use is **O(1)**.

## Common mistakes

- Applying binary search to unsorted data.
- Using `low < high` when the algorithm is written for an inclusive range with `low <= high`.
- Forgetting `+ 1` or `- 1` when updating a bound, which can leave the midpoint in the range and repeat forever.
- Confusing finding any matching index with finding the first or last occurrence. Those boundary variants need a slightly different rule after a match.

## Quick self-check

1. Why must the input be sorted?
2. If the middle value is smaller than the target, which bound changes?
3. Why is the running time O(log n) rather than O(n)?
4. What change is needed to find the first occurrence when duplicates exist?
