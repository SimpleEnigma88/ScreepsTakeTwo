const remoteMining = require('remoteMining');
const LinkLogic = require('./LinkLogic');
const MAX_HAULERS = 5;
const MAX_REMOTE_MINERS = 5;
function exploreAdjacentRooms(creep) {
    // If creep is not home, take it there and return.
    if (creep.room.name != creep.memory.home) {
        creep.moveTo(new RoomPosition(25, 25, creep.memory.home));
        return;
    }

    // Add current room information to Memory.rooms, sources and controller info.
    if (Memory.rooms == undefined) {
        Memory.rooms = {};
    }
    if (Memory.rooms[creep.room.name] == undefined) {
        Memory.rooms[creep.room.name] = {};
    }
    if (Memory.rooms[creep.room.name].sources == undefined) {
        Memory.rooms[creep.room.name].sources = {};
    }
    if (Memory.rooms[creep.room.name].controller == undefined) {
        Memory.rooms[creep.room.name].controller = {};
    }
    // Add sources to memory
    let sources = creep.room.find(FIND_SOURCES);
    for (let i = 0; i < sources.length; i++) {
        let source = sources[i];
        if (Memory.rooms[creep.room.name].sources[source.id] == undefined) {
            Memory.rooms[creep.room.name].sources[source.id] = {};
            Memory.rooms[creep.room.name].sources[source.id].id = source.id;
        }
        Memory.rooms[creep.room.name].sources[source.id].pos = source.pos;
    }
    // Add controller pos, owner, and progress to memory, if it exists
    let controller = creep.room.controller;
    if (controller) {
        Memory.rooms[creep.room.name].controller.pos = controller.pos;
        Memory.rooms[creep.room.name].controller.owner = controller.owner;
        Memory.rooms[creep.room.name].controller.progress = controller.progress;
    }


    // If Memory.rooms is undefined, create it
    if (Memory.rooms == undefined) {
        Memory.rooms = {};
    }
    // Find all exits to home room that have valid paths
    let exits = Game.map.describeExits(creep.memory.home);
    console;
    let validExits = [];
    for (let exit in exits) {
        let path = Game.map.findRoute(creep.room.name, exit);
        if (path.length > 0) {
            validExits.push(exit);
        }
    }

    // If room info is in memory, remove room from validExits   
    if (Memory.rooms[creep.room.name] != undefined) {
        let roomInfo = Memory.rooms[creep.room.name];
        if (roomInfo.sources != undefined && roomInfo.controller != undefined) {
            validExits.splice(validExits.indexOf(creep.room.name), 1);
        }
    }

    // If there are no valid exits, change creep.memory.home to a random adjacent room.
    if (validExits.length == 0) {
        if (exits) {
            let keys = Object.keys(exits);
            creep.memory.home = exits[keys[Math.floor(Math.random() * keys.length)]];
            return;
        } else {
        }
    }

    // Sort validExits by path length
    validExits.sort((a, b) => Game.map.findRoute(creep.room.name, a).length - Game.map.findRoute(creep.room.name, b).length);
    // Move to the first valid exit
    if (validExits.length > 0) {
        creep.moveTo(new RoomPosition(25, 25, validExits[0]));
    }
}

Creep.prototype.remoteDropMiner = function () {
    // If the creep is not in the source room, move to the source room
    if (this.room.name != this.memory.source.roomName) {
        this.moveTo(new RoomPosition(25, 25, this.memory.source.roomName));
        return;
    }
    // If the creep is not at the source, move to the source
    else if (this.harvest(this.room.lookForAt(LOOK_SOURCES, this.memory.source.x, this.memory.source.y)[0]) == ERR_NOT_IN_RANGE) {
        this.moveTo(this.room.lookForAt(LOOK_SOURCES, this.memory.source.x, this.memory.source.y)[0]);

    }
    // If the creep is at the source, mine the source
    else {
        let source = this.room.lookForAt(LOOK_SOURCES, this.memory.source.x, this.memory.source.y)[0];
        this.harvest(source);
    }
};

function scoreDroppedResources(creep) {
    let droppedResources = creep.room.find(FIND_DROPPED_RESOURCES);
    droppedResources.sort((a, b) => {
        const distanceA = creep.pos.getRangeTo(a);
        const distanceB = creep.pos.getRangeTo(b);
        const amountA = a.amount;
        const amountB = b.amount;

        // Calculate a weighted score for each resource
        const scoreA = amountA / distanceA;
        const scoreB = amountB / distanceB;

        // Sort in descending order of score
        return scoreB - scoreA;
    });
    return droppedResources;
}

