require("dotenv").config();
const fs = require("fs");
const {Client, Intents} = require("discord.js");
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

let config = JSON.parse(fs.readFileSync("./config.json"));

function format(str) {
    let s = str
    for(let [key, value] of Object.entries(config.replace)) {
        s = s.replaceAll(key, value);
    }

    return s
}

function handleNewUser(member) {
    console.log(`Handling new user ... ${member.user.username}`);

    member.user.send(format(config.welcomeMessage))
}

function commandHandler(msg, message) {
    console.log(`New command ${msg}`)
    let ct = msg.split(" ");
    switch (ct[0].substring(discriminator.length)) {
        case "newuser":
            handleNewUser(message.member);
            break;
    }
}

client.on("guildMemberAdd", (member) => {
    handleNewUser(member)
})

client.on("messageCreate", (message) => {
    /* console.log(`${message.author.username} : ${message.content}`)
    if(!message.author.bot) {
        message.reply("Truc")
            .then(() => console.log(`Replied to message "${message.content}"`))
            .catch(console.error);
    } */
    if(!message.author.bot) {
        let msg = message.content.toLowerCase().replace(/ */, "");
        if(msg[0] === discriminator) {
            commandHandler(msg, message);
        }
    }
})

client.login(process.env.TOKEN)
    .then(r => console.log("JEAN MAURICE IS UP !"))
    .catch(console.error)