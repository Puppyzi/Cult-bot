const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("4-1_mini")
    .setDescription("Ask GPT-4.1 mini anything (Knowledge Cutoff Jun 01, 2024)")
    .addStringOption(option =>
      option.setName("prompt")
        .setDescription("Your question or message")
        .setRequired(true)
    ),
  
  async execute(interaction) {
    const prompt = interaction.options.getString("prompt");

    await interaction.deferReply(); // Prevent timeout

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt }
        ]
      });

      const reply = `**${prompt}**:\n\n${completion.choices[0].message.content}`;
      await interaction.editReply(reply);

    } catch (err) {
      console.error("❌ OpenAI API error:", err);
      await interaction.editReply("⚠️ Something went wrong while contacting GPT-4.1 mini.");
    }
  }
};
