import { Token, LocationInfo } from './Tokenizer';

export default class TokenIterator implements Iterator<Token>, Iterable<Token> {
  // eslint-disable-next-line no-useless-constructor
  constructor(private tokenStream: Iterator<Token>) {}

  private collectedTokens: Token[] = [];

  public eat(keepLast = false): { tokens: Token[]; location: LocationInfo } {
    const tokens = this.collectedTokens;
    this.collectedTokens = [];
    if (keepLast) {
      this.collectedTokens.push(tokens.pop());
    }

    const last = tokens[tokens.length - 1];
    return {
      location: {
        start: tokens[0].location.start,
        end: last.location.end || last.location.start,
      },
      tokens,
    };
  }

  next() {
    const next = this.tokenStream.next();

    if (next.value) {
      this.collectedTokens.push(next.value);
    }

    return next;
  }

  return(value) {
    return this.tokenStream.return(value);
  }

  throw(error) {
    return this.tokenStream.throw(error);
  }

  [Symbol.iterator]() {
    return this;
  }
}
