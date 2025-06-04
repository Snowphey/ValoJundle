// filtrageData.js
// Fusionne, concatène, filtre et exporte les messages Discord à partir des CSV du dossier raw_data

const fs = require('fs');
const path = require('path');
const stopwords = require('stopwords').french;

const rawDataDir = path.join(__dirname, 'raw_data');

// 1. Charger tous les JSON
function loadAllJSONs() {
    const files = fs.readdirSync(rawDataDir).filter(f => f.endsWith('.json'));
    const allRows = [];
    for (const file of files) {
        const data = fs.readFileSync(path.join(rawDataDir, file), 'utf-8');
        const messages = JSON.parse(data);
        for (const msg of messages) {
            allRows.push({
                author: msg.author,
                userId: msg.userId,
                guildId: msg.guildId,
                channelId: msg.channelId,
                messageId: msg.messageId,
                content: msg.content,
                timestamp: msg.timestamp,
                url: msg.url,
                attachmentsCount: msg.attachmentsCount
            });
        }
    }
    // Tri par timestamp (du plus récent au plus ancien)
    allRows.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
    return allRows;
}

// Extraire les messages avec attachments
function extractAttachments(rows) {
    return rows.filter(row => row.attachmentsCount > 0);
}

// Exporter les citations en JSON
function exportCitationsJSON(citations, outPath) {
    fs.writeFileSync(outPath, JSON.stringify(citations, null, 2), 'utf-8');
}

// Exporter les attachments en JSON
function exportAttachmentsJSON(attachments, outPath) {
    fs.writeFileSync(outPath, JSON.stringify(attachments, null, 2), 'utf-8');
}

// Concaténer les messages consécutifs d'un même utilisateur
function concatAndFilterMessages(rows) {
    const result = [];
    let currentUser = null, currentAuthor = null, currentGuild = null, currentChannel = null;
    let currentMessages = [], currentMessageIds = [], currentTimestamps = [], currentUrls = [], currentAttachments = [];
    for (const row of rows) {
        if (row.userId !== currentUser || row.guildId !== currentGuild || row.channelId !== currentChannel) {
            if (currentUser !== null && currentMessages.length) {
                const content = currentMessages.join('\n').trim();
                if (wordCount(content) > 16 && containsMeaningfulWords(content)) {
                    result.push({
                        author: currentAuthor,
                        userId: currentUser,
                        guildId: currentGuild,
                        channelId: currentChannel,
                        messages: currentMessages.map((msg, idx) => ({
                            messageId: currentMessageIds[idx],
                            content: msg,
                            timestamp: currentTimestamps[idx],
                            url: currentUrls[idx],
                            attachmentsCount: currentAttachments[idx]
                        })).filter(m => m.content && m.content.trim().length > 0)
                    });
                }
            }
            currentUser = row.userId;
            currentAuthor = row.author;
            currentGuild = row.guildId;
            currentChannel = row.channelId;
            currentMessages = [row.content];
            currentMessageIds = [row.messageId];
            currentTimestamps = [row.timestamp];
            currentUrls = [row.url];
            currentAttachments = [row.attachmentsCount];
        } else {
            currentMessages.push(row.content);
            currentMessageIds.push(row.messageId);
            currentTimestamps.push(row.timestamp);
            currentUrls.push(row.url);
            currentAttachments.push(row.attachmentsCount);
        }
    }
    // Dernier bloc
    if (currentUser !== null && currentMessages.length) {
        const content = currentMessages.join('\n').trim();
        if (wordCount(content) > 16 && containsMeaningfulWords(content)) {
            result.push({
                author: currentAuthor,
                userId: currentUser,
                guildId: currentGuild,
                channelId: currentChannel,
                messages: currentMessages.map((msg, idx) => ({
                    messageId: currentMessageIds[idx],
                    content: msg,
                    timestamp: currentTimestamps[idx],
                    url: currentUrls[idx],
                    attachmentsCount: currentAttachments[idx]
                })).filter(m => m.content && m.content.trim().length > 0)
            });
        }
    }
    return result;
}

function wordCount(text) {
    return text.split(/\s+/).filter(Boolean).length;
}
function containsMeaningfulWords(text) {
    return text.split(/\s+/).some(w => !stopwords.includes(w.toLowerCase()));
}

// --- MAIN ---
(async () => {
    const allRows = loadAllJSONs();
    const citations = concatAndFilterMessages(allRows);
    const attachments = extractAttachments(allRows);
    exportCitationsJSON(citations, path.join(__dirname, 'citations.json'));
    exportAttachmentsJSON(attachments, path.join(__dirname, 'attachments.json'));
    console.log('Export citations, attachments terminé.');
})();
