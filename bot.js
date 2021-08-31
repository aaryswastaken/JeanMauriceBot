require("dotenv").config();
const fs = require("fs");
const {Client, Intents, MessageEmbed} = require("discord.js");
const client = new Client({intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_BANS,
        Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
        Intents.FLAGS.GUILD_INTEGRATIONS,
        Intents.FLAGS.GUILD_WEBHOOKS,
        Intents.FLAGS.GUILD_INVITES,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILD_PRESENCES,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_MESSAGE_TYPING,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
        Intents.FLAGS.DIRECT_MESSAGE_TYPING
    ]});

const discriminator = "!";
let cache = {};


///// CACHE MANAGEMENT
function refreshCache() {
    fs.writeFileSync("./cache.json", JSON.stringify(cache))
}

function readCache() {
    cache = JSON.parse(fs.readFileSync("./cache.json"));

    if(!Object.keys(cache).includes("activeComm")) {cache.activeComm = {}}
}

readCache();

///// CONFIG

let config = JSON.parse(fs.readFileSync("./config.json"));

function format(str) {
    let s = str
    for(let [key, value] of Object.entries(config.replace)) {
        s = s.replaceAll(key, value);
    }

    return s
}

function createDM(user, then) {
    user.createDM().then((channel) => {
        cache.activeComm[user.id].DMChannelID = channel.id;
        refreshCache();
        then(channel);
    })
}

function sendListAccordingToLevel(channel, level) {
    let lvl = cache.levels[level];

    let msg = new MessageEmbed()
        .setColor("#0099ff")
        .setTitle(lvl.name)
        .addField("⚠ Important ⚠", lvl.desc, true)
        .setDescription(Object.entries(lvl.content).map(([key, val]) => {
            return `${key} : ${val.id}`
        }).join("\n"));

    channel.send({embeds: [msg]});
}

function checkIfInProcedure(user) {
    if(Object.keys(cache.activeComm).includes(user.id)) {
        return (cache.activeComm[user.id].state !== -1)
    }

    return false
}

function processChoice(user, ct) {
    console.log(`User ${user.username} choose ${ct.join(", ")}`);
}

function handleResponse(user, message) { // If this function is called, the user is registered in cache, no verification needed in this case
    let ct = message.content.replace(/ */, ""); // Delete blank spaces before msg
    let state = cache.activeComm[user.id].state;

    let info = ct.split(" ");
    let stdQTY = cache.levels[state].qty;

    let error = "";

    if(stdQTY === -1 && info.length === 0) {
        error = format(config.message.shouldHaveAtLeastOneChoice);
    }
    if(stdQTY > 0 && stdQTY !== info.length) {
        error = format(config.message.notRightNumberOfArgs) + stdQTY.toString();
    }

    if(error !== "") {
        message.reply(message)
            .then(() => {console.log(`An error occured with ${user.username}#${user.tag}, replied ${error}`)})
            .catch(console.error);
    } else {
        processChoice(user, ct);
    }
}

function procedure(user) { // This function will handle the communication with the user
    /*
        Levels :
         - -1: Not in procedure
         - 0 : Starting
             + Niveau (Terminal, première ...)
         - 1 : Classe (1eA, B, C, D ...)
         - 2 : SPÉ+Prof (Maths Krieger, Maths Seda)
         - 3 : Options
    */
    if(Object.keys(cache.activeComm).includes(user.id)) {
        let level = cache.activeComm[user.id].state;


        client.channels.fetch(cache.activeComm[user.id].DMChannelID)
            .then((DMChannel) => {
                if(cache.activeComm[user.id].state === -1) {
                    DMChannel.send("An error occurred : procedure() was called for the user with -1 registration ...");
                } else {
                    if(cache.levels.length >= level) {
                        let msg = config.message["level"+level.toString()]; // Is there a predefined message ?

                        msg = msg || ("Bien, on va alors passer à la suite : "+cache.levels[level].name); // If not, go for the default one

                        DMChannel.send(format(msg)); // Send first message ...

                        sendListAccordingToLevel(DMChannel, level); // Then send list of according level from DMChannel
                    }
                }
            });
    } else {
        createDM(user, (channel) => {
            channel.send("An error occurred : procedure() was called for the user without being registered in cache");
        })
    }
}

