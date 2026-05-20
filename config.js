require('dotenv').config();

module.exports = {
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  colors: {
    white: 0xFFFFFF,
    green: 0x57F287,
    red: 0xED4245,
    orange: 0xFEE75C,
    blurple: 0x5865F2,
  },

  emojis: {
    website: '<:website:15063852148>',
    cart: '<:cart:1506417770336747661>',
    dev: '<:dev:1506385446458884096>',
    partner: '<:partner:1506418427915407501>',
    sc: '<:sc:1506388512356958218>',
    report: '<:report:1506418992808460388>',
    success: '✅',
    error: '❌',
    lock: '🔒',
    unlock: '🔓',
    close: '🔒',
    claim: '📋',
    delete: '🗑️',
    transcript: '📄',
    ticket: '🎫',
  },

  ticketCategories: [
    {
      value: 'purchase',
      label: 'Purchase Support',
      description: 'Get help with subscriptions, pricing, or payments',
      emoji: '<:cart:1506417770336747661>',
      categoryId: process.env.TICKET_CATEGORY_PURCHASE,
    },
    {
      value: 'technical',
      label: 'Technical Support',
      description: 'Report bugs, issues, or technical problems',
      emoji: '<:dev:1506385446458884096>',
      categoryId: process.env.TICKET_CATEGORY_TECHNICAL,
    },
    {
      value: 'partnership',
      label: 'Partnership Request',
      description: 'Apply for partnerships or collaborations',
      emoji: '<:partner:1506418427915407501>',
      categoryId: process.env.TICKET_CATEGORY_PARTNERSHIP,
    },
    {
      value: 'security',
      label: 'Security Report',
      description: 'Report abuse, exploits, or suspicious activity',
      emoji: '<:sc:1506388512356958218>',
      categoryId: process.env.TICKET_CATEGORY_SECURITY,
    },
    {
      value: 'staff',
      label: 'Staff Support',
      description: 'Contact management or staff assistance',
      emoji: '<:report:1506418992808460388>',
      categoryId: process.env.TICKET_CATEGORY_STAFF,
    },
  ],

  roles: {
    admin: process.env.ADMIN_ROLE_ID,
    manager: process.env.MANAGER_ROLE_ID,
    support1: process.env.SUPPORT_ROLE_1_ID,
    support2: process.env.SUPPORT_ROLE_2_ID,
    appManager: process.env.APPLICATION_MANAGER_ROLE_ID,
    verified: process.env.VERIFIED_ROLE_ID,
  },

  channels: {
    log: process.env.LOG_CHANNEL_ID,
    panel: process.env.TICKET_PANEL_CHANNEL_ID,
    welcome: process.env.WELCOME_CHANNEL_ID,
    rules: '1506349621222310020',
    ticket: '1506372850997526660',
    appSubmit: process.env.APPLICATION_SUBMIT_CHANNEL_ID,
    appResults: process.env.APPLICATION_RESULTS_CHANNEL_ID,
    verifyLog: process.env.VERIFY_LOG_CHANNEL_ID,
  },

  voiceChannelId: process.env.VOICE_CHANNEL_ID,
  serverName: process.env.SERVER_NAME || 'Nexus Security',
  websiteUrl: process.env.WEBSITE_URL || `https://${(process.env.SERVER_NAME || 'nexus-security').toLowerCase().replace(/\s/g, '')}.netlify.app`,

  maxTicketsPerUser: 3,

  appQuestions: [
    'What is your Discord username and age?',
    'What timezone/country are you from?',
    'How active are you daily? (in hours)',
    'Do you have previous staff experience? If so, where?',
    'Why do you want to join the Nexus Security Staff Team?',
    'How would you handle a toxic or rule-breaking member?',
    'Are you able to stay professional and respectful at all times?',
    'Why should we choose you over other applicants?',
  ],
};
