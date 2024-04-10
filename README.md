# Telnet-TTY

A TTY-compatible Telnet interface for node.js

Telnet-TTY consists of the following functions:
* a simple telnet server
* a TTY interface for each telenet session

Each connection to the telnet server is mapped by an instance of the `TelnetSession` class. This class implements the node.js `Duplex` interface of the `node:stream` module. In addition, some necessary TTY functions have been added to comply with the `node:tty` interface.

**Note:** this module is still at a very early stage!

## Examples

### Readline interface

This example demonstrates how a telnet-tty session can be connected to the `node:readline` interface of node.js.

```js
import { createInterface } from 'node:readline';
import { TelnetServer } from 'telnet-tty';

const server = new TelnetServer();

server.on('connection', (session) =>
{
  const rl = createInterface(
  {
    input: session,
    output: session,
    prompt: 'PROMPT> ',
  });

  rl.prompt();

  rl.on('line', (line) =>
  {
    switch (line.trim())
    {
      case 'hello':
        session.write('world!\n');
        break;

      default:
        session.write(`Say what? I might have heard '${line.trim()}'\n`);
        break;
    }
    rl.prompt();
  });

  rl.on('error', console.log);

  session.on('resize', () =>
  {
    console.log(session.getWindowSize());
  });
});

server.listen(23);
```
