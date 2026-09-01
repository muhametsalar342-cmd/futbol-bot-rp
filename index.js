const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// =====================================================
// UNITED LEAGUE BOT
// =====================================================

const PREFIX = ".";

const ROLE = {
    YONETICI: "1544449436011339806",
    KAYIT: "1544452022764568656",
    DEGER: "1544451743746891806",
    MOD: "1544450307088715917",
    TD: "1544452323450032229",
    OYUNCU: "1544452779156709516",
    KAYITSIZ: "1544488182027133030"
};

const TEAM_START_BUDGET = 100000000;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "database.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// =====================================================
// DATABASE
// =====================================================

const defaultDB = {
    players: {},
    teams: {},
    teamNames: [],
    contracts: {},
    transfers: [],
    matches: [],
    companies: {},
    sponsors: {},
    giveaways: {},
    warnings: {},
    valueHistory: {},
    budgetLogs: [],
    sponsorLogs: {},
    settings: {}
};

function loadDB() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(defaultDB, null, 2)
            );

            return structuredClone(defaultDB);
        }

        const data = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        return {
            ...structuredClone(defaultDB),
            ...data
        };
    } catch (err) {
        console.error("DATABASE OKUMA HATASI:", err);
        return structuredClone(defaultDB);
    }
}

let db = loadDB();

let saveTimer = null;

function saveDB() {
    clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
        try {
            const temp = DATA_FILE + ".tmp";

            fs.writeFileSync(
                temp,
                JSON.stringify(db, null, 2),
                "utf8"
            );

            fs.renameSync(temp, DATA_FILE);
        } catch (err) {
            console.error("DATABASE KAYDETME HATASI:", err);
        }
    }, 500);
}

function saveNow() {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(db, null, 2),
            "utf8"
        );
    } catch (err) {
        console.error("DATABASE SAVE:", err);
    }
}

// =====================================================
// CLIENT
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User
    ]
});

// =====================================================
// MONEY
// =====================================================

function parseMoney(input) {
    if (!input) return NaN;

    let text = String(input)
        .toUpperCase()
        .replace(/€/g, "")
        .replace(/\s/g, "");

    let multiplier = 1;

    if (text.endsWith("B")) {
        multiplier = 1000000000;
        text = text.slice(0, -1);
    } else if (text.endsWith("M")) {
        multiplier = 1000000;
        text = text.slice(0, -1);
    } else if (text.endsWith("K")) {
        multiplier = 1000;
        text = text.slice(0, -1);
    }

    text = text.replace(/\./g, "").replace(",", ".");

    const number = Number(text);

    if (!Number.isFinite(number)) return NaN;

    return Math.floor(number * multiplier);
}

function money(value) {
    value = Math.floor(Number(value) || 0);

    if (value >= 1000000000) {
        return `${Number(
            (value / 1000000000).toFixed(1)
        )}B€`;
    }

    if (value >= 1000000) {
        return `${Number(
            (value / 1000000).toFixed(1)
        )}M€`;
    }

    if (value >= 1000) {
        return `${Number(
            (value / 1000).toFixed(1)
        )}K€`;
    }

    return `${value}€`;
}

// =====================================================
// GENERAL FUNCTIONS
// =====================================================

function random(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}

function pick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[random(0, arr.length - 1)];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getPlayer(id) {
    if (!db.players[id]) {
        db.players[id] = {
            id,
            registered: false,
            value: 0,
            budget: 0,
            training: 0,
            goals: 0,
            assists: 0,
            matches: 0,
            yellow: 0,
            red: 0,
            penalties: {
                goals: 0,
                misses: 0
            },
            team: null,
            squad: false,
            formation: "4-3-3",
            company: null,
            contract: null
        };
    }

    return db.players[id];
}

function getTeamByDirector(userId) {
    return Object.values(db.teams).find(
        team => team.director === userId
    );
}

function getTeamByName(name) {
    if (!name) return null;

    return Object.values(db.teams).find(
        team =>
            team.name.toLowerCase() ===
            String(name).toLowerCase()
    );
}

function getTeamPlayers(team) {
    return Object.values(db.players).filter(
        player => player.team === team.id
    );
}

function memberHasRole(member, roleId) {
    return member.roles.cache.has(roleId);
}

function isAdmin(member) {
    return (
        member.permissions.has(
            PermissionsBitField.Flags.Administrator
        ) ||
        memberHasRole(member, ROLE.YONETICI)
    );
}

function isMod(member) {
    return (
        isAdmin(member) ||
        memberHasRole(member, ROLE.MOD)
    );
}

function isRegistration(member) {
    return (
        isAdmin(member) ||
        memberHasRole(member, ROLE.KAYIT)
    );
}

function isValueOfficial(member) {
    return (
        isAdmin(member) ||
        memberHasRole(member, ROLE.DEGER)
    );
}

function isTD(member) {
    return memberHasRole(member, ROLE.TD);
}

function isMention(text) {
    return /^<@!?\d+>$/.test(text || "");
}

function getMentionedMember(message) {
    return message.mentions.members.first() || null;
}

async function safeReply(message, text) {
    try {
        return await message.reply(text);
    } catch (err) {
        console.error("REPLY:", err.message);
        return null;
    }
}

async function safeSend(channel, data) {
    try {
        if (!channel || !channel.isTextBased()) {
            return null;
        }

        return await channel.send(data);
    } catch (err) {
        console.error("SEND:", err.message);
        return null;
    }
}

function findChannel(guild, names) {
    if (!guild) return null;

    if (!Array.isArray(names)) {
        names = [names];
    }

    return guild.channels.cache.find(
        channel => names.includes(channel.name)
    );
}

