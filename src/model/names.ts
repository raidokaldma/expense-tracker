/** Names are compared without case, Estonian letters included: "Ärikonto" and "ärikonto" are the same name. */
export const foldName = (name: string) => name.trim().toLocaleLowerCase('et');

export const sameName = (a: string, b: string) => foldName(a) === foldName(b);
