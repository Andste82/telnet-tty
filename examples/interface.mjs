import { createInterface } from 'node:readline';
import { TelnetServer } from '../index.mjs';

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