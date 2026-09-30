// FloArena uses both FOR and prefixed codes such as M FOR (medical forfeit).
export function isForfeit(winType: string): boolean {
	return winType.split(/\s+/).includes("FOR");
}
