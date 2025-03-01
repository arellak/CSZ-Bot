import parseOptions from "minimist";
import {
    APIEmbed,
    APIEmbedField,
    cleanContent,
    Snowflake,
    TextChannel,
    time,
    TimestampStyles,
    User,
} from "discord.js";

import log from "../utils/logger.js";
import AdditionalMessageData from "../storage/model/AdditionalMessageData.js";
import { getConfig } from "../utils/configHandler.js";
import type { BotContext } from "../context.js";
import type { CommandFunction } from "../types.js";

const config = getConfig();

export const LETTERS = [
    ":regional_indicator_a:",
    ":regional_indicator_b:",
    ":regional_indicator_c:",
    ":regional_indicator_d:",
    ":regional_indicator_e:",
    ":regional_indicator_f:",
    ":regional_indicator_g:",
    ":regional_indicator_h:",
    ":regional_indicator_i:",
    ":regional_indicator_j:",
    ":regional_indicator_k:",
    ":regional_indicator_l:",
    ":regional_indicator_m:",
    ":regional_indicator_n:",
    ":regional_indicator_o:",
    ":regional_indicator_p:",
    ":regional_indicator_q:",
    ":regional_indicator_r:",
    ":regional_indicator_s:",
    ":regional_indicator_t:",
];

export const EMOJI = [
    "🇦",
    "🇧",
    "🇨",
    "🇩",
    "🇪",
    "🇫",
    "🇬",
    "🇭",
    "🇮",
    "🇯",
    "🇰",
    "🇱",
    "🇲",
    "🇳",
    "🇴",
    "🇵",
    "🇶",
    "🇷",
    "🇸",
    "🇹",
];

export const TEXT_LIMIT = 4096;
export const FIELD_NAME_LIMIT = 256;
export const FIELD_VALUE_LIMIT = 1024;
export const POLL_OPTION_SEPARATOR = " - ";
export const POLL_OPTION_MAX_LENGTH =
    2 * FIELD_VALUE_LIMIT -
    Math.max(...LETTERS.map(s => s.length)) -
    POLL_OPTION_SEPARATOR.length;
export const OPTION_LIMIT = LETTERS.length;

interface DelayedPoll {
    pollId: string;
    createdAt: Date;
    finishesAt: Date;
    reactions: string[][];
    reactionMap: string[];
}

export const delayedPolls: DelayedPoll[] = [];

export const createOptionField = (
    option: string,
    index: number,
    author?: User,
): APIEmbedField => {
    let newOption = option;
    if (author) {
        const authorNote = ` (von ${author.username})`;
        newOption += authorNote;

        if (newOption.length > POLL_OPTION_MAX_LENGTH) {
            throw new Error(
                `Alter jetzt mal ganz im ernst, du hast etwas weniger als ${POLL_OPTION_MAX_LENGTH} Zeichen zur Verfüngung. Ich brauch auch noch ein bisschen Platz. Kannst du doch nicht ernst meinen.`,
            );
        }
    }

    const optionDiscriminator = `${LETTERS[index]}${POLL_OPTION_SEPARATOR}`;
    const splitIndex = FIELD_NAME_LIMIT - optionDiscriminator.length;
    const firstTextBlock =
        optionDiscriminator + newOption.substring(0, splitIndex);
    const secondTextBlock = newOption.substring(splitIndex) || " ";

    return { name: firstTextBlock, value: secondTextBlock, inline: false };
};

/**
 * Creates a new poll (multiple answers) or straw poll (single selection)
 */
