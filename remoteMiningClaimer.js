Creep.prototype.remoteClaim = function () {
    // If the creep is not in the target room, go there
    if (this.room.name != this.memory.target) {
        this.moveTo(new RoomPosition(25, 25, this.memory.target));
    } else {
        // reserve the controller for mining purposes
        let controller = this.room.controller;
        if (controller) {
            if (this.reserveController(controller) == ERR_NOT_IN_RANGE) {
                this.moveTo(controller);
            }
        }
    }
};

module.exports = Creep;