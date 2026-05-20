const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');
const config = require('../../config');
const logger = require('../utils/logger');

async function handleTicketPanel(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const embed = new EmbedBuilder()
      .setColor(config.colors.white)
      .setTitle('Support & Services')
      .setDescription(
        [
          `Welcome to the **${config.serverName}** support system.`,
          '',
          'Please select a ticket category from the dropdown menu below to contact our team.',
          '',
          '**Professional Support & Protection Services**',
          '**Ticket Support:** 24/7',
          '**Freelance Services:** Available',
          '**Weekend Support:** Limited Availability',
          '',
          '**Available Categories:**',
        ].join('\n')
      );

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_category_select')
        .setPlaceholder('Select a ticket category...')
        .addOptions(
          config.ticketCategories.map((cat) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(cat.label)
              .setDescription(cat.description)
              .setValue(cat.value)
              .setEmoji(cat.emoji)
          )
        )
    );

    const websiteRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Visit Our Website')
        .setURL(config.websiteUrl)
        .setStyle(ButtonStyle.Link)
    );

    await interaction.editReply({
      content: 'Ticket panel has been sent below.',
    });

    await interaction.channel.send({ embeds: [embed], components: [selectRow, websiteRow] });
    logger.info(`Ticket panel sent in #${interaction.channel.name}`);
  } catch (error) {
    logger.error(`Panel error: ${error.message}`);
    await interaction.editReply({ content: 'Failed to send panel: ' + error.message }).catch(() => {});
  }
}

async function handleTicketSelect(interaction, client) {
  const selectedValue = interaction.values[0];
  const category = config.ticketCategories.find((c) => c.value === selectedValue);

  if (!category) {
    return interaction.reply({ content: 'Invalid category selected.', flags: MessageFlags.Ephemeral });
  }

  const userTickets = client.tickets.filter(
    (t) => t.userId === interaction.user.id && t.status !== 'closed'
  );

  if (userTickets.size >= config.maxTicketsPerUser) {
    return interaction.reply({
      content: `You already have ${config.maxTicketsPerUser} open tickets. Please close one first.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const dupCategory = userTickets.find((t) => t.category === selectedValue);
  if (dupCategory) {
    return interaction.reply({
      content: `You already have an open ticket in **${category.label}**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`ticket_reason_modal_${selectedValue}`)
    .setTitle(`Open ${category.label} Ticket`);

  const reasonInput = new TextInputBuilder()
    .setCustomId('ticket_reason')
    .setLabel('Why are you opening this ticket?')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(10)
    .setMaxLength(500)
    .setPlaceholder('Please describe your issue in detail...')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
}

module.exports = { handleTicketPanel, handleTicketSelect };
