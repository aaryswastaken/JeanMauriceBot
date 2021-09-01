require("dotenv").config();
const fs = require("fs");
const {Client, Intents, MessageEmbed, DMChannel} = require("discord.js");
const {parse} = require("dotenv");
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

///// THANKS STACK OVERFLOW

function uniq(a) {
    return a.sort().filter(function(item, pos, ary) {
        return !pos || item !== ary[pos - 1];
    });
}

///// START OF THE REAL MESS

function createDM(user, then) {
    user.createDM().then((channel) => {
        cache.activeComm[user.id].DMChannelID = channel.id;
        refreshCache();
        then(channel);
    })
}

function sendListAccordingToLevel(channel, level) {
    let lvl = cache.levels[level];

    let qty = lvl.qty;
    let add = "";
    if(qty === 0) {qty = "autant de"; add="que vous voulez (meme aucune si vous voulez)";}
    if(qty === -1){qty = "au moins une"}

    let msg = new MessageEmbed()
        .setColor("#0099ff")
        .setTitle(lvl.name)
        .addField("⚠ Important ⚠", lvl.desc+`\nVous devez saisir ${qty} réponse(s) ${add}`, true)
        .setDescription(Object.entries(Object.keys(lvl.content)).map(([key, val]) => {
            return `${key} : ${val}`
        }).join("\n"));

    channel.send({embeds: [msg]});
}

function checkIfInProcedure(user) {
    if(Object.keys(cache.activeComm).includes(user.id)) {
        return (cache.activeComm[user.id].state !== -1)
    }

    return false
}

function createFinalRole(guild, name, levelPosition, roleLevel, resolve, reject) {
    guild.roles.create({
        name: name,
        color: "DEFAULT",
        hoist: false,
        permissions: guild.roles.everyone.permissions,
        position: levelPosition-1,
        mentionable: true,
        reason: "A user created this role ..."
    }).then((role) => {
        let id = role.id;
        console.log(`Created role #${id}, named ${name} at position #${levelPosition-1}`)

        cache.levels[roleLevel].content[name] = {id: id};

        refreshCache();

        resolve(id);
    }).catch(reject);
}

function createRole(roleName, roleLevel) { // crate role according to new information
    return new Promise((resolve, reject) => {
        let name = roleName.replace(/ */, "").toLowerCase();
        name[0] = name[0].toUpperCase();

        client.guilds.fetch().then((guilds) => {
            guilds.forEach((guildOAuth) => {
                guildOAuth.fetch()
                    .then((guild) => {
                        let levelPosition = -1;
                        console.log(`[*] Searching for level ${roleLevel} discriminator`)
                        guild.roles.cache.forEach((role) => { // Search for the correct position
                            if(role.name === ("level"+roleLevel.toString())) {
                                levelPosition = role.position;
                            }
                        });

                        if(levelPosition === -1) { // If no position where found
                            console.log("[*] Search ended with no results")
                            guild.roles.create({
                                name: ("level"+roleLevel.toString()),
                                color: "DEFAULT",
                                hoist: false,
                                permissions: guild.roles.everyone.permissions,
                                position: guild.roles.everyone.position,
                                mentionable: false,
                                reason: "No level where found"
                            }).then((role) => {
                                console.log(`Created role #${role.id}, named ${role.name} at position #${role.position}`)

                                levelPosition = role.position;
                                createFinalRole(guild, name, levelPosition, roleLevel, resolve, reject);
                            }).catch(console.error);
                        } else {
                            console.log("[*] Search ended with one result ")
                            createFinalRole(guild, name, levelPosition, roleLevel, resolve, reject);
                        }

                    }).catch(reject);
            })
        }).catch(reject);
    });
}

function postRoleApplication(state, user) {
    if(state >= (cache.levels.length-1)) { // Last information
        client.channels.fetch(cache.activeComm[user.id].DMChannelID)
            .then((DMChannel) => {
                DMChannel.send(format(config.messages.lastMessage));
            })

        cache.activeComm[user.id].state = -1; // we finish the thing

        console.log("[!] Registration ended ! ");
    } else {
        cache.activeComm[user.id].state += 1;
        console.log("[~] Going to next step");
        procedure(user);
    }

    refreshCache();
}

