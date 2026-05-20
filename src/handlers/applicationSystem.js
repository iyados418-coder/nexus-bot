const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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

async function handleApplyPanel(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const embed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setTitle('Staff Application')
      .setDescription(
        [
          '━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          `Join the **${config.serverName}** staff team by completing the application below.`,
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          '**Requirements**',
          '• Minimum age: 14 years',
          '• Clean Discord record',
          '• Active in the community',
          '• Fluent in English',
          '',
          '**Process**',
          '1. Click **Start Application** to begin',
          '2. Answer 8 questions via DM',
          '3. Wait for our team to review',
          '4. Receive the result in your DMs',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━',
        ].join('\n')
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('app_start')
        .setLabel('Start Application')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel('Results')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.com/channels/1504933159861485588/1506411965256433694')
    );

    await interaction.editReply({ content: 'Application panel has been sent below.' });
    await interaction.channel.send({ embeds: [embed], components: [row] });
    logger.info('Application panel sent');
  } catch (err) {
    logger.error(`Apply panel error: ${err.message}`);
    await interaction.editReply({ content: 'Failed to send panel.' }).catch(() => {});
  }
}

async function handleAppStart(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  try {
    await interaction.editReply({ content: 'Check your DMs to start the application process.' });
    const dmChannel = await interaction.user.createDM();

    const startEmbed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setTitle('Staff Application')
      .setDescription(
        [
          `Thank you for your interest in joining **${config.serverName}**.`,
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          'You will answer **8 questions** one at a time.',
          'Take your time and provide detailed answers.',
          'Each response is saved as you go.',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          'Click **Begin** to start.',
        ].join('\n')
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_q_${interaction.user.id}_0`)
        .setLabel('Begin')
        .setStyle(ButtonStyle.Success)
    );

    await dmChannel.send({ embeds: [startEmbed], components: [row] });
  } catch (err) {
    logger.error(`App start DM error: ${err.message}`);
    await interaction.editReply({ content: 'Could not send you a DM. Please enable DMs from server members and try again.' });
  }
}

async function handleAppQuestion(interaction, client) {
  const parts = interaction.customId.split('_');
  const userId = parts[2];
  const stepIndex = parseInt(parts[3], 10);

  if (interaction.user.id !== userId)
    return interaction.reply({ content: 'This application is not for you.', ephemeral: true });
  if (stepIndex >= config.appQuestions.length)
    return interaction.reply({ content: 'You have already completed the application.', ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`app_answer_${userId}_${stepIndex}`)
    .setTitle(`Question ${stepIndex + 1} of ${config.appQuestions.length}`);

  const input = new TextInputBuilder()
    .setCustomId('app_answer')
    .setLabel(config.appQuestions[stepIndex].slice(0, 45))
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(5)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleAppAnswer(interaction, client) {
  const parts = interaction.customId.split('_');
  const userId = parts[2];
  const stepIndex = parseInt(parts[3], 10);

  if (interaction.user.id !== userId)
    return interaction.reply({ content: 'This application is not for you.', ephemeral: true });

  const answer = interaction.fields.getTextInputValue('app_answer');
  const nextStep = stepIndex + 1;

  if (!client.applications) client.applications = new Map();
  if (!client.applications.has(userId))
    client.applications.set(userId, { answers: [], startedAt: Date.now() });

  const app = client.applications.get(userId);
  app.answers[stepIndex] = answer;
  client.applications.set(userId, app);

  await interaction.reply({ content: `Answer recorded for question ${stepIndex + 1}.`, ephemeral: true });

  if (nextStep >= config.appQuestions.length) {
    await submitApplication(interaction, client, userId, app);
  } else {
    const nextEmbed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setTitle(`Question ${nextStep + 1} of ${config.appQuestions.length}`)
      .setDescription(config.appQuestions[nextStep])
      .setFooter({ text: `${config.serverName} — Application` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_q_${userId}_${nextStep}`)
        .setLabel(`Answer Question ${nextStep + 1}`)
        .setStyle(ButtonStyle.Primary)
    );

    try {
      const dmChannel = await interaction.user.createDM();
      await dmChannel.send({ embeds: [nextEmbed], components: [row] });
    } catch (err) {
      logger.error(`App next question DM error: ${err.message}`);
    }
  }
}

