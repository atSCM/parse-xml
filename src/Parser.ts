import { Readable } from 'stream';
import Tokenizer, { TokenType, Token, Location, LocationInfo } from './Tokenizer';
import TokenIterator from './TokenIterator';

// type TokenStream = ReturnType<Tokenizer['tokenize']>;

class UnexpectedTokenError extends Error {
  public readonly token: Token;
  public readonly location: { start: Location; end?: Location };

  constructor(token: Token, expected?: TokenType | TokenType[]) {
    let message = `Unexpected token '${token.content}' (${token.location.start.line}:${token.location.start.column})`;

    if (expected) {
      message += ', expected ';

      if (Array.isArray(expected)) {
        message += `one of: ${expected.join(', ')}`;
      } else {
        message += expected;
      }
    }

    super(message);

    this.token = token;
    this.location = token.location;
  }
}

export enum NodeType {
  ProcessingInstruction = 'processing-instruction',
  OpenTag = 'open-tag',
  CloseTag = 'close-tag',
  Text = 'text',
  CData = 'cdata',
  Comment = 'comment',
}

type BaseNode<T extends NodeType> = { type: T; tokens: Token[]; location: LocationInfo };

type AttributeNode = AttributeDefinition & { leadingWhitespace: string };

export type ProcessingInstruction = BaseNode<NodeType.ProcessingInstruction> & {
  name: string;
  attributes: AttributeNode[];
  trailingWhitespace?: string;
};
export type OpenTag = BaseNode<NodeType.OpenTag> & {
  name: string;
  selfClosing: boolean;
  attributes: AttributeNode[];
  trailingWhitespace?: string;
};
export type CloseTag = BaseNode<NodeType.CloseTag> & { name: string };
export type Text = BaseNode<NodeType.Text> & { content: string };
export type CData = BaseNode<NodeType.CData> & { content: string };
export type Comment = BaseNode<NodeType.Comment> & { content: string };

export type Node = ProcessingInstruction | OpenTag | CloseTag | Text | CData | Comment;

enum UnfinishedNodeType {
  Less, // <
  PIStart, // <?
  PIOpen, // <?name
  PIClose, // <?name ... ?
  // PI, // <?name ... ?>
  // OpenTagOpen, // <name
  // CloseTagStart, // </
  // CloseTagOpen, // </name
  // CommentOpen, // <!--
  // CDataOpen, // <!--
  Text,

  // Inner:
  AttributeDefinitionStart, // name
  AttributeDefinitionOpen, // name=
  AttributeDefinitionClose, // name="value"
}

type AttributeDefinition = { name: string; value: string; tokens: Token[] };

interface AttributesNodeData {
  attributes: AttributeDefinition[];
}

type PINodeData = { name: string } & AttributesNodeData;

type PIOpenNode = UnfinishedNode<{ type: UnfinishedNodeType.PIOpen } & PINodeData>;
type AttributeContainerNode = PIOpenNode;

type UnfinishedNodeData =
  | { type: UnfinishedNodeType.Less }
  | { type: UnfinishedNodeType.PIStart }
  | ({ type: UnfinishedNodeType.PIOpen } & PINodeData)
  | ({ type: UnfinishedNodeType.PIClose } & PINodeData)
  | ({ type: NodeType.ProcessingInstruction } & PINodeData)
  | {
      type: UnfinishedNodeType.AttributeDefinitionStart;
      parent: UnfinishedNode<AttributeContainerNode>;
      name: string;
    }
  | {
      type: UnfinishedNodeType.AttributeDefinitionOpen;
      parent: UnfinishedNode<AttributeContainerNode>;
      name: string;
    }
  | {
      type: UnfinishedNodeType.AttributeDefinitionClose;
      parent: UnfinishedNode<AttributeContainerNode & { name: string }>;
      name: string;
      value: string;
    }
  | { type: UnfinishedNodeType.Text };

type UnfinishedNode<T = UnfinishedNodeData> = { tokens: Token[] } & T;

export default class Parser {
  private tokenizer = new Tokenizer();

  private nextValue<T>(generator: Iterator<T>): T {
    const next = generator.next();

    if (!next.value) {
      throw new Error('Unexpected end of document');
    }

    return next.value;
  }

