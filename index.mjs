import { EventEmitter } from 'events';
import { createServer } from 'node:net';
import { Duplex } from 'node:stream';
import hexdump from 'hexdump-nodejs';

const COMMANDS =
{
	SE:		0xF0, // end of subnegotiation parameters
	NOP:	0xF1, // no operation
	DM:		0xF2, // data mark
	BRK:	0xF3, // break
	IP:		0xF4, // suspend (a.k.a. "interrupt process")
	AO:		0xF5, // abort output
	AYT:	0xF6, // are you there?
	EC:		0xF7, // erase character
	EL:		0xF8, // erase line
	GA:		0xF9, // go ahead
	SB:		0xFA, // subnegotiation
	WILL:	0xFB, // will
	WONT:	0xFC, // wont
	DO:		0xFD, // do
	DONT:	0xFE, // dont
	IAC:	0xFF  // interpret as command
};

const COMMAND_NAMES = Object.keys(COMMANDS).reduce((out, key) =>
{
	const value = COMMANDS[key];
	out[value] = key.toLowerCase();
	return out;
}, {});

const OPTIONS =
{
	TRANSMIT_BINARY:		0x00,	// http://tools.ietf.org/html/rfc856
	ECHO:					0x01,	// http://tools.ietf.org/html/rfc857
	RECONNECT:				0x02,	// http://tools.ietf.org/html/rfc671
	SUPPRESS_GO_AHEAD:		0x03,	// http://tools.ietf.org/html/rfc858
	AMSN:					0x04,	// Approx Message Size Negotiation
									// https://google.com/search?q=telnet+option+AMSN
	STATUS:					0x05,	// http://tools.ietf.org/html/rfc859
	TIMING_MARK:			0x06,	// http://tools.ietf.org/html/rfc860
	RCTE:					0x07,	// http://tools.ietf.org/html/rfc563
									// http://tools.ietf.org/html/rfc726
	NAOL:					0x08,	// (Negotiate) Output Line Width
									// https://google.com/search?q=telnet+option+NAOL
									// http://tools.ietf.org/html/rfc1073
	NAOP:					0x09,	// (Negotiate) Output Page Size
									// https://google.com/search?q=telnet+option+NAOP
									// http://tools.ietf.org/html/rfc1073
	NAOCRD:					0x0A,	// http://tools.ietf.org/html/rfc652
	NAOHTS:					0x0B,	// http://tools.ietf.org/html/rfc653
	NAOHTD:					0x0C,	// http://tools.ietf.org/html/rfc654
	NAOFFD:					0x0D,	// http://tools.ietf.org/html/rfc655
	NAOVTS:					0x0E,	// http://tools.ietf.org/html/rfc656
	NAOVTD:					0x0F,	// http://tools.ietf.org/html/rfc657
	NAOLFD:					0x10,	// http://tools.ietf.org/html/rfc658
	EXTEND_ASCII:			0x11,	// http://tools.ietf.org/html/rfc698
	LOGOUT:					0x12,	// http://tools.ietf.org/html/rfc727
	BM:						0x13,	// http://tools.ietf.org/html/rfc735
	DET:					0x14,	// http://tools.ietf.org/html/rfc732
									// http://tools.ietf.org/html/rfc1043
	SUPDUP:					0x15,	// http://tools.ietf.org/html/rfc734
									// http://tools.ietf.org/html/rfc736
	SUPDUP_OUTPUT:			0x16,	// http://tools.ietf.org/html/rfc749
	SEND_LOCATION:			0x17,	// http://tools.ietf.org/html/rfc779
	TERMINAL_TYPE:			0x18,	// http://tools.ietf.org/html/rfc1091
	END_OF_RECORD:			0x19,	// http://tools.ietf.org/html/rfc885
	TUID:					0x1A,	// http://tools.ietf.org/html/rfc927
	OUTMRK:					0x1B,	// http://tools.ietf.org/html/rfc933
	TTYLOC:					0x1C,	// http://tools.ietf.org/html/rfc946
	REGIME_3270:			0x1D,	// http://tools.ietf.org/html/rfc1041
	X3_PAD:					0x1E,	// http://tools.ietf.org/html/rfc1053
	NAWS:					0x1F,	// http://tools.ietf.org/html/rfc1073
	TERMINAL_SPEED:			0x20,	// http://tools.ietf.org/html/rfc1079
	TOGGLE_FLOW_CONTROL:	0x21,	// http://tools.ietf.org/html/rfc1372
	LINEMODE:				0x22,	// http://tools.ietf.org/html/rfc1184
	X_DISPLAY_LOCATION:		0x23,	// http://tools.ietf.org/html/rfc1096
	ENVIRON:				0x24,	// http://tools.ietf.org/html/rfc1408
	AUTHENTICATION:			0x25,	// http://tools.ietf.org/html/rfc2941
									// http://tools.ietf.org/html/rfc1416
									// http://tools.ietf.org/html/rfc2942
									// http://tools.ietf.org/html/rfc2943
									// http://tools.ietf.org/html/rfc2951
	ENCRYPT:				0x26,	// http://tools.ietf.org/html/rfc2946
	NEW_ENVIRON:			0x27,	// http://tools.ietf.org/html/rfc1572
	TN3270E:				0x28,	// http://tools.ietf.org/html/rfc2355
	XAUTH:					0x29,	// https://google.com/search?q=telnet+option+XAUTH
	CHARSET:				0x2A,	// http://tools.ietf.org/html/rfc2066
	RSP:					0x2B,	// http://tools.ietf.org/html/draft-barnes-telnet-rsp-opt-01
	COM_PORT_OPTION:		0x2C,	// http://tools.ietf.org/html/rfc2217
	SLE:					0x2D,	// http://tools.ietf.org/html/draft-rfced-exp-atmar-00
	START_TLS:				0x2E,	// http://tools.ietf.org/html/draft-altman-telnet-starttls-02
	KERMIT:					0x2F,	// http://tools.ietf.org/html/rfc2840
	SEND_URL:				0x30,	// http://tools.ietf.org/html/draft-croft-telnet-url-trans-00
	FORWARD_X:				0x31,	// http://tools.ietf.org/html/draft-altman-telnet-fwdx-01
	PRAGMA_LOGON:			0x8A,	// https://google.com/search?q=telnet+option+PRAGMA_LOGON
	SSPI_LOGON:				0x8B,	// https://google.com/search?q=telnet+option+SSPI_LOGON
	PRAGMA_HEARTBEAT:		0x8C,	// https://google.com/search?q=telnet+option+PRAMGA_HEARTBEAT
	EXOPL:					0xFF	// http://tools.ietf.org/html/rfc861
};