Creep.prototype.remoteHauler = function () {
    let adjacentCreeps = this.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (creep) => {
            // Check if the creep is a miner or hauler and has capacity for more energy
            return ((creep.memory.role == 'miner' || creep.memory.role == 'hauler') && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 24);
        }
    });

    // If there are any, transfer energy to the first one
    if (adjacentCreeps.length > 0) {
        if (this.transfer(adjacentCreeps[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            this.moveTo(adjacentCreeps[0]);
        }
        return; // Exit the function early so the creep doesn't do anything else this tick
    }
    if (this.memory.state == undefined) {
        this.memory.state = 'loading';
    }

    if (this.memory.state == 'loading') {
        if (this.store[RESOURCE_ENERGY] == this.store.getCapacity()) {
            this.memory.state = 'hauling';
        }
    }
    if (this.memory.state == 'hauling') {
        if (this.store[RESOURCE_ENERGY] == 0) {
            this.memory.state = 'loading';
        }
    }

    let droppedResources = scoreDroppedResources(this);

    let containers = this.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType == STRUCTURE_CONTAINER && structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
        }
    });
    containers.sort((a, b) => a.store.getUsedCapacity(RESOURCE_ENERGY) - b.store.getUsedCapacity(RESOURCE_ENERGY));

    // Find all sources for depositing energy in the room
    let spawns = this.room.find(FIND_MY_SPAWNS, {
        filter: (structure) => {
            return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
    });
    let spawnContainers = [];
    for (let i = 0; i < spawns.length; i++) {
        let spawn = spawns[i];
        spawnContainers = spawnContainers.concat(spawn.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: (structure) => {
                return structure.structureType == STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        }));
    }
    let extensions = this.room.find(FIND_MY_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType == STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
    });

    let controllerContainers = this.room.controller ? this.room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
        filter: (structure) => {
            return structure.structureType == STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 1200;
        }
    }) : [];

    if (this.memory.state == 'loading') {
        if (this.room.name != this.memory.source.roomName) {
            this.moveTo(new RoomPosition(25, 25, this.memory.source.roomName));
            return;
        }
        if (droppedResources.length > 0) {
            if (this.pickup(droppedResources[0]) == ERR_NOT_IN_RANGE) {
                this.moveTo(droppedResources[0]);
            }
        }
        else if (containers.length > 0) {
            if (this.withdraw(containers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                this.moveTo(containers[0]);
            }
        }
    }

    if (this.memory.state == 'hauling') {
        if (this.room.name != this.memory.home) {
            this.moveTo(new RoomPosition(25, 25, this.memory.home));
            return;
        }
        // if (spawns.length > 0) {
        //     if (this.transfer(spawns[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        //         this.moveTo(spawns[0]);
        //     }
        // }
        // else if (extensions.length > 0) {
        //     if (this.transfer(extensions[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        //         this.moveTo(extensions[0]);
        //     }
        // }
        let spawn = this.room.find(FIND_MY_SPAWNS)[0];
        if (controllerContainers.length > 0 /* && this.pos.getRangeTo(controllerContainers[0]) < this.pos.getRangeTo(spawn) */) {
            if (this.transfer(controllerContainers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                this.moveTo(controllerContainers[0]);
            }
        }
        else if (spawnContainers.length > 0) {
            if (this.transfer(spawnContainers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                this.moveTo(spawnContainers[0]);
            }
        }
        else {
            // Move to a spawn and drop the energy
            if (this.pos.getRangeTo(spawn) > 1) {
                this.moveTo(spawn);
            }
            else {
                this.drop(RESOURCE_ENERGY);
            }
        }


    }

};

StructureController.prototype.placeRoads = function () {
    let sources = this.room.find(FIND_SOURCES);
    let controller = this;
    for (let i = 0; i < sources.length; i++) {
        let path = this.room.findPath(sources[i].pos, controller.pos, {
            ignoreCreeps: true
        });
        for (let j = 0; j < path.length; j++) {
            let position = new RoomPosition(path[j].x, path[j].y, this.room.name);
            let structures = position.lookFor(LOOK_STRUCTURES);
            let isWalkable = structures.every(structure => structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER);
            if (isWalkable) {
                this.room.createConstructionSite(path[j].x, path[j].y, STRUCTURE_ROAD);
            }
        }
    }
    // Place roads from spawn to controller and each source
    let spawns = this.room.find(FIND_MY_SPAWNS);
    for (let i = 0; i < spawns.length; i++) {
        let path = this.room.findPath(spawns[i].pos, controller.pos, {
            ignoreCreeps: true
        });
        for (let j = 0; j < path.length; j++) {
            let position = new RoomPosition(path[j].x, path[j].y, this.room.name);
            let structures = position.lookFor(LOOK_STRUCTURES);
            let isWalkable = structures.every(structure => structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER);
            if (isWalkable) {
                this.room.createConstructionSite(path[j].x, path[j].y, STRUCTURE_ROAD);
            }
        }
    }

};


function repairOnTheFly(creep) {
    // If structures need repair within range 3, repair it
    let structures = creep.pos.findInRange(FIND_STRUCTURES, 3, {
        filter: (structure) => {
            return structure.hits < structure.hitsMax;
        }
    });
    if (structures.length > 0) {
        creep.repair(structures[0]);
    }
}

Creep.prototype.doNotIdleOnRoads = function () {
    // If the creep remains on a square with a road for more than 2 ticks, move it to a random square
    let terrain = creep.pos.lookFor(LOOK_TERRAIN);
    if (terrain[0] == 'road') {
        if (creep.memory.roadTicks == undefined) {
            creep.memory.roadTicks = 0;
        }
        creep.memory.roadTicks++;
        if (creep.memory.roadTicks > 2) {
            let x = Math.floor(Math.random() * 50);
            let y = Math.floor(Math.random() * 50);
            // Check if the random square is walkable and unoccupied
            let terrain = new RoomPosition(x, y, creep.room.name).lookFor(LOOK_TERRAIN);
            let structures = new RoomPosition(x, y, creep.room.name).lookFor(LOOK_STRUCTURES);
            if (terrain[0] != 'wall' && structures.length == 0) {
                creep.moveTo(new RoomPosition(x, y, creep.room.name));
                creep.memory.roadTicks = 0;
            }
        }
    }
};

function minerCreep(creep) {
    // If the creep is not home, take it there and return.
    if (creep.room.name != creep.memory.home) {
        creep.moveTo(new RoomPosition(25, 25, creep.memory.home));
        return;
    }
    const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
    const controller = creep.room.controller;
    const sources = creep.pos.findClosestByPath(FIND_SOURCES);
    let droppedResources = creep.room.find(FIND_DROPPED_RESOURCES);
    // sort the dropped resources by path distance
    droppedResources.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));
    // filter out amounts less than .5 of creep capacity
    droppedResources = droppedResources.filter(resource => resource.amount > creep.store.getFreeCapacity(RESOURCE_ENERGY) * .5);
    const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
    // Sort by percentage complete, those closest to completion first
    constructionSites.sort((a, b) => b.progress / b.progressTotal - a.progress / a.progressTotal);

    // A creep can have multiple states, mining, filling, building, upgrading, etc.
    // The state is stored in the creep's memory
    if (creep.memory.state == undefined) {
        creep.memory.state = 'filling';
    }

    // If the creep is mining
    if (creep.memory.state == 'mining') {
        repairOnTheFly(creep);
        // If the creep is full, change the state to 'filling'
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
            creep.memory.state = 'filling';
        } else {
            // If there are dropped resources, tombstones, or ruins, pick them up
            if (droppedResources.length > 0) {
                if (creep.pickup(droppedResources[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(droppedResources[0]);
                    return;
                }
            }
            if (creep.room.find(FIND_TOMBSTONES).length > 0) {
                let tombstone = creep.room.find(FIND_TOMBSTONES)[0];
                if (creep.withdraw(tombstone, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(tombstone);
                    return;
                }
            }
            // If a container with energy is within 1 square of a spawn or source, mine the container
            let sourceContainers = [];
            let sources = creep.room.find(FIND_SOURCES);
            for (let i = 0; i < sources.length; i++) {
                let source = sources[i];
                sourceContainers += source.pos.findInRange(FIND_STRUCTURES, 1, {
                    filter: (structure) => {
                        return structure.structureType == STRUCTURE_CONTAINER;
                    }
                });
            }
            let spawnContainers = [];
            let spawns = creep.room.find(FIND_MY_SPAWNS);
            for (let i = 0; i < spawns.length; i++) {
                let spawn = spawns[i];
                spawnContainers = spawnContainers.concat(spawn.pos.findInRange(FIND_STRUCTURES, 1, {
                    filter: (structure) => {
                        return structure.structureType == STRUCTURE_CONTAINER;
                    }
                }));
            }
            if (sourceContainers.length > 0) {
                if (creep.harvest(sourceContainers[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(sourceContainers[0]);
                    return;
                }
            }
            if (spawnContainers.length > 0) {
                if (creep.harvest(spawnContainers[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(spawnContainers[0]);
                    return;
                }
            }
            // Sort the sources by path distance
            sources.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));
            if (creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                creep.moveTo(sources[0]);
            }
        }
    }
    if (creep.memory.state == 'filling') {
        repairOnTheFly(creep);
        // Find all extensions that need energy in the room
        let extensions = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType == STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        // If the creep is empty, change the state to 'mining'
        if (creep.store.getUsedCapacity() == 0) {
            creep.memory.state = 'mining';
        }
        else {
            if (creep.transfer(spawn, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(spawn);
            }
            else if (extensions.length > 0) {
                if (creep.transfer(extensions[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(extensions[0]);
                }
            }
            // If the spawns are all full, change the state to 'building'
            if (spawn && spawn.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
                creep.memory.state = 'building';
            }
        }
    }
    if (creep.memory.state == 'building') {
        repairOnTheFly(creep);
        let containers = creep.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: (structure) => {
                return structure.structureType == STRUCTURE_CONTAINER;
            }
        });
        // If there are containers, withdraw energy from them
        if (containers.length > 0) {
            creep.withdraw(containers[0], RESOURCE_ENERGY);
        }
        // If the creep is empty, change the state to 'mining'
        if (creep.store.getUsedCapacity() == 0) {
            creep.memory.state = 'mining';
        }
        else if (constructionSites.length > 0) {
            // If the creep is not empty, build the construction site
            if (creep.build(constructionSites[0]) == ERR_NOT_IN_RANGE) {
                creep.moveTo(constructionSites[0]);
            }
        }
        else {
            // If the creep is not empty, change the state to 'upgrading'
            creep.memory.state = 'upgrading';
        }
    }
    if (creep.memory.state == 'upgrading') {
        repairOnTheFly(creep);
        // Find any containers within range 1 of this creep
        let containers = creep.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: (structure) => {
                return structure.structureType == STRUCTURE_CONTAINER;
            }
        });
        // If there are containers, withdraw energy from them
        if (containers.length > 0) {
            creep.withdraw(containers[0], RESOURCE_ENERGY);
        }
        // If the creep is empty, change the state to 'mining'
        if (creep.store.getUsedCapacity() == 0) {
            creep.memory.state = 'mining';
        }
        else if (constructionSites.length > 0) {
            // If the creep is not empty, build the construction site
            if (creep.build(constructionSites[0]) == ERR_NOT_IN_RANGE) {
                creep.moveTo(constructionSites[0]);
            }
        }
        else {
            // If the creep is not empty, upgrade the controller
            if (creep.upgradeController(controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(controller);
            }
            // Initialize counters for terrain spots and adjacent creeps
            let terrainSpots = 0;
            let creepsAdjacent = 0;

            // Scan the controller for number of terrain spots and creeps adjacent to it
            for (let i = 1; i < 9; i++) {
                let x = controller.pos.x + [0, -1, 0, 1, 1, 1, 0, -1, -1][i]; // Iterator can start at 1 since the controller is at the center(0,0) of 3 x 3 square
                let y = controller.pos.y + [0, -1, -1, -1, 0, 1, 1, 1, 0][i];
                let position = new RoomPosition(x, y, controller.pos.roomName);

                // Check for terrain
                let terrain = position.lookFor(LOOK_TERRAIN);
                if (terrain[0] != 'wall') {
                    terrainSpots++;
                }

                // Check for creeps
                let creeps = position.lookFor(LOOK_CREEPS);
                if (creeps.length > 0) {
                    creepsAdjacent++;
                }
            }

            // If there are less than terrain Spots - 1 creeps adjacent to the controller, move this creep to the controller
            if (creepsAdjacent < terrainSpots) {
                creep.moveTo(controller);
            }

        }
    }
}

function dropCreep(creep) {
    const source = creep.pos.findClosestByPath(FIND_SOURCES);
    if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
        creep.moveTo(source);
    }
}

function claimCreep(creep) {
    // If not in source room, move to source room
    if (creep.room.name != creep.memory.source.roomName) {
        creep.moveTo(new RoomPosition(25, 25, creep.memory.source.roomName));
        return;
    }
    // If not at the controller, move to the controller
    if (creep.pos.getRangeTo(creep.room.controller) > 1) {
        creep.moveTo(creep.room.controller);
        return;
    }
    // reserve the controller
    creep.reserveController(creep.room.controller);
}

function haulerCreep(creep) {

    let spawns = creep.room.find(FIND_MY_SPAWNS, {
        filter: (structure) => {
            return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
    });

    let spawnContainers = [];
    for (let i = 0; i < spawns.length; i++) {
        let spawn = spawns[i];
        spawnContainers = spawnContainers.concat(spawn.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: (structure) => {
                return structure.structureType == STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 100;
            }
        }));
    }

    let extensions = creep.room.find(FIND_MY_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType == STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
    });
    extensions.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));

    let droppedResources = creep.room.find(FIND_DROPPED_RESOURCES);
    droppedResources = droppedResources.filter(resource => resource.amount > 50);
    // sort the dropped resources by amount
    const weightAmount = 0.5; // weight for the amount of resources
    const weightDistance = 4; // weight for the distance from the creep

    droppedResources.sort((a, b) => {
        const distanceToA = creep.pos.getRangeTo(a);
        const distanceToB = creep.pos.getRangeTo(b);

        const scoreA = weightAmount * a.amount - weightDistance * distanceToA;
        const scoreB = weightAmount * b.amount - weightDistance * distanceToB;

        return scoreB - scoreA; // sort in descending order of score
    });
    let tombstones = creep.room.find(FIND_TOMBSTONES);
    tombstones = tombstones.filter(tombstone => tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 50);
    tombstones.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));
    // Find all sources
    let sources = creep.room.find(FIND_SOURCES);
    // Find all containers within range 1 of the sources
    let sourceContainers = [];
    for (let i = 0; i < sources.length; i++) {
        let source = sources[i];
        sourceContainers = sourceContainers.concat(source.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: (structure) => {
                return structure.structureType == STRUCTURE_CONTAINER && structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
            }
        }));
    }

    if (creep.room.name != creep.memory.home) {
        creep.moveTo(new RoomPosition(25, 25, creep.memory.home));
        return;
    }
    if (creep.memory.state == undefined) {
        creep.memory.state = 'loading';
    }
    if (creep.memory.state == 'loading') {
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
            creep.memory.state = 'hauling';
        }
        if (droppedResources.length > 0) {
            if (creep.pickup(droppedResources[0]) == ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedResources[0]);
                return;
            }
        }
        if (tombstones.length > 0) {
            if (creep.withdraw(tombstones[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(tombstones[0]);
                return;
            }
        }
        if (sourceContainers.length > 0) {
            if (creep.withdraw(sourceContainers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(sourceContainers[0]);
                return;
            }
        }
    }
    if (creep.memory.state == 'hauling') {
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
            creep.memory.state = 'loading';
        }
        let controllerContainers = creep.room.controller ? creep.room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: (structure) => {
                return structure.structureType == STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 1800;
            }
        }) : [];
        if (spawns.length > 0) {
            if (creep.transfer(spawns[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(spawns[0]);
                return;
            }
        }
        if (extensions.length > 0) {
            if (creep.transfer(extensions[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(extensions[0]);
                return;
            }
        }
        if (controllerContainers.length > 0) {
            if (creep.transfer(controllerContainers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(controllerContainers[0]);
                return;
            }
        }
        if (spawnContainers.length > 0) {
            if (creep.transfer(spawnContainers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(spawnContainers[0]);
                return;
            }
        }
    }
}


function placeContainer(structure) {
    // if a container or construction site already exists in target position, return
    let structurePos = structure.pos;
    let containerPos = new RoomPosition(structurePos.x - 1, structurePos.y - 1, structurePos.roomName);
    let terrain = containerPos.lookFor(LOOK_TERRAIN);
    let structures = containerPos.lookFor(LOOK_STRUCTURES);
    if (terrain[0] == 'wall' || structures.length > 0 && structure.room.controller.level < 2) {
        return;
    }
    structure.room.createConstructionSite(containerPos, STRUCTURE_CONTAINER);
}

// Function to place a container at a controller 2 squares away, but in the direction of the sources
function placeContainerAtController(controller) {
    console.log(controller.level);
    if (controller.level < 3) {
        return;
    }
    // If there are already a total of two containers or construction sites within range 2 of the controller, return
    let containers = controller.pos.findInRange(FIND_STRUCTURES, 2, {
        filter: (structure) => {
            return structure.structureType == STRUCTURE_CONTAINER;
        }
    });
    let constructionSites = controller.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, {
        filter: (structure) => {
            return structure.structureType == STRUCTURE_CONTAINER;
        }
    });
    if (containers.length + constructionSites.length >= 2) {
        return;
    }

    // Find all open spots in range 2 of the controller not adjacent to a wall or structure
    let openSpots = [];
    // Iterate over all squares in a 5x5 square around the controller
    for (let i = controller.pos.x - 2; i <= controller.pos.x + 2; i++) {
        for (let j = controller.pos.y - 2; j <= controller.pos.y + 2; j++) {
            let position = new RoomPosition(i, j, controller.pos.roomName);
            // Check if the position is in range 2 of the controller
            if (controller.pos.getRangeTo(position) == 2) {
                // Check if the position is not adjacent to a wall or structure
                let terrain = position.lookFor(LOOK_TERRAIN);
                let structures = position.lookFor(LOOK_STRUCTURES);
                if (terrain[0] != 'wall' && structures.length == 0) {
                    // Check adjacent spots
                    let adjacentPositions = [
                        new RoomPosition(i - 1, j, controller.pos.roomName),
                        new RoomPosition(i + 1, j, controller.pos.roomName),
                        new RoomPosition(i, j - 1, controller.pos.roomName),
                        new RoomPosition(i, j + 1, controller.pos.roomName)
                    ];
                    let isAdjacentOpen = adjacentPositions.every(adjacentPosition => {
                        let adjacentTerrain = adjacentPosition.lookFor(LOOK_TERRAIN);
                        let adjacentStructures = adjacentPosition.lookFor(LOOK_STRUCTURES);
                        return adjacentTerrain[0] != 'wall' && adjacentStructures.length == 0;
                    });
                    if (isAdjacentOpen) {
                        openSpots.push(position);
                    }
                }
            }
        }
    }

    // Pick one of these spots that is closest to the two sources
    let sources = controller.room.find(FIND_SOURCES);
    let bestSpot = openSpots[0];
    let bestDistance = 1000;
    for (let i = 0; i < openSpots.length; i++) {
        let distance = 0;
        for (let j = 0; j < sources.length; j++) {
            distance += openSpots[i].getRangeTo(sources[j]);
        }
        if (distance < bestDistance) {
            bestDistance = distance;
            bestSpot = openSpots[i];
        }
    }
    controller.room.createConstructionSite(bestSpot, STRUCTURE_CONTAINER);
}

function placeExtensions(spawn) {
    let controller = spawn.room.controller;
    let numExtensionsNeeded = 0;
    if (controller.level == 1) {
        numExtensionsNeeded = 0;
    }
    else if (controller.level == 2) {
        numExtensionsNeeded = 5;
    }
    else if (controller.level == 3) {
        numExtensionsNeeded = 10;
    }
    else if (controller.level == 4) {
        numExtensionsNeeded = 20;
    }
    else if (controller.level == 5) {
        numExtensionsNeeded = 30;
    }
    else if (controller.level == 6) {
        numExtensionsNeeded = 40;
    }
    else if (controller.level == 7) {
        numExtensionsNeeded = 50;
    }
    else if (controller.level == 8) {
        numExtensionsNeeded = 60;
    }

    // Find current number of extensions
    let extensions = spawn.room.find(FIND_MY_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType == STRUCTURE_EXTENSION;
        }
    });
    // Find construction sites for extensions
    let constructionSites = spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: (structure) => {
            return structure.structureType == STRUCTURE_EXTENSION;
        }
    });
    // If the number of extensions and construction sites is less than the number needed, place a construction site
    if (extensions.length + constructionSites.length < numExtensionsNeeded) {
        // Find the best spot for the extension
        let bestSpot = findBestExtensionSpot(spawn);
        spawn.room.createConstructionSite(bestSpot, STRUCTURE_EXTENSION);
    }

    // Place extensions as close to the spawn without any extension touching more than 2 other extensions
    function findBestExtensionSpot(spawn) {
        let bestSpot = new RoomPosition(spawn.pos.x + 4, spawn.pos.y, spawn.room.name);
        let bestScore = 0;
        for (let i = spawn.pos.x - 4; i <= spawn.pos.x + 4; i++) {
            for (let j = spawn.pos.y - 4; j <= spawn.pos.y + 4; j++) {
                let pos = new RoomPosition(i, j, spawn.room.name);
                let structures = pos.lookFor(LOOK_STRUCTURES);
                let score = 0;
                if (structures.length == 0) {
                    let adjacentExtensions = 0;
                    for (let k = 0; k < extensions.length; k++) {
                        if (extensions[k].pos.getRangeTo(pos) <= 1) {
                            adjacentExtensions++;
                        }
                    }
                    score = 9 - adjacentExtensions;
                    if (score > bestScore) {
                        bestScore = score;
                        bestSpot = pos;
                    }
                }
            }
        }
        return bestSpot;
    }

}

