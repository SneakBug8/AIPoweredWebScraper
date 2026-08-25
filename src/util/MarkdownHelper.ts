class MarkdownHelperClass {
    /**
 * Splits a markdown string into chunks of at most `maxLength` characters,
 * ensuring that no chunk boundary falls inside an HTML tag (including comments).
 * If an HTML tag itself is longer than `maxLength`, the chunk containing it
 * will exceed `maxLength` – this is unavoidable without breaking the tag.
 *
 * @param text - The markdown string to split.
 * @param maxLength - The desired maximum length of each chunk (must be ≥ 1).
 * @returns An array of chunks. All chunks except the last will normally have
 *          length ≤ `maxLength`, unless a single tag exceeds `maxLength`.
 */
    splitMarkdown(text: string, maxLength: number): string[] {
        if (maxLength < 1) throw new Error('maxLength must be a positive integer');
        if (!text) return [];

        const safeIndices = getSafeSplitIndices(text);
        const pieces: string[] = [];
        let start = 0;

        while (start < text.length) {
            const target = start + maxLength;

            // Largest safe position ≤ target
            let end = floorValue(safeIndices, target);

            // If the only safe position within bounds is `start` itself,
            // we have to jump to the next safe position (which will exceed maxLength).
            if (end === start) {
                const nextEnd = ceilValue(safeIndices, start);
                if (nextEnd === -1) {
                    // Should never happen because text.length is always a safe index
                    end = text.length;
                } else {
                    end = nextEnd;
                }
            }

            pieces.push(text.substring(start, end));
            start = end;
        }

        return pieces;
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns all character indices at which it is safe to split the text,
 * i.e. positions where we are **not** inside an HTML tag or comment.
 * Always includes 0 and `text.length`.
 */
function getSafeSplitIndices(text: string): number[] {
    const safe: number[] = [0];

    let inTag = false;
    let inComment = false;

    for (let i = 0; i < text.length; i++) {
        if (inComment) {
            // Look for comment end "-->"
            if (text.startsWith('-->', i)) {
                inComment = false;
                safe.push(i + 3); // safe position right after "-->"
                i += 2; // loop will do i++ → total skip of 3
                continue;
            }
            // else still inside comment → no safe position
            continue;
        }

        if (!inTag) {
            if (text[i] === '<') {
                // Check for comment start
                if (text.startsWith('<!--', i)) {
                    inComment = true;
                    i += 3; // jump past "<!--"
                    continue;
                }
                inTag = true;
                // entering a tag – no safe position added here
            } else {
                // plain text character – position after it is safe
                safe.push(i + 1);
            }
        } else {
            // inside a regular tag
            if (text[i] === '>') {
                inTag = false;
                safe.push(i + 1);
            }
            // else still inside tag → no safe position
        }
    }

    // If the text ends while still inside a tag/comment, force the end to be safe
    if (safe[safe.length - 1] !== text.length) {
        safe.push(text.length);
    }

    return safe;
}

/**
 * Largest element in `arr` that is ≤ `target`.
 * Assumes `arr` is sorted ascending.
 */
function floorValue(arr: number[], target: number): number {
    let lo = 0;
    let hi = arr.length - 1;
    let ans = -1;

    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] <= target) {
            ans = arr[mid];
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    return ans;
}

/**
 * Smallest element in `arr` that is > `value`.
 * Returns -1 if no such element exists.
 */
function ceilValue(arr: number[], value: number): number {
    let lo = 0;
    let hi = arr.length - 1;
    let ans = -1;

    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] > value) {
            ans = arr[mid];
            hi = mid - 1;
        } else {
            lo = mid + 1;
        }
    }

    return ans;
}

export const MarkdownHelper = new MarkdownHelperClass();