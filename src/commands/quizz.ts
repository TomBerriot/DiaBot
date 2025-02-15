import { ActionRowBuilder, Attachment, BufferResolvable, CacheType, ChatInputCommandInteraction, EmbedBuilder, Message, SelectMenuBuilder, SlashCommandBuilder, StringSelectMenuBuilder, TextBasedChannel, escapeMarkdown } from 'discord.js';
import getPairs from '../functions/arrays';
import fs from 'fs';
import axios from 'axios';

export = {
    data: new SlashCommandBuilder()
            .setName('quizz')
            .setDescription('Start or stop a quiz !')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('start')
                    .setDescription('Start a quizz')
                    .addStringOption(option =>
                        option.setName('quizzname')
                        .setDescription('Give a name of the quizz')
                        .setRequired(true)
                    )
                    .addStringOption(option =>
                        option.setName('title')
                        .setDescription('The quizz title to display')
                    )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('stop')
                    .setDescription('Stop a quizz and print the leaderboard')
                    .addStringOption(option =>
                        option.setName('quizzname')
                        .setDescription('The name of the quizz to stop')
                        .setRequired(true)
                    )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('viewall')
                    .setDescription('View all created quizzs')
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('auto')
                    .setDescription('Starts an automatic Quizz')
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('import')
                    .setDescription('Import a quizz from a JSON file')
                    .addAttachmentOption(option =>
                        option.setName('file')
                        .setDescription("Drop the JSON file")
                        .setRequired(true)
                    )
                ),
            
            //NOT IMPLEMENTED YET
            //.addIntegerOption(option => 
            //     option.setName('max')
            //         .setDescription('Set the max accepted answers')
            // ),
    async execute(redisClient: any, interaction: ChatInputCommandInteraction<CacheType>) {
        const name:string = interaction.options.get('quizzname') ? (interaction.options.get('quizzname')?.value as string).toLowerCase() : "default";
        const title: string = interaction.options.get('title') ? interaction.options.get('title')?.value as string : "BUU BUU QUIZZ DESUWA !!";

        const optionChoice:string = interaction.options.getSubcommand();

        if(optionChoice === 'start') {
            const embed: EmbedBuilder = new EmbedBuilder()
                .setColor('#FD5E53')
                .setTitle('QUIZZ TIME !')
                .setAuthor({ name: 'Dia Kurosawa'})
                .setDescription(`Theme: ${title}`);
            const key: string = `${interaction.guild?.id.toString()}:quizz:${name}`;
            await redisClient.HSET(key, "name", name);
            await interaction.reply({embeds: [embed]});
        } else if (optionChoice === 'stop') {

            if (!(await redisClient.EXISTS(`${interaction.guild?.id.toString()}:quizz:${name}`)))
            {
                await interaction.reply({content: "Sorry the quizz doesn't exist. Try another name", ephemeral: true});
                return;
            }
            const templeaderboard = await redisClient.sendCommand(["ZRANGE",`${interaction.guild?.id.toString()}:quizz:${name}:leaderboard`,"0","10","WITHSCORES","REV"]);
            const leaderboard = getPairs(templeaderboard).map((e: any[]) => {
                return {
                    "name": e[1],
                    "value": e[0]
                }
            });

            const embed: EmbedBuilder = new EmbedBuilder()
                .setColor('#FD5E53')
                .setTitle('QUIZZ IS OVER !')
                .setAuthor({ name: 'Dia Kurosawa'})
                .setDescription(`Here is the leaderboard`)
                .setFields(leaderboard);
            await interaction.reply({embeds: [embed]});

            await redisClient.multi()
            .DEL(`${interaction.guild?.id.toString()}:quizz:${name}`)
            .DEL(`${interaction.guild?.id.toString()}:quizz:leaderboard:${name}`)
            .exec();
        } else if (optionChoice == 'viewall') {
            const quizzs: { name: string, value: string }[] = (await redisClient.KEYS(`${interaction.guild?.id.toString()}:quizz:*`)).map((e: string) => {
                return {
                    "name": e.split(":")[2],
                    "value": '\u200b'
                }
            });
            const embed: EmbedBuilder = new EmbedBuilder()
                .setColor('#FD5E53')
                .setTitle('Here are the current quizzs')
                .setAuthor({ name: 'Dia Kurosawa'})
                .setFields(quizzs);
            await interaction.reply({embeds: [embed], ephemeral: true});
        } else if (optionChoice == 'import') {

            const attachment = interaction.options.getAttachment('file') as Attachment;
            const response = await axios.get(attachment.url, {
                headers: { "Accept-Encoding": "gzip,deflate,compress", accept: 'application/json' },
                responseType: 'json'
            });
            const json: jsonquizz = response.data; // All the questions from the JSON file
            const name: string = json.name.toLowerCase().split(' ').join('-');
            redisClient.json.set(`quizz:${name}`, '.', json);
            await interaction.reply({content: "Quizz importé", ephemeral: true});
        } else if (optionChoice == 'auto') { // TODO: changer en 'play'
            const quizzs = await redisClient.KEYS('quizz:*');
            const options = [];
            for (const quiz of quizzs) {
                const [name, description]: [string, string] = await redisClient.json.get(quiz, {path: '$["name","description"]'});
                options.push({
                    label: name,
                    description: description,
                    value: quiz,
                });
            }
            
            const row: ActionRowBuilder<any> = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('selectquiz')
                        .setPlaceholder('Please select a quizz')
                        .addOptions(options),
                );

            const embed: EmbedBuilder = new EmbedBuilder()
                .setColor("#FD5E53")
                .setTitle('Which quiz you want to start ?');
            
            // TODO: Créer un event avec un message collector qui va récupérer les réponses des joueurs
		    await interaction.reply({ embeds: [embed], components: [row] });
        }
    }
}