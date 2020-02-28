export enum TokenType {
  Greater = 'greater',
  Less = 'less',
  Question = 'question',
  Slash = 'slash',
  Equals = 'equals',

  StringLiteral = 'string-literal',
  Whitespace = 'whitespace',
  Name = 'name',

  Text = 'text',
  CommentContent = 'comment-content',
  CDataContent = 'cdata-content',
}

export const singleCharTokens = {
  '<': TokenType.Less,
  '>': TokenType.Greater,
  '?': TokenType.Question,
  '/': TokenType.Slash,
  '=': TokenType.Equals,
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

type UnfinishedTokenInfo = { content: string; startLocation: Location };
type UnfinishedToken = UnfinishedTokenInfo &
  (
    | { type: TokenType.StringLiteral; start: string }
    | { type: TokenType.Whitespace }
    | { type: TokenType.Name }
    | { type: TokenType.Text }
    | { type: TokenType.CommentContent }
    | { type: TokenType.CDataContent }
  );

export type Token = {
  type: TokenType;
  content: string;
  location: LocationInfo;
};

enum CharHandlerResult {
  Eat,
  Finalize,
  EatThenFinalize,
}

const whitespaceRegExp = /\s+/;
const nameRegExp = /[^<>?/="'\s]+/i;

export default class Tokenizer {
  private currentToken?: UnfinishedToken;

  // Parser location
  private index = -1; // 0 based
  private line = 1; // 1 based
  private column = 0; // 1 based

  public get unfinishedToken(): Token {
    return (
      this.currentToken && {
        ...this.currentToken,
        location: { start: this.currentToken.startLocation, end: this.currentLocation },
      }
    );
  }

  private handleTokenChar(char: string): CharHandlerResult {
    const token = this.currentToken;
    switch (token.type) {
      case TokenType.StringLiteral:
        return char === token.start ? CharHandlerResult.EatThenFinalize : CharHandlerResult.Eat;
      case TokenType.Whitespace:
        return whitespaceRegExp.test(char) ? CharHandlerResult.Eat : CharHandlerResult.Finalize;
      case TokenType.Name: {
        if (!nameRegExp.test(char)) {
          return CharHandlerResult.Finalize;
        }

        if (
          // Detected a CData section
          (char === '[' && token.content === '![CDATA') ||
          // Detected a comment
          (char === '-' && token.content === '!-')
        ) {
          return CharHandlerResult.EatThenFinalize;
        }

        return CharHandlerResult.Eat;
      }
      case TokenType.Text:
        return char === '<' ? CharHandlerResult.Finalize : CharHandlerResult.Eat;
      case TokenType.CommentContent:
        return char === '>' && token.content.endsWith('--')
          ? CharHandlerResult.EatThenFinalize
          : CharHandlerResult.Eat;
      case TokenType.CDataContent:
        return char === '>' && token.content.endsWith(']]')
          ? CharHandlerResult.EatThenFinalize
          : CharHandlerResult.Eat;
      default:
        throw new Error(`Unexpected character '${char}'`);
    }
  }

  private get currentLocation(): Location {
    return {
      index: this.index,
      line: this.line,
      column: this.column,
    };
  }

  private moveLocation(char): Location {
    this.index++;
    if (char === '\n') {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }

    return this.currentLocation;
  }

  private waitForLess = true;

  public startText(): void {
    this.waitForLess = true;
  }

  public stopText(): void {
    this.waitForLess = false;
  }

  private switchToType?: TokenType.CommentContent | TokenType.CDataContent;

  public startComment(): void {
    this.switchToType = TokenType.CommentContent;
  }

  public startCDataSection(): void {
    this.switchToType = TokenType.CDataContent;
  }

  public *tokenize(chunk: string): Generator<Token, void, unknown> {
    for (const char of chunk) {
      const currentLocation = this.moveLocation(char);

      const switchToType = this.switchToType;
      if (switchToType) {
        if (this.currentToken) {
          this.currentToken.type = this.switchToType;
        } else {
          this.currentToken = {
            type: switchToType,
            content: '',
            startLocation: currentLocation,
          } as UnfinishedToken;
        }

        delete this.switchToType;
      }

      if (this.currentToken) {
        const result = this.handleTokenChar(char);

        if (result !== CharHandlerResult.Finalize) {
          this.currentToken.content += char;
        }

        if (result !== CharHandlerResult.Eat) {
          yield {
            type: this.currentToken.type,
            content: this.currentToken.content,
            location: {
              start: this.currentToken.startLocation,
              end:
                result === CharHandlerResult.EatThenFinalize
                  ? {
                      // NOTE: This only works because no tokens end with a newline
                      index: currentLocation.index + 1,
                      column: currentLocation.column + 1,
                      line: currentLocation.line,
                    }
                  : currentLocation,
            },
          };
          delete this.currentToken;
        }

        if (result !== CharHandlerResult.Finalize) {
          // eslint-disable-next-line no-continue
          continue;
        }
      }

      if (this.waitForLess) {
        if (char === '<') {
          this.waitForLess = false;
        } else {
          this.currentToken = {
            type: TokenType.Text,
            content: char,
            startLocation: currentLocation,
          };
          // eslint-disable-next-line no-continue
          continue;
        }
      }

      const type = singleCharTokens[char];
      if (type) {
        yield { type, content: char, location: { start: currentLocation } };
      }

      // String literals
      else if (char === '"' || char === "'") {
        this.currentToken = {
          type: TokenType.StringLiteral,
          start: char,
          content: char,
          startLocation: currentLocation,
        };
      }

      // Whitespace
      else if (whitespaceRegExp.test(char)) {
        this.currentToken = {
          type: TokenType.Whitespace,
          content: char,
          startLocation: currentLocation,
        };
      }

      // Names
      else {
        this.currentToken = { type: TokenType.Name, content: char, startLocation: currentLocation };
      }
    }
  }
}
