export declare enum TokenType {
    Greater = "greater",
    Less = "less",
    Question = "question",
    Slash = "slash",
    Equals = "equals",
    StringLiteral = "string-literal",
    Whitespace = "whitespace",
    Name = "name",
    Text = "text",
    CommentContent = "comment-content",
    CDataContent = "cdata-content"
}
export declare const singleCharTokens: {
    '<': TokenType;
    '>': TokenType;
    '?': TokenType;
    '/': TokenType;
    '=': TokenType;
};
export interface Location {
    index: number;
    line: number;
    column: number;
}
export interface LocationInfo {
    start: Location;
    end?: Location;
}
export declare type Token = {
    type: TokenType;
    content: string;
    location: LocationInfo;
};
export default class Tokenizer {
    private currentToken?;
    private index;
    private line;
    private column;
    get unfinishedToken(): Token;
    private handleTokenChar;
    private get currentLocation();
    private moveLocation;
    private waitForLess;
    startText(): void;
    stopText(): void;
    private switchToType?;
    startComment(): void;
    startCDataSection(): void;
    tokenize(chunk: string): Generator<Token, void, unknown>;
}