async function logMessage(guild, text) {
    const channel = findChannel(guild, [
        "📋・yetkili-log",
        "🛡️・moderasyon-log",
        "📋・kayıt-log",
        "💰・transfer-log"
    ]);

    if (channel) {
        await safeSend(channel, {
            content: `📝 ${text}`
        });
    }
}

// =====================================================
// VALUE
// =====================================================

function replaceValueInNickname(nickname, value) {
    if (!nickname) {
        return `Oyuncu | ${money(value)}`;
    }

    const parts = nickname.split("|");

    if (parts.length < 2) {
        return `${nickname} | ${money(value)}`;
    }

    parts[parts.length - 1] =
        ` ${money(value)}`;

    return parts.join("|").trim();
}

async function updatePlayerNickname(member, value) {
    try {
        if (!member.manageable) return false;

        const nickname =
            member.nickname ||
            member.user.username;

        await member.setNickname(
            replaceValueInNickname(
                nickname,
                value
            )
        );

        return true;
    } catch (err) {
        console.error("NICKNAME:", err.message);
        return false;
    }
}

function addValue(userId, amount, reason) {
    const player = getPlayer(userId);

    const oldValue = player.value;

    player.value += amount;

    if (player.value < 0) {
        player.value = 0;
    }

    if (!db.valueHistory[userId]) {
        db.valueHistory[userId] = [];
    }

    db.valueHistory[userId].push({
        oldValue,
        newValue: player.value,
        amount,
        reason,
        date: Date.now()
    });

    saveDB();

    return {
        oldValue,
        newValue: player.value
    };
}

// =====================================================
// TEAMS
// =====================================================

const REAL_TEAMS = [
    "Galatasaray",
    "Fenerbahçe",
    "Beşiktaş",
    "Trabzonspor",
    "Başakşehir",
    "Real Madrid",
    "Barcelona",
    "Atlético Madrid",
    "Manchester City",
    "Manchester United",
    "Liverpool",
    "Arsenal",
    "Chelsea",
    "Tottenham Hotspur",
    "Bayern Münih",
    "Borussia Dortmund",
    "Bayer Leverkusen",
    "Paris Saint-Germain",
    "Inter",
    "Milan",
    "Juventus",
    "Napoli",
    "Roma",
    "Lazio",
    "Ajax",
    "PSV Eindhoven",
    "Benfica",
    "Porto",
    "Sporting Lizbon"
];

function createTeam(name, guildId, directorId) {
    const id =
        `team_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 8)}`;

    db.teams[id] = {
        id,
        name,
        guildId,
        director: directorId,
        budget: TEAM_START_BUDGET,
        players: [],
        squad: [],
        formation: "4-3-3",
        points: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        company: null,
        sponsor: null,
        sponsorIncome: 0,
        createdAt: Date.now()
    };

    if (!db.teamNames.includes(name)) {
        db.teamNames.push(name);
    }

    saveDB();

    return db.teams[id];
}

async function createTeamRole(guild, team) {
    try {
        let role = guild.roles.cache.find(
            r => r.name === team.name
        );

        if (!role) {
            role = await guild.roles.create({
                name: team.name,
                reason: "United League takım rolü"
            });
        }

        team.roleId = role.id;

        saveDB();

        return role;
    } catch (err) {
        console.error("TEAM ROLE:", err.message);
        return null;
    }
}

async function giveTeamRole(member, team) {
    if (!team?.roleId) return;

    try {
        await member.roles.add(team.roleId);
    } catch (err) {
        console.error("TEAM ROLE ADD:", err.message);
    }
}

async function removeTeamRole(member, team) {
    if (!team?.roleId) return;

    try {
        if (member.roles.cache.has(team.roleId)) {
            await member.roles.remove(team.roleId);
        }
    } catch (err) {
        console.error("TEAM ROLE REMOVE:", err.message);
    }
}

// =====================================================
// REGISTRATION
// =====================================================

async function registerUser(member, type) {
    const player = getPlayer(member.id);

    player.registered = true;

    if (member.roles.cache.has(ROLE.KAYITSIZ)) {
        await member.roles.remove(ROLE.KAYITSIZ)
            .catch(() => {});
    }

    if (type === "td") {
        await member.roles.add(ROLE.TD)
            .catch(() => {});
    } else {
        await member.roles.add(ROLE.OYUNCU)
            .catch(() => {});
    }

    saveDB();

    const chat = findChannel(member.guild, [
        "💬・sohbet",
        "sohbet"
    ]);

    if (chat) {
        await safeSend(chat, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("📋 Kayıt Tamamlandı")
                    .setDescription(
                        `${member} kayıt işlemini tamamladı.\n\n` +
                        `👤 Tür: **${
                            type === "td"
                                ? "Teknik Direktör"
                                : "Futbolcu"
                        }**`
                    )
                    .setTimestamp()
            ]
        });
    }

    await logMessage(
        member.guild,
        `${member.user.tag} kayıt oldu.`
    );
}

// =====================================================
// COMPANIES
// =====================================================

const COMPANY_NAMES = [
    "Adidas",
    "Nike",
    "Puma",
    "Emirates",
    "Qatar Airways",
    "Coca-Cola",
    "Pepsi",
    "Samsung",
    "Sony",
    "Microsoft",
    "Apple",
    "Red Bull",
    "Visa",
    "Mastercard"
];

function setupCompanies() {
    for (const name of COMPANY_NAMES) {
        if (!db.companies[name]) {
            db.companies[name] = {
                name,
                owner: null,
                income: random(
                    500000,
                    2000000
                )
            };
        }
    }

    saveDB();
}

setupCompanies();

// =====================================================
// SPONSORS
// =====================================================

