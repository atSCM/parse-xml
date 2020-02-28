/// <reference types="node" />
import { Readable } from 'stream';
import { Token, LocationInfo } from './Tokenizer';
export declare enum NodeType {
    ProcessingInstruction = "processing-instruction",
    OpenTag = "open-tag",
    CloseTag = "close-tag",
    Text = "text",
    CData = "cdata",
    Comment = "comment"
}
declare type BaseNode<T extends NodeType> = {
    type: T;
    tokens: Token[];
    location: LocationInfo;
};
declare type AttributeNode = AttributeDefinition & {
    leadingWhitespace: string;
};
export declare type ProcessingInstruction = BaseNode<NodeType.ProcessingInstruction> & {
    name: string;
    attributes: AttributeNode[];
    trailingWhitespace?: string;
};
export declare type OpenTag = BaseNode<NodeType.OpenTag> & {
    name: string;
    selfClosing: boolean;
    attributes: AttributeNode[];
    trailingWhitespace?: string;
};
export declare type CloseTag = BaseNode<NodeType.CloseTag> & {
    name: string;
};
export declare type Text = BaseNode<NodeType.Text> & {
    content: string;
};
export declare type CData = BaseNode<NodeType.CData> & {
    content: string;
};
export declare type Comment = BaseNode<NodeType.Comment> & {
    content: string;
};
export declare type Node = ProcessingInstruction | OpenTag | CloseTag | Text | CData | Comment;
declare type AttributeDefinition = {
    name: string;
    value: string;
    tokens: Token[];
};
export default class Parser {
    private tokenizer;
    private nextValue;
    private nextNonWhitespace;
    private assertTokenType;
    private walkAttributeDefinition;
    private walkLess;
    private walkText;
    private walkTokens;
    private parse;
    private finalize;
    parseString(input: string): Generator<Node, void, unknown>;
    parseStream(input: Readable): AsyncGenerator<Node, void, unknown>;
}
export {};
