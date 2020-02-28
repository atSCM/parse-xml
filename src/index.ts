import { Readable } from 'stream';
import Parser from './Parser';

export { default as Parser, Node, NodeType } from './Parser';

export const parse = (string: string) => new Parser().parseString(string);
export const parseStream = (stream: Readable) => new Parser().parseStream(stream);
