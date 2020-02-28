'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var TokenType;
(function (TokenType) {
    TokenType["Greater"] = "greater";
    TokenType["Less"] = "less";
    TokenType["Question"] = "question";
    TokenType["Slash"] = "slash";
    TokenType["Equals"] = "equals";
    TokenType["StringLiteral"] = "string-literal";
    TokenType["Whitespace"] = "whitespace";
    TokenType["Name"] = "name";
    TokenType["Text"] = "text";
    TokenType["CommentContent"] = "comment-content";
    TokenType["CDataContent"] = "cdata-content";
})(TokenType || (TokenType = {}));
const singleCharTokens = {
    '<': TokenType.Less,
    '>': TokenType.Greater,
    '?': TokenType.Question,
    '/': TokenType.Slash,
    '=': TokenType.Equals,
};
var CharHandlerResult;
(function (CharHandlerResult) {
    CharHandlerResult[CharHandlerResult["Eat"] = 0] = "Eat";
    CharHandlerResult[CharHandlerResult["Finalize"] = 1] = "Finalize";
    CharHandlerResult[CharHandlerResult["EatThenFinalize"] = 2] = "EatThenFinalize";
})(CharHandlerResult || (CharHandlerResult = {}));
const whitespaceRegExp = /\s+/;
const nameRegExp = /[^<>?/="'\s]+/i;
class Tokenizer {
    constructor() {
        // Parser location
        this.index = -1; // 0 based
        this.line = 1; // 1 based
        this.column = 0; // 1 based
        this.waitForLess = true;
    }
    get unfinishedToken() {
        return (this.currentToken && {
            ...this.currentToken,
            location: { start: this.currentToken.startLocation, end: this.currentLocation },
        });
    }
    handleTokenChar(char) {
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
                    (char === '-' && token.content === '!-')) {
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
    get currentLocation() {
        return {
            index: this.index,
            line: this.line,
            column: this.column,
        };
    }
    moveLocation(char) {
        this.index++;
        if (char === '\n') {
            this.line++;
            this.column = 0;
        }
        else {
            this.column++;
        }
        return this.currentLocation;
    }
    startText() {
        this.waitForLess = true;
    }
    stopText() {
        this.waitForLess = false;
    }
    startComment() {
        this.switchToType = TokenType.CommentContent;
    }
    startCDataSection() {
        this.switchToType = TokenType.CDataContent;
    }
    *tokenize(chunk) {
        for (const char of chunk) {
            const currentLocation = this.moveLocation(char);
            const switchToType = this.switchToType;
            if (switchToType) {
                if (this.currentToken) {
                    this.currentToken.type = this.switchToType;
                }
                else {
                    this.currentToken = {
                        type: switchToType,
                        content: '',
                        startLocation: currentLocation,
                    };
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
                            end: result === CharHandlerResult.EatThenFinalize
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
                }
                else {
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

class TokenIterator {
    // eslint-disable-next-line no-useless-constructor
    constructor(tokenStream) {
        this.tokenStream = tokenStream;
        this.collectedTokens = [];
    }
    eat(keepLast = false) {
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

// type TokenStream = ReturnType<Tokenizer['tokenize']>;
class UnexpectedTokenError extends Error {
    constructor(token, expected) {
        let message = `Unexpected token '${token.content}' (${token.location.start.line}:${token.location.start.column})`;
        if (expected) {
            message += ', expected ';
            if (Array.isArray(expected)) {
                message += `one of: ${expected.join(', ')}`;
            }
            else {
                message += expected;
            }
        }
        super(message);
        this.token = token;
        this.location = token.location;
    }
}
(function (NodeType) {
    NodeType["ProcessingInstruction"] = "processing-instruction";
    NodeType["OpenTag"] = "open-tag";
    NodeType["CloseTag"] = "close-tag";
    NodeType["Text"] = "text";
    NodeType["CData"] = "cdata";
    NodeType["Comment"] = "comment";
})(exports.NodeType || (exports.NodeType = {}));
var UnfinishedNodeType;
(function (UnfinishedNodeType) {
    UnfinishedNodeType[UnfinishedNodeType["Less"] = 0] = "Less";
    UnfinishedNodeType[UnfinishedNodeType["PIStart"] = 1] = "PIStart";
    UnfinishedNodeType[UnfinishedNodeType["PIOpen"] = 2] = "PIOpen";
    UnfinishedNodeType[UnfinishedNodeType["PIClose"] = 3] = "PIClose";
    // PI, // <?name ... ?>
    // OpenTagOpen, // <name
    // CloseTagStart, // </
    // CloseTagOpen, // </name
    // CommentOpen, // <!--
    // CDataOpen, // <!--
    UnfinishedNodeType[UnfinishedNodeType["Text"] = 4] = "Text";
    // Inner:
    UnfinishedNodeType[UnfinishedNodeType["AttributeDefinitionStart"] = 5] = "AttributeDefinitionStart";
    UnfinishedNodeType[UnfinishedNodeType["AttributeDefinitionOpen"] = 6] = "AttributeDefinitionOpen";
    UnfinishedNodeType[UnfinishedNodeType["AttributeDefinitionClose"] = 7] = "AttributeDefinitionClose";
})(UnfinishedNodeType || (UnfinishedNodeType = {}));
class Parser {
    constructor() {
        this.tokenizer = new Tokenizer();
    }
    nextValue(generator) {
        const next = generator.next();
        if (!next.value) {
            throw new Error('Unexpected end of document');
        }
        return next.value;
    }
    nextNonWhitespace(generator) {
        let result;
        while (!result || result.type === TokenType.Whitespace) {
            result = this.nextValue(generator);
        }
        return result;
    }
    assertTokenType(token, expected) {
        if (!(Array.isArray(expected) ? expected.includes(token.type) : token.type === expected)) {
            throw new UnexpectedTokenError(token, expected);
        }
        return token;
    }
    walkAttributeDefinition(tokens) {
        const nameToken = this.nextValue(tokens);
        if (nameToken.type !== TokenType.Name) {
            return { token: nameToken };
        }
        const name = nameToken.content;
        const equalsToken = this.assertTokenType(this.nextNonWhitespace(tokens), TokenType.Equals);
        const valueToken = this.assertTokenType(this.nextNonWhitespace(tokens), TokenType.StringLiteral);
        return {
            attribute: {
                name,
                value: valueToken.content.slice(1, -1),
                tokens: [nameToken, equalsToken, valueToken],
            },
        };
    }
    walkLess(less, tokenStream) {
        const first = this.nextValue(tokenStream);
        // Got a close tag
        if (first.type === TokenType.Slash) {
            const name = this.assertTokenType(this.nextValue(tokenStream), TokenType.Name).content;
            this.assertTokenType(this.nextNonWhitespace(tokenStream), TokenType.Greater);
            return { node: { type: exports.NodeType.CloseTag, name, ...tokenStream.eat() } };
        }
        // Got an open tag or a processing instruction
        const isPI = first.type === TokenType.Question;
        const nameToken = isPI ? this.nextValue(tokenStream) : first;
        if (nameToken.type !== TokenType.Name) {
            throw new UnexpectedTokenError(nameToken, TokenType.Name);
        }
        const name = nameToken.content;
        // Stop tokenizing, as we have detected a cdata section
        if (name === '![CDATA[') {
            this.tokenizer.startCDataSection();
            const content = this.assertTokenType(this.nextValue(tokenStream), TokenType.CDataContent);
            return {
                node: {
                    type: exports.NodeType.CData,
                    content: content.content.slice(0, -3),
                    ...tokenStream.eat(),
                },
            };
        }
        // Detected a comment
        else if (name === '!--') {
            this.tokenizer.startComment();
            const content = this.assertTokenType(this.nextValue(tokenStream), TokenType.CommentContent);
            return {
                node: {
                    type: exports.NodeType.Comment,
                    content: content.content.slice(0, -3),
                    ...tokenStream.eat(),
                },
            };
        }
        // As long as we have a whitespace next, an attribute definition can follow
        const attributes = [];
        let trailingWhitespace;
        let current = this.nextValue(tokenStream);
        while (current.type === TokenType.Whitespace) {
            const { token, attribute } = this.walkAttributeDefinition(tokenStream);
            if (token) {
                trailingWhitespace = current.content;
                current = token;
                break;
            }
            attributes.push({ ...attribute, leadingWhitespace: current.content });
            current = this.nextValue(tokenStream);
        }
        let selfClosing = false;
        if (isPI) {
            this.assertTokenType(current, TokenType.Question);
            current = this.nextValue(tokenStream);
        }
        else if (current.type === TokenType.Slash) {
            selfClosing = true;
            current = this.nextValue(tokenStream);
        }
        if (current.type !== TokenType.Greater) {
            throw new UnexpectedTokenError(current, TokenType.Greater);
        }
        const nodeData = {
            name,
            attributes,
            ...tokenStream.eat(),
        };
        if (trailingWhitespace)
            nodeData.trailingWhitespace = trailingWhitespace;
        return {
            node: isPI
                ? { type: exports.NodeType.ProcessingInstruction, ...nodeData }
                : { type: exports.NodeType.OpenTag, ...nodeData, selfClosing },
        };
    }
    walkText(first, tokenStream) {
        let content = '';
        let current = first;
        this.tokenizer.startText();
        // Skip ahead to the next '<'.
        while (current.type !== TokenType.Less) {
            content += current.content;
            current = this.nextValue(tokenStream);
        }
        return {
            node: {
                type: exports.NodeType.Text,
                content,
                ...tokenStream.eat(true),
            },
            token: current,
        };
    }
    *walkTokens(tokens) {
        let current = tokens.next().value;
        while (current) {
            const handler = {
                [TokenType.Less]: this.walkLess.bind(this),
            }[current.type] || this.walkText.bind(this);
            const { node, token } = handler(current, tokens);
            yield node;
            current = token || tokens.next().value;
        }
    }
    *parse(chunk) {
        for (const node of this.walkTokens(new TokenIterator(this.tokenizer.tokenize(chunk)))) {
            yield node;
        }
    }
    finalize() {
        const token = this.tokenizer.unfinishedToken;
        if (token) {
            if (token.type === TokenType.Whitespace) {
                return {
                    type: exports.NodeType.Text,
                    content: token.content,
                    tokens: [token],
                    location: token.location,
                };
            }
            throw new Error('Unexpected end of document');
        }
        return null;
    }
    *parseString(input) {
        for (const node of this.parse(input)) {
            yield node;
        }
        const last = this.finalize();
        if (last)
            yield last;
    }
    async *parseStream(input) {
        for await (const chunk of input) {
            for (const node of this.parse(chunk.toString())) {
                yield node;
            }
        }
        const last = this.finalize();
        if (last)
            yield last;
    }
}

const parse = (string) => new Parser().parseString(string);
const parseStream = (stream) => new Parser().parseStream(stream);

exports.Parser = Parser;
exports.parse = parse;
exports.parseStream = parseStream;
