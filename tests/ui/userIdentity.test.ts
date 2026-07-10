import { expect, test } from "bun:test";
import {
  createBrowserUuid,
  normalizeUserId,
} from "../../ui/persist/userIdentity";

test("browser UUID falls back to getRandomValues when randomUUID is unavailable", () => {
  let called = false;
  const uuid = createBrowserUuid({
    getRandomValues(values) {
      called = true;
      values.forEach((_, index) => {
        values[index] = index;
      });
      return values;
    },
  });

  expect(called).toBeTrue();
  expect(normalizeUserId(uuid)).toBe(uuid);
  expect(uuid[14]).toBe("4");
  expect(["8", "9", "a", "b"]).toContain(uuid.charAt(19));
});

test("browser UUID falls back when randomUUID throws on an HTTP context", () => {
  const uuid = createBrowserUuid({
    randomUUID() {
      throw new TypeError("randomUUID is unavailable");
    },
    getRandomValues(values) {
      values.fill(255);
      return values;
    },
  });

  expect(uuid).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
});

test("browser UUID has a last-resort fallback without Web Crypto", () => {
  const uuid = createBrowserUuid(null, () => 0);

  expect(uuid).toBe("00000000-0000-4000-8000-000000000000");
  expect(normalizeUserId(uuid)).toBe(uuid);
});
