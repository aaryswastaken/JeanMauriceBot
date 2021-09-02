require("dotenv").config();
const fs = require("fs");
const {Client, Intents, MessageEmbed, DMChannel} = require("discord.js");
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

let output = console;

///// THANKS STACK OVERFLOW

function uniq(a) {
    return a.sort().filter(function(item, pos, ary) {
        return !pos || item !== ary[pos - 1];
    });
}

///// START OF THE REAL MESS

function isChar(n) {
    return n.replaceAll(/[0-9]*/gm, "").length !== 0
}

function createDM(user, then) {
    user.createDM().then((channel) => {
        cache.activeComm[user.id].DMChannelID = channel.id;
        refreshCache();
        then(channel);
    })
}

// ------------ CLEAN ------------
const channelList = [
    "882174415314489417", // Salons textuels
    "882174415314489419", //  |- général
    "882175606291308615", //  |- temp
    "882512852383051807", //  |- log
    "882513817798602753", // Terminale
    "882527373948518431", // Espace des classes
    "882547251438825483", // tc
    "882547264755748924"  // 1c
]

const roleList = [
    "882175695571284000", // Jean maurice
    "882239582907805727", // Terminale
    "882239844594626600", // TC
    "882239748343746620", // 1C
    "882543508081229866", // ---- level1
    "882174414769258516"  // everyone
]

async function clean(message) {
    output.log(`Cleaning sender (${message.author.username}) roles`)
    await message.member.edit({roles: []});

    output.log("### Fetching channels ...")
    let channels = await message.guild.channels.fetch();

    output.log("### Begin check ...")
    await Promise.all(channels.map(async (channel) => {
        output.log(`checking ${channel.id}`);
        if (!channelList.includes(channel.id.toString())) {
            await channel.delete();
            output.log(" - deleted")
        }
    }));

    output.log("### Fetching roles ...")
    let roles = await message.guild.roles.fetch();

    output.log("### Begin check ...")
    await Promise.all(roles.map(async (role) => {
        output.log(`checking ${role.id}`)
        if (!roleList.includes(role.id.toString())) {
            await role.delete();
            output.log(" - deleted");
        }
    }))

    output.log("### Cleaning cache.json ...");
    fs.writeFileSync("./cache.json", fs.readFileSync("./cache.json.save"))

    output.log("finished")
    readCache();
}
// -------------------------------

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

async function createFinalRole(guild, name, levelPosition, roleLevel) {
    let role = await guild.roles.create({
        name: name,
        color: "DEFAULT",
        hoist: false,
        permissions: guild.roles.everyone.permissions,
        position: levelPosition-1,
        mentionable: true,
        reason: "A user created this role ..."
    })

    let id = role.id;
    output.log(`Created role #${id}, named ${name} at position #${levelPosition-1}`)

    cache.levels[roleLevel].content[name] = {id: id};

    refreshCache();

    return id
}

async function createCategory(guild, name, position, roleThatHasPerm) {
    output.log(`{~} Creating new category ! Name : ${name} | Position : ${position} | RTHP : ${roleThatHasPerm}`);
    return guild.channels.create(name, {
        type: "GUILD_CATEGORY",
        position: position,
        permissionOverwrites: [
            {
                type: "role",
                id: roleThatHasPerm,
                allow: ['SEND_MESSAGES', 'VIEW_CHANNEL']
            }, {
                type: "role",
                id: guild.roles.everyone.id, // @everyone role
                deny: ['SEND_MESSAGES', 'VIEW_CHANNEL']
            }
        ]
    })
}

async function createChannel(guild, category, name, position, roleThatHasPerm) {
    output.log(`{~} Creating new channel ! Name : ${name} | Position : ${position} | RTHP : ${roleThatHasPerm} | Parent : #${category}`);
    return guild.channels.create(name, {
        type: "GUILD_TEXT",
        position: position,
        parent: category,
        permissionOverwrites: [
            {
                type: "role",
                id: roleThatHasPerm,
                allow: ['SEND_MESSAGES', 'VIEW_CHANNEL']
            }, {
                type: "role",
                id: guild.roles.everyone.id, // @everyone role
                deny: ['SEND_MESSAGES', 'VIEW_CHANNEL']
            }
        ]
    });
}

