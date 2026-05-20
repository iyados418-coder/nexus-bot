const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const config = require('../../config');
const logger = require('../utils/logger');

function getClient(interaction) {
  return interaction.client;
}

async function logToChannel(client, data) {
  const channel = client.channels.cache.get(config.channels.log);
  if (!channel) return;
  try {
    const embed = new EmbedBuilder()
      .setColor(data.color || config.colors.white)
      .setTimestamp();
    if (data.title) embed.setTitle(data.title);
    if (data.description) embed.setDescription(data.description);
    if (data.fields) embed.addFields(data.fields);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error(`Log send failed: ${err.message}`);
  }
}

async function handleDMUser(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const client = getClient(interaction);

  try {
    const user = interaction.options.getUser('user');
    const message = interaction.options.getString('message');
    const embedTitle = interaction.options.getString('embed_title');
    const embedDesc = interaction.options.getString('embed_description');
    const linkLabel = interaction.options.getString('link_label');
    const linkUrl = interaction.options.getString('link_url');

    if (!message && !embedTitle && !embedDesc) {
      return interaction.editReply({ content: 'You must provide a message or embed content.' });
    }

    const dmChannel = await user.createDM();
    const components = [];

    if (embedTitle || embedDesc) {
      const embed = new EmbedBuilder()
        .setColor(config.colors.white);
      if (embedTitle) embed.setTitle(embedTitle);
      if (embedDesc) embed.setDescription(embedDesc);
      embed.setTimestamp();

      const row = new ActionRowBuilder();
      if (linkLabel && linkUrl) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel(linkLabel)
            .setURL(linkUrl)
            .setStyle(ButtonStyle.Link)
        );
        components.push(row);
      }

      await dmChannel.send({ embeds: [embed], components });
    }

    if (message) {
      await dmChannel.send(message);
    }

    await logToChannel(client, {
      title: 'DM Sent',
      color: config.colors.white,
      fields: [
        { name: 'To', value: `${user.tag} (<@${user.id}>)`, inline: true },
        { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Content', value: message || embedDesc || embedTitle || 'Embed only' },
      ],
    });

    logger.info(`DM sent to ${user.tag} by ${interaction.user.tag}`);
    await interaction.editReply({ content: `Message sent to ${user.tag}.` });
  } catch (err) {
    logger.error(`DM error: ${err.message}`);
    await interaction.editReply({ content: 'Failed to send DM. User may have DMs disabled.' });
  }
}

async function handleDMAll(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const client = getClient(interaction);

  try {
    const message = interaction.options.getString('message');
    const embedTitle = interaction.options.getString('embed_title');
    const embedDesc = interaction.options.getString('embed_description');
    const linkLabel = interaction.options.getString('link_label');
    const linkUrl = interaction.options.getString('link_url');

    if (!message && !embedTitle && !embedDesc) {
      return interaction.editReply({ content: 'You must provide a message or embed content.' });
    }

    const guild = interaction.guild;
    const members = await guild.members.fetch();
    const botId = client.user.id;

    let sent = 0;
    let failed = 0;

    await interaction.editReply({ content: 'Sending DMs to all members... This may take a while.' });

    const batchSize = 5;
    const memberArray = [...members.values()].filter(m => !m.user.bot && m.id !== botId);

    for (let i = 0; i < memberArray.length; i += batchSize) {
      const batch = memberArray.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(async (member) => {
        try {
          const dmChannel = await member.user.createDM();
          if (embedTitle || embedDesc) {
            const embed = new EmbedBuilder()
              .setColor(config.colors.white);
            if (embedTitle) embed.setTitle(embedTitle);
            if (embedDesc) embed.setDescription(embedDesc);
            embed.setTimestamp();

            const components = [];
            const row = new ActionRowBuilder();
            if (linkLabel && linkUrl) {
              row.addComponents(
                new ButtonBuilder()
                  .setLabel(linkLabel)
                  .setURL(linkUrl)
                  .setStyle(ButtonStyle.Link)
              );
              components.push(row);
            }

            await dmChannel.send({ embeds: [embed], components });
          }
          if (message) {
            await dmChannel.send(message);
          }
          sent++;
        } catch {
          failed++;
        }
      }));
    }

    await logToChannel(client, {
      title: 'Mass DM Sent',
      color: config.colors.white,
      fields: [
        { name: 'Sent By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Success', value: `${sent} members`, inline: true },
        { name: 'Failed', value: `${failed} members`, inline: true },
      ],
    });

    logger.info(`Mass DM: ${sent} sent, ${failed} failed`);
    await interaction.editReply({ content: `Mass DM complete. **${sent}** sent, **${failed}** failed.` });
  } catch (err) {
    logger.error(`Mass DM error: ${err.message}`);
    await interaction.editReply({ content: 'Failed to send mass DM: ' + err.message });
  }
}

module.exports = { handleDMUser, handleDMAll };
