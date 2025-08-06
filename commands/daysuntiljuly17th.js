const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daysuntiljuly17th')
        .setDescription('Replies with how many days until the next July 17th.'),
    async execute(interaction) {
        // Get the interaction's creation date
        const messageDate = interaction.createdAt;

        // Get current year
        const currentYear = messageDate.getFullYear();

        // Set target date as July 17th of the current year
        let targetDate = new Date(currentYear, 6, 17); // Months are 0-based in JS (6 = July)

        // If message date is on or after July 17th, target next year's July 17th
        if (messageDate >= targetDate) {
            targetDate = new Date(currentYear + 1, 6, 17);
        }

        // Calculate the difference in days
        const timeDifference = targetDate - messageDate; // Difference in milliseconds
        const daysDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24)); // Convert to days

        // Send response
        await interaction.reply(`There are ${daysDifference} days until the next July 17th.`);
    },
};