var OPTION_NAMES = Object.keys(OPTIONS).reduce((out, key) =>
{
	const value = OPTIONS[key];
	out[value] = key.toLowerCase();
	return out;
}, {});

const SUB =
{
	IS:				0,
	SEND:			1,
	INFO:			2,
	VARIABLE:		0,
	VALUE:			1,
	ESC:			2, // unused, for env
	USER_VARIABLE:	3
};

const DECODE_IDLE = 0;
const DECODE_COMMAND = 1;
const DECODE_OPTION = 2;
const DECODE_SUBNEGOTIATION = 3;
const DECODE_SUBNEGOTIATION_END = 4;
const DECODE_IGNORE_2 = 5;
const DECODE_IGNORE_1 = 6;

const log = (...args) =>
{
	// console.log(...args);
};

const loge = (...args) =>
{
	// console.error(...args);
};

const logh = (name, arg) =>
{
	// console.log(name);
	// console.log(hexdump(arg));
};

export class TelnetSession extends Duplex
{
	#socket;
	#send;
	#s2c = {};	// send commands from server to client
	#c2s = {};	// handler for commands sent from client

	#isRaw = true;
	#isTTY = true;
	#columns = 80;
	#rows = 24;

	constructor(socket)
	{
		super();

		this.#socket = socket;

		this.#send = (data, encoding, callback) =>
		{
			logh("TX", data);

			this.#socket.write(data, encoding, callback);
		};

		['DO', 'DONT', 'WILL', 'WONT'].forEach((commandName) =>
		{
			const cmdName = commandName.toLowerCase();
			this.#s2c[cmdName] = {};

			Object.keys(OPTIONS).forEach((optionName) =>
			{
				const optName = optionName.toLowerCase();
				this.#s2c[cmdName][optName] = () =>
				{
					const buf = Buffer.alloc(3);
					buf[0] = COMMANDS.IAC;
					buf[1] = COMMANDS[commandName];
					buf[2] = OPTIONS[optionName];

					this.#send(buf);
				};
			});
		});

		this.#c2s.naws = (data) =>
		{
			if (data.length < 4) return -1;
			this.#columns = data.readUInt16BE(0);
			this.#rows = data.readUInt16BE(2);

			this.emit('resize');
		};

		// tty enable
		this.setRawMode(true);

		this.#s2c.do.transmit_binary();
		this.#s2c.do.terminal_type();
		this.#s2c.do.naws();
		this.#s2c.do.new_environ();

		let decode = DECODE_IDLE;
		let command = 0;
		let option = 0;
		let param;
		let len = 0;

		this.#socket.on('data', (data) =>
		{
			logh("RX", data);

			const buffer = Buffer.alloc(data.length);
			let buflen = 0;

			for (const char of data)
			{
				switch (decode)
				{
					case DECODE_IDLE:
						if (char === COMMANDS.IAC)
						{
							// interpret as command
							command = 0;
							option = 0;
							decode = DECODE_COMMAND;
						}
						else
						{
							// interpret as payload
							buffer[buflen++] = char;
						}

						break;

					case DECODE_COMMAND:
						log(`COMMAND: ${COMMAND_NAMES[char]}`);

						if (COMMAND_NAMES[char])
						{
							// command is known
							command = char;
							decode = DECODE_OPTION;
						}
						else
						{
							// command is unknown, throw await the next 2 bytes
							decode = DECODE_IGNORE_2;
						}

						break;

					case DECODE_OPTION:
						log(`OPTION: ${OPTION_NAMES[char]}`);

						option = char;

						if (command === COMMANDS.SB)
						{
							// start of subnegotiation parameters
							param = Buffer.alloc(128);
							len = 0;
							decode = DECODE_SUBNEGOTIATION;
						}
						else
						{
							const handler = this.#c2s[OPTION_NAMES[option]];
							if (typeof handler === 'function')
							{
								handler(Buffer.from([command, option]));
							}

							decode = DECODE_IDLE;
						}

						break;

					case DECODE_SUBNEGOTIATION_END:
						if (char === COMMANDS.SE)
						{
							// end of subnegotiation parameters
							const handler = this.#c2s[OPTION_NAMES[option]];
							if (typeof handler === 'function')
							{
								handler(param.slice(0, len));
							}

							decode = DECODE_IDLE;
							break;
						}

						// subnegotiation end sequence incomplete, go further ...
						decode = DECODE_SUBNEGOTIATION;
						// [[fallthrough]]

					case DECODE_SUBNEGOTIATION:
						if (char === COMMANDS.IAC)
						{
							// interpret as subnegotiation end sequence
							decode = DECODE_SUBNEGOTIATION_END;
						}
						else
						{
							param[len] = char;
							len++;
						}

						break;

					case DECODE_IGNORE_2:
						// byte ignored, ignore next byte, too
						decode = DECODE_IGNORE_1;
						break;

					case DECODE_IGNORE_1:
						// byte ignored, goto normal operation
						decode = DECODE_IDLE;
						break;
				}
			}

			if (buflen)
			{
				this.emit('data', buffer.slice(0, buflen));
			}
		});

