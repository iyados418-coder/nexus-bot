const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const config = require('../../config');
const logger = require('../utils/logger');

let currentConnection = null;
let currentChannelId = null;
let wasEverReady = false;
let reconnectAttempts = 0;
const MAX_RECONNECT = 50;

async function handleVoiceSystem(client, voiceChannel) {
  if (currentConnection) {
    try {
      currentConnection.removeAllListeners();
      currentConnection.destroy();
    } catch (_) {}
    currentConnection = null;
  }

  wasEverReady = false;

  try {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    currentConnection = connection;

    connection.on(VoiceConnectionStatus.Ready, () => {
      logger.success(`Voice connected: #${voiceChannel.name}`);
      wasEverReady = true;
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (!wasEverReady) {
        connection.destroy();
        return;
      }
      logger.warn('Voice disconnected, reconnecting...');
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        if (reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          try {
            connection.rejoin();
          } catch {
            connection.destroy();
          }
        }
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      if (wasEverReady) {
        logger.info('Voice connection destroyed, will auto-reconnect');
        wasEverReady = false;
      }
    });

    connection.on('error', (error) => {
      if (!wasEverReady) return;
      logger.error(`Voice error: ${error.message}`);
    });

    currentChannelId = voiceChannel.id;

    try {
      const member = voiceChannel.guild.members.cache.get(client.user.id);
      if (member) {
        await member.voice.setDeaf(true);
      }
    } catch (_) {}

    return connection;
  } catch (error) {
    logger.error(`Voice system error: ${error.message}`);
    return null;
  }
}

function getCurrentConnection() {
  return currentConnection;
}

module.exports = { handleVoiceSystem, getCurrentConnection };