const SPONSOR_NAMES = [
    "Global Sports",
    "Elite Energy",
    "World Finance",
    "Prime Telecom",
    "United Bank",
    "Sport Media",
    "Football World",
    "Champion Group",
    "Mega Motors",
    "Future Tech"
];

function setupSponsors() {
    for (const name of SPONSOR_NAMES) {
        if (!db.sponsors[name]) {
            db.sponsors[name] = {
                name,
                team: null,
                income: random(
                    1000000,
                    5000000
                ),
                duration: 30
            };
        }
    }

    saveDB();
}

setupSponsors();

// =====================================================
// LEAGUE
// =====================================================

function sortTeams() {
    return Object.values(db.teams).sort(
        (a, b) => {
            if (b.points !== a.points) {
                return b.points - a.points;
            }

            const gdA =
                a.goalsFor - a.goalsAgainst;

            const gdB =
                b.goalsFor - b.goalsAgainst;

            if (gdB !== gdA) {
                return gdB - gdA;
            }

            return b.goalsFor - a.goalsFor;
        }
    );
}

function updateLeague(team1, team2, score1, score2) {
    team1.played++;
    team2.played++;

    team1.goalsFor += score1;
    team1.goalsAgainst += score2;

    team2.goalsFor += score2;
    team2.goalsAgainst += score1;

    if (score1 > score2) {
        team1.wins++;
        team2.losses++;

        team1.points += 3;
    } else if (score2 > score1) {
        team2.wins++;
        team1.losses++;

        team2.points += 3;
    } else {
        team1.draws++;
        team2.draws++;

        team1.points++;
        team2.points++;
    }

    saveDB();
}

// =====================================================
// MATCH
// =====================================================

async function startMatch(channel, team1, team2) {
    if (!team1 || !team2) {
        return null;
    }

    if (team1.id === team2.id) {
        return null;
    }

    const players1 = getTeamPlayers(team1);
    const players2 = getTeamPlayers(team2);

    let score1 = 0;
    let score2 = 0;

    const match = {
        id: `match_${Date.now()}`,
        team1: team1.id,
        team2: team2.id,
        score1: 0,
        score2: 0,
        events: [],
        startedAt: Date.now(),
        finished: false
    };

    db.matches.push(match);
    saveDB();

    const live = await safeSend(channel, {
        embeds: [
            new EmbedBuilder()
                .setTitle("⚽ UNITED LEAGUE | CANLI MAÇ")
                .setDescription(
                    `**${team1.name} 0 - 0 ${team2.name}**\n\n` +
                    "🟢 Maç başladı!"
                )
                .setTimestamp()
        ]
    });

    // API spamını önlemek için maç simülasyonu
    // 90 dakikayı hızlı simüle eder.
    for (let minute = 5; minute <= 90; minute += 5) {
        await sleep(1000);

        const chance = random(1, 100);

        let event = `⏱️ ${minute}'`;

        if (
            chance <= 15 &&
            players1.length > 0
        ) {
            const scorer = pick(players1);

            score1++;

            const player =
                getPlayer(scorer.id);

            player.goals++;

            match.events.push({
                minute,
                type: "goal",
                team: team1.id,
                player: scorer.id
            });

            event +=
                `\n⚽ ${team1.name} gol attı! ` +
                `(${scorer.name || scorer.id})`;
        } else if (
            chance <= 30 &&
            players2.length > 0
        ) {
            const scorer = pick(players2);

            score2++;

            const player =
                getPlayer(scorer.id);

            player.goals++;

            match.events.push({
                minute,
                type: "goal",
                team: team2.id,
                player: scorer.id
            });

            event +=
                `\n⚽ ${team2.name} gol attı! ` +
                `(${scorer.name || scorer.id})`;
        } else if (chance <= 38) {
            event += "\n🟨 Sarı kart!";
        } else if (chance <= 41) {
            event += "\n🟥 Kırmızı kart!";
        } else if (chance <= 47) {
            event += "\n🔄 Oyuncu değişikliği!";
        } else if (chance <= 53) {
            event += "\n🥅 Tehlikeli pozisyon!";
        }

        match.score1 = score1;
        match.score2 = score2;

        if (live) {
            await live.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(
                            "⚽ UNITED LEAGUE | CANLI MAÇ"
                        )
                        .setDescription(
                            `**${team1.name} ${score1} - ${score2} ${team2.name}**\n\n` +
                            event
                        )
                        .setTimestamp()
                ]
            }).catch(() => {});
        }
    }

    match.finished = true;
    match.finishedAt = Date.now();

    updateLeague(
        team1,
        team2,
        score1,
        score2
    );

    for (const player of [
        ...players1,
        ...players2
    ]) {
        const p = getPlayer(player.id);
        p.matches++;
    }

    saveDB();

    await safeSend(channel, {
        embeds: [
            new EmbedBuilder()
                .setTitle("🏁 MAÇ SONA ERDİ")
                .setDescription(
                    `## ${team1.name} ${score1} - ${score2} ${team2.name}\n\n` +
                    (
                        score1 > score2
                            ? `🏆 Kazanan: **${team1.name}**`
                            : score2 > score1
                                ? `🏆 Kazanan: **${team2.name}**`
                                : "🤝 Berabere!"
                    )
                )
                .setTimestamp()
        ]
    });

    return match;
}

// =====================================================
// GIVEAWAY
// =====================================================

function parseDuration(text) {
    if (!text) return NaN;

    const match =
        String(text)
            .toLowerCase()
            .match(/^(\d+)(s|m|h|d)$/);

    if (!match) return NaN;

    const value = Number(match[1]);
    const unit = match[2];

    if (unit === "s") return value;
    if (unit === "m") return value * 60;
    if (unit === "h") return value * 3600;
    if (unit === "d") return value * 86400;

    return NaN;
}

