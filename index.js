require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, ActivityType, REST, Routes, MessageFlags } = require('discord.js');
const config = require('./config');
const logger = require('./src/utils/logger');
const { loadTickets, saveTickets } = require('./src/utils/ticketStore');
const { handleTicketPanel, handleTicketSelect } = require('./src/handlers/ticketPanel');
const { handleTicketManager, handleTicketModal, handleAddMemberModal } = require('./src/handlers/ticketManager');
const { handleVoiceSystem } = require('./src/handlers/voiceSystem');
const { handleWelcomeMessage } = require('./src/handlers/welcomeMessage');
const { handleApplyPanel, handleAppStart, handleAppQuestion, handleAppAnswer, handleAppReview, handleAppReviewReason } = require('./src/handlers/applicationSystem');
const { handleDMUser, handleDMAll } = require('./src/handlers/dmSystem');
const { handleVerifyPanel, handleVerifyButton } = require('./src/handlers/verificationSystem');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: ['CHANNEL'],
});

client.tickets = loadTickets();
client.applications = new Map();

function persistTickets() {
  saveTickets(client.tickets);
}

client.once('clientReady', async () => {
  if (process.env.DATA_DIR) {
    try { fs.mkdirSync(process.env.DATA_DIR, { recursive: true }); } catch (_) {}
  }
  logger.divider();
  logger.success(`Logged in as ${client.user.tag}`);
  logger.info(`Servers: ${client.guilds.cache.size}`);
  logger.info(`Users: ${client.users.cache.size}`);
  logger.divider();

  client.user.setPresence({
    activities: [{
      name: `${config.serverName} — Support System`,
      type: ActivityType.Watching,
    }],
    status: 'dnd',
  });

  await registerCommands();

  const guild = client.guilds.cache.get(config.guildId);
  if (guild) {
    for (const [, channel] of guild.channels.cache) {
      if (channel.isTextBased() && channel.name.startsWith('ticket-') && !client.tickets.has(channel.id)) {
        client.tickets.set(channel.id, { status: 'open' });
      }
    }
    persistTickets();
    logger.info(`Tracking ${client.tickets.size} ticket channel(s)`);
  }

  if (config.voiceChannelId) {
    const voiceChannel = client.channels.cache.get(config.voiceChannelId);
    if (voiceChannel) {
      await handleVoiceSystem(client, voiceChannel);
    }
  }
});

