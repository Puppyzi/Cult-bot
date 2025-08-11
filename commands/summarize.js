const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summarize')
        .setDescription('An attempt to summarize messages in a channel using AI.')
        .addChannelOption(option =>
            option
            .setName('channel')
            .setDescription('The channel to summarize messages from.')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(option =>
            option
            .setName('timeframe')
            .setDescription('The timeframe to summarize (e.g., day, week, month, year)')
            .setRequired(false)
            .addChoices(
                { name: 'Day', value: 'day' },
                { name: 'Week', value: 'week' },
                { name: 'Month', value: 'month' },
                { name: 'Year', value: 'year' }
            )
        ),

    async execute(interaction) {
        
        const channel = interaction.options.getChannel('channel');
        const timeFrame = interaction.options.getString('timeframe') || 'day';

        const timeLimits = {
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000,
            year: 365 * 24 * 60 * 60 * 1000
        };
        const timeLimit = timeLimits[timeFrame] || timeLimits.day;

        try {
            const messages = await channel.messages.fetch({ limit: 100 }); //means will fetch latest 50 messages within that timeframe
            const text = messages
                .filter(m => !m.author.bot && m.content.length > 5 && m.createdTimestamp > Date.now() - timeLimit) //means characters less than 10, will be ignored.
                .map(m => m.content)
                .join(' ');
            
            if (text.length === 0) {
                return interaction.reply({
                content: `No relevant messages found in ${channel.toString()} for the specified timeframe (${timeFrame}).`,
                ephemeral: true
                });
            }

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
            await interaction.reply(`Summary of ${channel.toString()} (${timeFrame}):\n${summary}`);

        } catch (err) {
            console.error("Error summarizing:", err);
             await interaction.reply({
                content: 'Error summarizing channel. Check my permissions or API status!',
                ephemeral: true
        });
    }
    }
};