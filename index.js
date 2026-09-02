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
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

/* =========================================================
   UNITED LEAGUE BOT
   Prefix: .
   ========================================================= */

/* ================= TOKEN KONTROL ================= */

if (!process.env.TOKEN) {
    console.error("========================================");
    console.error("❌ TOKEN BULUNAMADI!");
    console.error("Railway > Variables > TOKEN ekle.");
    console.error("========================================");
    process.exit(1);
}

/* ================= CLIENT ================= */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.User,
        Partials.Message
    ]
});

/* ================= AYARLAR ================= */

const PREFIX = ".";

const ROLES = {
    YONETICI: "1544449436011339806",
    KAYIT: "1544452022764568656",
    DEGER: "1544451743746891806",
    MOD: "1544450307088715917",
    TD: "1544452323450032229",
    OYUNCU: "1544452779156709516",
    KAYITSIZ: "1544488182027133030"
};

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "database.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* ================= DATABASE ================= */

const defaultDB = {
    users: {},
    teams: {},
    contracts: {},
    transfers: [],
    matches: [],
    companies: {},
    sponsors: {},
    giveaways: {},
    warnings: {},
    usedTeams: [],
    logs: []
};

let db;

function loadDB() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(defaultDB, null, 2),
                "utf8"
            );
        }

        db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

        for (const key of Object.keys(defaultDB)) {
            if (db[key] === undefined) {
                db[key] = defaultDB[key];
            }
        }

    } catch (error) {
        console.error("DATABASE OKUMA HATASI:", error);

        db = JSON.parse(JSON.stringify(defaultDB));

        try {
            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(db, null, 2),
                "utf8"
            );
        } catch (e) {
            console.error("DATABASE OLUŞTURULAMADI:", e);
        }
    }
}

loadDB();

let saveTimer = null;

function saveDB() {
    clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
        try {
            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(db, null, 2),
                "utf8"
            );
        } catch (error) {
            console.error("DATABASE KAYIT HATASI:", error);
        }
    }, 500);
}

/* ================= YARDIMCI FONKSİYONLAR ================= */

function ensureUser(id) {
    if (!db.users[id]) {
        db.users[id] = {
            value: 0,
            budget: 0,
            training: 0,
            goals: 0,
            assists: 0,
            matches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            yellow: 0,
            red: 0,
            penalties: 0,
            penaltyGoals: 0,
            team: null,
            squad: true
        };
        saveDB();
    }

    return db.users[id];
}

function money(value) {
    value = Number(value) || 0;

    if (value >= 1000000000) {
        return (value / 1000000000).toFixed(1).replace(".0", "") + "B€";
    }

    if (value >= 1000000) {
        return (value / 1000000).toFixed(1).replace(".0", "") + "M€";
    }

    if (value >= 1000) {
        return (value / 1000).toFixed(1).replace(".0", "") + "K€";
    }

    return `${Math.floor(value)}€`;
}

function parseMoney(input) {
    if (!input) return NaN;

    let text = String(input)
        .toLowerCase()
        .replace(/€/g, "")
        .replace(/\s/g, "")
        .replace(/,/g, ".");

    let multiplier = 1;

    if (text.endsWith("m")) {
        multiplier = 1000000;
        text = text.slice(0, -1);
    } else if (text.endsWith("k")) {
        multiplier = 1000;
        text = text.slice(0, -1);
    } else if (text.endsWith("b")) {
        multiplier = 1000000000;
        text = text.slice(0, -1);
    }

    const number = Number(text);

    if (Number.isNaN(number)) return NaN;

    return Math.floor(number * multiplier);
}

function getMention(message, index = 0) {
    return message.mentions.members.first();
}

function isAdmin(member) {
    return (
        member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        member.roles.cache.has(ROLES.YONETICI)
    );
}

function hasRole(member, roleID) {
    return member.roles.cache.has(roleID);
}

function canManage(member) {
    return (
        isAdmin(member) ||
        hasRole(member, ROLES.MOD)
    );
}

function canValue(member) {
    return (
        isAdmin(member) ||
        hasRole(member, ROLES.DEGER)
    );
}

function canRegister(member) {
    return (
        isAdmin(member) ||
        hasRole(member, ROLES.KAYIT)
    );
}

function canTD(member) {
    return (
        isAdmin(member) ||
        hasRole(member, ROLES.TD)
    );
}

function getTeamByTD(userID) {
    return Object.values(db.teams).find(
        team => team.director === userID
    );
}

function getTeamByName(name) {
    if (!name) return null;

    return Object.values(db.teams).find(
        team => team.name.toLowerCase() === name.toLowerCase()
    );
}

function getPlayerTeam(userID) {
    const user = ensureUser(userID);

    if (!user.team) return null;

    return db.teams[user.team] || null;
}

function getChannel(guild, name) {
    return guild.channels.cache.find(
        channel =>
            channel.name === name ||
            channel.name.endsWith(name)
    );
}

function cleanChannelName(name) {
    return name
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s+/g, "-");
}

async function safeSend(channel, content) {
    if (!channel) return null;

    try {
        return await channel.send(content);
    } catch (error) {
        console.error("MESAJ GÖNDERME HATASI:", error.message);
        return null;
    }
}

async function logAction(guild, text) {
    try {
        db.logs.push({
            time: new Date().toISOString(),
            guild: guild.id,
            text
        });

        if (db.logs.length > 500) {
            db.logs.shift();
        }

        saveDB();

        const channel =
            getChannel(guild, "yetkili-log") ||
            getChannel(guild, "moderasyon-log");

        if (channel) {
            await channel.send(`📝 ${text}`).catch(() => {});
        }
    } catch {}
}

function setNicknameValue(member, newValue) {
    const oldName = member.displayName;

    const parts = oldName.split("|");

    if (parts.length >= 2) {
        parts[parts.length - 1] = ` ${money(newValue)}`;
        return parts.join("|").trim();
    }

    return `${oldName} | ${money(newValue)}`;
}

