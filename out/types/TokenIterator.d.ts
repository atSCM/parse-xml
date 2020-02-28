import { Token, LocationInfo } from './Tokenizer';
export default class TokenIterator implements Iterator<Token>, Iterable<Token> {
    private tokenStream;
    constructor(tokenStream: Iterator<Token>);
    private collectedTokens;
    eat(keepLast?: boolean): {
        tokens: Token[];
        location: LocationInfo;
    };
    next(): IteratorResult<Token, any>;
    return(value: any): IteratorResult<Token, any>;
    throw(error: any): IteratorResult<Token, any>;
    [Symbol.iterator](): this;
}
