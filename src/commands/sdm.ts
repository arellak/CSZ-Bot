import { Client, GuildMember, EmbedData, InteractionReplyOptions, CommandInteraction, CacheType, SlashCommandBuilder, SlashCommandStringOption, SlashCommandSubcommandBuilder, EmbedBuilder } from "discord.js";

import { ApplicationCommand, CommandResult, MessageCommand } from "./command.js";
import { substringAfter } from "../utils/stringUtils.js";
import type { ProcessableMessage } from "../handler/cmdHandler.js";

// Truly random seed, generated by putting trainee in front of vim and tell him to exit
const randomSeed = "AQa0B7HK4vvrBOlaKKplMsKorGhN4gJvOCBWxw531P8uwpeIU3d39ODZ02fbvcxiImOwAOuOtR4eaiPDkyTCbSqzKnaJWqp4AqwxOTMgU2UCPWKIH4WXCQzVq8M7oqWBF32KEAdAoXvAm5o3Wvl4MOwdMJk1LleFjv7mQJizltVw3Y2Tan88uc3JxoJurDTKvxBzRt6H";

const iocCalculator = function (s: string): number {
    const bigrams = new Map();
    const text = s.replace(/\s+/g, "");
    [...text].forEach(c => (bigrams.has(c) ? bigrams.set(c, bigrams.get(c) + 1) : bigrams.set(c, 1)));

    let sum = 0;
    bigrams.forEach(v => (sum += v + (v - 1)));
    return sum / (text.length * (text.length - 1));
};

const rng = function (min: number, max: number, seed: number): number {
    const sido = (seed * 9301 + 49297) % 233280;
    let rnd = sido / 233280;
    const disp = Math.abs(Math.sin(sido));

    rnd = rnd + disp - Math.floor(rnd + disp);

    return Math.floor((min || 0) + rnd * ((max || 1) - (min || 0) + 1));
};

const ioc = iocCalculator(randomSeed);

const secureDecisionMaker = (question: string, max: number = 1) => (rng(0, max, (Date.now() * ioc) / iocCalculator(question)));

const createSecureDecisionMessage = (question: string, author: GuildMember, options: string[] = []) => {
    const formattedQuestion = question.endsWith("?") ? question : `${question}?`;

    const embed = new EmbedBuilder()
        .setTitle(formattedQuestion)
        .setTimestamp(new Date())
        .setAuthor({
            name: `Secure Decision für ${author.user.username}`,
            iconURL: author.displayAvatarURL()
        })

    // If yes / no
    if (options.length === 0) {
        const decision = secureDecisionMaker(question);
        let file;
        if (!!decision) {
            embed.setColor(0x2ecc71);
            file = "yes.png";
        } else {
            embed.setColor(0xe74c3c);
            file = "no.png";
        }
        embed.setThumbnail("attachment://" + file);

        return {
            embeds: [embed],
            files: [`./assets/${file}`]
        };
    }

    // If pick
    const decision = secureDecisionMaker(question, options.length - 1);
    embed.setColor(0x9b59b6)
    embed.setDescription(`Ich rate dir zu **${options[decision]}**!`)

    return {
        embeds: [embed]
    };
};

export class SdmCommand implements MessageCommand, ApplicationCommand {
    name = "sdm";
    description = "Macht eine Secure Decision mithilfe eines komplexen, hochoptimierten, Blockchain Algorithmus.";
    get applicationCommand() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(
                new SlashCommandSubcommandBuilder()
                    .setName("ja-nein")
                    .setDescription("Macht ne ja/nein decision")
                    .addStringOption(
                        new SlashCommandStringOption()
                            .setDescription("Frage")
                            .setRequired(true)
                            .setName("question")
                    )
            )
            .addSubcommand(
                new SlashCommandSubcommandBuilder()
                    .setName("entscheidung")
                    .setDescription("Macht ne decision aus n Elementen")
                    .addStringOption(
                        new SlashCommandStringOption()
                            .setDescription("Frage")
                            .setRequired(true)
                            .setName("question")
                    )
                    .addStringOption(
                        new SlashCommandStringOption()
                            .setDescription("Option 1")
                            .setRequired(true)
                            .setName("o1")
                    )
                    .addStringOption(
                        new SlashCommandStringOption()
                            .setDescription("Option 2")
                            .setRequired(true)
                            .setName("o2")
                    )
                    .addStringOption(
                        new SlashCommandStringOption()
                            .setDescription("Option 3")
                            .setRequired(false)
                            .setName("o3")
                    )
                    .addStringOption(
                        new SlashCommandStringOption()
                            .setDescription("Option 4")
                            .setRequired(false)
                            .setName("o4")
                    )
                    .addStringOption(
                        new SlashCommandStringOption()
                            .setDescription("Option 5")
                            .setRequired(false)
                            .setName("o5")
                    )
            );
    }

    async handleMessage(message: ProcessableMessage, _client: Client<boolean>): Promise<CommandResult> {
        const replyRef = message.reference?.messageId;
        const isReply = replyRef !== undefined;
        const args = substringAfter(message.cleanContent, this.name).trim().split(/\s+/g).filter(s => !!s);

        if (!args.length && !isReply) {
            await message.reply("Bruder da ist keine Frage :c");
            return;
        }

        let question = args.join(" ").replace(/\s\s+/g, " ");
        if (isReply && !args.length) {
            question = (await message.channel.messages.fetch(replyRef!)).content.trim();
        }

        const options = question.split(/,|;|\s+oder\s+/gi).map(s => s.trim()).filter(s => !!s);

        if (options.length > 1) {
            question = options.reduce((p, c, i, a) => (`${p}${i === a.length - 1 ? " oder " : ", "}${c}`));
            const msg = createSecureDecisionMessage(question, message.member, options);
            await message.reply(msg);
            // Don't delete as it would trigger the messageDeleteHandler
            // await message.delete();
            return;
        }

        const msg = createSecureDecisionMessage(question, message.member);
        await message.reply(msg);
        // Don't delete as it would trigger the messageDeleteHandler
        // await message.delete();
        return;
    }

    async handleInteraction(command: CommandInteraction<CacheType>, client: Client<boolean>): Promise<CommandResult> {
        if (!command.isChatInputCommand()) {
            // TODO: Solve this on a type level
            return;
        }

        const subcommand = command.options.getSubcommand(true);
        const question = command.options.getString("question", true);
        const member = command.member as GuildMember;
        if (subcommand === "ja-nein") {
            const msg = createSecureDecisionMessage(question, member);
            await command.reply(msg);
            return;
        }

        if (subcommand === "entscheidung") {
            // Well, there must be a better way, but I'm too lazy atm
            const o1 = command.options.getString("o1", true);
            const o2 = command.options.getString("o2", true);
            const o3 = command.options.getString("o3", false);
            const o4 = command.options.getString("o4", false);
            const o5 = command.options.getString("o5", false);

            const options = [o1, o2, o3, o4, o5].filter(o => o !== null) as string[];

            const msg = createSecureDecisionMessage(question, member, options);
            await command.reply(msg);
            return;
        }
        return Promise.reject(new Error(`Subcommand ${subcommand} not implemented.`));
    }
}