async function registerCommands() {
  const commands = [
    {
      name: 'panel',
      description: 'Send the ticket panel to the current channel',
      default_member_permissions: '8',
    },
    {
      name: 'setup-voice',
      description: 'Join and stay in a voice channel 24/7',
      default_member_permissions: '8',
      options: [{
        name: 'channel',
        description: 'The voice channel to join',
        type: 7,
        required: true,
        channel_types: [2],
      }],
    },
    {
      name: 'apply-panel',
      description: 'Send the staff application panel to the current channel',
      default_member_permissions: '8',
    },
    {
      name: 'dm',
      description: 'Send a direct message to a user',
      default_member_permissions: '8',
      options: [
        { name: 'user', description: 'The user to DM', type: 6, required: true },
        { name: 'message', description: 'The message text to send', type: 3, required: false },
        { name: 'embed_title', description: 'Title of the embed', type: 3, required: false },
        { name: 'embed_description', description: 'Description of the embed', type: 3, required: false },
        { name: 'link_label', description: 'Label for the link button', type: 3, required: false },
        { name: 'link_url', description: 'URL for the link button', type: 3, required: false },
      ],
    },
    {
      name: 'verify-panel',
      description: 'Send the verification panel to the current channel',
      default_member_permissions: '8',
    },
    {
      name: 'dm-all',
      description: 'Send a mass DM to all server members',
      default_member_permissions: '8',
      options: [
        { name: 'message', description: 'The message text to send', type: 3, required: false },
        { name: 'embed_title', description: 'Title of the embed', type: 3, required: false },
        { name: 'embed_description', description: 'Description of the embed', type: 3, required: false },
        { name: 'link_label', description: 'Label for the link button', type: 3, required: false },
        { name: 'link_url', description: 'URL for the link button', type: 3, required: false },
      ],
    },
  ];

  try {
    const rest = new REST({ version: '10' }).setToken(config.token);
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
    logger.success('Slash commands registered');
  } catch (error) {
    logger.error(`Failed to register commands: ${error.message}`);
  }
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'panel') return await handleTicketPanel(interaction);
      if (interaction.commandName === 'setup-voice') {
        const channel = interaction.options.getChannel('channel');
        if (!channel) return interaction.reply({ content: 'Select a valid voice channel.', flags: MessageFlags.Ephemeral });
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await handleVoiceSystem(client, channel);
        return interaction.editReply({ content: `Connected to ${channel.name}. 24/7 mode active.` });
      }
      if (interaction.commandName === 'apply-panel') return await handleApplyPanel(interaction);
      if (interaction.commandName === 'dm') return await handleDMUser(interaction);
      if (interaction.commandName === 'verify-panel') return await handleVerifyPanel(interaction);
      if (interaction.commandName === 'dm-all') return await handleDMAll(interaction);
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_category_select') return await handleTicketSelect(interaction, client);
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('ticket_reason_modal_')) return await handleTicketModal(interaction, client);
      if (interaction.customId.startsWith('ticket_add_member_modal_')) return await handleAddMemberModal(interaction, client, persistTickets);
      if (interaction.customId.startsWith('app_answer_')) return await handleAppAnswer(interaction, client);
      if (interaction.customId.startsWith('app_review_reason_')) return await handleAppReviewReason(interaction, client);
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'verify_user') return await handleVerifyButton(interaction, client);
      if (interaction.customId === 'app_start') return await handleAppStart(interaction, client);
      if (interaction.customId.startsWith('app_q_')) return await handleAppQuestion(interaction, client);
      if (interaction.customId.startsWith('app_accept_') || interaction.customId.startsWith('app_reject_')) return await handleAppReview(interaction, client);
      return await handleTicketManager(interaction, client, persistTickets);
    }

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Unknown interaction type.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  } catch (error) {
    logger.error(`Interaction error: ${error.message}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    handleWelcomeMessage(member, client);
    const roleId = '1506344765669773372';
    const role = member.guild.roles.cache.get(roleId);
    if (role) {
      await member.roles.add(role);
      logger.info(`Auto-role given to ${member.user.tag}`);
    }
  } catch (err) {
    logger.error(`Join error: ${err.message}`);
  }
});

let lastVoiceReconnect = 0;

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (oldState.member.id !== client.user.id && newState.member.id !== client.user.id) return;
  const targetId = config.voiceChannelId;
  if (!targetId) return;

  if (!newState.channelId) {
    const now = Date.now();
    if (now - lastVoiceReconnect < 10000) return;
    lastVoiceReconnect = now;
    logger.warn('Bot disconnected from voice, reconnecting...');
    const channel = client.channels.cache.get(targetId);
    if (channel) {
      handleVoiceSystem(client, channel);
    }
    return;
  }

  if (newState.channelId !== targetId) {
    const channel = client.channels.cache.get(targetId);
    if (channel) {
      try {
        await newState.setChannel(channel);
        logger.info('Returned to target voice channel');
      } catch (err) {
        logger.error(`Voice move-back failed: ${err.message}`);
      }
    }
  }
});

const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;
app.get('/', (req, res) => res.send('OK'));
app.listen(PORT, () => {
  logger.info(`Health server on port ${PORT}`);
  if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(async () => {
      try {
        const res = await fetch(process.env.RENDER_EXTERNAL_URL);
        if (res.ok) logger.info(`Keep-alive ping OK`);
      } catch (_) {}
    }, 4 * 60 * 1000);
    logger.info('Keep-alive pinger started (every 4 min)');
  }
});

process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled rejection: ${error.message}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
});

client.login(config.token);
