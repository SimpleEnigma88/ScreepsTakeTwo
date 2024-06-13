const doctorWhoQuotes = [
    "The universe is big. It's vast and complicated and ridiculous.",
    "In 900 years of time and space, I've never met anyone who wasn't important.",
    "You want weapons? We're in a library! Books! The best weapons in the world!",
    "Some people live more in 20 years than others do in 80.",
    "We're all stories, in the end. Just make it a good one, eh?",
    "I am definitely a madman with a box.",
    "900 years of time and space, and I've never been slapped by someone's mother.",
    "I'm the Doctor. I'm a Time Lord. I'm from the planet Gallifrey in the Constellation of Kasterborous.",
    "Scared is super power. It's your super power. There is danger in this room and guess what? It's you.",
    "Never cruel or cowardly. Never give up, never give in.",
    "I'm not a hero. I really am just a madman with a box.",
    "I am and always will be the optimist. The hoper of far-flung hopes, the dreamer of improbable dreams.",
    "It's more like a big ball of wibbly-wobbly, timey-wimey... stuff.",
    // Add more quotes here
];

function getRandomDoctorWhoQuote() {
    const randomIndex = Math.floor(Math.random() * doctorWhoQuotes.length);
    return doctorWhoQuotes[randomIndex];
}

Creep.prototype.signControllerWithQuote = function () {
    const quote = getRandomDoctorWhoQuote();
    this.signController(this.room.controller, quote);
};


Creep.prototype.remoteClaim = function () {
    // If the creep is not in the target room, go there
    if (this.room.name != this.memory.target) {
        this.moveTo(new RoomPosition(25, 25, this.memory.target));
    }
    else {
        // reserve the controller for mining purposes
        let controller = this.room.controller;
        if (controller) {
            if (this.reserveController(controller) == ERR_NOT_IN_RANGE) {
                this.moveTo(controller);
            }
        }
    }
    const controller = this.room.controller ? this.room.controller : null;
    if (controller) {
        if (controller.sign && controller.sign.time > Game.time - 1000) {
            return;
        }
        this.signControllerWithQuote();
    }
};

module.exports = Creep;