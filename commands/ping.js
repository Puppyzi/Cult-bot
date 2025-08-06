const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with latency information!'),
    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const pingTime = sent.createdTimestamp - interaction.createdTimestamp;
        
        await interaction.editReply(`Connection:\n--> Bot Latency: ${pingTime}ms\n--> API Latency: ${Math.round(interaction.client.ws.ping)}ms`);
    },
};