// Constant containing the number of expected creeps for each role by room level
const NUM_CREEPS = {

    'scout': [1, 1, 1, 1, 1, 1, 1, 1], // [RCL 1, RCL 2, RCL 3, RCL 4, RCL 5, RCL 6, RCL 7, RCL 8,]
    'miner': [12, 12, 10, 6, 6, 5, 4, 4],
    'upgrader': [5, 5, 5, 5, 5, 5, 5, 5],
    'builder': [5, 5, 5, 5, 5, 5, 5, 5],
    'dropMiner': [3, 3, 3, 2, 1, 1, 1, 1],
};

function displayEnergy(obj) {
    let energy, energyMax;

    if (obj.store) {
        energy = obj.store.getUsedCapacity(RESOURCE_ENERGY) > 0 ? obj.store.getUsedCapacity(RESOURCE_ENERGY) : obj.energy;
        energyMax = obj.store.getCapacity(RESOURCE_ENERGY) > 0 ? obj.store.getCapacity(RESOURCE_ENERGY) : obj.energyCapacity;
    } else if (obj.energy !== undefined && obj.energyCapacity !== undefined) {
        energy = obj.energy;
        energyMax = obj.energyCapacity;
    } else {
        return; // If neither store nor energy properties exist, exit the function
    }

    let energyPercentage = energy / energyMax;
    let energyString = '';
    for (let j = 0; j < 10; j++) {
        if (j < energyPercentage * 10) {
            energyString += ':';
        }
        else {
            energyString += '.';
        }
    }
    obj.room.visual.text(energyString, obj.pos.x, obj.pos.y - 1.5, { align: 'center', color: 'yellow' });
}

