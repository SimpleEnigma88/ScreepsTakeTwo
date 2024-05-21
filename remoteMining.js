const MAX_REMOTES = 3;
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
    // Remove sources that are more than 1 room away
    for (let i = 0; i < sources.length; i++) {
        if (Game.map.findRoute(this.room.name, sources[i].pos.roomName).length >= 4) {
            sources.splice(i, 1);
            i--;
        }
    }
    // Remove sources that are in the same room as the controller
    for (let i = 0; i < sources.length; i++) {
        if (sources[i].pos.roomName == this.room.name) {
            sources.splice(i, 1);
            i--;
        }
    }
    // Sort sources by path length from home room controller
    sources.sort((a, b) => Game.map.findRoute(this.room.name, a.pos.roomName).length - Game.map.findRoute(this.room.name, b.pos.roomName).length);
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
        if (claimers[i].ticksToLive < 100) {
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
        if (dropMinersForSource.length < 2 && this.room.energyAvailable >= 300) {
            let body = [MOVE, WORK, WORK];
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
        else if (haulersForSource.length < 5 && this.room.energyAvailable >= 300) {
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
        if (claimersForSource.length < 2 && this.room.energyAvailable > 750) {
            let newName = 'Claimer - ' + Game.time;
            this.room.find(FIND_MY_SPAWNS)[0].spawnCreep([MOVE, CLAIM], newName,
                { memory: { role: 'claimer', source: source.pos, home: this.room.name } });
        }
    }
};
module.exports = StructureController.prototype.remoteMining;