export const run: CommandFunction = async (_client, message, args, context) => {
    const options = parseOptions(args, {
        boolean: ["channel", "extendable", "straw"],
        string: ["delayed"],
        alias: {
            channel: "c",
            extendable: "e",
            straw: "s",
            delayed: "d",
        },
    });

    const parsedArgs = options._;
    const delayTime = Number(options.delayed);

    if (!parsedArgs.length) return "Bruder da ist keine Umfrage :c";

    const pollArray = parsedArgs
        .join(" ")
        .split(";")
        .map(e => e.trim())
        .filter(e => e.replace(/\s/g, "") !== "");

    const question = pollArray[0];
    if (question.length > TEXT_LIMIT)
        return "Bruder die Frage ist ja länger als mein Schwanz :c";

    const pollOptions = pollArray.slice(1);
    let pollOptionsTextLength = 0;

    const isExtendable = options.extendable;
    for (const pollOption of pollOptions) {
        pollOptionsTextLength += pollOption.length;
    }

    if (!pollOptions.length)
        return "Bruder da sind keine Antwortmöglichkeiten :c";
    else if (pollOptions.length < 2 && !isExtendable)
        return "Bruder du musst schon mehr als eine Antwortmöglichkeit geben 🙄";
    else if (pollOptions.length > OPTION_LIMIT)
        return `Bitte gib nicht mehr als ${OPTION_LIMIT} Antwortmöglichkeiten an!`;
    else if (pollOptions.some(value => value.length > POLL_OPTION_MAX_LENGTH))
        return `Bruder mindestens eine Antwortmöglichkeit ist länger als ${POLL_OPTION_MAX_LENGTH} Zeichen!`;

    const fields = pollOptions.map((o, i) => createOptionField(o, i));

    const embed: APIEmbed = {
        description: `**${cleanContent(question, message.channel)}**`,
        fields,
        timestamp: new Date().toISOString(),
        author: {
            name: `${options.straw ? "Strawpoll" : "Umfrage"} von ${
                message.author.username
            }`,
            icon_url: message.author.displayAvatarURL(),
        },
    };
    const embedFields = embed.fields;
    if (embedFields === undefined) {
        return "Irgendwie fehlen die Felder in dem Embed. Das sollte nicht passieren.";
    }

    const extendable =
        options.extendable &&
        pollOptions.length < OPTION_LIMIT &&
        pollOptionsTextLength < TEXT_LIMIT;

    if (extendable) {
        if (options.delayed) {
            return "Bruder du kannst -e nicht mit -d kombinieren. 🙄";
        }

        embedFields.push({
            name: "✏️ Erweiterbar",
            value: "Erweiterbar mit .extend als Reply",
            inline: true,
        });
        embed.color = 0x2ecc71;
    }

    const finishTime = new Date(new Date().valueOf() + delayTime * 60 * 1000);
    if (options.delayed) {
        if (isNaN(delayTime) || delayTime <= 0) {
            return "Bruder keine ungültigen Zeiten angeben 🙄";
        } else if (delayTime > 60 * 1000 * 24 * 7) {
            return "Bruder du kannst maximal 7 Tage auf ein Ergebnis warten 🙄";
        }

        embedFields.push({
            name: "⏳ Verzögert",
            value: `Abstimmungsende: ${time(
                finishTime,
                TimestampStyles.RelativeTime,
            )}`,
            inline: true,
        });
        embed.color = 0xa10083;
    }

    embedFields.push({
        name: "📝 Antwortmöglichkeit",
        value: options.straw ? "Einzelauswahl" : "Mehrfachauswahl",
        inline: true,
    });

    const voteChannel = context.textChannels.votes;
    const channel = options.channel ? voteChannel : message.channel;
    if (options.delayed && channel !== voteChannel) {
        return "Du kannst keine verzögerte Abstimmung außerhalb des Umfragenchannels machen!";
    }

    if (!channel.isTextBased()) {
        return "Der Zielchannel ist irgenwie kein Text-Channel?";
    }

    const pollMessage = await channel.send({
        embeds: [embed],
    });

    await message.delete();
    await Promise.all(pollOptions.map((_e, i) => pollMessage.react(EMOJI[i])));

    if (options.delayed) {
        const reactionMap: string[] = [];
        const reactions: string[][] = [];
        pollOptions.forEach((option, index) => {
            reactionMap[index] = option;
            reactions[index] = [];
        });

        const delayedPollData = {
            pollId: pollMessage.id,
            createdAt: new Date(),
            finishesAt: finishTime,
            reactions,
            reactionMap,
        };

        const additionalData = await AdditionalMessageData.fromMessage(
            pollMessage,
        );
        const newCustomData = additionalData.customData;
        newCustomData.delayedPollData = delayedPollData;
        additionalData.customData = newCustomData;
        await additionalData.save();

        delayedPolls.push(delayedPollData);
    }
};

