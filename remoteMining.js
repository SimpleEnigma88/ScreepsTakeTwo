const MAX_REMOTES = 4; // Number of remote sources to mine
const MAX_CLAIMERS = 1;
const MAX_DROPMINERS = 1;
const MAX_HAULERS = 5;

StructureController.prototype.remoteMining = function () {
    if (Memory.rooms == undefined) {
        return;
    }
    let sources = [];
    for (let room in Memory.rooms) {
        let controller = {};
        if (Memory.rooms[room].sources != undefined) {
            // Concat all sources into one array
            sources = sources.concat(Object.values(Memory.rooms[room].sources));
        }
    }
    // Remove sources that are in the same room as the controller
    for (let i = 0; i < sources.length; i++) {
        if (sources[i].pos.roomName == this.room.name) {
            sources.splice(i, 1);
            i--;
        }
    }
    // Cut the total number of sources to MAX_REMOTES
    sources = sources.slice(0, MAX_REMOTES);

    // Output each source of sources, show id and room it's located in.
    for (let i = 0; i < sources.length; i++) {
    }
    // Sort sources by path length between home room controller and the remote source
    // Find all creeps with the role 'remoteDropMiner'
    let dropMiners = _.filter(Game.creeps, (creep) => creep.memory.role == 'remoteDropMiner');
    let haulers = _.filter(Game.creeps, (creep) => creep.memory.role == 'remoteHauler');
    let claimers = _.filter(Game.creeps, (creep) => creep.memory.role == 'claimer');
    // Remove claimers that have less than 100 ticks to live
    for (let i = 0; i < claimers.length; i++) {
        if (claimers[i].ticksToLive < 150) {
            claimers.splice(i, 1);
            i--;
        }
    }
    let source = {};

    // For each unique source, spawn a dropMiner and a hauler
    let dropMinersForSource = [];
    let haulersForSource = [];
    let claimersForSource = [];
    for (let i = 0; i < sources.length; i++) {
        source = sources[i];

        // Find the number of sources for the room this one is in.
        let sourcesInRoom = _.filter(sources, (source) => source.pos.roomName == source.pos.roomName);


        // Find the number of dropMiners and haulers for this source
        dropMinersForSource = _.filter(dropMiners, (creep) => creep.memory.source.x == source.pos.x && creep.memory.source.y == source.pos.y && creep.memory.role == 'remoteDropMiner');
        haulersForSource = _.filter(haulers, (creep) => creep.memory.source.roomName == source.pos.roomName && creep.memory.role == 'remoteHauler');
        claimersForSource = _.filter(claimers, (creep) => creep.memory.source.roomName == source.pos.roomName && creep.memory.role == 'claimer');
        // Find the number of non-wall tiles around the source

        // Use creep memory of source info to check room for number of sources
        let roomSources = Memory.rooms[source.pos.roomName].sources;
        let roomSourcesArray = Object.values(roomSources);
        let roomSourcesInRoom = _.filter(roomSourcesArray, (source) => source.pos.roomName == source.pos.roomName);
        let sourceCount = roomSourcesInRoom.length;
        // For each source, spawn a dropMiner and a hauler
        let body = [MOVE, WORK, WORK];
        let readyToSpawn = this.room.energyAvailable >= this.room.energyCapacityAvailable * 0.5;
        if (readyToSpawn) {
            if (Game.time % 3 != 0) {
                readyToSpawn = false;
            }
        }
        if (!readyToSpawn) {
            continue;
        }
        if (dropMinersForSource.length < MAX_DROPMINERS && this.room.energyAvailable >= 300) {
            if (this && this.my) {
                let cost = 250;
                while (cost + 250 < this.room.energyAvailable) {
                    body.push(MOVE);
                    body.push(WORK);
                    body.push(WORK);
                    cost += 250;
                }
            }
            let newName = 'RemoteDropMiner - ' + Game.time;
            this.room.find(FIND_MY_SPAWNS)[0].spawnCreep(body, newName,
                { memory: { role: 'remoteDropMiner', source: source.pos, home: this.room.name } });
            break;
        }
        else if (haulersForSource.length < MAX_HAULERS && this.room.energyAvailable >= 300) {
            let body = [MOVE, CARRY, MOVE, CARRY];
            if (this && this.my) {
                let cost = 100;
                while (cost + 100 < this.room.energyAvailable) {
                    body.push(MOVE);
                    body.push(CARRY);
                    cost += 100;
                }
            }
            let newName = 'RemoteHauler - ' + Game.time;
            this.room.find(FIND_MY_SPAWNS)[0].spawnCreep(body, newName,
                { memory: { role: 'remoteHauler', source: source.pos, home: this.room.name } });
            break;
        }
        console.log("Claimers: " + claimersForSource.length + " MAX_CLAIMERS: " + MAX_CLAIMERS + " Energy: " + this.room.energyAvailable + " Source: " + source.pos.roomName + " Energy Available: " + this.room.energyAvailable + " Source Count: " + sourceCount + " Room Sources: " + roomSourcesInRoom.length + " Room Sources Array: " + roomSourcesArray.length + " Room Sources: " + roomSources);
        if (source.pos.findClosestByRange(FIND_MY_SPAWNS).length && claimersForSource.length < MAX_CLAIMERS && this.room.energyAvailable >= 650) {
            let controller = {};
            // if controller is reserved and above 4000 ticks, return
            console.log("Source: " + source);
            if (source) {
                console.log("Source is defined: " + source.pos.roomName);
                if (!source.pos.roomName in Game.rooms) {
                    console.log("No vision in room: " + source.pos.roomName);
                    continue;
                }
                if (source.room && source.room.controller) {
                    console.log("Controller is defined: " + source.room.controller);
                    controller = source.room.controller;
                    if (controller && controller.ticksToDowngrade > 4000) {
                        console.log("Controller is reserved and above 4000 ticks: " + controller.ticksToDowngrade);
                        continue;
                    }
                }
            }
            else {
                console.log("Source is not defined: " + source);
                continue;
            }
            console.log("Energy Capacity: " + Game.rooms[source.pos.roomName].energyCapacityAvailable);
            let body = Game.rooms[source.pos.roomName].energyCapacityAvailable < 1300 ? [MOVE, CLAIM] : [MOVE, CLAIM, MOVE, CLAIM];
            let newName = 'Claimer - ' + Game.time;
            console.log("Spawning claimer for room: " + source.pos.roomName);
            console.log("Spawn Creep? ", this.room.find(FIND_MY_SPAWNS)[0].spawnCreep(body, newName,
                { memory: { role: 'claimer', source: source.pos, home: this.room.name, target: source.pos.roomName } }));
            break;
        }
    }
};
module.exports = StructureController.prototype.remoteMining;
