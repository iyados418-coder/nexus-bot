const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../../config');
const logger = require('../utils/logger');

async function handleVerifyPanel(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const embed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setDescription([
        '━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        `**${config.serverName} — Verification**`,
        '',
        'Click the button below to verify yourself and gain access to the server.',
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_user')
        .setLabel('Verify')
        .setStyle(ButtonStyle.Success)
        .setEmoji({ name: '✅' }),
      new ButtonBuilder()
        .setLabel('Website')
        .setURL(config.websiteUrl)
        .setStyle(ButtonStyle.Link)
    );

    await interaction.editReply({ content: 'Verification panel has been sent below.' });
    await interaction.channel.send({ embeds: [embed], components: [row] });
    logger.info(`Verification panel sent in #${interaction.channel.name}`);
  } catch (error) {
    logger.error(`Verify panel error: ${error.message}`);
    await interaction.editReply({ content: 'Failed to send panel.' }).catch(() => {});
  }
}

async function handleVerifyButton(interaction, client) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const member = await interaction.member.fetch().catch(() => interaction.member);
    const verifiedRoleId = config.roles.verified;

    if (!verifiedRoleId) {
      return interaction.editReply({ content: 'Verification system is not configured properly. Please contact an administrator.' });
    }

    const role = await member.guild.roles.fetch(verifiedRoleId).catch(() => member.guild.roles.cache.get(verifiedRoleId));
    if (!role) {
      return interaction.editReply({ content: 'Verified role not found. Please contact an administrator.' });
    }

    if (member.roles.cache.has(verifiedRoleId)) {
      return interaction.editReply({ content: 'You are already verified!' });
    }

    await member.roles.add(role);
    logger.info(`${member.user.tag} has been verified`);

    const dmEmbed = new EmbedBuilder()
      .setColor(config.colors.green)
      .setDescription(
        [
          `━━━━━━━━━━━━━━━━━━━━━━━━`,
          '',
          `**✅ You have been verified!**`,
          '',
          `Welcome to **${config.serverName}**.`,
          `You now have full access to the server.`,
          '',
          `━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n')
      )
      .setTimestamp();

    const dmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Visit Website')
        .setURL(config.websiteUrl)
        .setStyle(ButtonStyle.Link)
    );

    try {
      await member.send({ embeds: [dmEmbed], components: [dmRow] });
      logger.info(`Verification DM sent to ${member.user.tag}`);
    } catch (dmErr) {
      logger.warn(`Could not DM ${member.user.tag} — DMs may be closed`);
    }

    await interaction.editReply({ content: 'You have been successfully verified!' });

    const logChannelId = config.channels.verifyLog;
    if (logChannelId) {
      const logChannel = client.channels.cache.get(logChannelId);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(config.colors.green)
          .setDescription(
            [
              `━━━━━━━━━━━━━━━━━━━━━━━━`,
              '',
              `**✅ User Verified**`,
              '',
              `**User:** ${member.user.tag} (\`${member.user.id}\`)`,
              `**Mention:** <@${member.user.id}>`,
              `**Role:** ${role.name}`,
              `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`,
              '',
              `━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].join('\n')
          )
          .setTimestamp()
          .setFooter({ text: `ID: ${member.user.id}` });

        await logChannel.send({ embeds: [logEmbed] });
        logger.info(`Verification logged for ${member.user.tag}`);
      }
    }
  } catch (error) {
    logger.error(`Verify error for ${interaction.user.tag}: ${error.message}`);
    if (interaction.deferred) {
      await interaction.editReply({ content: 'An error occurred during verification. Please try again later.' }).catch(() => {});
    }
  }
}

module.exports = { handleVerifyPanel, handleVerifyButton };