module.exports.loop = function () {
    console.log('Tick: ' + Game.time);
    for (let roomName in Game.rooms) {

        // body = [MOVE, WORK, WORK];
        // LinkLogic.runLinkLogic(roomName);
        // Log CPU usage at this point
        console.log(Game.time + ': CPU used at the beginning of the loop: ' + Game.cpu.getUsed());
        let room = Game.rooms[roomName];
        if (Game.rooms[roomName].controller && Game.rooms[roomName].controller.my) {
            // console.log(roomName + ' - ' + Game.rooms[roomName].find(FIND_MY_SPAWNS)[0].name + ' - ' + Game.rooms[roomName].energyAvailable);
            Game.rooms[roomName].controller.remoteMining(roomName);
            if (Game.rooms[roomName].controller.level > 3) {
                Game.rooms[roomName].controller.placeRoads();
            }
            if (Game.rooms[roomName].controller.level > 2) {
                placeContainerAtController(Game.rooms[roomName].controller);
            }
        }
        // Calculate the number of access points to the sources
        let sources = room.find(FIND_SOURCES);
        let accessPoints = 0;
        for (let i = 0; i < sources.length; i++) {
            let source = sources[i];
            let terrain = room.lookForAtArea(LOOK_TERRAIN, source.pos.y - 1, source.pos.x - 1, source.pos.y + 1, source.pos.x + 1, true);
            for (let j = 0; j < terrain.length; j++) {
                if (terrain[j].terrain != 'wall') {
                    accessPoints++;
                }
            }
        }


        // Find all creeps with the role 'scout'
        let scouts = _.filter(Game.creeps, (creep) => creep.memory.role == 'scout');
        let miners = _.filter(Game.creeps, (creep) => creep.memory.role == 'miner');
        let dropMiners = _.filter(Game.creeps, (creep) => creep.memory.role == 'dropMiner');
        let haulers = _.filter(Game.creeps, (creep) => creep.memory.role == 'hauler');
        // Find all spawns in the room
        var spawns = room.find(FIND_MY_SPAWNS);
        // For each spawn in the room, place a container
        // For each spawn in the room, place a container

        // TODO :: Better method of room recovery than a bootstrap function
        // If no miners or dropMiners, spawn a new miner
        if (miners.length < 1 && spawns.length > 0 && dropMiners.length < 1) {
            var newName = 'Miner - ' + Game.time;
            // Small creep with 1 WORK, 1 CARRY, 1 MOVE for room recovery(300- energy cost)
            spawns[0].spawnCreep([WORK, CARRY, MOVE], newName,
                { memory: { role: 'miner', home: roomName } });
        }


        for (let i = 0; i < spawns.length; i++) {
            if (Game.rooms[roomName].controller.level > 2) {
                placeContainer(spawns[i]);
            }
            placeExtensions(spawns[i]);
            // Record the last 1500 ticks of energy in the spawn and if it was spawning each of those ticks or not
            if (spawns[i].memory.energy == undefined) {
                spawns[i].memory.energy = [];
                spawns[i].memory.spawningTicks = [];
            }
            spawns[i].memory.energy.push(spawns[i].store.getUsedCapacity(RESOURCE_ENERGY));
            spawns[i].memory.spawningTicks.push(spawns[i].spawning ? 1 : 0);
            if (spawns[i].memory.energy.length > 1500) {
                spawns[i].memory.energy.shift();
                spawns[i].memory.spawningTicks.shift();
            }

            // Calculate the percentage of actively spawning ticks
            let activelySpawningTicks = spawns[i].memory.spawningTicks.reduce((a, b) => a + b, 0);
            let percentageActivelySpawning = activelySpawningTicks / spawns[i].memory.spawningTicks.length * 100;
            // Room visual to show the percentage of time the spawn was actively spawning, just ##%
            room.visual.text(`${percentageActivelySpawning.toFixed(2)}%`, spawns[i].pos.x, spawns[i].pos.y + 2, { align: 'center', color: 'white' });
            // If age is not save to spawn memory, save the current tick.
            if (spawns[i].memory.age == undefined) {
                spawns[i].memory.age = Game.time;
            }
            // Room Visual to show the age of the spawn
            room.visual.text(`Age: ${Game.time - spawns[i].memory.age}`, spawns[i].pos.x, spawns[i].pos.y + 1, { align: 'center', color: 'white' });

            // Room visual using stacked colons to represent the percentage full the spawn is


            displayEnergy(spawns[i]);
            // For each source, run displayEnergy
            for (let j = 0; j < sources.length; j++) {
                displayEnergy(sources[j]);
            }


            let spots = [];
            let terrain = new Room.Terrain(spawns[i].room.name);

            for (let x = Math.max(spawns[i].pos.x - 5, 0); x <= Math.min(spawns[i].pos.x + 5, 49); x++) {
                for (let y = Math.max(spawns[i].pos.y - 5, 0); y <= Math.min(spawns[i].pos.y + 5, 49); y++) {
                    if (terrain.get(x, y) == 0) { // 0 means plain, which is walkable
                        let structures = spawns[i].room.lookForAt(LOOK_STRUCTURES, x, y);
                        if (structures.length == 0) {
                            spots.push(new RoomPosition(x, y, spawns[i].room.name));
                        }
                    }
                }
            }

        }
        // If there are no scouts and there is a spawn, spawn a new scout
        if (scouts.length < 1 && spawns.length > 0) {
            var newName = 'Scout - ' + Game.time;
            spawns[0].spawnCreep([MOVE], newName,
                { memory: { role: 'scout', home: roomName } });
        }
        if (Game.rooms[roomName].controller && Game.rooms[roomName].controller.my && Game.rooms[roomName].controller.level > 1 && haulers.length < MAX_HAULERS && spawns.length > 0) {
            let body = [MOVE, CARRY, MOVE, CARRY];
            let cost = 200;
            while (cost + 100 < room.energyAvailable) {
                body.push(MOVE);
                body.push(CARRY);
                cost += 100;
            }
            var newName = 'Hauler - ' + Game.time;
            spawns[0].spawnCreep(body, newName,
                { memory: { role: 'hauler', home: roomName } });
        }
        if (Game.rooms[roomName].controller &&
            Game.rooms[roomName].controller.my) {
            console.log('Miners: ' + miners.length + ' DropMiners: ' + dropMiners.length + ' Access Points: ' + accessPoints);
        }
        // Console log CPU usage
        console.log(Game.time + ': CPU used after spawning: ' + Game.cpu.getUsed());
        body = [MOVE, WORK, WORK];
        if (Game.rooms[roomName].controller &&
            Game.rooms[roomName].controller.my &&
            dropMiners.length < accessPoints &&
            miners.length > dropMiners.length &&
            dropMiners.length < NUM_CREEPS['dropMiner'][Game.rooms[roomName].controller.level - 1] + 1) {
            console.log('Spawning dropMiner');
            let cost = 250;
            while (cost + 250 < room.energyAvailable) {
                body.push(MOVE);
                body.push(WORK);
                body.push(WORK);
                cost += 250;
                // break after # of work parts is >= 5
                if (body.length > 6) {
                    break;
                }
            }
            var newName = 'DropMiner - ' + Game.time;
            spawns[0].spawnCreep(body, newName,
                { memory: { role: 'dropMiner', home: roomName } });
        }
        else if (Game.rooms[roomName].controller && Game.rooms[roomName].controller.my && miners.length < NUM_CREEPS['miner'][Game.rooms[roomName].controller.level - 1] && spawns.length > 0) {
            console.log('Spawning miner');
            let cost = 250;
            body = [MOVE, MOVE, CARRY, WORK];
            while (cost + 250 < room.energyAvailable) {
                body.push(MOVE);
                body.push(MOVE);
                body.push(CARRY);
                body.push(WORK);
                cost += 250;
            }

            var newName = 'Miner - ' + Game.time;
            spawns[0].spawnCreep(body, newName,
                { memory: { role: 'miner', home: roomName, state: 'filling' } });
        }

        // Console log CPU usage
        console.log(Game.time + ': CPU used after spawning: ' + Game.cpu.getUsed());
        // Find containers withing range 2 of the controller
        if (room.controller) {
            let controllerContainers = room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: (structure) => {
                    return structure.structureType == STRUCTURE_CONTAINER;
                }
            });
            // For each container, check the surroundings and move any creeps found TODO
            for (let i = 0; i < controllerContainers.length; i++) {
            }
        }
        // Remove dead creeps from memory
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
        // Remove dead spawns from memory(from respawns, etc.)
        for (let name in Memory.spawns) {
            if (!Game.spawns[name]) {
                delete Memory.spawns[name];
            }
        }
        for (let creepName in Game.creeps) {
            let creep = Game.creeps[creepName];
            if (creep.memory.role == 'scout') {
                exploreAdjacentRooms(creep);
            }
            if (creep.memory.role == 'miner') {
                minerCreep(creep);
            }
            if (creep.memory.role == 'dropMiner') {
                dropCreep(creep);
            }
            if (creep.memory.role == 'hauler') {
                haulerCreep(creep);
            }
            if (creep.memory.role == 'remoteDropMiner') {
                creep.remoteDropMiner();
            }
            if (creep.memory.role == 'remoteHauler') {
                creep.remoteHauler();
            }
            if (creep.memory.role == 'claimer') {
                claimCreep(creep);
            }
        }

        // Console log CPU usage
        console.log(Game.time + ': CPU used at the end of the script: ' + Game.cpu.getUsed());
    };
};
