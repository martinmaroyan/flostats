import { expect, it } from "vitest";
import { isForfeit } from "./boutResults";

it("recognizes prefixed forfeits without treating falls as forfeits", () => {
	expect(isForfeit("FOR")).toBe(true);
	expect(isForfeit("M FOR")).toBe(true);
	expect(isForfeit("F")).toBe(false);
	expect(isForfeit("FALL")).toBe(false);
	expect(isForfeit("DEC")).toBe(false);
});
