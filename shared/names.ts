/** Names are compared without case, Estonian letters included: "Ärikonto" and "ärikonto" are the same name. */
export function foldName(name: string) {
  return name.trim().toLocaleLowerCase('et');
}

export function sameName(a: string, b: string) {
  return foldName(a) === foldName(b);
}
