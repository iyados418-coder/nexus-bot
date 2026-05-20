const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const config = require('../../config');
const logger = require('../utils/logger');

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

function getNextTicketNumber(client) {
  const guild = client.guilds.cache.get(config.guildId);
  if (!guild) return Math.floor(Math.random() * 90000) + 10000;
  let max = 0;
  for (const [, c] of guild.channels.cache) {
    if (!c.name.startsWith('ticket-')) continue;
    const parts = c.name.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num) && num > max) max = num;
  }
  return max + 1;
}

async function sendTicketNotification(client, userId, category, ticketNum, channelId) {
  try {
    const user = await client.users.fetch(userId);
    const dmChannel = await user.createDM();
    const embed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setTitle('Ticket Created')
      .setDescription(
        [
          `Your **${category}** ticket has been created.`,
          '',
          `**Ticket ID:** #${ticketNum}`,
          `**Channel:** <#${channelId}>`,
          '',
          'A support team member will assist you shortly.',
        ].join('\n')
      )
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Go to Ticket')
        .setURL(`https://discord.com/channels/${config.guildId}/${channelId}`)
        .setStyle(ButtonStyle.Link)
    );
    await dmChannel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    logger.warn(`Could not DM ticket owner: ${err.message}`);
  }
}

async function sendReminderToOwner(client, channelId, staffMember) {
  try {
    const ticket = client.tickets.get(channelId);
    if (!ticket || !ticket.userId) return;
    const user = await client.users.fetch(ticket.userId);
    const dmChannel = await user.createDM();
    const embed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setTitle('Reminder — Please Respond')
      .setDescription(
        [
          `Staff member <@${staffMember.id}> is waiting for your response in your ticket.`,
          '',
          `**Ticket:** #${ticket.ticketNumber || ''}`,
          `**Category:** ${ticket.categoryLabel || 'Support'}`,
          '',
          'Please check your ticket and reply as soon as possible.',
        ].join('\n')
      )
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Open Ticket')
        .setURL(`https://discord.com/channels/${config.guildId}/${channelId}`)
        .setStyle(ButtonStyle.Link)
    );
    await dmChannel.send({ embeds: [embed], components: [row] });
    return true;
  } catch (err) {
    logger.warn(`Reminder DM failed: ${err.message}`);
    return false;
  }
}

