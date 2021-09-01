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
    console.log(`Cleaning sender (${message.author.username}) roles`)
    await message.member.edit({roles: []});

    console.log("### Fetching channels ...")
    let channels = await message.guild.channels.fetch();

    console.log("### Begin check ...")
    await Promise.all(channels.map(async (channel) => {
        console.log(`checking ${channel.id}`);
        if (!channelList.includes(channel.id.toString())) {
            await channel.delete();
            console.log(" - deleted")
        }
    }));

    console.log("### Fetching roles ...")
    let roles = await message.guild.roles.fetch();

    console.log("### Begin check ...")
    await Promise.all(roles.map(async (role) => {
        console.log(`checking ${role.id}`)
        if (!roleList.includes(role.id.toString())) {
            await role.delete();
            console.log(" - deleted");
        }
    }))

    console.log("### Cleaning cache.json ...");
    fs.writeFileSync("./cache.json", fs.readFileSync("./cache.json.save"))

    console.log("finished")
}

client.on("messageCreate", async (message) => {
    if(message.content === "!clean") {
        await clean(message);
    }
})

client.login(process.env.TOKEN) // Entrypoint
    .then(async (r) => {
        console.warn("waiting for cleaning message")
    })
    .catch(console.error);