function beginProcedure(user) { // This function handles the start of the procedure with clean user state
    cache.activeComm[user.id].state = 0;

    refreshCache();

    procedure(user);
}

function handleNewUser(user, force) { // This function is triggered whenever someones joins the server or type !newuser
    console.log(`Handling new user ... ${user.username}`);

    if(!Object.keys(cache.activeComm).includes(user.id) || force) {
        cache.activeComm[user.id] = {};

        createDM(user, (channel) => {
            config.messages.welcomeMessages.forEach(m => {
                channel.send(format(m));
            });

            cache.activeComm[user.id].state = 0;

            refreshCache();

            beginProcedure(user);
        })
    } else {
        client.channels.fetch(cache.activeComm[user.id].DMChannelID).send(format(config.messages.alreadyProcessing))
    }
}

function handleAbortUser(user) { // !abort
    if(Object.keys(cache.activeComm).includes(user.id)) {
        client.channels.fetch(cache.activeComm[user.id].DMChannelID)
            .then((DMChannel) => {
                DMChannel.send(format(config.messages.abortMessage));
                cache.activeComm[user.id].state = -1;

                refreshCache();
            });
    } else {
        createDM(user, (channel) => {
            channel.send(format(config.messages.abortNotStarted))
        })
    }
}

function handleRestartUser(user) { // !restart
    if(Object.keys(cache.activeComm).includes(user.id)) {
        client.channels.fetch(cache.activeComm[user.id].DMChannelID)
            .then((DMChannel) => {
                DMChannel.send(format(config.message.restartMessage));
            });

        cache.activeComm[user.id].state = 0;

        refreshCache();

        beginProcedure(user);
    } else {
        handleNewUser(user, true);
    }
}

function setManualLVL(message, lvlMSG) {
    let lvl = Number.parseInt(lvlMSG);

    cache.activeComm[user.id].state = lvl;

    refreshCache();
}

function commandHandler(msg, message, isMP) { // Handles every commands (starting with "!")
    console.log(`New command ${msg}`)
    let ct = msg.split(" ");
    switch (ct[0].substring(discriminator.length)) {
        case "newuser":
            handleNewUser(message.author, false);
            break;
        case "abort":
            handleAbortUser(message.author);
            break;
        case "restart":
            handleRestartUser(message.author);
            break;
        case "setlvl":
            setManualLVL(message, ct[1]);
    }
}

client.on("guildMemberAdd", (member) => { // Whenever someone joins the server
    handleNewUser(member)
})

client.on("messageCreate", (message) => { // Whenever someone send a message
    console.log(`New message from ${message.author.username} on ${message.guildId} : ${message.content}`);
    if(!message.author.bot) {
        let msg = message.content.toLowerCase().replace(/ */, ""); // Deletes every spaces before the message
        if(msg[0] === discriminator) {
            commandHandler(msg, message, (message.guildId === null));
        }

        if(checkIfInProcedure(message.author)) {
            handleResponse(message.author, message);
        }
    }
})

client.login(process.env.TOKEN) // Entrypoint
    .then(r => {
        console.log("[*] Restoring DM ... ");
        if(Object.keys(cache.activeComm).length > 0) {
            for (let [id, value] of Object.entries(cache.activeComm)) {
                console.log(`Restoring ... #${value.DMChannelID}`);
                client.channels.fetch(value.DMChannelID);
            }
        }

        console.log("JEAN MAURICE IS UP !");
    })
    .catch(console.error);

function exitHandler(options, exitCode) { // Whenever the bot stops
    if (options.cleanup) {
        console.log('----- STOPPING -----');

        refreshCache(); console.log("[!] Cache saved")
    }
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) process.exit();
}

// REGISTER STOPPING PROCEDURE

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));