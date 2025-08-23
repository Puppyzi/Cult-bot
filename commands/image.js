// commands/image.js
const { SlashCommandBuilder } = require('discord.js');
const aiplatform = require('@google-cloud/aiplatform');
const { PredictionServiceClient } = aiplatform.v1;
const { helpers } = aiplatform;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Generate an AI image from a prompt (Google Cloud Vertex AI Imagen)')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Describe the image you want to generate')
        .setRequired(true)
    ),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');
    await interaction.deferReply();

    try {
      const projectId = process.env.PROJECT_ID;
      const location = process.env.LOCATION || 'us-central1';

      // Create Vertex AI Prediction client
      const client = new PredictionServiceClient({
        apiEndpoint: `${location}-aiplatform.googleapis.com`,
      });

      // Imagen model endpoint
      const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001`;

      // Prepare request
      const instances = [helpers.toValue({ prompt })];
      const parameters = helpers.toValue({
        sampleCount: 1,
        aspectRatio: '1:1',
      });

      // Call Vertex AI
      const [response] = await client.predict({
        endpoint,
        instances,
        parameters,
      });

      const preds = response.predictions || [];
      if (!preds.length) {
        await interaction.editReply('⚠️ No image generated. Try a different prompt.');
        return;
      }

      // Extract image
      const fields = preds[0].structValue.fields;
      const b64 = fields?.bytesBase64Encoded?.stringValue;

      if (!b64) {
        await interaction.editReply('⚠️ No image data found in the response.');
        return;
      }

      const buffer = Buffer.from(b64, 'base64');

      // Send back to Discord
      await interaction.editReply({
        content: `Here’s your AI image for: **${prompt}**`,
        files: [{ attachment: buffer, name: 'generated.png' }],
      });

    } catch (err) {
      console.error('[Imagen] Generation error:', err);
      await interaction.editReply(
        `❌ Error while generating image:\n\`\`\`${err.message || err}\`\`\``
      );
    }
  },
};