async function handleChannelCreation(roleName, roleLevel, affiliationType, guild, user, role) {
    output.log("Handle Channel Creation ...")
    let channel;

    switch(affiliationType) {
        case 0:
            output.log("[0] Channel type 0")
            channel = await createCategory(guild, roleName, 100000, role);
            output.log(`Channel created wish id ${channel.id}`)
            cache.levels[roleLevel].content[roleName].affiliation = channel.id;
            break;
        case 1:
            output.log("[0] Channel type 1");
            channel = await createChannel(guild, cache.activeComm[user.id].lastAffiliation, roleName, 10000, role);
            output.log(`Channel created with id ${channel.id}`)
            cache.levels[roleLevel].content[roleName].channelID = channel.id;
            break;
        case 2:
            output.log(`[0] Channel type 0`)
            channel = await createChannel(guild, cache.levels[roleLevel].affiliation.detail, roleName, 10000, role);
            output.log(`Channel created with id ${channel.id}`)
            cache.levels[roleLevel].content[roleName].channelID = channel.id;
            break;
    }
}

async function createRole(roleName, roleLevel, affiliationType, user) { // crate role according to new information
    // let name = roleName.replace(/ */, "");
    let name = roleName.toString();

    let guildsOAuth = await client.guilds.fetch();

    let roleID = -1; ////// THIS IS BAD !! THIS IS CONSIDERING ONLY ONE SERVER IS ACTIVE ON EACH INSTANCE

    cache.levels[roleLevel].content[roleName] = {}; // Create the placeholder

    await Promise.all(
        guildsOAuth.map(async (guildOAuth) => {
            let guild = await guildOAuth.fetch();

            let levelPosition = -1;
            output.log(`[*] Searching for level ${roleLevel} discriminator`)
            guild.roles.cache.forEach((role) => { // Search for the correct position
                if(role.name === ("---- level"+roleLevel.toString())) {
                    levelPosition = role.position;
                }
            });

            if(levelPosition === -1) { // If no position where found
                output.log("[*] Search ended with no results")
                let role = await guild.roles.create({                // creating role discriminator
                    name: ("---- level"+roleLevel.toString()),
                    color: "DEFAULT",
                    hoist: false,
                    permissions: guild.roles.everyone.permissions,
                    position: guild.roles.everyone.position,
                    mentionable: false,
                    reason: "No level where found"
                });

                output.log(`Created role #${role.id}, named ${role.name} at position #${role.position}`)

                levelPosition = role.position;
            } else {
                output.log("[*] Search ended with one result ")
            }

            roleID = await createFinalRole(guild, name, levelPosition, roleLevel);

            output.log("Starting Channel Creation ...")
            await handleChannelCreation(name, roleLevel, affiliationType, guild, user, roleID);
        })
    )

    return roleID
}

function postRoleApplication(state, user) {
    if(state >= (cache.levels.length-1)) { // Last information
        client.channels.fetch(cache.activeComm[user.id].DMChannelID)
            .then((DMChannel) => {
                DMChannel.send(format(config.messages.lastMessage));
            })

        cache.activeComm[user.id].state = -1; // we finish the thing

        output.log("[!] Registration ended ! ");
    } else {
        cache.activeComm[user.id].state += 1;
        output.log("[~] Going to next step");
        procedure(user);
    }

    refreshCache();
}

async function applyRoles(user, rolesIDs, state) {
    let guildsOAuth = await client.guilds.fetch();

    await Promise.all(guildsOAuth.map(async (guildOAuth) => {
        let guild = await guildOAuth.fetch();
        output.log(`[^] Applying for ${guild.name}`);
        let member = await guild.members.search({query: user.username});

        await Promise.all(member.map(async (val, key, map) => {
            let member = await val.roles.add(rolesIDs, "Updated profile trough bot");
            output.log(`${member.user.username} has been updated successfully with ${rolesIDs.join(", ")}`)
        }));
    }));
}

async function processChoice(user, reply) {
    output.log(`User ${user.username} choose ${reply.join(", ")}`);
    let state = cache.activeComm[user.id].state;
    let affiliationType = cache.levels[state].affiliation.type;

    await Promise.all(reply.map(async (r) => {
        if(isChar(r)) {
            output.log("[$] Creating Role");
            let id = await createRole(r, state, affiliationType, user);

            output.log("[$] Applying role after creation")
            await applyRoles(user, [id], state);
        } else {
            let id = cache.levels[state].content[Object.keys(cache.levels[state].content)[parseInt(r)]].id;

            output.log("[.] Applying already existing role")
            await applyRoles(user, [id], state);
        }

        if(affiliationType === 0) {
            output.log(`Caching lastAffiliation`)
            // cache.activeComm[user.id].lastAffiliation = cache.levels[state].content[Object.keys(cache.levels[state].content)[parseInt(r)]].affiliation;
            let index = (isChar(r) ? r : Object.keys(cache.levels[state].content)[parseInt(r)]);
            cache.activeComm[user.id].lastAffiliation = cache.levels[state].content[index].affiliation;
        }
    }));

    postRoleApplication(state, user);
}

