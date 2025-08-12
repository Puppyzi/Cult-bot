require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
// Use dynamic import for node-fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Added global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
    console.error(`[${new Date().toISOString()}] Uncaught Exception:`, err);
});
process.on('unhandledRejection', (err) => {
    console.error(`[${new Date().toISOString()}] Unhandled Rejection:`, err);
});

const deployCommands = async () => {
    try {
        const commands = [];

        const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(`./commands/${file}`);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.log(`WARNING: The command at ${file} is missing a required 'data' or 'execute' property.`);
            }
        }
    

    const rest = new REST().setToken(process.env.BOT_TOKEN);

    console.log(`Started refreshing application slash commands globally.`);

    const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
    );

    console.log('Successfully reloaded all commands!');
    } catch (error) {
        console.error('Error deploying commands:', error)
    }
}

const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Collection,
    ActivityType,
    PresenceUpdateStatus,
    Events
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember
    ]
});

client.commands = new Collection();



const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`The Command ${filePath} is missing a required "data" or "execute" property.`)
    }
}

// cooldown for rapid commands
const cooldowns = new Map();    

client.once(Events.ClientReady, async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    //Deploy Commands
    await deployCommands();
    console.log(`Commands deployed globally.`);

    const statusType = process.env.BOT_STATUS || 'online';
    const activityType = process.env.ACTIVITY_TYPE || ''; //constant activity_type should be 'Playing'.
    const activityName = process.env.ACTIVITY_NAME || ''; //constant should be 'Discord'

    const activityTypeMap = {
        'PLAYING': ActivityType.Playing,
        'WATCHING': ActivityType.Watching,
        'LISTENING': ActivityType.Listening,
        'STREAMING': ActivityType.Streaming,
        'COMPETING': ActivityType.Competing
    };

    const statusMap = {
        'online': PresenceUpdateStatus.Online,
        'idle': PresenceUpdateStatus.Idle,
        'dnd': PresenceUpdateStatus.DoNotDisturb,
        'invisible': PresenceUpdateStatus.Invisible
    };

    client.user.setPresence({
        status: statusMap[statusType],
        activities: [{
            name: activityName,
            type: activityTypeMap[activityType]
        }]
    });
    
    console.log(`Bot status set to: ${statusType}`);
    console.log(`Activity set to: ${activityType} ${activityName}`)
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        // console.error(`No command matching ${interaction.commandName} was found.`)
        return;
    }

    // cooldown check to prevent rapid commands
    const now = Date.now();
    const cooldownAmount = 5000; // 5-second cooldown per user
    const userId = interaction.user.id;
    if (cooldowns.has(userId)) {
        const expirationTime = cooldowns.get(userId);
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            try {
                await interaction.reply({ content: `Please wait ${timeLeft.toFixed(1)} seconds before using /${interaction.commandName} again.`, flags: 64 });
            } catch (err) {
                console.error(`[${new Date().toISOString()}] Failed to send cooldown reply:`, err);
            }
            return;
        }
    }
    cooldowns.set(userId, now + cooldownAmount);
    setTimeout(() => cooldowns.delete(userId), cooldownAmount);

    try {
        console.log(`[${new Date().toISOString()}] Executing ${interaction.commandName} for user ${interaction.user.id}...`);
        await command.execute(interaction);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error executing ${interaction.commandName}:`, error);
        try {
            if (interaction.deferred) {
                await interaction.editReply({ content: 'There was an error while executing this command!' });
            } else if (!interaction.replied) {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: 64 });
            }
        } catch (replyError) {
            console.error(`[${new Date().toISOString()}] Failed to send error reply:`, replyError);
        }
    }
});

// message event for testing
client.on("messageCreate", msg => {
    if (msg.author.bot) return; // Ignore bot messages
    if (msg.content.toLowerCase() === "july 17th") {
        msg.reply("Nothing ever happens")
    }
});

client.on("guildMemberAdd", member => {
    const channel = member.guild.channels.cache.find(ch => ch.name === "没问题"); // Replace with your channel name in double " "
    if (channel) {
        channel.send(`Welcome ${member.user.tag} to The cult!\nPlease read the rules in #rules.`);
    }
});


client.login(process.env.BOT_TOKEN);