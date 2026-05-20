const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const logger = require('../utils/logger');

async function handleWelcomeMessage(member, client) {
  try {
    const welcomeChannel = member.guild.channels.cache.get(config.channels.welcome);
    if (!welcomeChannel) {
      return logger.warn('Welcome channel not found');
    }

    const memberCount = member.guild.memberCount;
    const createdTimestamp = Math.floor(member.user.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setTitle(`Welcome to ${config.serverName}`)
      .setDescription(
        [
          `Hey <@${member.id}>, welcome to **${config.serverName}!**`,
          '',
          `You are our **${memberCount}th** member.`,
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          '📜 **Read the Rules**',
          `Before anything else, please review our rules: <#${config.channels.rules}>`,
          '',
          '🎫 **Need Support?**',
          `Open a ticket in <#${config.channels.ticket}> and our team will assist you.`,
          '',
          '💬 **Introduce Yourself**',
          'Feel free to chat and make yourself at home.',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━',
        ].join('\n')
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: '📋 Rules',
          value: `<#${config.channels.rules}>`,
          inline: true,
        },
        {
          name: '🎫 Support',
          value: `<#${config.channels.ticket}>`,
          inline: true,
        },
        {
          name: '📅 Account',
          value: `Created <t:${createdTimestamp}:R>`,
          inline: true,
        }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Read the Rules')
        .setURL(`https://discord.com/channels/${member.guild.id}/${config.channels.rules}`)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Open a Ticket')
        .setURL(`https://discord.com/channels/${member.guild.id}/${config.channels.ticket}`)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Website')
        .setURL(config.websiteUrl)
        .setStyle(ButtonStyle.Link)
    );

    await welcomeChannel.send({
      content: `<@${member.id}>`,
      embeds: [embed],
      components: [row],
    });

    logger.info(`Welcome sent to ${member.user.tag}`);
  } catch (error) {
    logger.error(`Welcome error: ${error.message}`);
  }
}

module.exports = { handleWelcomeMessage };