async function createTicketChannel(interaction, client, category, reason) {
  const { guild, user } = interaction;
  const ticketNum = getNextTicketNumber(client);
  const channelName = `ticket-${category.value}-${ticketNum}`;
  const parentCat = category.categoryId ? guild.channels.cache.get(category.categoryId) : null;
  const adminRole = guild.roles.cache.get(config.roles.admin);
  const managerRole = guild.roles.cache.get(config.roles.manager);
  const support1 = guild.roles.cache.get(config.roles.support1);
  const support2 = guild.roles.cache.get(config.roles.support2);

  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  for (const role of [adminRole, managerRole].filter(Boolean)) {
    overwrites.push({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.MentionEveryone,
      ],
    });
  }

  for (const role of [support1, support2].filter(Boolean)) {
    overwrites.push({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parentCat?.id || null,
    permissionOverwrites: overwrites,
    topic: `Ticket #${ticketNum} | ${user.tag} | ${category.label}`,
  });

  const ticketData = {
    userId: user.id, userTag: user.tag, category: category.value,
    categoryLabel: category.label, reason, ticketNumber: ticketNum,
    createdAt: Date.now(), claimedBy: null, status: 'open', locked: false,
  };

  client.tickets.set(channel.id, ticketData);

  const supportMentions = [support1, support2].filter(Boolean).map((r) => `<@&${r.id}>`).join(' ');

  const openEmbed = new EmbedBuilder()
    .setColor(config.colors.white)
    .setTitle(`${category.label} — Ticket #${ticketNum}`)
    .setDescription(
      [
        `Hello <@${user.id}>,`,
        '',
        `Your **${category.label}** ticket has been created.`,
        'Our support team will be with you shortly.',
        '',
        `**User:** <@${user.id}>`,
        `**Category:** ${category.label}`,
        `**Reason:** ${reason}`,
        `**Ticket ID:** #${ticketNum}`,
        '',
        'Please provide any additional information below.',
      ].join('\n')
    )
    .setTimestamp();

  const manageRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_claim_${channel.id}`).setLabel('Claim').setEmoji(config.emojis.claim).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_remind_${channel.id}`).setLabel('Remind').setEmoji('🔔').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_lock_${channel.id}`).setLabel('Lock').setEmoji(config.emojis.lock).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_add_${channel.id}`).setLabel('Add').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_transcript_${channel.id}`).setLabel('Transcript').setEmoji(config.emojis.transcript).setStyle(ButtonStyle.Secondary),
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close_${channel.id}`).setLabel('Close').setEmoji(config.emojis.close).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket_delete_${channel.id}`).setLabel('Delete').setEmoji(config.emojis.delete).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket_user_close_${channel.id}`).setLabel('Close My Ticket').setEmoji(config.emojis.close).setStyle(ButtonStyle.Secondary),
  );

  await channel.send({
    content: `${supportMentions} <@${user.id}>`,
    embeds: [openEmbed],
    components: [manageRow, actionRow],
  });

  await logToChannel(client, {
    title: 'Ticket Created', color: config.colors.green,
    fields: [
      { name: 'User', value: `<@${user.id}>`, inline: true },
      { name: 'Category', value: category.label, inline: true },
      { name: 'Channel', value: `<#${channel.id}>`, inline: true },
      { name: 'Ticket ID', value: `#${ticketNum}`, inline: true },
    ],
  });

  logger.info(`Ticket #${ticketNum} created — ${category.label} — ${user.tag}`);
  sendTicketNotification(client, user.id, category.label, ticketNum, channel.id);
  return channel;
}

