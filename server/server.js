//
// MKJS Dedicated server main file.
//

// Default config:
var defaultCfg = {
	port:8080,
	instances:1,

	defaultInstance: {
		mapRotation: [
			"mkdsDefault" //auto includes all default maps. if you want to specify specific maps you will need to remove this and add "mkds/tracknum" for each default track you want to include.
			//custom tracks are read from the "maps/" folder.
		],
		mapMode: "random",

		itemConfig: [
			//specifies item number and default params
			//eg triple green will have settings to choose how many shells you start with.
			{item:0, cfg:{}},
			{item:1, cfg:{}},
			{item:2, cfg:{}},
		],
		itemChance: [
			//specifies brackets where certain items have a specific chance of appearing.
			//should be in order of near first place first.
			{
				placement: 0.25, //if 8 players, players 1 and 2 will get this chance distribution.
				choices: [
					//the random selector generates a number between 0 and 1. if it is less than an item's "chance", that item will be selected. If not we try the next one.
					//real % chance per item is (item.chance - last.chance)*100
					{item:0, chance:0.5}, 
					{item:1, chance:0.75},
					{item:2, chance:1}
				]
			},

			{
				placement: 1,
				choices: [
					{item:2, chance:1}
				]
			},
		]
	}
}
// --

process.title = "MKJS Dedicated Server";

console.log("Initializing server...");
try {
	var ws		= require('ws'),
  	http		= require('http'),
  	fs			= require('fs'),
  	inst 		= require('./modules/mkjsInstance.js');
} catch (err) {
	console.error("FATAL ERROR - could not load modules. Ensure you have ws for websockets.");
	process.exit(1);
}
console.log("Modules Ready!");

try {
	var config = JSON.parse(fs.readFileSync('config.json', 'ascii'));
} catch (err) {
	if (err.errno == 34) {
		console.error("No config file. Writing default config.");
		fs.writeFileSync('config.json', JSON.stringify(defaultCfg, null, "\t"), 'ascii')
		var config = JSON.parse(fs.readFileSync('config.json', 'ascii'));
	} else {
		console.error("FATAL ERROR - could not load config. Check that the syntax is correct.");
		process.exit(1);
	}
}

var wss = new ws.Server({port: config.port});

var instances = [];

for (var i=0; i<config.instances; i++) {
	instances.push(new inst.mkjsInstance(config, config.defaultInstance, wss));
}

wss.on('connection', function(cli) {
	//client needs to connect to an instance before anything.

	cli.on('message', function(data, flags) {
		if (cli.inst == null) {
			if (flags.binary) cli.close(); //first packet must identify location.
			else {
				try {
					var obj = JSON.parse(data);
					if (obj.t == "*") {
						cli.credentials = obj.c;
						var inst = instances[obj.i];
						if (inst == null) cli.close(); //that instance does not exist
						else {
							cli.inst = inst;
							inst.addClient(cli);
						}
					}
				} catch (err) {
					cli.close(); //just leave
				}
			}
		} else {
			cli.inst.handleMessage(cli, data, flags);
		}
	});

	cli.on('close', function() {
		if (cli.inst != null) {
			cli.inst.removeClient(cli);
		}
	})
})