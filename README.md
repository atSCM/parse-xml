# @atscm/parse-xml

> An XML parser that keeps track of the original document formatting.

[![CircleCI](https://circleci.com/gh/atSCM/parse-xml/tree/master.svg?style=svg)](https://circleci.com/gh/atSCM/parse-xml/tree/master)

## Installation

To install this package via npm, run `npm i @atscm/parse-xml`.

## Usage

**Parse an XML string**

```javascript
import { parse } from '@atscm/parse-xml';

const sample = `<?xml version='1.0' encoding='UTF-8' ?>
<doc>
  ...
</doc>`;

for (const node of parse(sample)) {
  console.log(node);
}
```

**Parse a file stream**

```javascript
import { createReadStream } from 'fs';
import { parseStream } from '@atscm/parse-xml';

async function run() {
  const stream = createReadStream('./sample.xml');

  for await (const node of parseStream(stream)) {
    console.log(node);
  }
}

run().catch(console.error);
```

**Usage with TypeScript**

This package is written in TypeScript and ships with complete type definitions, so no additional steps should be required for you to use it in your TypeScript project.
