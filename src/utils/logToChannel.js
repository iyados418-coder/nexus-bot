const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

async function logToChannel(client, embedData) {
  try {
    const logChannel = client.channels.cache.get(config.channels.log);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setTimestamp()
      .setFooter({ text: config.serverName });

    Object.entries(embedData).forEach(([key, value]) => {
      if (key === 'color') embed.setColor(value);
      else if (key === 'title') embed.setTitle(value);
      else if (key === 'description') embed.setDescription(value);
      else if (key === 'fields') embed.addFields(value);
      else if (key === 'author') embed.setAuthor(value);
      else if (key === 'thumbnail') embed.setThumbnail(value);
      else if (key === 'image') embed.setImage(value);
      else if (key === 'footer') embed.setFooter(value);
      else if (key === 'timestamp') {}
    });

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Log channel error:', error.message);
  }
}

module.exports = { logToChannel };