export const importPolls = async () => {
    const additionalDatas = await AdditionalMessageData.findAll();
    let count = 0;
    additionalDatas.forEach(additionalData => {
        if (!additionalData.customData.delayedPollData) {
            return;
        }

        delayedPolls.push(additionalData.customData.delayedPollData);
        count++;
    });
    log.info(`Loaded ${count} polls from database`);
};

export const processPolls = async (context: BotContext) => {
    const currentDate = new Date();
    const pollsToFinish = delayedPolls.filter(
        delayedPoll => currentDate >= delayedPoll.finishesAt,
    );

    const channel: TextChannel = context.textChannels.votes;

    for (const element of pollsToFinish) {
        const delayedPoll = element;
        const message = await /** @type {import("discord.js").TextChannel} */ (
            channel
        ).messages.fetch(delayedPoll.pollId);

        const users: Record<Snowflake, User> = {};
        await Promise.all(
            delayedPoll.reactions
                .flat()
                .filter(
                    (x, uidi) =>
                        delayedPoll.reactions.indexOf(
                            // biome-ignore lint/suspicious/noExplicitAny: I don't know if this works
                            x as any as string[],
                        ) !== uidi,
                )
                .map(async uidToResolve => {
                    users[uidToResolve] = await context.client.users.fetch(
                        uidToResolve,
                    );
                }),
        );

        const fields: APIEmbedField[] = delayedPoll.reactions.map(
            (value, i) => {
                return {
                    name: `${LETTERS[i]} ${delayedPoll.reactionMap[i]} (${value.length})`,
                    value: value.map(uid => users[uid]).join("\n") || "-",
                    inline: false,
                };
            },
        );

        const embed = message.embeds[0];
        if (embed === undefined) {
            continue;
        }
        const embedDescription = embed.description;
        if (embedDescription === null) {
            continue;
        }
        const embedAuthor = embed.author;
        if (embedAuthor === null) {
            continue;
        }

        const question =
            embedDescription.length > TEXT_LIMIT
                ? `${embedDescription.slice(0, TEXT_LIMIT - 20)}...`
                : embed.description;

        const toSend: APIEmbed = {
            description: `Zusammenfassung: ${question}`,
            fields,
            timestamp: new Date().toISOString(),
            author: {
                name: `${embedAuthor.name}`,
                icon_url: embedAuthor.iconURL,
            },
            footer: {
                text: `Gesamtabstimmungen: ${delayedPoll.reactions
                    .map(x => x.length)
                    .reduce((a, b) => a + b)}`,
            },
        };

        await channel.send({
            embeds: [toSend],
        });
        await Promise.all(
            message.reactions.cache.map(reaction => reaction.remove()),
        );
        await message.react("✅");
        delayedPolls.splice(delayedPolls.indexOf(delayedPoll), 1);

        const messageData = await AdditionalMessageData.fromMessage(message);
        const { customData } = messageData;
        customData.delayedPollData = undefined;
        messageData.customData = customData;
        await messageData.save();
    }
};

export const description = `Erstellt eine Umfrage mit mehreren Antwortmöglichkeiten (standardmäßig mit Mehrfachauswahl) (maximal ${OPTION_LIMIT}).
Usage: ${config.bot_settings.prefix.command_prefix}poll [Optionen?] [Hier die Frage] ; [Antwort 1] ; [Antwort 2] ; [...]
Optionen:
\t-c, --channel
\t\t\tSendet die Umfrage in den Umfragenchannel, um den Slowmode zu umgehen
\t-e, --extendable
\t\t\tErlaubt die Erweiterung der Antwortmöglichkeiten durch jeden User mit .extend als Reply
\t-s, --straw
\t\t\tStatt mehrerer Antworten kann nur eine Antwort gewählt werden
\t-d <T>, --delayed <T>
\t\t\tErgebnisse der Umfrage wird erst nach <T> Minuten angezeigt. (Noch) inkompatibel mit -e`;