async function startGiveaway(message, prize, seconds) {
    const id =
        `giveaway_${Date.now()}`;

    db.giveaways[id] = {
        id,
        guildId: message.guild.id,
        channelId: message.channel.id,
        prize,
        participants: [],
        end: Date.now() + seconds * 1000,
        ended: false
    };

    saveDB();

    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `giveaway:${id}`
                    )
                    .setLabel("Katıl")
                    .setEmoji("🎉")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    const msg = await safeSend(
        message.channel,
        {
            embeds: [
                new EmbedBuilder()
                    .setTitle("🎉 ÇEKİLİŞ")
                    .setDescription(
                        `🎁 Ödül: **${prize}**\n\n` +
                        `⏱️ Süre: **${seconds} saniye**\n\n` +
                        "Katılmak için butona bas!"
                    )
                    .setTimestamp()
            ],
            components: [row]
        }
    );

    if (msg) {
        db.giveaways[id].messageId =
            msg.id;
    }

    saveDB();

    setTimeout(async () => {
        const giveaway =
            db.giveaways[id];

        if (!giveaway || giveaway.ended) {
            return;
        }

        giveaway.ended = true;

        const winner =
            pick(giveaway.participants);

        if (!winner) {
            await safeSend(
                message.channel,
                "❌ Çekilişe kimse katılmadı."
            );
        } else {
            await safeSend(
                message.channel,
                `🎉 Çekiliş sona erdi!\n\n` +
                `🏆 Kazanan: <@${winner}>\n` +
                `🎁 Ödül: **${prize}**`
            );
        }

        saveDB();
    }, seconds * 1000);
}

// =====================================================
// SERVER SETUP
// =====================================================

const SERVER_STRUCTURE = [
    {
        category: "📁 UNITED LEAGUE",
        channels: [
            "📢・duyurular",
            "💬・sohbet",
            "👋・gelen-giden",
            "📜・kurallar"
        ]
    },
    {
        category: "📁 KAYIT",
        channels: [
            "📝・kayıt",
            "📋・kayıt-log"
        ]
    },
    {
        category: "📁 TAKIM & KADRO",
        channels: [
            "🏟️・takımlar",
            "👥・kadrolar",
            "📊・puan-durumu",
            "📅・fikstür",
            "⚽・maçlar"
        ]
    },
    {
        category: "📁 TRANSFER",
        channels: [
            "🔄・transfer",
            "📜・sözleşmeler",
            "💰・transfer-log"
        ]
    },
    {
        category: "📁 EKONOMİ",
        channels: [
            "💵・bütçeler",
            "💎・değerler",
            "🤝・sponsorlar",
            "🏢・şirketler"
        ]
    },
    {
        category: "📁 MEDYA",
        channels: [
            "📰・haberler",
            "🐦・tweetler",
            "📸・transfer-duyuruları"
        ]
    },
    {
        category: "📁 YETKİLİ",
        channels: [
            "🔐・yetkili-sohbet",
            "📋・yetkili-log",
            "🛡️・moderasyon-log",
            "🎁・çekiliş-log"
        ]
    },
    {
        category: "📁 SOHBET",
        channels: [
            "💬・sohbet",
            "🤖・bot-komut",
            "🖼️・görsel"
        ]
    }
];

async function setupServer(guild) {
    for (const group of SERVER_STRUCTURE) {
        let category =
            guild.channels.cache.find(
                c =>
                    c.type === ChannelType.GuildCategory &&
                    c.name === group.category
            );

        if (!category) {
            category =
                await guild.channels.create({
                    name: group.category,
                    type: ChannelType.GuildCategory
                });
        }

        for (const name of group.channels) {
            const exists =
                guild.channels.cache.find(
                    c =>
                        c.parentId === category.id &&
                        c.name === name
                );

            if (!exists) {
                await guild.channels.create({
                    name,
                    type: ChannelType.GuildText,
                    parent: category.id
                });
            }
        }
    }

    const registration =
        guild.channels.cache.find(
            c => c.name === "📝・kayıt"
        );

    if (registration) {
        try {
            await registration.permissionOverwrites.edit(
                guild.roles.everyone,
                {
                    ViewChannel: false
                }
            );

            const role =
                guild.roles.cache.get(
                    ROLE.KAYITSIZ
                );

            if (role) {
                await registration.permissionOverwrites.edit(
                    role,
                    {
                        ViewChannel: true,
                        SendMessages: true
                    }
                );
            }
        } catch (err) {
            console.error(
                "KAYIT KANALI:",
                err.message
            );
        }
    }

    saveDB();
}

// =====================================================
// READY
// =====================================================

client.once("ready", () => {
    console.log("================================");
    console.log("✅ UNITED LEAGUE BOT AKTİF");
    console.log(`🤖 ${client.user.tag}`);
    console.log(
        `🏠 ${client.guilds.cache.size} sunucu`
    );
    console.log("================================");

    client.user.setPresence({
        activities: [
            {
                name: "United League ⚽",
                type: 3
            }
        ],
        status: "online"
    });
});

// =====================================================
// MEMBER JOIN
// =====================================================

client.on(
    "guildMemberAdd",
    async member => {
        try {
            const player =
                getPlayer(member.id);

            player.registered = false;

            const role =
                member.guild.roles.cache.get(
                    ROLE.KAYITSIZ
                );

            if (role) {
                await member.roles.add(role)
                    .catch(() => {});
            }

            const channel =
                findChannel(member.guild, [
                    "👋・gelen-giden",
                    "gelen-giden"
                ]);

            if (channel) {
                await safeSend(channel, {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "👋 Yeni Oyuncu"
                            )
                            .setDescription(
                                `Sunucuya yeni oyuncu katıldı!\n\n${member}`
                            )
                            .setTimestamp()
                    ]
                });
            }

            saveDB();
        } catch (err) {
            console.error(
                "MEMBER JOIN:",
                err
            );
        }
    }
);