async function applyRoles(user, rolesIDs, state) {
    client.guilds.fetch().then((guilds) => {
        guilds.forEach((guildOAuth) => {
            guildOAuth.fetch().then((guild) => {
                console.log(`[^] Applying for ${guild.name}`)
                guild.members.search({query: user.username})
                    .then((member) => {
                        member.forEach((val, key, map) => {
                            // val.edit({roles: [...val.roles, ...rolesIDs]}, "Updated profile trough bot")
                            //     .then((member) => {console.log(`${member.user.username} has been updated successfully with ${rolesIDs.join(", ")}`)})
                            //     .catch(console.error);

                            val.roles.add(rolesIDs, "Updated profile trough bot")
                                .then((member) => {console.log(`${member.user.username} has been updated successfully with ${rolesIDs.join(", ")}`)})
                                .catch(console.error);
                        })

                        postRoleApplication(state, user);
                    })
                    .catch(console.error);
            }).catch(console.error);
        });
    }).catch((error) => {
        console.log(`ERROR ${error}`);
    });
}

function processChoice(user, reply) {
    console.log(`User ${user.username} choose ${reply.join(", ")}`);
    let state = cache.activeComm[user.id].state;

    // let rolesIDs = [];

    reply.forEach((r) => {
        if(isNaN(parseInt(r))) {
            console.log("[$] Creating Role");
            createRole(r, state)
                .then((id) => {
                    // rolesIDs.push(id);

                    console.log("[$] Applying role after creation")
                    // applyRoles(user, rolesIDs, state);
                    await applyRoles(user, [id], state);
                }).catch(console.error);
        } else {
            let id = cache.levels[state].content[Object.keys(cache.levels[state].content)[parseInt(r)]].id;
            // rolesIDs.push(id);

            console.log("[.] Applying already existing role")
            // applyRoles(user, rolesIDs, state);
            applyRoles(user, [id], state);
        }
    });


}

function handleResponse(user, message) { // If this function is called, the user is registered in cache, no verification needed in this case
    let ct = message.content.replace(/ */, ""); // Delete blank spaces before msg
    let state = cache.activeComm[user.id].state;

    let reply = ct.split(" ");

    let replyD = reply;  // reply with maybe some duplicates
    reply = uniq(reply); // Delete duplicates

    let stdQTY = cache.levels[state].qty;
    let maxId = Object.keys(cache.levels[state].content).length;

    let error = "";

    if(replyD.length !== reply.length) {
        error = format(config.messages.duplicatesInAnswer);
    }

    reply = reply.filter(i => i !== "."); // delete every "." (usefull for options)

    if(reply.length === 0 && state === (cache.levels.length - 1)) { // If last level and no answer -> no changes
        postRoleApplication(state, user); // Get directly to message
        return;
    }

    if(stdQTY === -1 && reply.length === 0) {
        error = format(config.messages.shouldHaveAtLeastOneChoice);
    }
    if(stdQTY > 0 && stdQTY !== reply.length) {
        error = format(config.messages.notRightNumberOfArgs) + stdQTY.toString();
    }
    if(reply.some((element) => {
        return !(isNaN(parseInt(element)) || parseInt(element) < maxId)   // If string -> false, if id <= maxId -> false, else -> true
    })) {
        error = format(config.messages.atLeastOneIdIsWrong)
    }

    if(error !== "") {
        message.reply(error)
            .then(() => {console.log(`An error occured with ${user.username}#${user.tag}, replied ${error}`)})
            .catch(console.error);
    } else {
        processChoice(user, reply);
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
                    if(cache.levels.length >= (level+1)) {
                        let msg = config.messages["level"+level.toString()]; // Is there a predefined message ?

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

    if(force || ((cache.activeComm[user.id] || {state: -1}).state === -1)) { // If force or state = -1 or state = undefined
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
        client.channels.fetch(cache.activeComm[user.id].DMChannelID)
            .then((DMChannel) => {
                DMChannel.send(format(config.messages.alreadyProcessing));
            })
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
                DMChannel.send(format(config.messages.restartMessage));
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
    handleNewUser(member.user, false)
})

client.on("messageCreate", (message) => { // Whenever someone send a message
    if(!message.author.bot) {
        console.log(`New message from ${message.author.username} on ${message.guildId} : ${message.content}`);

        let msg = message.content.toLowerCase().replace(/ */, ""); // Deletes every spaces before the message
        if(msg[0] === discriminator) {
            commandHandler(msg, message, (message.guildId === null));
        }
        else {
            if(checkIfInProcedure(message.author) && (message.guildId === null)) { // If DM + in procedure
                handleResponse(message.author, message);
            }
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