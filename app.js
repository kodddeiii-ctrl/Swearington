require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const postgres = require('pg');

const VERSION = "0.4.0";

// Create Discord Client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Postgre DB Pool
const pool = new postgres.Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});

// Initialize database
pool.query(`CREATE TABLE IF NOT EXISTS points (
    userId TEXT,
    guildId TEXT,
    points INTEGER DEFAULT 0,
    PRIMARY KEY (userId, guildId)
)`).catch(err => console.error('Database init error:', err));

// Database Helper Functions
async function getPoints(userId, guildId) {
    const result = await pool.query('SELECT points FROM points WHERE userId = $1 AND guildId = $2', [userId, guildId]);
    return result.rows.length > 0 ? result.rows[0].points : 0;
}

async function updatePoints(userId, guildId, delta) {
    const currentPoints = await getPoints(userId, guildId);
    const newPoints = currentPoints + delta;
    await pool.query(
        'INSERT INTO points (userId, guildId, points) VALUES ($1, $2, $3) ON CONFLICT(userId, guildId) DO UPDATE SET points = $3',
        [userId, guildId, newPoints]
    );
    return newPoints;
}

// Terms File 
const termsFile = path.join('/data', 'terms.json');

function loadTerms() {
    if (!fs.existsSync(termsFile)) {
        fs.writeFileSync(termsFile, '{}');
        return {};
    }
    const data = fs.readFileSync(termsFile, 'utf-8');
    return JSON.parse(data);
}

function getGuildTerms(guildId) {
    const allTerms = loadTerms();
    return allTerms[guildId] || [];
}

function setGuildTerms(guildId, terms) {
    const allTerms = loadTerms();
    allTerms[guildId] = terms;
    fs.writeFileSync(termsFile, JSON.stringify(allTerms));
}

function addGuildTerm(guildId, term) {
    const terms = getGuildTerms(guildId);
    terms.push(term);
    setGuildTerms(guildId, terms);
}

function removeGuildTerm(guildId, term) {
    let terms = getGuildTerms(guildId);
    const index = terms.findIndex(t => t.toLowerCase() === term.toLowerCase());
    if (index !== -1) {
        terms.splice(index, 1);
        setGuildTerms(guildId, terms);
        return true;
    }
    return false;
}

// Commands List
const commands = [
    new SlashCommandBuilder().setName('points').setDescription('Check points').addUserOption(option => option.setName('user').setDescription('User to check').setRequired(false)),
    new SlashCommandBuilder().setName('addpoint').setDescription('Add a point').addUserOption(option => option.setName('user').setDescription('User to add point to').setRequired(true)),
    new SlashCommandBuilder().setName('removepoint').setDescription('Remove a point').addUserOption(option => option.setName('user').setDescription('User to remove point from').setRequired(true)),
    new SlashCommandBuilder().setName('addterm').setDescription('Add a banned term').addStringOption(option => option.setName('term').setDescription('Term to add').setRequired(true)),
    new SlashCommandBuilder().setName('removeterm').setDescription('Remove a banned term').addStringOption(option => option.setName('term').setDescription('Term to remove').setRequired(true)),
    new SlashCommandBuilder().setName('setpoints').setDescription('Set user points').addUserOption(option => option.setName('user').setDescription('User').setRequired(true)).addIntegerOption(option => option.setName('points').setDescription('Points to set').setRequired(true)),
    new SlashCommandBuilder().setName('listterms').setDescription('List all banned terms'),
    new SlashCommandBuilder().setName('version').setDescription('Show bot version'),
].map(cmd => cmd.toJSON());

// REST Client for Command Registration
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Once Bot is Ready
client.once('clientReady', async () => {
    console.log(`Swear Jar Bot v${VERSION} is now online!`);
    console.log(`✓ Bot logged in as ${client.user.tag}`);
    // Check Database Connection
    try {
        await pool.query('SELECT 1');
        console.log('✓ Database connected');
    } catch (err) {
        console.error('Failed to connect to database:', err.message);
    }
    // Register Slash Commands
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✓ Slash commands registered');
    } catch (err) {
        console.error(err);
    }
});

// When a Message is Sent in Discord
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;
    const guildId = message.guildId;
    const words = message.content.toLowerCase().replaceAll(/[,?!.;:"']/g, '').split(/\s+/);
    let newPoints = 0;

    const guildTerms = getGuildTerms(guildId);
    for (const term of guildTerms) {
        const matches = words.filter(word => word === term.toLowerCase()).length;
        if (matches > 0) {
            newPoints = await updatePoints(userId, guildId, matches);
        }
    }
    if (newPoints > 0) {
        const count = await getPoints(userId, guildId);
        message.reply(`⚠️ Something Bad Has Been Detected! ${message.author.displayName} now has ${count} point${count !== 1 ? 's' : ''}.`);
    }
});

// Commands Handling
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        const command = interaction.commandName;
        const user = interaction.options.getUser('user') || interaction.user;

        if (command === 'points') {
            const count = await getPoints(user.id, interaction.guildId);
            await interaction.reply(`${user.displayName} has ${count} point${count !== 1 ? 's' : ''}.`);
        } else if (command === 'addpoint') {
            const newPoints = await updatePoints(user.id, interaction.guildId, 1);
            await interaction.reply(`Added a point to ${user.displayName}. Total: ${newPoints}`);
        } else if (command === 'removepoint') {
            const currentPoints = await getPoints(user.id, interaction.guildId);
            if (currentPoints > 0) {
                const newPoints = await updatePoints(user.id, interaction.guildId, -1);
                await interaction.reply(`Removed a point from ${user.displayName}. Total: ${newPoints}`);
            } else {
                await interaction.reply(`${user.displayName} has no points to remove.`);
            }
        } else if (command === 'addterm') {
            if (!interaction.member.permissions.has('Administrator')) {
                return await interaction.reply('You need Administrator permissions.');
            }
            const newTerm = interaction.options.getString('term');
            addGuildTerm(interaction.guildId, newTerm);
            await interaction.reply(`Added new term: "${newTerm}"`);
        } else if (command === 'removeterm') {
            if (!interaction.member.permissions.has('Administrator')) {
                return await interaction.reply('You need Administrator permissions.');
            }
            const termToRemove = interaction.options.getString('term');
            if (removeGuildTerm(interaction.guildId, termToRemove)) {
                await interaction.reply(`Removed term: "${termToRemove}"`);
            } else {
                await interaction.reply(`Term "${termToRemove}" not found.`);
            }
        } else if (command === 'setpoints') {
            if (!interaction.member.permissions.has('Administrator')) {
                return await interaction.reply('You need Administrator permissions.');
            }
            const points = interaction.options.getInteger('points');
            const currentPoints = await getPoints(user.id, interaction.guildId);
            const newPoints = await updatePoints(user.id, interaction.guildId, points - currentPoints);
            await interaction.reply(`Set ${user.displayName}'s points to ${newPoints}.`);
        } else if (command === 'listterms') {
            const guildTerms = getGuildTerms(interaction.guildId);
            const termsListDisplay = guildTerms.length > 0 ? guildTerms.join(', ') : 'No banned terms';
            await interaction.reply(`Banned terms: ${termsListDisplay}`);
        } else if (command === 'version') {
            await interaction.reply(`Swear Jar Bot version: v${VERSION}`);
        }
    } catch (err) {
        console.error('Interaction error:', err);
        if (!interaction.replied) {
            await interaction.reply('An error occurred.');
        }
    }
});

// Bot Login
client.login(process.env.DISCORD_TOKEN);
