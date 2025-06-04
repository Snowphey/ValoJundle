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

        // Load existing messages if file exists (for incremental extraction)
        const dirPath = path.resolve(__dirname, folder_path);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        const jsonFilePath = path.join(dirPath, `${channel.name}.json`);
        if (fs.existsSync(jsonFilePath)) {
            try {
                const existingData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
                if (Array.isArray(existingData) && existingData.length > 0) {
                    messages = existingData;
                    // Find the latest messageId (by timestamp)
                    const sorted = [...messages].sort((a, b) => b.timestamp - a.timestamp);
                    lastMessageId = sorted[0].messageId;
                }
            } catch (err) {
                console.error(`Error reading existing JSON for channel ${channel.name}`, err);
            }
        }

        // If lastMessageId is set, fetch only messages after it (incremental)
        let fetchOptions = { limit: 100 };
        if (lastMessageId) fetchOptions.after = lastMessageId;

        while (true) {
            let fetchedMessages = await channel.messages.fetch(fetchOptions);
            fetchedMessages = fetchedMessages.filter(message => !message.author.bot);

            console.log(`Fetching ${fetchedMessages.size} messages from channel ${channel.id}`);

            if (fetchedMessages.size === 0) break;

            for (const message of fetchedMessages.values()) {
                // Skip if message already exists (by messageId)
                if (messages.some(m => m.messageId === message.id)) continue;
                const attachmentsCount = message.attachments ? message.attachments.size : 0;

                // Resolve user and channel mentions (<@userId>, <@!userId>, <#channelId>) to usernames/channel names
                let resolvedContent = message.content || '';
                if (resolvedContent) {
                    // Replace user mentions
                    resolvedContent = resolvedContent.replace(/<@!?([0-9]+)>/g, (match, userId) => {
                        const user = message.mentions.users.get(userId);
                        return user ? `@${user.username}` : match;
                    });
                    // Replace channel mentions
                    resolvedContent = resolvedContent.replace(/<#(\d+)>/g, (match, channelId) => {
                        const channelObj = message.mentions.channels?.get(channelId) || message.guild.channels.cache.get(channelId);
                        return channelObj ? `#${channelObj.name}` : match;
                    });
                }

                messages.push({
                    author: message.author.username,
                    userId: message.author.id,
                    guildId: guild.id,
                    channelId: channel.id,
                    messageId: message.id,
                    content: resolvedContent,
                    timestamp: message.createdTimestamp,
                    url: message.url,
                    attachmentsCount: attachmentsCount
                });
            }

            // Update fetchOptions for next batch
            fetchOptions.after = fetchedMessages.last().id;

            console.log(`Last message ID: ${fetchedMessages.last().id}, Date: ${fetchedMessages.last().createdAt}`);
        }

        // Write messages to a JSON file per channel
        try {
            fs.writeFileSync(jsonFilePath, JSON.stringify(messages, null, 2), 'utf-8');
            console.log(`Messages from channel ${channel.name} have been written to ${folder_path}/${channel.name}.json`);
            console.log(`Total messages extracted for channel ${channel.name}: ${messages.length}`);
        } catch (err) {
            console.error(`Error writing to JSON file for channel ${channel.name}`, err);
        }
    }

    client.destroy();
});
