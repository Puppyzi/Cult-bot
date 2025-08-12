const { SlashCommandBuilder, ChannelType, PermissionsBitField, InteractionResponseType } = require('discord.js');

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
        
        console.log(`[${new Date().toISOString()}] Starting /summarize command for user ${interaction.user.id}`);
        try {
            await interaction.deferReply();
            console.log(`[${new Date().toISOString()}] Interaction deferred.`);
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to defer reply:`, err);
            return; // Exit early to avoid further errors
        }

        try {
        const channel = interaction.options.getChannel('channel');
        console.log(`[${new Date().toISOString()}] Channel selected: ${channel?.name} (ID: ${channel?.id})`);
        const timeFrame = interaction.options.getString('timeframe') || 'day';
        console.log(`[${new Date().toISOString()}] Timeframe: ${timeFrame}`);

        // Channel Validation
        if (!channel || !channel.isTextBased()) {
                console.log(`[${new Date().toISOString()}] Invalid channel:`, channel);
                return interaction.editReply({ content: 'Please select a valid text channel!' });
        }

        // Permission Check
        if (!channel.permissionsFor(interaction.client.user).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory])) {
                console.log(`[${new Date().toISOString()}] Missing permissions in channel: ${channel.name}`);
                return interaction.editReply({ content: 'I need View Channel and Read Message History permissions!' });
        }

        const timeLimits = {
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000,
            year: 365 * 24 * 60 * 60 * 1000
        };
        const timeLimit = timeLimits[timeFrame] || timeLimits.day;
        console.log(`[${new Date().toISOString()}] Current time: ${Date.now()}, Time limit: ${Date.now() - timeLimit}, Timeframe: ${timeFrame}`);
        console.log(`[${new Date().toISOString()}] Fetching messages...`);

        let messages;
            try {
                // Added timeout for message fetch
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout
                messages = await channel.messages.fetch({ limit: 100, signal: controller.signal });
                clearTimeout(timeoutId);
                console.log(`[${new Date().toISOString()}] Fetched ${messages.size} messages.`);
            } catch (err) {
                console.error(`[${new Date().toISOString()}] Failed to fetch messages:`, err);
                return interaction.editReply({ content: 'Failed to fetch messages. Check my permissions or try another channel.' });
            }

            // Added debug for filtered messages with relaxed filter
            const filteredMessages = messages.filter(m => !m.author.bot && m.content.length > 0 && m.createdTimestamp > Date.now() - timeLimit);
            console.log(`[${new Date().toISOString()}] Filtered ${filteredMessages.size} messages:`, filteredMessages.map(m => ({ content: m.content, timestamp: new Date(m.createdTimestamp) })));

            const text = filteredMessages
                .map(m => m.content)
                .join(' ');
            console.log(`[${new Date().toISOString()}] Filtered text length: ${text.length} characters.`);

            // Fixed if block to handle no messages
            if (text.length === 0) {
                console.log(`[${new Date().toISOString()}] No relevant messages found.`);
                return interaction.editReply({
                    content: `No relevant messages found in ${channel.toString()} for the specified timeframe (${timeFrame}).`
                });
            }

            console.log(`[${new Date().toISOString()}] Making Hugging Face API call...`);
            let response;
            try {
                // Added timeout to prevent API hang
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
                response = await fetch("https://api-inference.huggingface.co/models/facebook/bart-large-cnn", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY || ''}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ inputs: text.slice(0, 1100) }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                console.log(`[${new Date().toISOString()}] API response status: ${response.status}`);
            } catch (err) {
                console.error(`[${new Date().toISOString()}] API fetch error:`, err);
                return interaction.editReply({ content: 'Failed to reach Hugging Face API. Please try again later.' });
            }

            let result;
            try {
                result = await response.json();
                console.log(`[${new Date().toISOString()}] API response received:`, result);
            } catch (err) {
                console.error(`[${new Date().toISOString()}] Failed to parse API response:`, err);
                return interaction.editReply({ content: 'Error processing API response. Please try again.' });
            }

            // Added safer result handling
            const summary = result && Array.isArray(result) && result[0]?.summary_text ? result[0].summary_text : "Unable to generate summary.";
            await interaction.editReply(`Summary of ${channel.toString()} (${timeFrame}):\n${summary}`);
            console.log(`[${new Date().toISOString()}] Summary sent successfully.`);
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error summarizing:`, err);
        
            try {
                await interaction.editReply({
                    content: 'Error summarizing channel. Check my permissions or API status!'
                });
            } catch (editErr) {
                console.error(`[${new Date().toISOString()}] Failed to send error reply:`, editErr);
            }
        }
    }
};