async function handleTicketModal(interaction, client) {
  const reason = interaction.fields.getTextInputValue('ticket_reason');
  const catValue = interaction.customId.replace('ticket_reason_modal_', '');
  const category = config.ticketCategories.find((c) => c.value === catValue);
  if (!category) return interaction.reply({ content: 'Invalid category.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  try {
    const channel = await createTicketChannel(interaction, client, category, reason);
    await interaction.editReply({ content: `Ticket created: ${channel}` });
  } catch (err) {
    logger.error(`Ticket creation failed: ${err.message}`);
    await interaction.editReply({ content: `Failed: ${err.message}` });
  }
}

async function handleTicketManager(interaction, client, persistCallback) {
  const { customId } = interaction;
  if (customId.startsWith('ticket_remind_')) return handleRemind(interaction, client);
  if (customId.startsWith('ticket_claim_')) return handleClaim(interaction, client, persistCallback);
  if (customId.startsWith('ticket_user_close_')) return handleClose(interaction, client, persistCallback);
  if (customId.startsWith('ticket_close_')) return handleClose(interaction, client, persistCallback);
  if (customId.startsWith('ticket_delete_')) return handleDelete(interaction, client, persistCallback);
  if (customId.startsWith('ticket_transcript_')) return handleTranscript(interaction, client);
  if (customId.startsWith('ticket_lock_')) return handleLock(interaction, client, persistCallback);
  if (customId.startsWith('ticket_unlock_')) return handleUnlock(interaction, client, persistCallback);
  if (customId.startsWith('ticket_add_')) return handleAddMember(interaction, client, persistCallback);
}

async function handleRemind(interaction, client) {
  const channelId = interaction.customId.replace('ticket_remind_', '');
  const hasAccess = interaction.member.roles.cache.has(config.roles.admin) ||
    interaction.member.roles.cache.has(config.roles.manager) ||
    interaction.member.roles.cache.has(config.roles.support1) ||
    interaction.member.roles.cache.has(config.roles.support2);
  if (!hasAccess) return interaction.reply({ content: 'No permission.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });
  const ok = await sendReminderToOwner(client, channelId, interaction.member);
  if (ok) {
    const embed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setDescription('Reminder sent to the ticket owner.');
    await interaction.channel.send({ embeds: [embed] });
    await interaction.editReply({ content: 'Reminder sent.' });
  } else {
    await interaction.editReply({ content: 'Could not send reminder. Owner may have DMs disabled.' });
  }
}

async function handleClaim(interaction, client, persist) {
  const channelId = interaction.customId.replace('ticket_claim_', '');
  const ticket = client.tickets.get(channelId) || {};
  const hasAccess = interaction.member.roles.cache.has(config.roles.admin) ||
    interaction.member.roles.cache.has(config.roles.manager) ||
    interaction.member.roles.cache.has(config.roles.support1) ||
    interaction.member.roles.cache.has(config.roles.support2);

  if (!hasAccess) {
    return interaction.reply({ content: 'No permission to claim.', ephemeral: true });
  }

  if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id)
    return interaction.reply({ content: `Already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });

  ticket.claimedBy = interaction.user.id;
  client.tickets.set(channelId, ticket);
  if (persist) persist();

  const embed = new EmbedBuilder()
    .setColor(config.colors.white)
    .setDescription(`Claimed by <@${interaction.user.id}>.`);
  await interaction.channel.send({ embeds: [embed] });

  await logToChannel(client, {
    title: 'Ticket Claimed', color: config.colors.orange,
    fields: [
      { name: 'Channel', value: `<#${channelId}>`, inline: true },
      { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    ],
  });

  logger.info(`Ticket claimed: ${channelId} by ${interaction.user.tag}`);
  return interaction.reply({ content: 'Ticket claimed.', ephemeral: true });
}

async function handleLock(interaction, client, persist) {
  const channelId = interaction.customId.replace('ticket_lock_', '');
  const ticket = client.tickets.get(channelId) || {};
  const hasAccess = interaction.member.roles.cache.has(config.roles.admin) ||
    interaction.member.roles.cache.has(config.roles.manager) ||
    interaction.member.roles.cache.has(config.roles.support1) ||
    interaction.member.roles.cache.has(config.roles.support2);
  if (!hasAccess) return interaction.reply({ content: 'No permission to lock.', ephemeral: true });

  ticket.locked = true;
  client.tickets.set(channelId, ticket);
  if (persist) persist();

  if (ticket.userId) {
    try {
      await interaction.channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false });
    } catch (err) { logger.error(`Lock permission error: ${err.message}`); }
  }

  const embed = new EmbedBuilder()
    .setColor(config.colors.orange)
    .setDescription(`Ticket locked by <@${interaction.user.id}>. Only staff can send messages.`);
  await interaction.channel.send({ embeds: [embed] });

  await logToChannel(client, {
    title: 'Ticket Locked', color: config.colors.orange,
    fields: [
      { name: 'Channel', value: `<#${channelId}>`, inline: true },
      { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
    ],
  });

  logger.info(`Ticket locked: ${channelId} by ${interaction.user.tag}`);
  return interaction.reply({ content: 'Ticket locked.', ephemeral: true });
}

async function handleUnlock(interaction, client, persist) {
  const channelId = interaction.customId.replace('ticket_unlock_', '');
  const ticket = client.tickets.get(channelId) || {};
  const hasAccess = interaction.member.roles.cache.has(config.roles.admin) ||
    interaction.member.roles.cache.has(config.roles.manager) ||
    interaction.member.roles.cache.has(config.roles.support1) ||
    interaction.member.roles.cache.has(config.roles.support2);
  if (!hasAccess) return interaction.reply({ content: 'No permission to unlock.', ephemeral: true });

  ticket.locked = false;
  client.tickets.set(channelId, ticket);
  if (persist) persist();

  if (ticket.userId) {
    try {
      await interaction.channel.permissionOverwrites.edit(ticket.userId, { SendMessages: null });
    } catch (err) { logger.error(`Unlock permission error: ${err.message}`); }
  }

  const embed = new EmbedBuilder()
    .setColor(config.colors.green)
    .setDescription(`Ticket unlocked by <@${interaction.user.id}>. All participants can send messages again.`);
  await interaction.channel.send({ embeds: [embed] });

  await logToChannel(client, {
    title: 'Ticket Unlocked', color: config.colors.green,
    fields: [
      { name: 'Channel', value: `<#${channelId}>`, inline: true },
      { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
    ],
  });

  logger.info(`Ticket unlocked: ${channelId} by ${interaction.user.tag}`);
  return interaction.reply({ content: 'Ticket unlocked.', ephemeral: true });
}

async function handleAddMember(interaction, client, persist) {
  const hasAccess = interaction.member.roles.cache.has(config.roles.admin) ||
    interaction.member.roles.cache.has(config.roles.manager) ||
    interaction.member.roles.cache.has(config.roles.support1) ||
    interaction.member.roles.cache.has(config.roles.support2);
  if (!hasAccess) return interaction.reply({ content: 'No permission.', ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`ticket_add_member_modal_${interaction.channel.id}`)
    .setTitle('Add Member to Ticket');
  const input = new TextInputBuilder()
    .setCustomId('ticket_add_member_id').setLabel('Enter the User ID to add')
    .setStyle(TextInputStyle.Short).setPlaceholder('Paste the Discord User ID here...')
    .setMinLength(17).setMaxLength(20).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleAddMemberModal(interaction, client, persist) {
  const targetId = interaction.fields.getTextInputValue('ticket_add_member_id');
  await interaction.deferReply({ ephemeral: true });
  try {
    const targetUser = await client.users.fetch(targetId);
    if (!targetUser) return interaction.editReply({ content: 'User not found.' });

    await interaction.channel.permissionOverwrites.edit(targetId, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
    });

    const embed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setDescription(`Added <@${targetId}> to the ticket.`);
    await interaction.channel.send({ embeds: [embed] });

    await logToChannel(client, {
      title: 'Member Added to Ticket', color: config.colors.white,
      fields: [
        { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
        { name: 'Added', value: `<@${targetId}>`, inline: true },
        { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
      ],
    });

    logger.info(`Added ${targetUser.tag} to ticket ${interaction.channel.id}`);
    await interaction.editReply({ content: `Added ${targetUser.tag} to the ticket.` });
  } catch (err) {
    logger.error(`Add member error: ${err.message}`);
    await interaction.editReply({ content: 'Failed to add member. Invalid ID or user not found.' });
  }
}

async function handleClose(interaction, client, persist) {
  const raw = interaction.customId;
  const channelId = raw.startsWith('ticket_user_close_') ? raw.replace('ticket_user_close_', '') : raw.replace('ticket_close_', '');
  const ticket = client.tickets.get(channelId) || {};
  const isUserClose = raw.startsWith('ticket_user_close_');
  const isAdmin = interaction.member.roles.cache.has(config.roles.admin) ||
    interaction.member.roles.cache.has(config.roles.manager);
  const isSupport1 = interaction.member.roles.cache.has(config.roles.support1);
  const isSupport2 = interaction.member.roles.cache.has(config.roles.support2);
  const isOwner = interaction.user.id === ticket.userId;

  if (isUserClose && !isOwner) return interaction.reply({ content: 'You can only close your own tickets.', ephemeral: true });
  if (!isUserClose && !isAdmin && !isSupport1 && !isSupport2) return interaction.reply({ content: 'No permission to close.', ephemeral: true });

  const embed = new EmbedBuilder()
    .setColor(config.colors.orange)
    .setTitle('Ticket Closed')
    .setDescription(`Closed by <@${interaction.user.id}>. The ticket is now locked. Use **Delete** to remove it permanently.`)
    .setTimestamp();
  await interaction.channel.send({ embeds: [embed] });

  if (ticket.userId) {
    try { await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: false, SendMessages: false }); }
    catch (err) { logger.error(`Permission edit failed: ${err.message}`); }
  }

  ticket.status = 'closed';
  client.tickets.set(channelId, ticket);
  if (persist) persist();

  try {
    const user = await client.users.fetch(ticket.userId).catch(() => null);
    if (user) {
      const dmEmbed = new EmbedBuilder()
        .setColor(config.colors.orange).setTitle('Ticket Closed')
        .setDescription(`Your ticket **#${ticket.ticketNumber || ''}** has been closed. If you need further assistance, please create a new ticket.`)
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
    }
  } catch (_) {}

  await logToChannel(client, {
    title: 'Ticket Closed', color: config.colors.orange,
    fields: [
      { name: 'Channel', value: `<#${channelId}>`, inline: true },
      { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'User', value: ticket.userId ? `<@${ticket.userId}>` : 'Unknown', inline: true },
      { name: 'Category', value: ticket.categoryLabel || 'Unknown', inline: true },
    ],
  });

  logger.info(`Ticket closed: ${channelId} by ${interaction.user.tag}`);
  return interaction.reply({ content: 'Ticket closed.', ephemeral: true });
}

async function handleDelete(interaction, client, persist) {
  const channelId = interaction.customId.replace('ticket_delete_', '');
  const ticket = client.tickets.get(channelId) || {};
  if (!interaction.member.roles.cache.has(config.roles.admin) && !interaction.member.roles.cache.has(config.roles.manager))
    return interaction.reply({ content: 'Only admins can delete tickets.', ephemeral: true });

  await logToChannel(client, {
    title: 'Ticket Deleted', color: config.colors.red,
    fields: [
      { name: 'Channel', value: `#${interaction.channel.name}`, inline: true },
      { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'User', value: ticket.userId ? `<@${ticket.userId}>` : 'Unknown', inline: true },
      { name: 'Category', value: ticket.categoryLabel || 'Unknown', inline: true },
    ],
  });

  client.tickets.delete(channelId);
  if (persist) persist();
  logger.info(`Ticket deleted: ${channelId} by ${interaction.user.tag}`);

  await interaction.reply({ content: 'Deleting in 3 seconds...' });
  setTimeout(async () => {
    try { await interaction.channel.delete(); }
    catch (err) { logger.error(`Delete failed: ${err.message}`); }
  }, 3000);
}

async function handleTranscript(interaction, client) {
  if (!interaction.member.roles.cache.has(config.roles.admin) && !interaction.member.roles.cache.has(config.roles.manager))
    return interaction.reply({ content: 'Admins only.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  try {
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    let text = `=== Ticket Transcript ===\nChannel: #${interaction.channel.name}\nDate: ${new Date().toLocaleString()}\n${'='.repeat(40)}\n\n`;
    for (const msg of sorted) {
      if (msg.author.bot && msg.embeds.length > 0) {
        text += `[BOT] ${msg.embeds[0].title || 'Embed'}: ${msg.embeds[0].description || ''}\n\n`;
        continue;
      }
      text += `[<t:${Math.floor(msg.createdTimestamp / 1000)}:T>] ${msg.author.tag}: ${msg.content}\n`;
      if (msg.attachments.size > 0) {
        for (const [, att] of msg.attachments) text += `  [Attachment] ${att.url}\n`;
      }
    }
    const buffer = Buffer.from(text, 'utf-8');
    await interaction.editReply({
      content: 'Here is the transcript:',
      files: [{ attachment: buffer, name: `transcript-${interaction.channel.name}.txt` }],
    });
    logger.info(`Transcript generated for ${interaction.channel.name}`);
  } catch (err) {
    logger.error(`Transcript error: ${err.message}`);
    await interaction.editReply({ content: 'Failed to generate transcript.' });
  }
}

module.exports = { handleTicketManager, handleTicketModal, handleAddMemberModal };
