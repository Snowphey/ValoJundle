// Import necessary modules
const { Client, GatewayIntentBits, Partials, ChannelType } = require('discord.js');
const { token, guildId, channelsIds } = require('./config.json');
const fs = require('fs');
const path = require('path');

const folder_path = 'raw_data';

// Create a new Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds], partials: [Partials.Channel] });

// Log in to the Discord client using your bot token
client.login(token);

// Fetch messages from all channels in the server
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const guild = client.guilds.cache.get(guildId);

    const channels = guild.channels.cache.filter(channel => channelsIds.includes(channel.id) && channel.type === ChannelType.GuildText);

    for (const channel of channels.values()) {
        let messages = [];
        let lastMessageId;

        while (true) {
            let fetchedMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
            fetchedMessages = fetchedMessages.filter(message => !message.author.bot);

            console.log(`Fetching ${fetchedMessages.size} messages from channel ${channel.id}`);

            if (fetchedMessages.size === 0) break;

            for (const message of fetchedMessages.values()) {
                const attachmentsCount = message.attachments ? message.attachments.size : 0;

                messages.push({
                    author: message.author.username,
                    userId: message.author.id,
                    guildId: guild.id,
                    channelId: channel.id,
                    messageId: message.id,
                    content: message.content || '',
                    timestamp: message.createdTimestamp,
                    url: message.url,
                    attachmentsCount: attachmentsCount
                });
            }

            lastMessageId = fetchedMessages.last().id;

            console.log(`Last message ID: ${lastMessageId}, Date: ${fetchedMessages.last().createdAt}`);
        }

        // Ensure the directory exists
        const dirPath = path.resolve(__dirname, folder_path);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Write messages to a JSON file per channel
        const jsonFilePath = path.join(dirPath, `${channel.name}.json`);
        try {
            fs.writeFileSync(jsonFilePath, JSON.stringify(messages, null, 2), 'utf-8');
            console.log(`Messages from channel ${channel.name} have been written to ${folder_path}/${channel.name}.json`);
        } catch (err) {
            console.error(`Error writing to JSON file for channel ${channel.name}`, err);
        }
    }

    client.destroy();
});
