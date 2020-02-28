import test from 'ava';
import TokenIterator from '../src/TokenIterator';
import Tokenizer, { TokenType } from '../src/Tokenizer';

const compareTypes = <T>(t, result: { type: T }[], types: T[]) =>
  t.deepEqual(
    result.map(({ type }) => type),
    types
  );

test('TokenIterator should yield tokens', t => {
  const tokenizer = new Tokenizer();
  const iterator = new TokenIterator(tokenizer.tokenize('<'));

  compareTypes(t, [...iterator], [TokenType.Less]);
});

test('TokenIterator#eat should return tokens iterated so far', t => {
  const tokenizer = new Tokenizer();
  (tokenizer as any).waitForLess = false;
  const iterator = new TokenIterator(tokenizer.tokenize('//</'));

  for (const token of iterator) {
    if (token.type === TokenType.Less) {
      compareTypes(t, iterator.eat(true).tokens, [TokenType.Slash, TokenType.Slash]);
      compareTypes(t, iterator.eat().tokens, [TokenType.Less]);
    }
  }

  compareTypes(t, iterator.eat().tokens, [TokenType.Slash]);
});
