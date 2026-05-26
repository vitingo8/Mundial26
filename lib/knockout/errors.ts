export class KnockoutBracketError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KnockoutBracketError'
  }
}