  private nextNonWhitespace<T>(generator: Iterator<T>): T {
    let result;

    while (!result || result.type === TokenType.Whitespace) {
      result = this.nextValue(generator);
    }

    return result;
  }

  private assertTokenType(token: Token, expected: TokenType | TokenType[]): Token {
    if (!(Array.isArray(expected) ? expected.includes(token.type) : token.type === expected)) {
      throw new UnexpectedTokenError(token, expected);
    }

    return token;
  }

  private walkAttributeDefinition(
    tokens: TokenIterator
  ): { token?: Token; attribute?: AttributeDefinition } {
    const nameToken = this.nextValue(tokens);
    if (nameToken.type !== TokenType.Name) {
      return { token: nameToken };
    }

    const name = nameToken.content;
    const equalsToken = this.assertTokenType(this.nextNonWhitespace(tokens), TokenType.Equals);
    const valueToken = this.assertTokenType(
      this.nextNonWhitespace(tokens),
      TokenType.StringLiteral
    );

    return {
      attribute: {
        name,
        value: valueToken.content.slice(1, -1),
        tokens: [nameToken, equalsToken, valueToken],
      },
    };
  }

  private walkLess(less: Token, tokenStream: TokenIterator): { node: Node } {
    const first = this.nextValue(tokenStream);

    // Got a close tag
    if (first.type === TokenType.Slash) {
      const name = this.assertTokenType(this.nextValue(tokenStream), TokenType.Name).content;
      this.assertTokenType(this.nextNonWhitespace(tokenStream), TokenType.Greater);

      return { node: { type: NodeType.CloseTag, name, ...tokenStream.eat() } };
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
          type: NodeType.CData,
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
          type: NodeType.Comment,
          content: content.content.slice(0, -3),
          ...tokenStream.eat(),
        },
      };
    }

    // As long as we have a whitespace next, an attribute definition can follow
    const attributes = [];
    let trailingWhitespace: string;
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
    } else if (current.type === TokenType.Slash) {
      selfClosing = true;
      current = this.nextValue(tokenStream);
    }

    if (current.type !== TokenType.Greater) {
      throw new UnexpectedTokenError(current, TokenType.Greater);
    }

    const nodeData: Omit<ProcessingInstruction, 'type'> = {
      name,
      attributes,
      ...tokenStream.eat(),
    };
    if (trailingWhitespace) nodeData.trailingWhitespace = trailingWhitespace;

    return {
      node: isPI
        ? { type: NodeType.ProcessingInstruction, ...nodeData }
        : { type: NodeType.OpenTag, ...nodeData, selfClosing },
    };
  }

  private walkText(first: Token, tokenStream: TokenIterator): { node: Node; token: Token } {
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
        type: NodeType.Text,
        content,
        ...tokenStream.eat(true),
      },
      token: current,
    };
  }

  private *walkTokens(tokens: TokenIterator): Generator<Node, void, unknown> {
    let current = tokens.next().value;
    while (current) {
      const handler: (token: Token, tokens: TokenIterator) => { node: Node; token?: Token } =
        {
          [TokenType.Less]: this.walkLess.bind(this),
          // [TokenType.Whitespace]: this.walkText.bind(this),
        }[current.type] || this.walkText.bind(this);

      const { node, token } = handler(current, tokens);

      yield node;

      current = token || tokens.next().value;
    }
  }

  private *parse(chunk: string) {
    for (const node of this.walkTokens(new TokenIterator(this.tokenizer.tokenize(chunk)))) {
      yield node;
    }
  }

  private finalize(): Node | void {
    const token = this.tokenizer.unfinishedToken;

    if (token) {
      if (token.type === TokenType.Whitespace) {
        return {
          type: NodeType.Text,
          content: token.content,
          tokens: [token],
          location: token.location,
        };
      }

      throw new Error('Unexpected end of document');
    }

    return null;
  }

  public *parseString(input: string) {
    for (const node of this.parse(input)) {
      yield node;
    }

    const last = this.finalize();
    if (last) yield last;
  }

  public async *parseStream(input: Readable) {
    for await (const chunk of input) {
      for (const node of this.parse(chunk.toString())) {
        yield node;
      }
    }

    const last = this.finalize();
    if (last) yield last;
  }
}
