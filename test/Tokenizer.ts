import test, { ExecutionContext } from 'ava';
import Tokenizer, { singleCharTokens, TokenType, Token } from '../src/Tokenizer';

type RawToken = Omit<Token, 'location'>;

const tokenize = (chunk: string) =>
  Object.assign(new Tokenizer(), { waitForLess: false }).tokenize(chunk);

const tokenEquals = (t: ExecutionContext, { type, content }: Token, expected: RawToken) =>
  t.deepEqual({ type, content }, expected);

const yieldsTokens = (
  t: ExecutionContext,
  input: string,
  expected: { type: TokenType; content: string }[]
) =>
  t.deepEqual(
    [...tokenize(input)].map(({ type, content }) => ({ type, content })),
    expected
  );

test('Tokenizer should emit single char tokens', t => {
  t.deepEqual(
    [...tokenize(Object.keys(singleCharTokens).join(''))].map(({ type }) => type),
    Object.values(singleCharTokens)
  );
});

test('Tokenizer should emit multi-char tokens', t => {
  yieldsTokens(t, '"string literal"', [
    { type: TokenType.StringLiteral, content: '"string literal"' },
  ]);

  const whitespace = `
  `;
  yieldsTokens(t, `${whitespace}x`, [{ type: TokenType.Whitespace, content: whitespace }]);

  yieldsTokens(t, 'asdf ', [{ type: TokenType.Name, content: 'asdf' }]);
});

test('Tokenizer should yield after cdata and comment start', t => {
  yieldsTokens(t, '<![CDATA[', [
    { type: TokenType.Less, content: '<' },
    { type: TokenType.Name, content: '![CDATA[' },
  ]);

  yieldsTokens(t, '<!--', [
    { type: TokenType.Less, content: '<' },
    { type: TokenType.Name, content: '!--' },
  ]);
});

test('Tokenizer should store unfinished token', t => {
  const tokenizer = Object.assign(new Tokenizer(), { waitForLess: false });
  const tokens = [...tokenizer.tokenize('"asdf')];

  t.deepEqual(tokens, []);
  t.is(tokenizer.unfinishedToken.type, TokenType.StringLiteral);
  t.is(tokenizer.unfinishedToken.content, '"asdf');
});

function switchTokenType(
  t: ExecutionContext,
  input: string,

  switchIndex: number,
  doSwitch: (tokenizer: Tokenizer) => void,
  expected: RawToken[]
) {
  const tokenizer = Object.assign(new Tokenizer(), { waitForLess: false });

  let i = 0;
  for (const token of tokenizer.tokenize(input)) {
    tokenEquals(t, token, expected[i++]);
    if (i === switchIndex) {
      doSwitch(tokenizer);
    }
  }
}

test('Tokenizer should switch to token type if needed', t => {
  switchTokenType(t, 'x -->', 1, tokenizer => tokenizer.startComment(), [
    { type: TokenType.Name, content: 'x' },
    { type: TokenType.CommentContent, content: ' -->' },
  ]);

  switchTokenType(t, 'x ]]>', 1, tokenizer => tokenizer.startCDataSection(), [
    { type: TokenType.Name, content: 'x' },
    { type: TokenType.CDataContent, content: ' ]]>' },
  ]);
});
