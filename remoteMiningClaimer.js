const doctorWhoQuotes = [
    "I am and always will be the optimist. The hoper of far-flung hopes and the dreamer of improbable dreams.",
    "The universe is big. It's vast and complicated and ridiculous.",
    "In 900 years of time and space, I've never met anyone who wasn't important.",
    "You want weapons? We're in a library! Books! The best weapons in the world!",
    "Some people live more in 20 years than others do in 80. It's not the time that matters, it's the person.",
    "We're all stories, in the end. Just make it a good one, eh?",
    "The way I see it, every life is a pile of good things and bad things. The good things don't always soften the bad things, but vice versa, the bad things don't always spoil the good things and make them unimportant.",
    "You know when grown-ups tell you everything's going to be fine, and you think they're probably lying to make you feel better?",
    "There's a lot of things you need to get across this universe. Warp drive... wormhole refractors... You know the thing you need most of all? You need a hand to hold.",
    "I am definitely a madman with a box.",

    // Add more quotes here
];

function getRandomDoctorWhoQuote() {
    const randomIndex = Math.floor(Math.random() * doctorWhoQuotes.length);
    return doctorWhoQuotes[randomIndex];
}

Creep.prototype.signControllerWithQuote = function () {
    const quote = getRandomDoctorWhoQuote();
    this.signController(quote);
};


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
    const controller = this.room.controller ? this.room.controller : null;
    if (controller) {
        if (controller.sign && controller.sign.time < Game.time - 1000) {
            return;
        }
        this.signControllerWithQuote();
    }
};

module.exports = Creep;