function addValue(member, amount) {
    const user = ensureUser(member.id);

    user.value += amount;

    if (user.value < 0) {
        user.value = 0;
    }

    const nickname = setNicknameValue(
        member,
        user.value
    );

    member.setNickname(nickname).catch(() => {});

    saveDB();

    return user.value;
}

function random(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function teamStats(team) {
    if (!team.stats) {
        team.stats = {
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            gf: 0,
            ga: 0,
            points: 0
        };
    }

    return team.stats;
}

function teamGoalDiff(team) {
    const s = teamStats(team);
    return s.gf - s.ga;
}

/* ================= TAKIMLAR ================= */

const REAL_TEAMS = [
    "Real Madrid",
    "Barcelona",
    "Manchester United",
    "Manchester City",
    "Liverpool",
    "Chelsea",
    "Arsenal",
    "Tottenham Hotspur",
    "Bayern Münih",
    "Borussia Dortmund",
    "Paris Saint-Germain",
    "Inter",
    "Milan",
    "Juventus",
    "Napoli",
    "Roma",
    "Lazio",
    "Atletico Madrid",
    "Sevilla",
    "Valencia",
    "Ajax",
    "Benfica",
    "Porto",
    "Galatasaray",
    "Fenerbahçe",
    "Beşiktaş",
    "Trabzonspor",
    "Al Nassr",
    "Al Hilal",
    "Bayer Leverkusen"
];

/* ================= ŞİRKETLER ================= */

const COMPANIES = [
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

const SPONSORS = [
    {
        name: "Adidas",
        income: 5000000
    },
    {
        name: "Nike",
        income: 6000000
    },
    {
        name: "Puma",
        income: 4000000
    },
    {
        name: "Emirates",
        income: 7000000
    },
    {
        name: "Qatar Airways",
        income: 7500000
    },
    {
        name: "Coca-Cola",
        income: 4500000
    },
    {
        name: "Red Bull",
        income: 6500000
    },
    {
        name: "Visa",
        income: 5500000
    }
];

/* ================= READY ================= */

client.once("ready", () => {
    console.log("====================================");
    console.log("✅ UNITED LEAGUE BOT AKTİF");
    console.log(`🤖 ${client.user.tag}`);
    console.log(`🏠 ${client.guilds.cache.size} sunucu`);
    console.log("====================================");

    client.user.setPresence({
        activities: [
            {
                name: "United League ⚽",
                type: 0
            }
        ],
        status: "online"
    });
});

/* ================= YENİ ÜYE ================= */

client.on("guildMemberAdd", async member => {
    try {
        ensureUser(member.id);

        const kayitsiz = member.guild.roles.cache.get(
            ROLES.KAYITSIZ
        );

        if (kayitsiz) {
            await member.roles.add(kayitsiz).catch(() => {});
        }

        const channel =
            getChannel(member.guild, "gelen-giden");

        if (channel) {
            await channel.send(
                `👋 **Yeni oyuncu geldi!**\n` +
                `${member} sunucuya katıldı.\n\n` +
                `📝 Kayıt için kayıt kanalını kullanabilirsiniz.`
            ).catch(() => {});
        }
    } catch (error) {
        console.error("GUILD MEMBER ADD:", error);
    }
});

/* ================= HATA KORUMASI ================= */

client.on("error", error => {
    console.error("DISCORD CLIENT ERROR:", error);
});

client.on("warn", warning => {
    console.warn("DISCORD WARN:", warning);
});

process.on("unhandledRejection", error => {
    console.error("UNHANDLED REJECTION:", error);
});

process.on("uncaughtException", error => {
    console.error("UNCAUGHT EXCEPTION:", error);
});

/* ================= MESSAGE ================= */

client.on("messageCreate", async message => {
    try {
        if (!message.guild) return;
        if (message.author.bot) return;

        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content
            .slice(PREFIX.length)
            .trim()
            .split(/\s+/);

        const command = args.shift()?.toLowerCase();

        if (!command) return;

        ensureUser(message.author.id);

        /* =====================================================
           YARDIM
           ===================================================== */

        if (command === "yardım" || command === "help") {
            const embed = new EmbedBuilder()
                .setTitle("⚽ UNITED LEAGUE KOMUTLARI")
                .setDescription(
                    [
                        "**👤 Kayıt**",
                        "`.k @oyuncu İsim`",
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
                        "`.dsil @oyuncu 2M`",
                        "`.değer @oyuncu`",
                        "`.değergeçmiş @oyuncu`",
                        "",
                        "**⚽ Oyuncu**",
                        "`.ant`",
                        "`.antrenman`",
                        "`.pen`",
                        "`.penaltı`",
                        "`.profil @oyuncu`",
                        "",
                        "**🔄 Transfer**",
                        "`.oyuncual @oyuncu`",
                        "`.sözleşme @oyuncu`",
                        "`.sözleşmeiptal @oyuncu`",
                        "",
                        "**🏆 Lig**",
                        "`.maç @oyuncu1 @oyuncu2`",
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
                        "`.bütçeler`",
                        "",
                        "**🤝 Sponsor / Şirket**",
                        "`.şirketler`",
                        "`.şirketseç Adidas`",
                        "`.şirketim`",
                        "`.şirketiptal`",
                        "`.sponsorlar`",
                        "`.sponsorseç Adidas`",
                        "`.sponsorlarım`",
                        "`.sponsorgelir`",
                        "`.sponsoriptal`",
                        "",
                        "**🛡️ Moderasyon**",
                        "`.sil 10`",
                        "`.kick @oyuncu`",
                        "`.ban @oyuncu`",
                        "`.mute @oyuncu`",
                        "`.unmute @oyuncu`",
                        "`.uyar @oyuncu sebep`",
                        "`.sicil @oyuncu`",
                        "`.kilit`",
                        "`.aç`",
                        "",
                        "**📢 Medya**",
                        "`.tweet mesaj`",
                        "`.haber mesaj`",
                        "`.transferduyuru mesaj`",
                        "`.duyuru mesaj`",
                        "`.spoiler mesaj`",
                        "",
                        "**🎁 Çekiliş**",
                        "`.çekiliş 30M€ 1m`"
                    ].join("\n")
                )
                .setColor(0x2b2d31);

            await message.reply({ embeds: [embed] });
            return;
        }

        /* =====================================================
           KAYIT
           ===================================================== */

        if (command === "k") {
            if (!canRegister(message.member)) {
                return message.reply("❌ Bu komutu kullanma yetkin yok.");
            }

            const player = message.mentions.members.first();

            if (!player) {
                return message.reply(
                    "❌ Kullanım: `.k @oyuncu İsim`"
                );
            }

            const name = args.slice(0).join(" ");

            if (!name) {
                return message.reply(
                    "❌ Oyuncunun ismini yaz."
                );
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`register_player_${player.id}_${message.author.id}_${name}`)
                    .setLabel("⚽ Futbolcu")
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId(`register_td_${player.id}_${message.author.id}_${name}`)
                    .setLabel("👔 Teknik Direktör")
                    .setStyle(ButtonStyle.Primary)
            );

            await message.reply({
                content: `${player} için kayıt türünü seç:`,
                components: [row]
            });

            return;
        }

        /* =====================================================
           TAKIM KUR
           ===================================================== */

        if (command === "takımkur") {
            if (!canTD(message.member)) {
                return message.reply(
                    "❌ Sadece Teknik Direktör kullanabilir."
                );
            }

            const existing = getTeamByTD(message.author.id);

            if (existing) {
                return message.reply(
                    `❌ Zaten **${existing.name}** takımının sahibisin.`
                );
            }

            const available = REAL_TEAMS.filter(
                team =>
                    !db.usedTeams.includes(team) &&
                    !Object.values(db.teams).some(
                        x => x.name === team
                    )
            );

            if (!available.length) {
                return message.reply(
                    "❌ Kullanılabilir takım kalmadı."
                );
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`create_team_${message.author.id}`)
                .setPlaceholder("🏟️ Bir takım seç")
                .addOptions(
                    available.slice(0, 25).map(team => ({
                        label: team,
                        value: team
                    }))
                );

            await message.reply({
                content:
                    "🏟️ **Takımını seç.**\n\n" +
                    "Takım kurulduğunda başlangıç bütçen **100M€** olacaktır.",
                components: [
                    new ActionRowBuilder().addComponents(menu)
                ]
            });

            return;
        }

        /* =====================================================
           SUNUCU KUR
           ===================================================== */

        if (command === "sunucukur") {
            if (!isAdmin(message.member)) {
                return message.reply("❌ Yönetici yetkisi gerekiyor.");
            }

            await message.reply(
                "⏳ United League sunucu yapısı hazırlanıyor..."
            );

            const categories = [
                {
                    name: "📁 UNITED LEAGUE",
                    channels: [
                        "📢・duyurular",
                        "💬・sohbet",
                        "👋・gelen-giden",
                        "📜・kurallar"
                    ]
                },
                {
                    name: "📁 KAYIT",
                    channels: [
                        "📝・kayıt",
                        "📋・kayıt-log"
                    ]
                },
                {
                    name: "📁 TAKIM & KADRO",
                    channels: [
                        "🏟️・takımlar",
                        "👥・kadrolar",
                        "📊・puan-durumu",
                        "📅・fikstür",
                        "⚽・maçlar"
                    ]
                },
                {
                    name: "📁 TRANSFER",
                    channels: [
                        "🔄・transfer",
                        "📜・sözleşmeler",
                        "💰・transfer-log"
                    ]
                },
                {
                    name: "📁 EKONOMİ",
                    channels: [
                        "💵・bütçeler",
                        "💎・değerler",
                        "🤝・sponsorlar",
                        "🏢・şirketler"
                    ]
                },
                {
                    name: "📁 MEDYA",
                    channels: [
                        "📰・haberler",
                        "🐦・tweetler",
                        "📸・transfer-duyuruları"
                    ]
                },
                {
                    name: "📁 YETKİLİ",
                    channels: [
                        "🔐・yetkili-sohbet",
                        "📋・yetkili-log",
                        "🛡️・moderasyon-log",
                        "🎁・çekiliş-log"
                    ]
                },
                {
                    name: "📁 SOHBET",
                    channels: [
                        "💬・sohbet",
                        "🤖・bot-komut",
                        "🖼️・görsel"
                    ]
                }
            ];

            for (const categoryData of categories) {
                let category = message.guild.channels.cache.find(
                    c =>
                        c.type === ChannelType.GuildCategory &&
                        c.name === categoryData.name
                );

                if (!category) {
                    category =
                        await message.guild.channels.create({
                            name: categoryData.name,
                            type: ChannelType.GuildCategory
                        }).catch(() => null);
                }

                if (!category) continue;

                for (const channelName of categoryData.channels) {
                    const exists =
                        message.guild.channels.cache.find(
                            c =>
                                c.parentId === category.id &&
                                c.name === channelName
                        );

                    if (!exists) {
                        await message.guild.channels.create({
                            name: channelName,
                            type: ChannelType.GuildText,
                            parent: category.id
                        }).catch(() => {});
                    }
                }
            }

            await message.channel.send(
                "✅ **United League sunucu yapısı oluşturuldu.**"
            );

            return;
        }

        /* =====================================================
           KADRO
           ===================================================== */

        if (
            command === "kadro" ||
            command === "kadrom"
        ) {
            let team;

            if (message.mentions.members.first()) {
                team = getPlayerTeam(
                    message.mentions.members.first().id
                );
            } else {
                team = getTeamByTD(message.author.id);
            }

            if (!team) {
                return message.reply(
                    "❌ Bir takımla bağlantın yok."
                );
            }

            const players = team.players || [];

            const names = [];

            for (const id of players) {
                const member =
                    await message.guild.members.fetch(id)
                        .catch(() => null);

                if (member) {
                    names.push(
                        `⚽ ${member.displayName}`
                    );
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`👥 ${team.name} Kadrosu`)
                .setDescription(
                    names.length
                        ? names.join("\n")
                        : "Henüz kadroda oyuncu yok."
                )
                .addFields(
                    {
                        name: "👔 Teknik Direktör",
                        value: team.director
                            ? `<@${team.director}>`
                            : "Boş Takım"
                    },
                    {
                        name: "💰 Bütçe",
                        value: money(team.budget)
                    },
                    {
                        name: "📋 Formasyon",
                        value: team.formation || "4-3-3"
                    }
                );

            await message.reply({
                embeds: [embed]
            });

            return;
        }

        /* =====================================================
           KADRO EKLE
           ===================================================== */

        if (command === "kadroekle") {
            const team = getTeamByTD(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Önce takım kurmalısın."
                );
            }

            const player = message.mentions.members.first();

            if (!player) {
                return message.reply(
                    "❌ Bir oyuncu etiketle."
                );
            }

            const user = ensureUser(player.id);

            if (user.team !== team.id) {
                return message.reply(
                    "❌ Bu oyuncu senin takımında değil."
                );
            }

            team.players ||= [];

            if (team.players.includes(player.id)) {
                return message.reply(
                    "❌ Oyuncu zaten kadroda."
                );
            }

            team.players.push(player.id);

            saveDB();

            await message.reply(
                `✅ ${player} kadroya eklendi.`
            );

            return;
        }

        /* =====================================================
           KADRO ÇIKAR
           ===================================================== */

        if (command === "kadroçıkar") {
            const team = getTeamByTD(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Takımın yok."
                );
            }

            const player = message.mentions.members.first();

            if (!player) {
                return message.reply(
                    "❌ Oyuncu etiketle."
                );
            }

            team.players ||= [];

            team.players =
                team.players.filter(
                    id => id !== player.id
                );

            saveDB();

            await message.reply(
                `✅ ${player} kadrodan çıkarıldı.`
            );

            return;
        }

        /* =====================================================
           FORMASYON
           ===================================================== */

        if (command === "formasyon") {
            const team = getTeamByTD(message.author.id);

            if (!team) {
                return message.reply(
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

            if (!formations.includes(args[0])) {
                return message.reply(
                    `❌ Geçerli formasyonlar:\n${formations.join(", ")}`
                );
            }

            team.formation = args[0];

            saveDB();

            await message.reply(
                `⚽ Formasyon **${args[0]}** olarak ayarlandı.`
            );

            return;
        }

        /* =====================================================
           DEĞER VER
           ===================================================== */

        if (command === "dver") {
            if (!canValue(message.member)) {
                return message.reply(
                    "❌ Değer Yetkilisi değilsin."
                );
            }

            const player = message.mentions.members.first();

            if (!player) {
                return message.reply(
                    "❌ Kullanım: `.dver @oyuncu 5M`"
                );
            }

            const amount = parseMoney(args[1]);

            if (!Number.isFinite(amount) || amount <= 0) {
                return message.reply(
                    "❌ Geçerli bir miktar yaz."
                );
            }

            const before = ensureUser(player.id).value;

            const after = addValue(
                player,
                amount
            );

            await message.reply(
                `💎 ${player}\n` +
                `Önce: **${money(before)}**\n` +
                `Eklenen: **${money(amount)}**\n` +
                `Yeni değer: **${money(after)}**`
            );

            await logAction(
                message.guild,
                `${message.author.tag}, ${player.user.tag} oyuncusuna ${money(amount)} değer verdi.`
            );

            return;
        }

        /* =====================================================
           DEĞER SİL
           ===================================================== */

        if (command === "dsil") {
            if (!canValue(message.member)) {
                return message.reply(
                    "❌ Değer Yetkilisi değilsin."
                );
            }

            const player = message.mentions.members.first();

            if (!player) {
                return message.reply(
                    "❌ Oyuncu etiketle."
                );
            }

            const amount = parseMoney(args[1]);

            if (!Number.isFinite(amount) || amount <= 0) {
                return message.reply(
                    "❌ Geçerli miktar yaz."
                );
            }

            const user = ensureUser(player.id);

            user.value -= amount;

            if (user.value < 0) {
                user.value = 0;
            }

            player.setNickname(
                setNicknameValue(
                    player,
                    user.value
                )
            ).catch(() => {});

            saveDB();

            await message.reply(
                `💎 ${player} değerinden **${money(amount)}** silindi.\n` +
                `Yeni değer: **${money(user.value)}**`
            );

            return;
        }

        /* =====================================================
           DEĞER
           ===================================================== */

        if (command === "değer") {
            const player =
                message.mentions.members.first() ||
                message.member;

            const user = ensureUser(player.id);

            await message.reply(
                `💎 ${player} oyuncusunun değeri: **${money(user.value)}**`
            );

            return;
        }

        /* =====================================================
           DEĞER GEÇMİŞİ
           ===================================================== */

        if (command === "değergeçmiş") {
            const player =
                message.mentions.members.first() ||
                message.member;

            const user = ensureUser(player.id);

            await message.reply(
                `📊 **${player.displayName} Değer Bilgisi**\n\n` +
                `💎 Güncel Değer: **${money(user.value)}**\n` +
                `⚽ Goller: **${user.goals}**\n` +
                `🎯 Asistler: **${user.assists}**\n` +
                `🏃 Antrenman: **${user.training}/10**\n` +
                `🥅 Penaltı Golü: **${user.penaltyGoals}**`
            );

            return;
        }

        /* =====================================================
           ANTRENMAN
           ===================================================== */

        if (
            command === "ant" ||
            command === "antrenman"
        ) {
            const user = ensureUser(
                message.author.id
            );

            user.training++;

            if (user.training >= 10) {
                user.training = 0;

                const newValue = addValue(
                    message.member,
                    3000000
                );

                await message.reply(
                    `🏃 **ANTRENMAN TAMAMLANDI!**\n\n` +
                    `🎯 10/10 tamamlandı.\n` +
                    `💎 **+3M€** değer kazandın.\n` +
                    `💰 Yeni değer: **${money(newValue)}**`
                );
            } else {
                await message.reply(
                    `🏃 Antrenman ilerlemesi: **${user.training}/10**`
                );
            }

            saveDB();

            return;
        }

        /* =====================================================
           PENALTI
           ===================================================== */

        if (
            command === "pen" ||
            command === "penaltı"
        ) {
            const user = ensureUser(
                message.author.id
            );

            user.penalties++;

            const goal =
                Math.random() < 0.6;

            if (goal) {
                user.penaltyGoals++;
                user.goals++;

                const newValue = addValue(
                    message.member,
                    2000000
                );

                await message.reply(
                    `🥅 **GOOOOL!** ⚽\n\n` +
                    `🎯 Penaltı başarılı.\n` +
                    `💎 **+2M€ değer**\n` +
                    `💰 Yeni değer: **${money(newValue)}**`
                );
            } else {
                await message.reply(
                    `🧤 **KALECİ KURTARDI!**\n\n` +
                    `❌ Penaltı kaçtı.`
                );
            }

            saveDB();

            return;
        }

        /* =====================================================
           PROFİL
           ===================================================== */

        if (command === "profil") {
            const player =
                message.mentions.members.first() ||
                message.member;

            const user = ensureUser(
                player.id
            );

            const team = getPlayerTeam(
                player.id
            );

            const embed = new EmbedBuilder()
                .setTitle(`👤 ${player.displayName}`)
                .setThumbnail(
                    player.displayAvatarURL()
                )
                .addFields(
                    {
                        name: "💎 Değer",
                        value: money(user.value),
                        inline: true
                    },
                    {
                        name: "💰 Bütçe",
                        value: money(user.budget),
                        inline: true
                    },
                    {
                        name: "🏟️ Takım",
                        value: team
                            ? team.name
                            : "Takımsız",
                        inline: true
                    },
                    {
                        name: "⚽ Gol",
                        value: String(user.goals),
                        inline: true
                    },
                    {
                        name: "🎯 Asist",
                        value: String(user.assists),
                        inline: true
                    },
                    {
                        name: "🏃 Antrenman",
                        value: `${user.training}/10`,
                        inline: true
                    }
                );

            await message.reply({
                embeds: [embed]
            });

            return;
        }

        /* =====================================================
           BÜTÇE
           ===================================================== */

        if (command === "bütçe") {
            const user = ensureUser(
                message.author.id
            );

            await message.reply(
                `💰 Kişisel bütçen: **${money(user.budget)}**`
            );

            return;
        }

        /* =====================================================
           BÜTÇE VER
           ===================================================== */

        if (command === "bütçever") {
            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Yönetici yetkisi gerekiyor."
                );
            }

            const player =
                message.mentions.members.first();

            const amount =
                parseMoney(args[1]);

            if (!player || !Number.isFinite(amount)) {
                return message.reply(
                    "❌ Kullanım: `.bütçever @oyuncu 5M`"
                );
            }

            const user =
                ensureUser(player.id);

            user.budget += amount;

            saveDB();

            await message.reply(
                `💰 ${player} hesabına **${money(amount)}** eklendi.`
            );

            return;
        }

        /* =====================================================
           BÜTÇE AL
           ===================================================== */

        if (command === "bütçeal") {
            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Yönetici yetkisi gerekiyor."
                );
            }

            const player =
                message.mentions.members.first();

            const amount =
                parseMoney(args[1]);

            if (!player || !Number.isFinite(amount)) {
                return message.reply(
                    "❌ Kullanım: `.bütçeal @oyuncu 5M`"
                );
            }

            const user =
                ensureUser(player.id);

            user.budget =
                Math.max(0, user.budget - amount);

            saveDB();

            await message.reply(
                `💰 ${player} hesabından **${money(amount)}** silindi.`
            );

            return;
        }

        /* =====================================================
           PARA GÖNDER
           ===================================================== */

        if (command === "gönder") {
            const target =
                message.mentions.members.first();

            const amount =
                parseMoney(args[1]);

            if (!target || !Number.isFinite(amount)) {
                return message.reply(
                    "❌ Kullanım: `.gönder @oyuncu 5M`"
                );
            }

            if (target.id === message.author.id) {
                return message.reply(
                    "❌ Kendine para gönderemezsin."
                );
            }

            const sender =
                ensureUser(message.author.id);

            const receiver =
                ensureUser(target.id);

            if (sender.budget < amount) {
                return message.reply(
                    "❌ Yeterli bütçen yok."
                );
            }

            sender.budget -= amount;
            receiver.budget += amount;

            saveDB();

            await message.reply(
                `💸 ${target} kişisine **${money(amount)}** gönderildi.`
            );

            return;
        }

        /* =====================================================
           TAKIM BÜTÇESİ
           ===================================================== */

        if (command === "takımbütçesi") {
            const team =
                getTeamByTD(message.author.id) ||
                getPlayerTeam(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Takım bulunamadı."
                );
            }

            await message.reply(
                `🏟️ **${team.name}**\n💰 Bütçe: **${money(team.budget)}**`
            );

            return;
        }

        /* =====================================================
           TAKIM BÜTÇE VER
           ===================================================== */

        if (command === "takımbütçever") {
            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Yönetici yetkisi gerekiyor."
                );
            }

            const amount =
                parseMoney(args[1]);

            const teamName =
                args.slice(0, -1).join(" ");

            const team =
                getTeamByName(teamName);

            if (!team || !Number.isFinite(amount)) {
                return message.reply(
                    "❌ Kullanım: `.takımbütçever Takım Adı 5M`"
                );
            }

            team.budget += amount;

            saveDB();

            await message.reply(
                `💰 ${team.name} bütçesine **${money(amount)}** eklendi.`
            );

            return;
        }

        /* =====================================================
           TAKIM BÜTÇE AL
           ===================================================== */

        if (command === "takımbütçeal") {
            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Yönetici yetkisi gerekiyor."
                );
            }

            const amount =
                parseMoney(args[1]);

            const teamName =
                args.slice(0, -1).join(" ");

            const team =
                getTeamByName(teamName);

            if (!team || !Number.isFinite(amount)) {
                return message.reply(
                    "❌ Kullanım: `.takımbütçeal Takım Adı 5M`"
                );
            }

            team.budget =
                Math.max(0, team.budget - amount);

            saveDB();

            await message.reply(
                `💰 ${team.name} bütçesinden **${money(amount)}** silindi.`
            );

            return;
        }

        /* =====================================================
           BÜTÇELER
           ===================================================== */

        if (command === "bütçeler") {
            const teams =
                Object.values(db.teams)
                    .sort((a, b) => b.budget - a.budget);

            if (!teams.length) {
                return message.reply(
                    "❌ Henüz takım yok."
                );
            }

            const text = teams
                .slice(0, 25)
                .map(
                    (team, i) =>
                        `**${i + 1}. ${team.name}** — ${money(team.budget)}`
                )
                .join("\n");

            await message.reply(
                `💰 **TAKIM BÜTÇELERİ**\n\n${text}`
            );

            return;
        }

        /* =====================================================
           ŞİRKETLER
           ===================================================== */

        if (command === "şirketler") {
            const available =
                COMPANIES.filter(
                    x =>
                        !Object.values(db.companies)
                            .some(c => c.company === x)
                );

            await message.reply(
                `🏢 **ŞİRKETLER**\n\n` +
                (available.length
                    ? available.map(x => `• ${x}`).join("\n")
                    : "Kullanılabilir şirket kalmadı.")
            );

            return;
        }

        /* =====================================================
           ŞİRKET SEÇ
           ===================================================== */

        if (command === "şirketseç") {
            const company =
                args.join(" ");

            if (!COMPANIES.includes(company)) {
                return message.reply(
                    "❌ Geçerli şirket değil."
                );
            }

            const already =
                Object.values(db.companies)
                    .some(c => c.company === company);

            if (already) {
                return message.reply(
                    "❌ Bu şirket zaten seçilmiş."
                );
            }

            db.companies[message.author.id] = {
                company,
                selectedAt: Date.now()
            };

            saveDB();

            await message.reply(
                `🏢 Şirketin **${company}** olarak seçildi.`
            );

            return;
        }

        /* =====================================================
           ŞİRKETİM
           ===================================================== */

        if (command === "şirketim") {
            const company =
                db.companies[message.author.id];

            await message.reply(
                company
                    ? `🏢 Şirketin: **${company.company}**`
                    : "❌ Bir şirket seçmedin."
            );

            return;
        }

        /* =====================================================
           ŞİRKET İPTAL
           ===================================================== */

        if (command === "şirketiptal") {
            delete db.companies[
                message.author.id
            ];

            saveDB();

            await message.reply(
                "✅ Şirket seçimin iptal edildi."
            );

            return;
        }

        /* =====================================================
           SPONSORLAR
           ===================================================== */

        if (command === "sponsorlar") {
            const text =
                SPONSORS.map(
                    s =>
                        `🤝 **${s.name}** — ${money(s.income)}/hafta`
                ).join("\n");

            await message.reply(
                `🤝 **SPONSORLAR**\n\n${text}`
            );

            return;
        }

        /* =====================================================
           SPONSOR SEÇ
           ===================================================== */

        if (command === "sponsorseç") {
            const sponsor =
                SPONSORS.find(
                    s => s.name === args.join(" ")
                );

            if (!sponsor) {
                return message.reply(
                    "❌ Sponsor bulunamadı."
                );
            }

            const exists =
                Object.values(db.sponsors)
                    .some(s => s.name === sponsor.name);

            if (exists) {
                return message.reply(
                    "❌ Bu sponsor zaten alınmış."
                );
            }

            const team =
                getTeamByTD(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Önce takım kurmalısın."
                );
            }

            db.sponsors[team.id] = {
                name: sponsor.name,
                income: sponsor.income,
                selectedAt: Date.now(),
                lastIncome: 0
            };

            saveDB();

            await message.reply(
                `🤝 **${sponsor.name}** sponsor olarak seçildi.\n` +
                `💰 Haftalık gelir: **${money(sponsor.income)}**`
            );

            return;
        }

        /* =====================================================
           SPONSORLARIM
           ===================================================== */

        if (command === "sponsorlarım") {
            const team =
                getTeamByTD(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Takımın yok."
                );
            }

            const sponsor =
                db.sponsors[team.id];

            await message.reply(
                sponsor
                    ? `🤝 Sponsor: **${sponsor.name}**\n💰 Gelir: **${money(sponsor.income)}**`
                    : "❌ Sponsorun yok."
            );

            return;
        }

        /* =====================================================
           SPONSOR GELİR
           ===================================================== */

        if (command === "sponsorgelir") {
            const team =
                getTeamByTD(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Takımın yok."
                );
            }

            const sponsor =
                db.sponsors[team.id];

            if (!sponsor) {
                return message.reply(
                    "❌ Sponsorun yok."
                );
            }

            team.budget += sponsor.income;
            sponsor.lastIncome = Date.now();

            saveDB();

            await message.reply(
                `💰 Sponsor geliri alındı: **${money(sponsor.income)}**`
            );

            return;
        }

        /* =====================================================
           SPONSOR İPTAL
           ===================================================== */

        if (command === "sponsoriptal") {
            const team =
                getTeamByTD(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Takımın yok."
                );
            }

            delete db.sponsors[team.id];

            saveDB();

            await message.reply(
                "✅ Sponsor iptal edildi."
            );

            return;
        }

        /* =====================================================
           OYUNCU AL
           ===================================================== */

        if (command === "oyuncual") {
            const team =
                getTeamByTD(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Önce takım kurmalısın."
                );
            }

            const player =
                message.mentions.members.first();

            if (!player) {
                return message.reply(
                    "❌ Oyuncu etiketle."
                );
            }

            if (player.id === message.author.id) {
                return message.reply(
                    "❌ Kendini transfer edemezsin."
                );
            }

            if (team.director === player.id) {
                return message.reply(
                    "❌ Takım sahibi transfer edilemez."
                );
            }

            const playerData =
                ensureUser(player.id);

            const currentTeam =
                getPlayerTeam(player.id);

            if (currentTeam &&
                currentTeam.id === team.id) {
                return message.reply(
                    "❌ Oyuncu zaten takımında."
                );
            }

            const row =
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `transfer_accept_${message.author.id}_${player.id}_${team.id}`
                        )
                        .setLabel("Transferi Kabul Et")
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId(
                            `transfer_reject_${message.author.id}_${player.id}_${team.id}`
                        )
                        .setLabel("Reddet")
                        .setStyle(ButtonStyle.Danger)
                );

            await message.reply({
                content:
                    `🔄 ${player}, **${team.name}** takımından transfer teklifi aldı.\n\n` +
                    `👔 Teklifi yapan: ${message.author}`,
                components: [row]
            });

            return;
        }

        /* =====================================================
           SÖZLEŞME
           ===================================================== */

        if (command === "sözleşme") {
            const player =
                message.mentions.members.first();

            if (!player) {
                return message.reply(
                    "❌ Oyuncu etiketle."
                );
            }

            const contract =
                db.contracts[player.id];

            if (!contract) {
                return message.reply(
                    "❌ Oyuncunun aktif sözleşmesi yok."
                );
            }

            await message.reply(
                `📜 **SÖZLEŞME**\n\n` +
                `👤 Oyuncu: ${player}\n` +
                `🏟️ Takım: **${contract.teamName}**\n` +
                `💰 Maaş: **${money(contract.salary)}**\n` +
                `💵 Transfer Bedeli: **${money(contract.fee)}**\n` +
                `⏳ Süre: **${contract.duration}**`
            );

            return;
        }

        /* =====================================================
           SÖZLEŞME İPTAL
           ===================================================== */

        if (command === "sözleşmeiptal") {
            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Yönetici yetkisi gerekiyor."
                );
            }

            const player =
                message.mentions.members.first();

            if (!player) {
                return message.reply(
                    "❌ Oyuncu etiketle."
                );
            }

            delete db.contracts[player.id];

            saveDB();

            await message.reply(
                `📜 ${player} sözleşmesi iptal edildi.`
            );

            return;
        }

        /* =====================================================
           MAÇ
           ===================================================== */

        if (command === "maç") {
            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Maç Yetkilisi/Yönetici gerekiyor."
                );
            }

            const mentions =
                [...message.mentions.members.values()];

            if (mentions.length < 2) {
                return message.reply(
                    "❌ Kullanım: `.maç @TD1 @TD2`"
                );
            }

            const team1 =
                getTeamByTD(mentions[0].id);

            const team2 =
                getTeamByTD(mentions[1].id);

            if (!team1 || !team2) {
                return message.reply(
                    "❌ İki kişinin de aktif takımı olmalı."
                );
            }

            if (team1.id === team2.id) {
                return message.reply(
                    "❌ Aynı takım karşılaşamaz."
                );
            }

            let score1 = 0;
            let score2 = 0;

            const events = [
                "⚽ Gol!",
                "🟨 Sarı kart!",
                "🟥 Kırmızı kart!",
                "🎯 Büyük fırsat!",
                "🧤 Kaleci kurtarışı!",
                "🔄 Oyuncu değişikliği!"
            ];

            const matchMessage =
                await message.reply(
                    `🏟️ **MAÇ BAŞLADI**\n\n` +
                    `🔵 ${team1.name} **0**\n` +
                    `🔴 ${team2.name} **0**\n\n` +
                    `⏱️ Maç simülasyonu başlıyor...`
                );

            for (let minute = 5; minute <= 90; minute += 10) {
                await new Promise(
                    resolve =>
                        setTimeout(resolve, 1000)
                );

                const event =
                    random(events);

                if (event === "⚽ Gol!") {
                    if (Math.random() < 0.5) {
                        score1++;
                    } else {
                        score2++;
                    }
                }

                await matchMessage.edit(
                    `🏟️ **${team1.name} - ${team2.name}**\n\n` +
                    `⏱️ ${minute}'\n\n` +
                    `🔵 ${team1.name} **${score1}**\n` +
                    `🔴 ${team2.name} **${score2}**\n\n` +
                    `${event}`
                ).catch(() => {});
            }

            const s1 = teamStats(team1);
            const s2 = teamStats(team2);

            s1.played++;
            s2.played++;

            s1.gf += score1;
            s1.ga += score2;

            s2.gf += score2;
            s2.ga += score1;

            if (score1 > score2) {
                s1.wins++;
                s2.losses++;
                s1.points += 3;
            } else if (score2 > score1) {
                s2.wins++;
                s1.losses++;
                s2.points += 3;
            } else {
                s1.draws++;
                s2.draws++;
                s1.points++;
                s2.points++;
            }

            const match = {
                id: Date.now().toString(),
                team1: team1.id,
                team2: team2.id,
                team1Name: team1.name,
                team2Name: team2.name,
                score1,
                score2,
                date: new Date().toISOString()
            };

            db.matches.push(match);

            saveDB();

            await matchMessage.edit(
                `🏆 **MAÇ SONA ERDİ**\n\n` +
                `🔵 **${team1.name}** ${score1}\n` +
                `🔴 **${team2.name}** ${score2}\n\n` +
                `📊 Maç sonucu kaydedildi.`
            ).catch(() => {});

            await logAction(
                message.guild,
                `${team1.name} ${score1}-${score2} ${team2.name}`
            );

            return;
        }

        /* =====================================================
           LİG
           ===================================================== */

        if (
            command === "lig" ||
            command === "puan"
        ) {
            const teams =
                Object.values(db.teams)
                    .sort((a, b) => {
                        const sa = teamStats(a);
                        const sb = teamStats(b);

                        if (sb.points !== sa.points) {
                            return sb.points - sa.points;
                        }

                        return (
                            teamGoalDiff(b) -
                            teamGoalDiff(a)
                        );
                    });

            if (!teams.length) {
                return message.reply(
                    "❌ Henüz takım yok."
                );
            }

            const text =
                teams
                    .map((team, i) => {
                        const s =
                            teamStats(team);

                        return (
                            `**${i + 1}. ${team.name}**\n` +
                            `🏆 ${s.points} P | ` +
                            `⚽ ${s.gf}-${s.ga} | ` +
                            `📊 ${s.wins}G ${s.draws}B ${s.losses}M`
                        );
                    })
                    .join("\n\n");

            await message.reply(
                `🏆 **UNITED LEAGUE PUAN DURUMU**\n\n${text}`
            );

            return;
        }

        /* =====================================================
           FİKSTÜR
           ===================================================== */

        if (command === "fikstür") {
            const matches =
                db.matches.slice(-20);

            if (!matches.length) {
                return message.reply(
                    "📅 Henüz maç oynanmadı."
                );
            }

            const text =
                matches
                    .map(
                        m =>
                            `⚽ **${m.team1Name} ${m.score1}-${m.score2} ${m.team2Name}**`
                    )
                    .join("\n");

            await message.reply(
                `📅 **FİKSTÜR / SON MAÇLAR**\n\n${text}`
            );

            return;
        }

        /* =====================================================
           SONUÇLAR
           ===================================================== */

        if (
            command === "sonuçlar" ||
            command === "maçlar" ||
            command === "maçgeçmişi"
        ) {
            const matches =
                db.matches.slice(-25).reverse();

            if (!matches.length) {
                return message.reply(
                    "❌ Maç geçmişi boş."
                );
            }

            const text =
                matches
                    .map(
                        m =>
                            `🏟️ ${m.team1Name} **${m.score1}-${m.score2}** ${m.team2Name}`
                    )
                    .join("\n");

            await message.reply(
                `📚 **MAÇ GEÇMİŞİ**\n\n${text}`
            );

            return;
        }

        /* =====================================================
           GOL KRALLIĞI
           ===================================================== */

        if (command === "golkrallığı") {
            const players =
                Object.entries(db.users)
                    .sort(
                        (a, b) =>
                            b[1].goals -
                            a[1].goals
                    )
                    .slice(0, 20);

            const text =
                players.length
                    ? players
                        .map(
                            ([id, u], i) =>
                                `**${i + 1}.** <@${id}> — ⚽ ${u.goals}`
                        )
                        .join("\n")
                    : "Henüz gol yok.";

            await message.reply(
                `👑 **GOL KRALLIĞI**\n\n${text}`
            );

            return;
        }

        /* =====================================================
           ASİST KRALLIĞI
           ===================================================== */

        if (command === "asistkrallığı") {
            const players =
                Object.entries(db.users)
                    .sort(
                        (a, b) =>
                            b[1].assists -
                            a[1].assists
                    )
                    .slice(0, 20);

            const text =
                players.length
                    ? players
                        .map(
                            ([id, u], i) =>
                                `**${i + 1}.** <@${id}> — 🎯 ${u.assists}`
                        )
                        .join("\n")
                    : "Henüz asist yok.";

            await message.reply(
                `🎯 **ASİST KRALLIĞI**\n\n${text}`
            );

            return;
        }

        /* =====================================================
           İSTATİSTİK
           ===================================================== */

        if (command === "istatistik") {
            const player =
                message.mentions.members.first() ||
                message.member;

            const u =
                ensureUser(player.id);

            await message.reply(
                `📊 **${player.displayName}**\n\n` +
                `⚽ Gol: **${u.goals}**\n` +
                `🎯 Asist: **${u.assists}**\n` +
                `🏃 Antrenman: **${u.training}/10**\n` +
                `🥅 Penaltı: **${u.penaltyGoals}/${u.penalties}**\n` +
                `🟨 Sarı: **${u.yellow}**\n` +
                `🟥 Kırmızı: **${u.red}**`
            );

            return;
        }

        /* =====================================================
           ÇEKİLİŞ
           ===================================================== */

        if (command === "çekiliş") {
            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Yönetici yetkisi gerekiyor."
                );
            }

            const prize =
                parseMoney(args[0]);

            const durationText =
                args[1];

            if (
                !Number.isFinite(prize) ||
                !durationText
            ) {
                return message.reply(
                    "❌ Kullanım: `.çekiliş 30M€ 1m`"
                );
            }

            const match =
                durationText
                    .toLowerCase()
                    .match(/^(\d+)(s|m|h)$/);

            if (!match) {
                return message.reply(
                    "❌ Süre örneği: 30s, 5m, 1h"
                );
            }

            const amount =
                Number(match[1]);

            const unit =
                match[2];

            let duration = amount * 1000;

            if (unit === "m") {
                duration =
                    amount * 60 * 1000;
            }

            if (unit === "h") {
                duration =
                    amount * 60 * 60 * 1000;
            }

            const id =
                `${message.guild.id}_${Date.now()}`;

            const row =
                new ActionRowBuilder().add
