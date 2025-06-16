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

// Détecte les messages Wordle ou jeux similaires (Wordle, Sutom, etc.)
// Exemples : "Wordle 234 4/6", "SUTOM #123 5/6", etc.
function isWordleResult(text) {
    // Détecte les messages Wordle ou jeux similaires (Wordle, Sutom, etc.)
    const wordleRegex = /\b(wordle|sutom|motus|framed|moviedle|worldle|tradle|nerdle|quordle|octordle|dordle|globle|semantle|absurdle|crosswordle|waffle|squabble|canuckle|primel|numble|mathler|lettre|motdle|contexto|valojundle|loldle|pedantix)\b.*\d+\s*([1-9]|X)\/\d+/i;
    const emojiGrid = /[\u2B1B\u2B1C\u2B50\uD83D\uDFE9\uD83D\uDFE8\uD83D\uDFE7\uD83D\uDFE6\uD83D\uDFE5\uD83D\uDFE4\uD83D\uDFE3\uD83D\uDFE2\uD83D\uDFE1\uD83D\uDFE0]+/;
    // Détecte les partages de résultats multi-modes (ValoJundle, LoLdle, etc.)
    const multiModeShare = /j'ai complété tous les modes de #(valojundle|loldle|sutom|motus|pedantix)/i;
    // Détecte les partages de résultats Pedantix
    const pedantixShare = /j'ai trouvé #pedantix nº?\d+ en \d+ coups/i;
    // Détecte les liens vers les sites de jeux
    const gameLinks = /(valojundle\.ransan\.fr|loldle\.net|pedantix\.certitudes\.org)/i;
    // Détecte les scores de modes (ex: Classique : 3, Citation : 1, etc.)
    const modeScore = /([❓💬🖼️🔥😀🎨][^\n]*:\s*\d+)/;
    // Détecte les grilles d'emojis sur plusieurs lignes
    const multiLineEmojiGrid = /([\u2B1B\u2B1C\u2B50\uD83D\uDFE9\uD83D\uDFE8\uD83D\uDFE7\uD83D\uDFE6\uD83D\uDFE5\uD83D\uDFE4\uD83D\uDFE3\uD83D\uDFE2\uD83D\uDFE1\uD83D\uDFE0]{5,}\n?){2,}/;
    return (
        wordleRegex.test(text) ||
        emojiGrid.test(text) ||
        multiLineEmojiGrid.test(text) ||
        multiModeShare.test(text) ||
        pedantixShare.test(text) ||
        gameLinks.test(text) ||
        modeScore.test(text)
    );
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
                if (
                    wordCount(content) > 16 &&
                    containsMeaningfulWords(content) &&
                    !isWordleResult(content) // <-- Ajout du filtre Wordle
                ) {
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
        if (
            wordCount(content) > 16 &&
            containsMeaningfulWords(content) &&
            !isWordleResult(content) // <-- Ajout du filtre Wordle
        ) {
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
