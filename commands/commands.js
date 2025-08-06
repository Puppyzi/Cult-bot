const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('Lists all Cult-bot commands'),
    async execute(interaction) {
        await interaction.reply('Commands:\n/commands - Lists all commands\n/ping - Check bot ping\n/kick - Kick a user\n/ban - Ban a user\n/daysuntiljuly17th - Check days until next July 17th\n!summarize');
    },
};