// Import necessary modules
const { Client, GatewayIntentBits, Partials, ChannelType } = require('discord.js');
const { token, guildId, channelsIds } = require('./config.json');
const fs = require('fs');
const path = require('path');

const folder_path = path.join(__dirname, 'raw_data');

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
        let isIncremental = false;

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
                    isIncremental = true;
                }
            } catch (err) {
                console.error(`Error reading existing JSON for channel ${channel.name}`, err);
            }
        }

        if (isIncremental) {
            // Incrémental : fetch uniquement les nouveaux messages
            let fetchOptions = { limit: 100 };
            if (lastMessageId) fetchOptions.after = lastMessageId;
            while (true) {
                let fetchedMessages = await channel.messages.fetch(fetchOptions);
                fetchedMessages = fetchedMessages.filter(message => !message.author.bot);
                console.log(`Fetching ${fetchedMessages.size} messages from channel ${channel.id}`);
                if (fetchedMessages.size === 0) break;
                for (const message of fetchedMessages.values()) {
                    if (messages.some(m => m.messageId === message.id)) continue;
                    const attachmentsCount = message.attachments ? message.attachments.size : 0;
                    let resolvedContent = message.content || '';
                    if (resolvedContent) {
                        resolvedContent = resolvedContent.replace(/<@!?([0-9]+)>/g, (match, userId) => {
                            const user = message.mentions.users.get(userId);
                            return user ? `@${user.username}` : '@utilisateur inconnu';
                        });
                        resolvedContent = resolvedContent.replace(/<@&([0-9]+)>/g, (match, roleId) => {
                            const role = message.guild.roles.cache.get(roleId);
                            return role ? `@${role.name}` : '@rôle inconnu';
                        });
                        resolvedContent = resolvedContent.replace(/<#(\d+)>/g, (match, channelId) => {
                            const channelObj = message.mentions.channels?.get(channelId) || message.guild.channels.cache.get(channelId);
                            return channelObj ? `#${channelObj.name}` : '#channel inconnu';
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
                const newestMsg = [...fetchedMessages.values()].reduce((a, b) => a.createdTimestamp > b.createdTimestamp ? a : b);
                fetchOptions.after = newestMsg.id;
                console.log(`Last message ID: ${newestMsg.id}, Date: ${newestMsg.createdAt}`);
            }
        } else {
            // Première extraction : paginer du plus récent vers le plus ancien avec before
            let fetchOptions = { limit: 100 };
            let allFetched = [];
            let beforeId = undefined;
            while (true) {
                if (beforeId) fetchOptions.before = beforeId;
                let fetchedMessages = await channel.messages.fetch(fetchOptions);
                fetchedMessages = fetchedMessages.filter(message => !message.author.bot);
                console.log(`Fetching ${fetchedMessages.size} messages from channel ${channel.id}`);
                if (fetchedMessages.size === 0) break;
                allFetched.push(...fetchedMessages.values());
                beforeId = [...fetchedMessages.values()].reduce((a, b) => a.createdTimestamp < b.createdTimestamp ? a : b).id;
                console.log(`Oldest message ID: ${beforeId}, Date: ${fetchedMessages.get(beforeId)?.createdAt}`);
            }
            // On inverse pour avoir du plus ancien au plus récent
            allFetched.reverse();
            for (const message of allFetched) {
                const attachmentsCount = message.attachments ? message.attachments.size : 0;

                // Resolve user and channel mentions (<@userId>, <@!userId>, <#channelId>) to usernames/channel names
                let resolvedContent = message.content || '';
                if (resolvedContent) {
                    // Replace user mentions
                    resolvedContent = resolvedContent.replace(/<@!?([0-9]+)>/g, (match, userId) => {
                        const user = message.mentions.users.get(userId);
                        return user ? `@${user.username}` : '@utilisateur inconnu';
                    });
                    // Replace role mentions
                    resolvedContent = resolvedContent.replace(/<@&([0-9]+)>/g, (match, roleId) => {
                        const role = message.guild.roles.cache.get(roleId);
                        return role ? `@${role.name}` : '@rôle inconnu';
                    });
                    // Replace channel mentions
                    resolvedContent = resolvedContent.replace(/<#(\d+)>/g, (match, channelId) => {
                        const channelObj = message.mentions.channels?.get(channelId) || message.guild.channels.cache.get(channelId);
                        return channelObj ? `#${channelObj.name}` : '#channel inconnu';
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