async function handleResponse(user, message) { // If this function is called, the user is registered in cache, no verification needed in this case
    let ct = message.content.replace(/ */, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(/[,.;:]/gm, " ").replaceAll(/\s+/gm, " "); // Delete blank spaces before msg
    let state = cache.activeComm[user.id].state;

    let reply = ct.split(" ");

    let replyD = reply;  // reply with maybe some duplicates
    reply = uniq(reply); // Delete duplicates

    let stdQTY = cache.levels[state].qty;
    let maxId = Object.keys(cache.levels[state].content).length;

    // STD QTY OVERRIDE
    // If affiliation.type is 0, then stdQTY = 1
    if(cache.levels[state].affiliation.type === 0 && stdQTY > 1) {
        stdQTY = 1;
    }
    ///////////////////////////////////////////////

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
    // if(reply.some((element) => {
    //     return !(isNaN(parseInt(element)) || parseInt(element) < maxId)   // If string -> false, if id <= maxId -> false, else -> true
    // })) {
    //     error = format(config.messages.atLeastOneIdIsWrong)
    // }
    let flag = false;
    reply.forEach((element) => {
        flag = flag || parseInt(element) > maxId;  // flag = true if index not correct
        flag = flag && !(isChar(element));         // flag = false if string (!important)
    });
    if(flag) {
        error = format(config.messages.atLeastOneIdIsWrong);
    }

    if(error !== "") {
        await message.reply(error);
        output.log(`An error occured with ${user.username}#${user.tag}, replied ${error}`);
    } else {
        await processChoice(user, reply);
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
    output.log(`Handling new user ... ${user.username}`);

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

async function commandHandler(msg, message, isMP) { // Handles every commands (starting with "!")
    output.log(`New command ${msg}`)
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
            break;
        case "cleanhere":
            // await clean(message);
            output.log("Aborted cleaning");
            break;
    }
}

client.on("guildMemberAdd", (member) => { // Whenever someone joins the server
    handleNewUser(member.user, false)
})

client.on("messageCreate", async (message) => { // Whenever someone send a message
    if(!message.author.bot) {
        output.log(`New message from ${message.author.username} on ${message.guildId} : ${message.content}`);

        let msg = message.content.toLowerCase().replace(/ */, ""); // Deletes every spaces before the message
        if(msg[0] === discriminator) {
            await commandHandler(msg, message, (message.guildId === null));
        }
        else {
            if(checkIfInProcedure(message.author) && (message.guildId === null)) { // If DM + in procedure
                await handleResponse(message.author, message);
            }
        }
    }
})

let logChannel = -1;

client.login(process.env.TOKEN) // Entrypoint
    .then(async (r) => {
        if(Object.keys(config).includes("log")) {
            if(Object.keys(config.log).includes("channel") {
                output.log("! Searching for log channel ...");
                let channels = await client.channels.fetch();
                await Promise.all(channels.map(async (channel) => {
                    if(channel.id == config.log.channel) {
                        output.log(`! Found one channel : ${channel.name}`);
                        logChannel = channel;
                    }
                })); 
            }
        }
        
        if(logChannel !== -1) {
            output.log("[^] Overriding output.log for discord log");
        
            output = {log: (message) => {console.log(message); logChannel.send(message)}};
            output.error = output.log; // Working ... I guess
            output.warn =  output.log;
        }
        
        output.log("[*] Restoring DM ... ");
        if(Object.keys(cache.activeComm).length > 0) {
            for (let [id, value] of Object.entries(cache.activeComm)) {
                output.log(`Restoring ... #${value.DMChannelID}`);
                await client.channels.fetch(value.DMChannelID);
            }
        }

        output.log("JEAN MAURICE IS UP !");
    })
    .catch(output.error);

function exitHandler(options, exitCode) { // Whenever the bot stops
    if (options.cleanup) {
        output.log('----- STOPPING -----');

        refreshCache(); output.log("[!] Cache saved")
    }
    if (exitCode || exitCode === 0) output.log(exitCode);
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