async function submitApplication(interaction, client, userId, app) {
  const user = interaction.user;
  const channel = client.channels.cache.get(config.channels.appSubmit);
  if (!channel) {
    logger.error('Application submit channel not found');
    return;
  }

  const fields = config.appQuestions.map((q, i) => ({
    name: `Q${i + 1}`,
    value: app.answers[i] || 'No answer provided',
    inline: false,
  }));

  const submitEmbed = new EmbedBuilder()
    .setColor(config.colors.white)
    .setTitle('New Staff Application')
    .setDescription(
      [
        `**Applicant:** <@${userId}>`,
        `**Tag:** ${user.tag}`,
        `**Submitted:** <t:${Math.floor(Date.now() / 1000)}:F>`,
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n')
    )
    .addFields(fields)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`app_accept_${userId}`)
      .setLabel('Accept')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`app_reject_${userId}`)
      .setLabel('Reject')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [submitEmbed], components: [row] });
  client.applications.set(userId, { ...app, submitted: true, msgId: msg.id });

  try {
    const dmChannel = await user.createDM();
    const doneEmbed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setTitle('Application Submitted')
      .setDescription(
        [
          'Your staff application has been submitted successfully.',
          '',
          'Our team will review it and get back to you.',
          'You will receive a DM with the result.',
        ].join('\n')
      );
    await dmChannel.send({ embeds: [doneEmbed] });
  } catch (err) {
    logger.error(`App submit DM error: ${err.message}`);
  }

  await logToChannel(client, {
    title: 'Application Submitted',
    color: config.colors.white,
    fields: [
      { name: 'Applicant', value: `<@${userId}>`, inline: true },
      { name: 'Channel', value: `<#${channel.id}>`, inline: true },
    ],
  });

  logger.info(`Application submitted by ${user.tag}`);
}

async function handleAppReview(interaction, client) {
  const parts = interaction.customId.split('_');
  const action = parts[1];
  const applicantId = parts[2];

  const isManager = interaction.member.roles.cache.has(config.roles.appManager) ||
    interaction.member.roles.cache.has(config.roles.admin) ||
    interaction.member.roles.cache.has(config.roles.manager);

  if (!isManager) {
    return interaction.reply({ content: 'Only application managers can review applications.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`app_review_reason_${action}_${applicantId}_${interaction.user.id}`)
    .setTitle(`${action === 'accept' ? 'Accept' : 'Reject'} Application`);

  const reasonInput = new TextInputBuilder()
    .setCustomId('app_review_reason')
    .setLabel(`Reason for ${action === 'accept' ? 'acceptance' : 'rejection'}`)
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(5)
    .setMaxLength(500)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
}

async function handleAppReviewReason(interaction, client) {
  const parts = interaction.customId.split('_');
  const action = parts[3];
  const applicantId = parts[4];
  const reviewerId = parts[5];

  if (interaction.user.id !== reviewerId)
    return interaction.reply({ content: 'This review session is not for you.', ephemeral: true });

  const reason = interaction.fields.getTextInputValue('app_review_reason');
  const isAccepted = action === 'accept';

  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await client.users.fetch(applicantId).catch(() => null);
    const app = client.applications?.get(applicantId);

    const resultEmbed = new EmbedBuilder()
      .setColor(isAccepted ? config.colors.green : config.colors.red)
      .setTitle(isAccepted ? 'Application Accepted' : 'Application Rejected')
      .setDescription(
        [
          `━━━━━━━━━━━━━━━━━━━━━━━━`,
          '',
          `**Applicant:** <@${applicantId}> ${user ? `(${user.tag})` : ''}`,
          `**Reviewed by:** <@${reviewerId}>`,
          `**Status:** ${isAccepted ? 'Accepted' : 'Rejected'}`,
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          `**Reason:**`,
          `${reason}`,
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          `> ${config.websiteUrl}`,
        ].join('\n')
      )
      .setThumbnail(user?.displayAvatarURL({ dynamic: true, size: 128 }) || null)
      .setTimestamp();

    const resultsChannel = client.channels.cache.get(config.channels.appResults);
    if (resultsChannel) {
      await resultsChannel.send({ embeds: [resultEmbed] });
    }

    if (user) {
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(isAccepted ? config.colors.green : config.colors.red)
          .setTitle(`Application ${isAccepted ? 'Accepted' : 'Rejected'}`)
          .setDescription(
            [
              `Your staff application for **${config.serverName}** has been **${isAccepted ? 'accepted' : 'rejected'}**.`,
              '',
              `**Reason:**`,
              `${reason}`,
              '',
              isAccepted
                ? 'Congratulations! A staff member will reach out to you shortly.'
                : 'Thank you for your interest. You may reapply in the future.',
              '',
              `> ${config.websiteUrl}`,
            ].join('\n')
          );

        await user.send({ embeds: [dmEmbed] });
        logger.info(`${isAccepted ? 'Accepted' : 'Rejected'} ${user.tag}: ${reason}`);
      } catch (err) {
        logger.error(`App result DM error: ${err.message}`);
      }
    }

    await logToChannel(client, {
      title: isAccepted ? 'Application Accepted' : 'Application Rejected',
      color: isAccepted ? config.colors.green : config.colors.red,
      fields: [
        { name: 'Applicant', value: `<@${applicantId}>`, inline: true },
        { name: 'Reviewer', value: `<@${reviewerId}>`, inline: true },
        { name: 'Reason', value: reason },
      ],
    });

    await interaction.editReply({ content: `Application ${isAccepted ? 'accepted' : 'rejected'} successfully.` });
  } catch (err) {
    logger.error(`App review error: ${err.message}`);
    await interaction.editReply({ content: 'Failed to process review.' });
  }
}

module.exports = {
  handleApplyPanel, handleAppStart, handleAppQuestion,
  handleAppAnswer, handleAppReview, handleAppReviewReason,
};
