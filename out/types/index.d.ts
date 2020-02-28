/// <reference types="node" />
import { Readable } from 'stream';
export { default as Parser, Node, NodeType } from './Parser';
export declare const parse: (string: string) => Generator<import("./Parser").Node, void, unknown>;
export declare const parseStream: (stream: Readable) => AsyncGenerator<import("./Parser").Node, void, unknown>;
