require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
// Use dynamic import for node-fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));



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

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true});
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true});
        }
    }
});

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

// AI Summarization Command
client.on("messageCreate", async msg => {
    if (msg.author.bot) return;
    if (msg.content.startsWith("!summarize")) {
        const args = msg.content.split(" ").slice(1);
        const channelMention = msg.mentions.channels.first();
        const timeFrame = args[1]?.toLowerCase() || "day";
        if (!channelMention) return msg.reply("Please mention a channel, e.g., `!summarize #general day`");

        const timeLimits = {
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000,
            year: 365 * 24 * 60 * 60 * 1000
        };
        const timeLimit = timeLimits[timeFrame] || timeLimits.day;

        try {
            const messages = await channelMention.messages.fetch({ limit: 100 }); //means will fetch latest 50 messages within that timeframe
            const text = messages
                .filter(m => !m.author.bot && m.content.length > 5 && m.createdTimestamp > Date.now() - timeLimit) //means characters less than 10, will be ignored.
                .map(m => m.content)
                .join(" ");
            
            if (text.length === 0) return msg.reply("No relevant messages found in the specified timeframe.");

            // Hugging Face API call
            const response = await fetch("https://api-inference.huggingface.co/models/facebook/bart-large-cnn", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`, //my API key
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ inputs: text.slice(0, 1100) }) // Limit input size to 1000 characters
            });
            const result = await response.json();
            const summary = result[0]?.summary_text || "Unable to generate summary.";
            msg.reply(`Summary of #${channelMention.name} (${timeFrame}):\n${summary}`);
        } catch (err) {
            console.error("Error summarizing:", err);
            msg.reply("Error summarizing channel. Check my permissions or API status!");
        }
    }

});


client.login(process.env.BOT_TOKEN);