		this.#socket.on('close', () =>
		{
			this.emit('close');
		});

		this.#socket.on('error', (e) =>
		{
			this.emit('error', e);
		});
	}

	get socket()
	{
		return this.#socket;
	}

	/* node:tty interface */
	get isRaw()
	{
		return this.#isRaw;
	}

	get isTTY()
	{
		return this.#isTTY;
	}

	get columns()
	{
		return this.#columns;
	}

	get rows()
	{
		return this.#rows;
	}

	setRawMode(mode)
	{
		this.#isRaw = mode;
		if (mode)
		{
			this.#s2c.do.suppress_go_ahead();
			this.#s2c.will.suppress_go_ahead();
			this.#s2c.will.echo();
		}
		else
		{
			this.#s2c.dont.suppress_go_ahead();
			this.#s2c.wont.suppress_go_ahead();
			this.#s2c.wont.echo();
		}
	}

	getWindowSize()
	{
		return [this.#columns, this.#rows];
	}

	// TODO
	// hasColors(count, env)
	// {
	// }

	/* protected 'Duplex' member overloads */
	_construct(callback)
	{
		log("_construct", callback);
		callback();
	}

	_write(chunk, encoding, callback)
	{
		log("_write", chunk, encoding, callback);

		if (chunk instanceof String)
		{
			// telnet specifies \r\n as line ending!
			chunk = chunk.replace(/\r?\n/g, '\r\n');
		}

		this.#send(chunk, encoding, callback);
	}

	_final(callback)
	{
		log("_final", callback);
		this.#socket._final(callback);
	}

	_read(n)
	{
		log("_read", n);
		this.#socket._read(n);
	}

	_destroy(err, callback)
	{
		log("_destroy", err, callback);
		this.#socket._destroy(err, callback);
	}
}

export class TelnetServer extends EventEmitter
{
	#server;
	#sessions = {};

	constructor()
	{
		super();

		this.#server = createServer();

		this.#server.on('listening', () =>
		{
			this.emit('listening');
		});

		this.#server.on('error', (e) =>
		{
			this.emit('error', e);
		});

		this.#server.on('close', () =>
		{
			this.emit('close');
		});

		this.#server.on('drop', () =>
		{
			this.emit('drop');
		});

		this.#server.on('connection', (socket) =>
		{
			const fd = socket._handle.fd;

			log("client connected", fd);

			const session = new TelnetSession(socket);
			this.#sessions[fd] = session;

			socket.on('close', () =>
			{
				log("client disconnected", fd);
				delete this.#sessions[fd];
			});

			socket.on('error', (e) =>
			{
				log("socket error", fd);
				loge(e);

				socket.close();
			});

			this.emit('connection', session);
		});
	}

	listen(port)
	{
		this.#server.listen(port);
	}

	close()
	{
		this.#server.close();
	}
}