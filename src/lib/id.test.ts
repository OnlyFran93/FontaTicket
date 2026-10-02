import { describe, expect, it } from "vitest";
import { newId } from "./id";

describe("local IDs", () => {
  it("creates unique UUIDs", () => {
    const first = newId();
    const second = newId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
});