// =====================================================
// INTERACTIONS
// =====================================================

client.on(
    "interactionCreate",
    async interaction => {
        try {
            // =========================================
            // KAYIT
            // =========================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "register:"
                )
            ) {
                if (
                    !isRegistration(
                        interaction.member
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Kayıt Yetkilisi değilsin.",
                        ephemeral: true
                    });
                }

                const [
                    ,
                    type,
                    userId
                ] =
                    interaction.customId.split(":");

                const member =
                    await interaction.guild.members
                        .fetch(userId)
                        .catch(() => null);

                if (!member) {
                    return interaction.reply({
                        content:
                            "❌ Oyuncu bulunamadı.",
                        ephemeral: true
                    });
                }

                await registerUser(
                    member,
                    type
                );

                return interaction.reply({
                    content:
                        `✅ ${member} kayıt edildi.`,
                    ephemeral: true
                });
            }

            // =========================================
            // ÇEKİLİŞ
            // =========================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "giveaway:"
                )
            ) {
                const id =
                    interaction.customId.split(":")[1];

                const giveaway =
                    db.giveaways[id];

                if (
                    !giveaway ||
                    giveaway.ended
                ) {
                    return interaction.reply({
                        content:
                            "❌ Çekiliş sona ermiş.",
                        ephemeral: true
                    });
                }

                if (
                    !giveaway.participants.includes(
                        interaction.user.id
                    )
                ) {
                    giveaway.participants.push(
                        interaction.user.id
                    );

                    saveDB();
                }

                return interaction.reply({
                    content:
                        "🎉 Çekilişe katıldın!",
                    ephemeral: true
                });
            }
        } catch (err) {
            console.error(
                "INTERACTION ERROR:",
                err
            );

            if (!interaction.replied) {
                await interaction.reply({
                    content:
                        "❌ İşlem sırasında hata oluştu.",
                    ephemeral: true
                }).catch(() => {});
            }
        }
    }
);

// =====================================================
// MESSAGE COMMANDS
// =====================================================

