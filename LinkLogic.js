const MIN_TERMINAL_ENERGY = 15000;
export function getLinks(roomName) {
    let room = Game.rooms[roomName];
    if (room.memory.links == undefined) {
        return;
    }
    let links = room.memory.links;
    let sourceLinks = [];
    let controllerLink = {};
    let storageLink = {};
    let terminalLink = {};
    for (let link in links) {
        if (links[link].type == 'source') {
            sourceLinks.push(links[link]);
        } else if (links[link].type == 'controller') {
            controllerLink = links[link];
        } else if (links[link].type == 'storage') {
            storageLink = links[link];
        } else if (links[link].type == 'terminal') {
            terminalLink = links[link];
        }
    }
    return {
        sourceLinks: sourceLinks,
        controllerLink: controllerLink,
        storageLink: storageLink,
        terminalLink: terminalLink
    };
}

export function setLinks(roomName) {
    let room = Game.rooms[roomName];
    if (room.memory.links == undefined) {
        return;
    }
    let links = room.find(FIND_MY_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType == STRUCTURE_LINK;
        }
    });
    for (let link in links) {
        let linkObj = Game.getObjectById(links[link].id);
        if (linkObj == null) {
            delete room.memory.links[link];
        }
        // if link is within 2 of controller, set as controller link
        if (room.controller.pos.getRangeTo(linkObj) <= 2) {
            room.memory.links[linkObj.id] = {
                type: 'controller'
            };
        }
        // if link is within 2 of storage, set as storage link
        else if (room.storage && room.storage.pos.getRangeTo(linkObj) <= 2) {
            room.memory.links[linkObj.id] = {
                type: 'storage'
            };
        }
        // if link is within 2 of terminal, set as terminal link
        else if (room.terminal && room.terminal.pos.getRangeTo(linkObj) <= 2) {
            room.memory.links[linkObj.id] = {
                type: 'terminal'
            };
        }
        // if link is within 2 of source, set as source link
        else {
            let sources = room.find(FIND_SOURCES);
            for (let source in sources) {
                if (sources[source].pos.getRangeTo(linkObj) <= 2) {
                    room.memory.links[linkObj.id] = {
                        type: 'source'
                    };
                }
            }
        }
    }
}

export function runLinkLogic(roomName) {
    let links = getLinks(roomName);
    if (links == undefined) {
        return;
    }
    let sourceLinks = links.sourceLinks;
    let controllerLink = links.controllerLink;
    let storageLink = links.storageLink;
    let terminalLink = links.terminalLink;
    // for each source link, transfer energy to upgrade link if it has less than 400 energy, otherwise transfer to storage link if not about 95% full
    for (let i = 0; i < sourceLinks.length; i++) {
        if (sourceLinks[i].energy >= 400) {
            if (controllerLink.energy < 400) {
                sourceLinks[i].transferEnergy(controllerLink);
            } else if (storageLink.energy < storageLink.energyCapacity * 0.95) {
                sourceLinks[i].transferEnergy(storageLink);
            }
        }
    }
    // terminal link is above 700, and controller is less than 400, transfer to controller, otherwise transfer to storage link if not about 95% full

    // storage link is above 700, and controller is less than 400, transfer to controller
    if (storageLink.energy >= 700 && controllerLink.energy < 400) {
        storageLink.transferEnergy(controllerLink);
    }

}
module.exports = {
    runLinkLogic,
    setLinks,
    getLink
};