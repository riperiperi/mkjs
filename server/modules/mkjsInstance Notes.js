// instances are basically individual game servers; it is possible to run more than one on the same server.
// the connection to the instance should be the first thing the client sends to the websocket server. the client is then bound to this instance for the duration of the connecton.
//
// normally a race packet exchange goes like this:
//
// C -> S: join instance. submit (kartInitFormat) (as obj.c) minus flags.
// S -> C: send back instance state, type "*". includes mode m (0 = choose course, 1 = race), data d.
//
//		data d for race is in format {c:(courseName), k:(kartInitFormat[]), r:(tickRate in 1/60 tick duration increments), i:(itemConfig), p:(your kart, or -1 if in spectator mode)}

//		kartInitFormat: {
//				name: (username),
//				char: (characterID), //physical character id.
//				kart: (kartID), //physical kart id.
//				kModel: (kartModelID, undefined normally. if non zero use model sent by server)
//				cModel: (charModelID, same as above)
//				customKParam: (same format as kartoffsetdata entry. note that custom characters always use the same offset. may be undefined.)
//				flags: (info on player, eg if player is an admin, mod, on mobile etc.)
//				active: boolean //karts are never deleted - they are just set as inactive after disconnect. the karts list is only completely refreshed on course change or restart.
//		}
//
// repeatedly:
// C -> S: send kart data every tick. positions and checkpoint numbers
// S -> C: send array of updated kart data to back to client
// 
// item request:
// C -> S: request item packet (hit itembox), type "ri"
// S -> C: return which item to select. type "si", sent to all clients so they know what you have.
// C -> S: when the user is ready to use their item, they will create the item and send a message to the server to create it on all sides. this is of type "ci", and includes the tick the item was fired on.
// S -> C (all others): type "ci" is mirrored to all other clients, server verifies that client has right to send that item first
// 		---the item is now on all clients at the correct place---
// C -> S: when a client gets hit with an item, they send a packet of type "~i" with reason "h" for hit. "~i" is "change item". items that destroy themselves do not need to send this -
//				they will annihilate automatically on all clients at the same tick if karts do not interfere.
//
// S -> C: when a spectator connects to a game in progress, they will be sent all item packets in order in an array with type "pi" (packed items).
//
// win:
// C -> S: completed all laps and finished course. type "w", includes finish tick.
// S -> C (all other): "w" mirrored to clients.
// C (all other) -> S: "wa" (win acknowledge) - ping back to server to confirm win. we wait until all clients agree or the timeout on the clients occurs (usually 2s)
//				this is to settle win conflicts.