client.on(
    "messageCreate",
    async message => {
        try {
            if (
                message.author.bot ||
                !message.guild ||
                !message.content.startsWith(PREFIX)
            ) {
                return;
            }

            const args =
                message.content
                    .slice(PREFIX.length)
                    .trim()
                    .split(/\s+/);

            const command =
                (args.shift() || "")
                    .toLowerCase();

            // =========================================
            // YARDIM
            // =========================================

            if (command === "yardım") {
                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "⚽ UNITED LEAGUE | YARDIM"
                        )
                        .setDescription(
                            [
                                "**📋 Kayıt**",
                                "`.k @oyuncu`",
                                "",
                                "**🏟️ Takım**",
                                "`.takımkur`",
                                "`.kadro`",
                                "`.kadrom`",
                                "`.kadroekle @oyuncu`",
                                "`.kadroçıkar @oyuncu`",
                                "`.formasyon 4-3-3`",
                                "",
                                "**💰 Değer**",
                                "`.dver @oyuncu 5M`",
                                "`.dsil @oyuncu 1M`",
                                "`.değer @oyuncu`",
                                "`.değergeçmiş @oyuncu`",
                                "",
                                "**⚽ Futbol**",
                                "`.ant`",
                                "`.antrenman`",
                                "`.pen`",
                                "`.penaltı`",
                                "`.istatistik @oyuncu`",
                                "",
                                "**🏆 Lig**",
                                "`.maç @TD1 @TD2`",
                                "`.maçlar`",
                                "`.maçgeçmişi`",
                                "`.lig`",
                                "`.puan`",
                                "`.fikstür`",
                                "`.sonuçlar`",
                                "`.golkrallığı`",
                                "`.asistkrallığı`",
                                "",
                                "**💵 Bütçe**",
                                "`.bütçe`",
                                "`.bütçever @oyuncu 5M`",
                                "`.bütçeal @oyuncu 5M`",
                                "`.gönder @oyuncu 5M`",
                                "`.takımbütçesi`",
                                "",
                                "**🤝 Sponsor/Şirket**",
                                "`.şirketler`",
                                "`.şirketseç Adidas`",
                                "`.şirketim`",
                                "`.sponsorlar`",
                                "`.sponsorseç Global Sports`",
                                "`.sponsorlarım`",
                                "",
                                "**🛡️ Yetkili**",
                                "`.sil 100`",
                                "`.kick @oyuncu`",
                                "`.ban @oyuncu`",
                                "`.mute @oyuncu`",
                                "`.unmute @oyuncu`",
                                "`.uyar @oyuncu sebep`",
                                "`.sicil @oyuncu`",
                                "`.kilit`",
                                "`.aç`",
                                "",
                                "**🎁 Medya**",
                                "`.çekiliş 30M€ 1m`",
                                "`.tweet mesaj`",
                                "`.haber mesaj`",
                                "`.transferduyuru mesaj`",
                                "`.duyuru mesaj`",
                                "`.embed başlık | açıklama`",
                                "`.spoiler mesaj`",
                                "",
                                "**👤 Profil**",
                                "`.profil @oyuncu`",
                                "`.takımprofil takım`"
                            ].join("\n")
                        );

                return safeReply(
                    message,
                    { embeds: [embed] }
                );
            }

            // =========================================
            // KAYIT
            // =========================================

            if (command === "k") {
                if (!isRegistration(message.member)) {
                    return safeReply(
                        message,
                        "❌ Kayıt Yetkilisi değilsin."
                    );
                }

                const member =
                    getMentionedMember(message);

                if (!member) {
                    return safeReply(
                        message,
                        "❌ Kullanıcı etiketle."
                    );
                }

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `register:player:${member.id}`
                                )
                                .setLabel(
                                    "Futbolcu"
                                )
                                .setEmoji("⚽")
                                .setStyle(
                                    ButtonStyle.Primary
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    `register:td:${member.id}`
                                )
                                .setLabel(
                                    "Teknik Direktör"
                                )
                                .setEmoji("👔")
                                .setStyle(
                                    ButtonStyle.Success
                                )
                        );

                return safeReply(
                    message,
                    {
                        content:
                            `${member} için kayıt türünü seç:`,
                        components: [row]
                    }
                );
            }

            // =========================================
            // SUNUCU KUR
            // =========================================

            if (command === "sunucukur") {
                if (!isAdmin(message.member)) {
                    return safeReply(
                        message,
                        "❌ Yönetici değilsin."
                    );
                }

                await setupServer(
                    message.guild
                );

                return safeReply(
                    message,
                    "✅ United League sunucu yapısı oluşturuldu."
                );
            }

            // =========================================
            // TAKIM KUR
            // =========================================

            if (command === "takımkur") {
                if (!isTD(message.member)) {
                    return safeReply(
                        message,
                        "❌ Teknik Direktör olmalısın."
                    );
                }

                if (
                    getTeamByDirector(
                        message.author.id
                    )
                ) {
                    return safeReply(
                        message,
                        "❌ Zaten bir takım yönetiyorsun."
                    );
                }

                const available =
                    REAL_TEAMS.filter(
                        name =>
                            !db.teamNames.includes(
                                name
                            )
                    );

                if (!available.length) {
                    return safeReply(
                        message,
                        "❌ Kullanılabilir takım kalmadı."
                    );
                }

                const options =
                    available.slice(0, 25);

                const menu =
                    new StringSelectMenuBuilder()
                        .setCustomId(
                            `teamcreate:${message.author.id}`
                        )
                        .setPlaceholder(
                            "Takımını seç"
                        )
                        .addOptions(
                            options.map(
                                name => ({
                                    label: name,
                                    value: name
                                })
                            )
                        );

                return safeReply(
                    message,
                    {
                        content:
                            "🏟️ Takımını seç:",
                        components: [
                            new ActionRowBuilder()
                                .addComponents(menu)
                        ]
                    }
                );
            }

            // =========================================
            // TAKIM SEÇİMİ
            // =========================================

            if (
                interactionDoesNotExist()
            ) {
                // sadece güvenlik için
            }

            // =========================================
            // KADRO
            // =========================================

            if (
                command === "kadro" ||
                command === "kadrom"
            ) {
                const team =
                    getTeamByDirector(
                        message.author.id
                    );

                if (!team) {
                    return safeReply(
                        message,
                        "❌ Bir takımın yok."
                    );
                }

                const players =
                    getTeamPlayers(team)
                        .filter(
                            p =>
                                team.squad.includes(
                                    p.id
                                )
                        );

                if (!players.length) {
                    return safeReply(
                        message,
                        `📋 **${team.name}** kadrosu boş.`
                    );
                }

                const text =
                    players
                        .map(
                            (p, i) =>
                                `**${i + 1}.** <@${p.id}> — ${money(p.value)}`
                        )
                        .join("\n");

                return safeReply(
                    message,
                    {
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(
                                    `👥 ${team.name} | KADRO`
                                )
                                .setDescription(
                                    text
                                )
                        ]
                    }
                );
            }

            // =========================================
            // KADRO EKLE
            // =========================================

            if (command === "kadroekle") {
                const team =
                    getTeamByDirector(
                        message.author.id
                    );

                if (!team) {
                    return safeReply(
                        message,
                        "❌ Takımın yok."
                    );
                }

                const member =
                    getMentionedMember(message);

                if (!member) {
                    return safeReply(
                        message,
                        "❌ Oyuncu etiketle."
                    );
                }

                const player =
                    getPlayer(member.id);

                if (
                    player.team !== team.id
                ) {
                    return safeReply(
                        message,
                        "❌ Oyuncu takımında değil."
                    );
                }

                if (
                    team.squad.includes(
                        member.id
                    )
                ) {
                    return safeReply(
                        message,
                        "❌ Oyuncu zaten kadroda."
                    );
                }

                team.squad.push(member.id);
                player.squad = true;

                saveDB();

                return safeReply(
                    message,
                    `✅ ${member} kadroya eklendi.`
                );
            }

            // =========================================
            // KADRO ÇIKAR
            // =========================================

            if (command === "kadroçıkar") {
                const team =
                    getTeamByDirector(
                        message.author.id
                    );

                if (!team) {
                    return safeReply(
                        message,
                        "❌ Takımın yok."
                    );
                }

                const member =
                    getMentionedMember(message);

                if (!member) {
                    return safeReply(
                        message,
                        "❌ Oyuncu etiketle."
                    );
                }

                team.squad =
                    team.squad.filter(
                        id =>
                            id !== member.id
                    );

                const player =
                    getPlayer(member.id);

                player.squad = false;

                saveDB();

                return safeReply(
                    message,
                    `✅ ${member} kadrodan çıkarıldı.`
                );
            }

            // =========================================
            // FORMASYON
            // =========================================

            if (command === "formasyon") {
                const team =
                    getTeamByDirector(
                        message.author.id
                    );

                if (!team) {
                    return safeReply(
                        message,
                        "❌ Takımın yok."
                    );
                }

                const formations = [
                    "4-2-1-3-2",
                    "4-3-3",
                    "4-2-3-1",
                    "4-4-2",
                    "4-1-2-3",
                    "3-4-3",
                    "3-5-2",
                    "5-3-2",
                    "5-4-1"
                ];

                const formation =
                    args[0];

                if (
                    !formations.includes(
                        formation
                    )
                ) {
                    return safeReply(
                        message,
                        `❌ Geçersiz formasyon.\n\n${formations.join(", ")}`
                    );
                }

                team.formation =
                    formation;

                saveDB();

                return safeReply(
                    message,
                    `✅ Formasyon: **${formation}**`
                );
            }

            // =========================================
            // DEĞER VER
            // =========================================

            if (command === "dver") {
                if (
                    !isValueOfficial(
                        message.member
                    )
                ) {
                    return safeReply(
                        message,
                        "❌ Değer Yetkilisi değilsin."
                    );
                }

                const member =
                    getMentionedMember(message);

                const amount =
                    parseMoney(args[1]);

                if (!member || !Number.isFinite(amount)) {
                    return safeReply(
                        message,
                        "❌ Kullanım: `.dver @oyuncu 5M`"
                    );
                }

                const result =
                    addValue(
                        member.id,
                        amount,
                        "Yetkili değer verme"
                    );

                await updatePlayerNickname(
                    member,
                    result.newValue
                );

                return safeReply(
                    message,
                    `💎 ${member} değeri **${money(result.oldValue)} → ${money(result.newValue)}** oldu.`
                );
            }

            // =========================================
            // DEĞER SİL
            // =========================================

            if (command === "dsil") {
                if (
                    !isValueOfficial(
                        message.member
                    )
                ) {
                    return safeReply(
                        message,
                        "❌ Değer Yetkilisi değilsin."
                    );
                }

                const member =
                    getMentionedMember(message);

                const amount =
                    parseMoney(args[1]);

                if (!member || !Number.isFinite(amount)) {
                    return safeReply(
                        message,
                        "❌ Kullanım: `.dsil @oyuncu 5M`"
                    );
                }

                const result =
                    addValue(
                        member.id,
                        -amount,
                        "Yetkili değer silme"
                    );

                await updatePlayerNickname(
                    member,
                    result.newValue
                );

                return safeReply(
                    message,
                    `💎 ${member} yeni değeri: **${money(result.newValue)}**`
                );
            }

            // =========================================
            // DEĞER
            // =========================================

            if (command === "değer") {
                const member =
                    getMentionedMember(message) ||
                    message.member;

                const player =
                    getPlayer(member.id);

                return safeReply(
                    message,
                    `💎 ${member} oyuncu değeri: **${money(player.value)}**`
                );
            }

            // =========================================
            // DEĞER GEÇMİŞ
            // =========================================

            if (
                command === "değergeçmiş"
            ) {
                const member =
                    getMentionedMember(message) ||
                    message.member;

                const history =
                    db.valueHistory[
                        member.id
                    ] || [];

                if (!history.length) {
                    return safeReply(
                        message,
                        "📭 Değer geçmişi yok."
                    );
                }

                const text =
                    history
                        .slice(-10)
                        .reverse()
                        .map(
                            h =>
                                `• ${money(h.oldValue)} → ${money(h.newValue)} — ${h.reason}`
                        )
                        .join("\n");

                return safeReply(
                    message,
                    {
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(
                                    `💎 ${member.user.username} | DEĞER GEÇMİŞİ`
                                )
                                .setDescription(
                                    text
                                )
                        ]
                    }
                );
            }

            // =========================================
            // ANTRENMAN
            // =========================================

            if (
                command === "ant" ||
                command === "antrenman"
            ) {
                const player =
                    getPlayer(
                        message.author.id
                    );

                player.training++;

                if (
                    player.training >= 10
                ) {
                    player.training = 1;

                    const result =
                        addValue(
                            message.author.id,
                            3000000,
                            "Antrenman ödülü"
                        );

                    await updatePlayerNickname(
                        message.member,
                        result.newValue
                    );

                    return safeReply(
                        message,
                        `🏋️ **10/10** tamamlandı!\n\n💎 +3M€\n💰 Yeni değer: **${money(result.newValue)}**\n\n🔄 Antrenman **1/10** olarak yenilendi.`
                    );
                }

                saveDB();

                return safeReply(
                    message,
                    `🏋️ Antrenman: **${player.training}/10**`
                );
            }

            // =========================================
            // PENALTI
            // =========================================

            if (
                command === "pen" ||
                command === "penaltı"
            ) {
                const player =
                    getPlayer(
                        message.author.id
                    );

                const goal =
                    random(1, 100) <= 60;

                if (goal) {
                    player.penalties.goals++;

                    const result =
                        addValue(
                            message.author.id,
                            2000000,
                            "Penaltı golü"
                        );

                    await updatePlayerNickname(
                        message.member,
                        result.newValue
                    );

                    saveDB();

                    return safeReply(
                        message,
                        `⚽ **GOOOL!**\n\n💎 +2M€\n💰 Değer: **${money(result.newValue)}**`
                    );
                }

                player.penalties.misses++;

                saveDB();

                return safeReply(
                    message,
                    "🧤 **KURTARDI!** Penaltı kaçtı."
                );
            }

            // =========================================
            // İSTATİSTİK
            // =========================================

            if (
                command === "istatistik"
            ) {
                const member =
                    getMentionedMember(message) ||
                    message.member;

                const p =
                    getPlayer(member.id);

                return safeReply(
                    message,
                    {
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(
                                    `📊 ${member.user.username} | İSTATİSTİK`
                                )
                                .addFields(
                                    {
                                        name: "💎 Değer",
                                        value: money(
                                            p.value
                                        ),
                                        inline: true
                                    },
                                    {
                                        name: "⚽ Gol",
                                        value: String(
                                            p.goals
                                        ),
                                        inline: true
                                    },
                                    {
                                        name: "🎯 Asist",
                                        value: String(
                                            p.assists
                                        ),
                                        inline: true
                                    },
                                    {
                                        name: "🏟️ Maç",
                                        value: String(
                                            p.matches
                                        ),
                                        inline: true
                                    },
                                    {
                                        name: "🟨 Sarı",
                                        value: String(
                                            p.yellow
                                        ),
                                        inline: true
                                    },
                                    {
                                        name: "🟥 Kırmızı",
                                        value: String(
                                            p.red
                                        ),
                                        inline: true
                                    }
                                )
                        ]
                    }
                );
            }

            // =========================================
            // BÜTÇE
            // =========================================

            if (command === "bütçe") {
                const player =
                    getPlayer(
                        message.author.id
                    );

                return safeReply(
                    message,
                    `💵 Kişisel bütçen: **${money(player.budget)}**`
                );
            }

            // =========================================
            // BÜTÇE VER
            // =========================================

            if (
                command === "bütçever"
            ) {
                if (!isAdmin(message.member)) {
                    return safeReply(
                        message,
                        "❌ Yönetici değilsin."
                    );
                }

                const member =
                    getMentionedMember(message);

                const amount =
                    parseMoney(args[1]);

                if (!member || !Number.isFinite(amount)) {
                    return safeReply(
                        message,
                        "❌ Kullanım: `.bütçever @oyuncu 5M`"
                    );
                }

                const p =
                    getPlayer(member.id);

                p.budget += amount;

                logBudget(
                    "VER",
                    message.author.id,
                    member.id,
                    amount
                );

                saveDB();

                return safeReply(
                    message,
                    `💵 ${member} hesabına **${money(amount)}** eklendi.`
                );
            }

            // =========================================
            // BÜTÇE AL
            // =========================================

            if (
                command === "bütçeal"
            ) {
                if (!isAdmin(message.member)) {
                    return safeReply(
                        message,
                        "❌ Yönetici değilsin."
                    );
                }

                const member =
                    getMentionedMember(message);

                const amount =
                    parseMoney(args[1]);

                if (!member || !Number.isFinite(amount)) {
                    return safeReply(
                        message,
                        "❌ Kullanım: `.bütçeal @oyuncu 5M`"
                    );
                }

                const p =
                    getPlayer(member.id);

                p.budget =
                    Math.max(
                        0,
                        p.budget - amount
                    );

                logBudget(
                    "AL",
                    message.author.id,
                    member.id,
                    amount
                );

                saveDB();

                return safeReply(
                    message,
                    `💵 ${member} hesabından **${money(amount)}** alındı.`
                );
            }

            // =========================================
            // GÖNDER
            // =========================================

            if (command === "gönder") {
                const member =
                    getMentionedMember(message);

                const amount =
                    parseMoney(args[1]);

                if (!member || !Number.isFinite(amount)) {
                    return safeReply(
                        message,
                        "❌ Kullanım: `.gönder @oyuncu 5M`"
                    );
                }

                if (
                    member.id ===
                    message.author.id
                ) {
                    return safeReply(
                        message,
                        "❌ Kendine para gönderemezsin."
                    );
                }

                const sender =
                    getPlayer(
                        message.author.id
                    );

                if (
                    sender.budget < amount
                ) {
                    return safeReply(
                        message,
                        "❌ Yeterli bütçen yok."
                    );
                }

                sender.budget -= amount;

                const receiver =
                    getPlayer(member.id);

                receiver.budget += amount;

                saveDB();

                return safeReply(
                    message,
                    `💸 ${member} kullanıcısına **${money(amount)}** gönderildi.`
                );
            }

            // =========================================
            // TAKIM BÜTÇESİ
            // =========================================

            if (
                command === "takımbütçesi"
            ) {
                const team =
                    getTeamByDirector(
                        message.author.id
                    );

                if (!team) {
                    return safeReply(
                        message,
                        "❌ Takımın yok."
                    );
                }

                return safeReply(
                    message,
                    `💰 **${team.name}** takım bütçesi: **${money(team.budget)}**`
                );
            }

            // =========================================
            // TAKIM BÜTÇE VER
            // =========================================

            if (
                command === "takımbütçever"
            ) {
                if (!isAdmin(message.member)) {
                    return safeReply(
                        message,
                        "❌ Yönetici değilsin."
                    );
                }

                const teamName =
                    args
                        .slice(0, -1)
                        .join(" ");

                const amount =
                    parseMoney(
                        args[args.length - 1]
                    );

                const team =
                    getTeamByName(
                        teamName
                    );

                if (
                    !team ||
                    !Number.isFinite(amount)
                ) {
                    return safeReply(
                        message,
                        "❌ Kullanım: `.takımbütçever Galatasaray 10M`"
                    );
                }

                team.budget += amount;

                saveDB();

                return safeReply(
                    message,
                    `💰 ${team.name} bütçesine **${money(amount)}** eklendi.`
                );
            }

            // =========================================
            // TAKIM BÜTÇE AL
            // =========================================

            if (
                command === "takımbütçeal"
            ) {
                if (!isAdmin(message.member)) {
                    return safeReply(
                        message,
                        "❌ Yönetici değilsin."
                    );
                }

                const teamName =
                    args
                        .slice(0, -1)
                        .join(" ");

                const amount =
                    parseMoney(
                        args[args.length - 1]
                    );

                const team =
                    getTeamByName(
                        te
