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
    ChannelType,
    ActivityType
} = require("discord.js");

const fs = require("fs");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
    console.error("❌ TOKEN bulunamadı!");
    console.error("Railway/Rainway > Variables > TOKEN ekle.");
    process.exit(1);
}

/* =========================================================
   ROLLER
========================================================= */

const ROLES = {
    YONETICI: "1544449436011339806",
    KAYIT: "1544452022764568656",
    DEGER: "1544451743746891806",
    MOD: "1544450307088715917",
    TD: "1544452323450032229",
    OYUNCU: "1544452779156709516",
    KAYITSIZ: "1544488182027133030"
};

/* =========================================================
   CLIENT
========================================================= */

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
        Partials.User
    ]
});

/* =========================================================
   DATA
========================================================= */

const DEFAULT_DATA = {
    players: {},
    teams: {},
    training: {},
    stats: {},
    contracts: {},
    matches: [],
    giveaways: {},
    companies: {},
    sponsors: {},
    selectedCompanies: {},
    selectedSponsors: {},
    budgets: {},
    channels: {},
    logs: []
};

let data = JSON.parse(JSON.stringify(DEFAULT_DATA));

function loadData() {
    try {
        if (!fs.existsSync("data.json")) {
            saveData();
            return;
        }

        const raw = fs.readFileSync("data.json", "utf8");

        if (!raw.trim()) {
            saveData();
            return;
        }

        const saved = JSON.parse(raw);

        data = {
            ...JSON.parse(JSON.stringify(DEFAULT_DATA)),
            ...saved
        };

        console.log("✅ data.json yüklendi.");
    } catch (error) {
        console.error("⚠️ data.json okunamadı.");
        console.error(error.message);
        data = JSON.parse(JSON.stringify(DEFAULT_DATA));
        saveData();
    }
}

function saveData() {
    try {
        fs.writeFileSync(
            "data.json",
            JSON.stringify(data, null, 2)
        );
    } catch (error) {
        console.error("❌ data.json kaydedilemedi:", error.message);
    }
}

loadData();

/* =========================================================
   TAKIMLAR
========================================================= */

const REAL_TEAMS = [
    "Real Madrid",
    "Barcelona",
    "Manchester City",
    "Manchester United",
    "Liverpool",
    "Arsenal",
    "Chelsea",
    "Tottenham Hotspur",
    "Bayern Munich",
    "Borussia Dortmund",
    "Paris Saint-Germain",
    "Olympique de Marseille",
    "Inter",
    "AC Milan",
    "Juventus",
    "Napoli",
    "Roma",
    "Lazio",
    "Atlético Madrid",
    "Sevilla",
    "Valencia",
    "Ajax",
    "PSV Eindhoven",
    "Feyenoord",
    "Benfica",
    "Porto",
    "Sporting CP",
    "Galatasaray",
    "Fenerbahçe",
    "Beşiktaş",
    "Trabzonspor",
    "Başakşehir"
];

/* =========================================================
   ŞİRKETLER
========================================================= */

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

/* =========================================================
   SPONSORLAR
========================================================= */

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
        name: "Samsung",
        income: 5500000
    },
    {
        name: "Sony",
        income: 5000000
    },
    {
        name: "Microsoft",
        income: 6000000
    },
    {
        name: "Red Bull",
        income: 6500000
    }
];

/* =========================================================
   YARDIMCI
========================================================= */

function isAdmin(member) {
    return member.roles.cache.has(ROLES.YONETICI);
}

function isRegistration(member) {
    return (
        isAdmin(member) ||
        member.roles.cache.has(ROLES.KAYIT)
    );
}

function isValueStaff(member) {
    return (
        isAdmin(member) ||
        member.roles.cache.has(ROLES.DEGER)
    );
}

function isModerator(member) {
    return (
        isAdmin(member) ||
        member.roles.cache.has(ROLES.MOD)
    );
}

function isTD(member) {
    return (
        isAdmin(member) ||
        member.roles.cache.has(ROLES.TD)
    );
}

function getMember(message) {
    return message.mentions.members.first();
}

function parseMoney(value) {
    if (!value) return 0;

    let text = String(value)
        .toLowerCase()
        .replace(/€/g, "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(/,/g, "");

    if (text.endsWith("m")) {
        return parseFloat(text.slice(0, -1)) * 1000000;
    }

    if (text.endsWith("k")) {
        return parseFloat(text.slice(0, -1)) * 1000;
    }

    return Number(text) || 0;
}

function money(value) {
    value = Number(value) || 0;

    if (value >= 1000000) {
        const x = value / 1000000;
        return `${Number.isInteger(x) ? x : x.toFixed(1)}M€`;
    }

    if (value >= 1000) {
        const x = value / 1000;
        return `${Number.isInteger(x) ? x : x.toFixed(1)}K€`;
    }

    return `${value}€`;
}

function getValue(member) {
    const nick = member.nickname || member.user.username;
    const parts = nick.split("|");

    const last = parts[parts.length - 1];

    return parseMoney(last);
}

function setValue(member, amount) {
    const nick = member.nickname || member.user.username;

    const parts = nick
        .split("|")
        .map(x => x.trim())
        .filter(Boolean);

    if (parts.length === 0) {
        parts.push(member.user.username);
    }

    parts[parts.length - 1] = money(
        Math.max(0, amount)
    );

    return parts.join(" | ");
}

function addValue(member, amount) {
    const oldValue = getValue(member);
    const newValue = Math.max(
        0,
        oldValue + amount
    );

    return {
        oldValue,
        newValue,
        nickname: setValue(member, newValue)
    };
}

function getPlayerStats(id) {
    if (!data.stats[id]) {
        data.stats[id] = {
            goals: 0,
            assists: 0,
            yellow: 0,
            red: 0,
            appearances: 0
        };
    }

    return data.stats[id];
}

function logAction(type, message) {
    data.logs.push({
        type,
        user: message.author.id,
        content: message.content,
        time: Date.now()
    });

    if (data.logs.length > 500) {
        data.logs.shift();
    }

    saveData();
}

function getTeamOfPlayer(id) {
    for (const team of Object.values(data.teams)) {
        if (
            Array.isArray(team.players) &&
            team.players.includes(id)
        ) {
            return team;
        }
    }

    return null;
}

function getTeamOfTD(id) {
    for (const team of Object.values(data.teams)) {
        if (team.td === id) {
            return team;
        }
    }

    return null;
}

async function findChannel(guild, name) {
    return guild.channels.cache.find(
        c => c.name === name
    );
}

async function sendLog(guild, text) {
    const channel =
        guild.channels.cache.get(
            data.channels.yetkiliLog
        ) ||
        guild.channels.cache.find(
            c => c.name === "yetkili-log"
        );

    if (channel) {
        channel.send(text).catch(() => {});
    }
}

/* =========================================================
   READY
========================================================= */

client.once("ready", () => {
    console.log("================================");
    console.log("✅ UNITED LEAGUE BOT AKTİF");
    console.log(`🤖 ${client.user.tag}`);
    console.log(`🏠 ${client.guilds.cache.size} sunucu`);
    console.log("================================");

    client.user.setPresence({
        activities: [
            {
                name: "United League ⚽",
                type: ActivityType.Watching
            }
        ],
        status: "online"
    });
});

/* =========================================================
   YENİ ÜYE
========================================================= */

client.on("guildMemberAdd", async member => {
    try {
        const kayitsiz =
            member.guild.roles.cache.get(
                ROLES.KAYITSIZ
            );

        if (kayitsiz) {
            await member.roles.add(kayitsiz)
                .catch(() => {});
        }

        const channel =
            member.guild.channels.cache.get(
                data.channels.gelenGiden
            ) ||
            await findChannel(
                member.guild,
                "gelen-giden"
            );

        if (channel) {
            await channel.send(
                `👋 **Yeni oyuncu geldi!**\n\n` +
                `${member} United League'e katıldı.\n` +
                `📝 Kayıt olmak için kayıt kanalını kullanabilirsiniz.`
            ).catch(() => {});
        }
    } catch (error) {
        console.error(
            "Üye giriş hatası:",
            error.message
        );
    }
});

/* =========================================================
   SUNUCU KUR
========================================================= */

client.on("messageCreate", async message => {

    if (message.author.bot) return;
    if (!message.content.startsWith(".")) return;

    const args = message.content
        .slice(1)
        .trim()
        .split(/\s+/);

    const command =
        args.shift()?.toLowerCase();

    if (!command) return;

    try {

        /* =================================================
           YARDIM
        ================================================= */

        if (command === "yardım") {

            const embed = new EmbedBuilder()
                .setTitle("⚽ UNITED LEAGUE")
                .setDescription(
                    [
                        "### 📋 KAYIT",
                        "`.k @oyuncu İsim`",
                        "",
                        "### 🏟️ TAKIM",
                        "`.takımkur`",
                        "`.kadro`",
                        "`.kadrom`",
                        "`.kadroekle @oyuncu`",
                        "`.kadroçıkar @oyuncu`",
                        "`.formasyon 4-3-3`",
                        "",
                        "### 💎 DEĞER",
                        "`.dver @oyuncu 5M`",
                        "`.dsil @oyuncu 2M`",
                        "`.değer @oyuncu`",
                        "`.değergeçmiş @oyuncu`",
                        "",
                        "### 🏋️ ANTRENMAN",
                        "`.ant` / `.antrenman`",
                        "",
                        "### 🥅 PENALTI",
                        "`.pen` / `.penaltı`",
                        "",
                        "### 💰 BÜTÇE",
                        "`.bütçe`",
                        "`.bütçever @oyuncu 5M`",
                        "`.bütçeal @oyuncu 5M`",
                        "`.gönder @oyuncu 5M`",
                        "",
                        "### 📊 LİG",
                        "`.lig`",
                        "`.puan`",
                        "`.golkrallığı`",
                        "`.asistkrallığı`",
                        "",
                        "### 🛡️ MODERASYON",
                        "`.sil 10`",
                        "`.kick @oyuncu`",
                        "`.ban @oyuncu`",
                        "`.mute @oyuncu`",
                        "`.unmute @oyuncu`",
                        "`.uyar @oyuncu sebep`",
                        "",
                        "### 📢 MEDYA",
                        "`.tweet mesaj`",
                        "`.haber mesaj`",
                        "`.transferduyuru mesaj`"
                    ].join("\n")
                );

            return message.reply({
                embeds: [embed]
            });
        }

        /* =================================================
           SUNUCU KUR
        ================================================= */

        if (command === "sunucukur") {

            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Bu komut sadece Yönetici tarafından kullanılabilir."
                );
            }

            await message.reply(
                "🏗️ **United League sunucusu kuruluyor...**"
            );

            const categories = {};

            const categoryList = [
                ["📁 UNITED LEAGUE", [
                    "📢・duyurular",
                    "💬・sohbet",
                    "👋・gelen-giden",
                    "📜・kurallar"
                ]],
                ["📁 KAYIT", [
                    "📝・kayıt",
                    "📋・kayıt-log"
                ]],
                ["📁 TAKIM & KADRO", [
                    "🏟️・takımlar",
                    "👥・kadrolar",
                    "📊・puan-durumu",
                    "📅・fikstür",
                    "⚽・maçlar"
                ]],
                ["📁 TRANSFER", [
                    "🔄・transfer",
                    "📜・sözleşmeler",
                    "💰・transfer-log"
                ]],
                ["📁 EKONOMİ", [
                    "💵・bütçeler",
                    "💎・değerler",
                    "🤝・sponsorlar",
                    "🏢・şirketler"
                ]],
                ["📁 MEDYA", [
                    "📰・haberler",
                    "🐦・tweetler",
                    "📸・transfer-duyuruları"
                ]],
                ["📁 YETKİLİ", [
                    "🔐・yetkili-sohbet",
                    "📋・yetkili-log",
                    "🛡️・moderasyon-log",
                    "🎁・çekiliş-log"
                ]],
                ["📁 SOHBET", [
                    "💬・sohbet",
                    "🤖・bot-komut",
                    "🖼️・görsel"
                ]]
            ];

            for (const [categoryName, channels] of categoryList) {

                let category =
                    message.guild.channels.cache.find(
                        c =>
                            c.type === ChannelType.GuildCategory &&
                            c.name === categoryName
                    );

                if (!category) {
                    category =
                        await message.guild.channels.create({
                            name: categoryName,
                            type: ChannelType.GuildCategory
                        });
                }

                categories[categoryName] = category.id;

                for (const channelName of channels) {

                    let channel =
                        message.guild.channels.cache.find(
                            c =>
                                c.parentId === category.id &&
                                c.name === channelName
                        );

                    if (!channel) {

                        const options = {
                            name: channelName,
                            type: ChannelType.GuildText,
                            parent: category.id
                        };

                        if (channelName === "📝・kayıt") {

                            options.permissionOverwrites = [
                                {
                                    id: message.guild.roles.everyone.id,
                                    deny: [
                                        PermissionsBitField.Flags.ViewChannel
                                    ]
                                },
                                {
                                    id: ROLES.KAYITSIZ,
                                    allow: [
                                        PermissionsBitField.Flags.ViewChannel,
                                        PermissionsBitField.Flags.SendMessages,
                                        PermissionsBitField.Flags.ReadMessageHistory
                                    ]
                                },
                                {
                                    id: ROLES.KAYIT,
                                    allow: [
                                        PermissionsBitField.Flags.ViewChannel,
                                        PermissionsBitField.Flags.SendMessages,
                                        PermissionsBitField.Flags.ReadMessageHistory
                                    ]
                                },
                                {
                                    id: ROLES.YONETICI,
                                    allow: [
                                        PermissionsBitField.Flags.ViewChannel,
                                        PermissionsBitField.Flags.SendMessages,
                                        PermissionsBitField.Flags.ReadMessageHistory
                                    ]
                                }
                            ];
                        }

                        channel =
                            await message.guild.channels.create(
                                options
                            );
                    }

                    if (channelName === "📝・kayıt") {
                        data.channels.kayit = channel.id;
                    }

                    if (channelName === "👋・gelen-giden") {
                        data.channels.gelenGiden = channel.id;
                    }

                    if (channelName === "💬・sohbet") {
                        data.channels.sohbet = channel.id;
                    }

                    if (channelName === "⚽・maçlar") {
                        data.channels.maclar = channel.id;
                    }

                    if (channelName === "📊・puan-durumu") {
                        data.channels.puan = channel.id;
                    }

                    if (channelName === "🔄・transfer") {
                        data.channels.transfer = channel.id;
                    }

                    if (channelName === "📜・sözleşmeler") {
                        data.channels.sozlesme = channel.id;
                    }

                    if (channelName === "💎・değerler") {
                        data.channels.degerler = channel.id;
                    }

                    if (channelName === "💵・bütçeler") {
                        data.channels.butceler = channel.id;
                    }

                    if (channelName === "🔐・yetkili-sohbet") {
                        data.channels.yetkiliSohbet = channel.id;
                    }

                    if (channelName === "📋・yetkili-log") {
                        data.channels.yetkiliLog = channel.id;
                    }

                    if (channelName === "🛡️・moderasyon-log") {
                        data.channels.modLog = channel.id;
                    }

                    if (channelName === "🎁・çekiliş-log") {
                        data.channels.cekilisLog = channel.id;
                    }

                    if (channelName === "📸・transfer-duyuruları") {
                        data.channels.transferDuyuru = channel.id;
                    }
                }
            }

            saveData();

            return message.channel.send(
                "✅ **United League sunucusu başarıyla kuruldu!**\n" +
                "📝 Kayıt kanalı Kayıtsız rolüne göre ayarlandı.\n" +
                "📁 Tüm kategoriler oluşturuldu.\n" +
                "⚙️ Kanal ID'leri kaydedildi."
            );
        }

        /* =================================================
           KAYIT
        ================================================= */

        if (command === "k") {

            if (!isRegistration(message.member)) {
                return message.reply(
                    "❌ Kayıt Yetkilisi değilsin."
                );
            }

            const member = getMember(message);

            if (!member) {
                return message.reply(
                    "❌ Kullanım: `.k @oyuncu İsim`"
                );
            }

            const name =
                args.slice(1).join(" ");

            if (!name) {
                return message.reply(
                    "❌ Oyuncunun ismini yaz."
                );
            }

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                `kayit_oyuncu_${member.id}`
                            )
                            .setLabel("⚽ Futbolcu")
                            .setStyle(ButtonStyle.Success),

                        new ButtonBuilder()
                            .setCustomId(
                                `kayit_td_${member.id}`
                            )
                            .setLabel("👔 Teknik Direktör")
                            .setStyle(ButtonStyle.Primary)
                    );

            data.players[member.id] = {
                name,
                value: getValue(member) || 1000000,
                registered: false,
                type: null
            };

            saveData();

            const embed =
                new EmbedBuilder()
                    .setTitle("📋 UNITED LEAGUE KAYIT")
                    .setDescription(
                        `${member}\n\n` +
                        `**İsim:** ${name}\n\n` +
                        "Oyuncunun görevini seç:"
                    );

            return message.channel.send({
                embeds: [embed],
                components: [row]
            });
        }

        /* =================================================
           TAKIM KUR
        ================================================= */

        if (command === "takımkur") {

            if (!isTD(message.member)) {
                return message.reply(
                    "❌ Teknik Direktör değilsin."
                );
            }

            const oldTeam =
                getTeamOfTD(message.author.id);

            if (oldTeam) {
                return message.reply(
                    `❌ Zaten **${oldTeam.name}** takımını yönetiyorsun.`
                );
            }

            const available =
                REAL_TEAMS.filter(
                    team =>
                        !Object.values(data.teams)
                            .some(t => t.name === team)
                );

            if (available.length === 0) {
                return message.reply(
                    "❌ Kullanılabilir takım kalmadı."
                );
            }

            const options =
                available.slice(0, 25).map(team => ({
                    label: team,
                    value: team
                        .toLowerCase()
                        .replace(/ /g, "_")
                        .replace(/[^a-z0-9_]/g, "")
                }));

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(
                                `takimsec_${message.author.id}`
                            )
                            .setPlaceholder(
                                "🏟️ Takımını seç"
                            )
                            .addOptions(options)
                    );

            data.tempTeams =
                data.tempTeams || {};

            data.tempTeams[message.author.id] =
                available;

            saveData();

            return message.reply({
                content:
                    "🏟️ **Takım seçimi**\n" +
                    "Bir takım seç. Seçilen takım başka TD tarafından tekrar alınamaz.",
                components: [row]
            });
        }

        /* =================================================
           KADRO
        ================================================= */

        if (command === "kadro" || command === "kadrom") {

            const team =
                getTeamOfTD(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Bir takımın Teknik Direktörü değilsin."
                );
            }

            const players =
                team.players || [];

            let text =
                `🏟️ **${team.name} KADROSU**\n\n`;

            if (players.length === 0) {
                text += "Henüz kadroda oyuncu yok.";
            } else {
                for (let i = 0; i < players.length; i++) {
                    const member =
                        await message.guild.members
                            .fetch(players[i])
                            .catch(() => null);

                    text += `${i + 1}. ${
                        member
                            ? member.displayName
                            : "Bilinmeyen Oyuncu"
                    }\n`;
                }
            }

            text +=
                `\n\n📋 Oyuncu sayısı: **${players.length}**`;

            return message.reply(text);
        }

        /* =================================================
           KADRO EKLE
        ================================================= */

        if (command === "kadroekle") {

            const team =
                getTeamOfTD(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Bir takımın Teknik Direktörü değilsin."
                );
            }

            const player =
                getMember(message);

            if (!player) {
                return message.reply(
                    "❌ Kullanım: `.kadroekle @oyuncu`"
                );
            }

            team.players =
                team.players || [];

            if (team.players.includes(player.id)) {
                return message.reply(
                    "❌ Bu oyuncu zaten kadroda."
                );
            }

            const otherTeam =
                getTeamOfPlayer(player.id);

            if (otherTeam) {
                return message.reply(
                    `❌ Bu oyuncu zaten **${otherTeam.name}** kadrosunda.`
                );
            }

            team.players.push(player.id);

            saveData();

            return message.reply(
                `✅ ${player} **${team.name}** kadrosuna eklendi.`
            );
        }

        /* =================================================
           KADRO ÇIKAR
        ================================================= */

        if (command === "kadroçıkar") {

            const team =
                getTeamOfTD(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Takımın yok."
                );
            }

            const player =
                getMember(message);

            if (!player) {
                return message.reply(
                    "❌ Oyuncu belirt."
                );
            }

            team.players =
                team.players || [];

            if (!team.players.includes(player.id)) {
                return message.reply(
                    "❌ Oyuncu kadroda değil."
                );
            }

            team.players =
                team.players.filter(
                    id => id !== player.id
                );

            saveData();

            return message.reply(
                `✅ ${player} kadrodan çıkarıldı.`
            );
        }

        /* =================================================
           FORMASYON
        ================================================= */

        if (command === "formasyon") {

            const team =
                getTeamOfTD(message.author.id);

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

            const formation = args[0];

            if (!formations.includes(formation)) {
                return message.reply(
                    "❌ Geçersiz formasyon.\n\n" +
                    formations.join("\n")
                );
            }

            team.formation = formation;

            saveData();

            return message.reply(
                `⚽ **${team.name}** formasyonu **${formation}** olarak ayarlandı.`
            );
        }

        /* =================================================
           DEĞER VER
        ================================================= */

        if (command === "dver") {

            if (!isValueStaff(message.member)) {
                return message.reply(
                    "❌ Değer Yetkilisi değilsin."
                );
            }

            const member =
                getMember(message);

            const amount =
                parseMoney(args[1]);

            if (!member || amount <= 0) {
                return message.reply(
                    "❌ Kullanım: `.dver @oyuncu 5M`"
                );
            }

            const result =
                addValue(member, amount);

            await member.setNickname(
                result.nickname
            ).catch(() => {});

            data.players[member.id] =
                data.players[member.id] || {};

            data.players[member.id].value =
                result.newValue;

            saveData();
            logAction("DEGER_VER", message);

            return message.reply(
                `💎 ${member}\n\n` +
                `Eski değer: **${money(result.oldValue)}**\n` +
                `Eklenen: **${money(amount)}**\n` +
                `Yeni değer: **${money(result.newValue)}**`
            );
        }

        /* =================================================
           DEĞER SİL
        ================================================= */

        if (command === "dsil") {

            if (!isValueStaff(message.member)) {
                return message.reply(
                    "❌ Değer Yetkilisi değilsin."
                );
            }

            const member =
                getMember(message);

            const amount =
                parseMoney(args[1]);

            if (!member || amount <= 0) {
                return message.reply(
                    "❌ Kullanım: `.dsil @oyuncu 2M`"
                );
            }

            const oldValue =
                getValue(member);

            const newValue =
                Math.max(
                    0,
                    oldValue - amount
                );

            await member.setNickname(
                setValue(member, newValue)
            ).catch(() => {});

            if (data.players[member.id]) {
                data.players[member.id].value =
                    newValue;
            }

            saveData();

            return message.reply(
                `💎 ${member} değerinden **${money(amount)}** silindi.\n` +
                `Yeni değer: **${money(newValue)}**`
            );
        }

        /* =================================================
           DEĞER
        ================================================= */

        if (command === "değer") {

            const member =
                getMember(message) ||
                message.member;

            return message.reply(
                `💎 **${member.displayName}**\n` +
                `Oyuncu değeri: **${money(
                    getValue(member)
                )}**`
            );
        }

        /* =================================================
           DEĞER GEÇMİŞİ
        ================================================= */

        if (command === "değergeçmiş") {

            const member =
                getMember(message);

            if (!member) {
                return message.reply(
                    "❌ Oyuncu belirt."
                );
            }

            const value =
                data.players[member.id]?.value ||
                getValue(member);

            return message.reply(
                `📜 **${member.displayName} Değer Bilgisi**\n\n` +
                `💎 Güncel değer: **${money(value)}**`
            );
        }

        /* =================================================
           ANTRENMAN
        ================================================= */

        if (
            command === "ant" ||
            command === "antrenman"
        ) {

            const id =
                message.author.id;

            if (!data.training[id]) {
                data.training[id] = 0;
            }

            data.training[id]++;

            if (data.training[id] >= 10) {

                data.training[id] = 0;

                const result =
                    addValue(
                        message.member,
                        3000000
                    );

                await message.member
                    .setNickname(result.nickname)
                    .catch(() => {});

                if (data.players[id]) {
                    data.players[id].value =
                        result.newValue;
                }

                saveData();

                return message.reply(
                    "🏋️ **ANTRENMAN TAMAMLANDI!**\n\n" +
                    "📈 İlerleme: **10/10**\n" +
                    "💎 Ödül: **+3M€**\n" +
                    "🔄 Yeni antrenman: **0/10**"
                );
            }

            saveData();

            return message.reply(
                `🏋️ Antrenman ilerlemen: **${data.training[id]}/10**`
            );
        }

        /* =================================================
           PENALTI
        ================================================= */

        if (
            command === "pen" ||
            command === "penaltı"
        ) {

            const goal =
                Math.random() < 0.65;

            const stats =
                getPlayerStats(
                    message.author.id
                );

            if (goal) {

                const result =
                    addValue(
                        message.member,
                        2000000
                    );

                await message.member
                    .setNickname(result.nickname)
                    .catch(() => {});

                if (data.players[message.author.id]) {
                    data.players[message.author.id].value =
                        result.newValue;
                }

                stats.goals++;

                saveData();

                return message.reply(
                    "🥅 **GOOOOOL!**\n\n" +
                    "⚽ Penaltı başarılı!\n" +
                    "💎 Kazanç: **+2M€**"
                );
            }

            saveData();

            return message.reply(
                "🥅 **KURTARDI!**\n\n" +
                "🧤 Kaleci penaltıyı çıkardı."
            );
        }

        /* =================================================
           KİŞİSEL BÜTÇE
        ================================================= */

        if (command === "bütçe") {

            const amount =
                data.budgets[message.author.id] || 0;

            return message.reply(
                `💰 Kişisel bütçen: **${money(amount)}**`
            );
        }

        /* =================================================
           BÜTÇE VER
        ================================================= */

        if (command === "bütçever") {

            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Yönetici değilsin."
                );
            }

            const member =
                getMember(message);

            const amount =
                parseMoney(args[1]);

            if (!member || amount <= 0) {
                return message.reply(
                    "❌ Kullanım: `.bütçever @oyuncu 5M`"
                );
            }

            data.budgets[member.id] =
                (data.budgets[member.id] || 0) +
                amount;

            saveData();

            return message.reply(
                `💰 ${member} hesabına **${money(amount)}** eklendi.`
            );
        }

        /* =================================================
           BÜTÇE AL
        ================================================= */

        if (command === "bütçeal") {

            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Yönetici değilsin."
                );
            }

            const member =
                getMember(message);

            const amount =
                parseMoney(args[1]);

            if (!member || amount <= 0) {
                return message.reply(
                    "❌ Geçerli miktar gir."
                );
            }

            data.budgets[member.id] =
                Math.max(
                    0,
                    (data.budgets[member.id] || 0) -
                    amount
                );

            saveData();

            return message.reply(
                `💰 ${member} hesabından **${money(amount)}** alındı.`
            );
        }

        /* =================================================
           PARA GÖNDER
        ================================================= */

        if (command === "gönder") {

            const target =
                getMember(message);

            const amount =
                parseMoney(args[1]);

            if (!target || amount <= 0) {
                return message.reply(
                    "❌ Kullanım: `.gönder @oyuncu 5M`"
                );
            }

            const senderBalance =
                data.budgets[message.author.id] || 0;

            if (senderBalance < amount) {
                return message.reply(
                    "❌ Yeterli bütçen yok."
                );
            }

            data.budgets[message.author.id] =
                senderBalance - amount;

            data.budgets[target.id] =
                (data.budgets[target.id] || 0) +
                amount;

            saveData();

            return message.reply(
                `💸 ${target} kullanıcısına **${money(amount)}** gönderildi.`
            );
        }

        /* =================================================
           ŞİRKETLER
        ================================================= */

        if (command === "şirketler") {

            const list =
                COMPANIES.map(
                    (x, i) =>
                        `${i + 1}. **${x}**`
                ).join("\n");

            return message.reply(
                `🏢 **Şirketler**\n\n${list}`
            );
        }

        if (command === "şirketseç") {

            const company =
                args.join(" ");

            if (!COMPANIES.includes(company)) {
                return message.reply(
                    "❌ Şirket bulunamadı.\n\n" +
                    COMPANIES.join("\n")
                );
            }

            if (
                Object.values(
                    data.selectedCompanies
                ).includes(company)
            ) {
                return message.reply(
                    "❌ Bu şirket zaten seçilmiş."
                );
            }

            data.selectedCompanies[
                message.author.id
            ] = company;

            saveData();

            return message.reply(
                `🏢 **${company}** şirketini seçtin.`
            );
        }

        if (command === "şirketim") {

            const company =
                data.selectedCompanies[
                    message.author.id
                ];

            return message.reply(
                company
                    ? `🏢 Şirketin: **${company}**`
                    : "❌ Henüz şirket seçmedin."
            );
        }

        if (command === "şirketiptal") {

            delete data.selectedCompanies[
                message.author.id
            ];

            saveData();

            return message.reply(
                "✅ Şirket seçimin iptal edildi."
            );
        }

        /* =================================================
           SPONSOR
        ================================================= */

        if (command === "sponsorlar") {

            const text =
                SPONSORS.map(
                    s =>
                        `🤝 **${s.name}** — ${money(s.income)}`
                ).join("\n");

            return message.reply(
                `🤝 **Sponsorlar**\n\n${text}`
            );
        }

        if (command === "sponsorseç") {

            const sponsor =
                SPONSORS.find(
                    s =>
                        s.name.toLowerCase() ===
                        args.join(" ").toLowerCase()
                );

            if (!sponsor) {
                return message.reply(
                    "❌ Sponsor bulunamadı."
                );
            }

            if (
                Object.values(
                    data.selectedSponsors
                ).includes(sponsor.name)
            ) {
                return message.reply(
                    "❌ Bu sponsor zaten seçilmiş."
                );
            }

            data.selectedSponsors[
                message.author.id
            ] = sponsor.name;

            saveData();

            return message.reply(
                `🤝 **${sponsor.name}** sponsorunu seçtin.`
            );
        }

        if (command === "sponsorlarım") {

            const sponsor =
                data.selectedSponsors[
                    message.author.id
                ];

            return message.reply(
                sponsor
                    ? `🤝 Sponsorun: **${sponsor}**`
                    : "❌ Sponsorun yok."
            );
        }

        if (command === "sponsoriptal") {

            delete data.selectedSponsors[
                message.author.id
            ];

            saveData();

            return message.reply(
                "✅ Sponsor iptal edildi."
            );
        }

        /* =================================================
           TAKIM BÜTÇESİ
        ================================================= */

        if (command === "takımbütçesi") {

            const team =
                getTeamOfTD(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Takımın yok."
                );
            }

            return message.reply(
                `🏟️ **${team.name}**\n` +
                `💰 Bütçe: **${money(team.budget || 0)}**`
            );
        }

        if (command === "takımbütçever") {

            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Yönetici değilsin."
                );
            }

            const teamName =
                args.slice(0, -1).join(" ");

            const amount =
                parseMoney(args[args.length - 1]);

            const team =
                Object.values(data.teams)
                    .find(
                        t =>
                            t.name.toLowerCase() ===
                            teamName.toLowerCase()
                    );

            if (!team || amount <= 0) {
                return message.reply(
                    "❌ Takım veya miktar hatalı."
                );
            }

            team.budget =
                (team.budget || 0) + amount;

            saveData();

            return message.reply(
                `💰 **${team.name}** bütçesine **${money(amount)}** eklendi.`
            );
        }

        if (command === "takımbütçeal") {

            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Yönetici değilsin."
                );
            }

            const teamName =
                args.slice(0, -1).join(" ");

            const amount =
                parseMoney(args[args.length - 1]);

            const team =
                Object.values(data.teams)
                    .find(
                        t =>
                            t.name.toLowerCase() ===
                            teamName.toLowerCase()
                    );

            if (!team || amount <= 0) {
                return message.reply(
                    "❌ Takım veya miktar hatalı."
                );
            }

            team.budget =
                Math.max(
                    0,
                    (team.budget || 0) - amount
                );

            saveData();

            return message.reply(
                `💰 **${team.name}** bütçesinden **${money(amount)}** alındı.`
            );
        }

        /* =================================================
           PROFİL
        ================================================= */

        if (command === "profil") {

            const member =
                getMember(message) ||
                message.member;

            const stats =
                getPlayerStats(member.id);

            const value =
                data.players[member.id]?.value ||
                getValue(member);

            const training =
                data.training[member.id] || 0;

            const team =
                getTeamOfPlayer(member.id);

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        `👤 ${member.displayName}`
                    )
                    .setThumbnail(
                        member.user.displayAvatarURL({
                            size: 256
                        })
                    )
                    .addFields(
                        {
                            name: "💎 Değer",
                            value: money(value),
                            inline: true
                        },
                        {
                            name: "🏟️ Takım",
                            value:
                                team?.name ||
                                "Takımsız",
                            inline: true
                        },
                        {
                            name: "🏋️ Antrenman",
                            value:
                                `${training}/10`,
                            inline: true
                        },
                        {
                            name: "⚽ Gol",
                            value:
                                String(stats.goals),
                            inline: true
                        },
                        {
                            name: "🎯 Asist",
                            value:
                                String(stats.assists),
                            inline: true
                        },
                        {
                            name: "🟨 Sarı",
                            value:
                                String(stats.yellow),
                            inline: true
                        },
                        {
                            name: "🟥 Kırmızı",
                            value:
                                String(stats.red),
                            inline: true
                        }
                    );

            return message.reply({
                embeds: [embed]
            });
        }

        /* =================================================
           LİG
        ================================================= */

        if (
            command === "lig" ||
            command === "puan"
        ) {

            const teams =
                Object.values(data.teams)
                    .sort(
                        (a, b) =>
                            (b.points || 0) -
                            (a.points || 0)
                    );

            let text =
                "🏆 **UNITED LEAGUE PUAN DURUMU**\n\n";

            if (teams.length === 0) {
                text +=
                    "Henüz ligde takım yok.";
            } else {

                teams.forEach(
                    (team, index) => {

                        text +=
                            `**${index + 1}. ${team.name}**\n` +
                            `⭐ ${team.points || 0} P | ` +
                            `⚽ ${team.gf || 0} AG | ` +
                            `🥅 ${team.ga || 0} YG | ` +
                            `📈 ${team.gd || 0} AV\n\n`;
                    }
                );
            }

            return message.reply(text);
        }

        /* =================================================
           GOL KRALLIĞI
        ================================================= */

        if (command === "golkrallığı") {

            const players =
                Object.entries(data.stats)
                    .sort(
                        (a, b) =>
                            (b[1].goals || 0) -
                            (a[1].goals || 0)
                    )
                    .slice(0, 20);

            let text =
                "⚽ **GOL KRALLIĞI**\n\n";

            for (
                let i = 0;
                i < players.length;
                i++
            ) {

                const member =
                    await message.guild.members
                        .fetch(players[i][0])
                        .catch(() => null);

                text +=
                    `${i + 1}. ` +
                    `${member ? member.displayName : "Oyuncu"} — ` +
                    `**${players[i][1].goals || 0} gol**\n`;
            }

            return message.reply(text);
        }

        /* =================================================
           ASİST KRALLIĞI
        ================================================= */

        if (command === "asistkrallığı") {

            const players =
                Object.entries(data.stats)
                    .sort(
                        (a, b) =>
                            (b[1].assists || 0) -
                            (a[1].assists || 0)
                    )
                    .slice(0, 20);

            let text =
                "🎯 **ASİST KRALLIĞI**\n\n";

            for (
                let i = 0;
                i < players.length;
                i++
            ) {

                const member =
                    await message.guild.members
                        .fetch(players[i][0])
                        .catch(() => null);

                text +=
                    `${i + 1}. ` +
                    `${member ? member.displayName : "Oyuncu"} — ` +
                    `**${players[i][1].assists || 0} asist**\n`;
            }

            return message.reply(text);
        }

        /* =================================================
           MAÇ
        ================================================= */

        if (command === "maç") {

            if (
                !isAdmin(message.member) &&
                !message.member.roles.cache.has(
                    ROLES.YONETICI
                )
            ) {
                return message.reply(
                    "❌ Maç Yetkilisi değilsin."
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
                getTeamOfTD(mentions[0].id);

            const team2 =
                getTeamOfTD(mentions[1].id);

            if (!team1 || !team2) {
                return message.reply(
                    "❌ Her iki TD'nin de takımı olmalı."
                );
            }

            if (team1.name === team2.name) {
                return message.reply(
                    "❌ Aynı takım kendiyle oynayamaz."
                );
            }

            let score1 = 0;
            let score2 = 0;

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        `⚽ ${team1.name} - ${team2.name}`
                    )
                    .setDescription(
                        "🏟️ Maç başlıyor..."
                    );

            const matchMessage =
                await message.channel.send({
                    embeds: [embed]
                });

            for (
                let minute = 1;
                minute <= 90;
                minute += 10
            ) {

                await new Promise(
                    resolve =>
                        setTimeout(resolve, 1000)
                );

                const chance =
                    Math.random();

                if (chance < 0.13) {
                    score1++;

                    embed.setDescription(
                        `⏱️ ${minute}'\n\n` +
                        `⚽ **GOOOL!** ${team1.name}\n\n` +
                        `🔴 ${score1} - ${score2} 🔵`
                    );
                } else if (chance > 0.87) {
                    score2++;

                    embed.setDescription(
                        `⏱️ ${minute}'\n\n` +
                        `⚽ **GOOOL!** ${team2.name}\n\n` +
                        `🔴 ${score1} - ${score2} 🔵`
                    );
                } else {
                    embed.setDescription(
                        `⏱️ ${minute}'\n\n` +
                        `⚽ Oyun devam ediyor...\n\n` +
                        `🔴 ${score1} - ${score2} 🔵`
                    );
                }

                await matchMessage.edit({
                    embeds: [embed]
                });
            }

            team1.played =
                (team1.played || 0) + 1;

            team2.played =
                (team2.played || 0) + 1;

            team1.gf =
                (team1.gf || 0) + score1;

            team1.ga =
                (team1.ga || 0) + score2;

            team2.gf =
                (team2.gf || 0) + score2;

            team2.ga =
                (team2.ga || 0) + score1;

            team1.gd =
                (team1.gf || 0) -
                (team1.ga || 0);

            team2.gd =
                (team2.gf || 0) -
                (team2.ga || 0);

            if (score1 > score2) {

                team1.points =
                    (team1.points || 0) + 3;

                team1.wins =
                    (team1.wins || 0) + 1;

                team2.losses =
                    (team2.losses || 0) + 1;

            } else if (score2 > score1) {

                team2.points =
                    (team2.points || 0) + 3;

                team2.wins =
                    (team2.wins || 0) + 1;

                team1.losses =
                    (team1.losses || 0) + 1;

            } else {

                team1.points =
                    (team1.points || 0) + 1;

                team2.points =
                    (team2.points || 0) + 1;

                team1.draws =
                    (team1.draws || 0) + 1;

                team2.draws =
                    (team2.draws || 0) + 1;
            }

            data.matches.push({
                team1: team1.name,
                team2: team2.name,
                score1,
                score2,
                date: Date.now()
            });

            saveData();

            embed.setTitle("🏁 MAÇ BİTTİ")
                .setDescription(
                    `🏟️ **${team1.name}**\n` +
                    `🔴 **${score1}** - **${score2}** 🔵\n` +
                    `🏟️ **${team2.name}**`
                );

            return matchMessage.edit({
                embeds: [embed]
            });
        }

        /* =================================================
           MAÇ GEÇMİŞİ
        ================================================= */

        if (
            command === "maçlar" ||
            command === "maçgeçmişi"
        ) {

            const matches =
                data.matches.slice(-15).reverse();

            if (matches.length === 0) {
                return message.reply(
                    "📭 Henüz maç oynanmadı."
                );
            }

            const text =
                matches.map(
                    (m, i) =>
                        `${i + 1}. **${m.team1}** ` +
                        `**${m.score1}-${m.score2}** ` +
                        `**${m.team2}**`
                ).join("\n");

            return message.reply(
                `📜 **MAÇ GEÇMİŞİ**\n\n${text}`
            );
        }

        /* =================================================
           İSTATİSTİK
        ================================================= */

        if (command === "istatistik") {

            const member =
                getMember(message) ||
                message.member;

            const stats =
                getPlayerStats(member.id);

            return message.reply(
                `📊 **${member.displayName}**\n\n` +
                `⚽ Gol: **${stats.goals}**\n` +
                `🎯 Asist: **${stats.assists}**\n` +
                `🟨 Sarı: **${stats.yellow}**\n` +
                `🟥 Kırmızı: **${stats.red}**\n` +
                `🏟️ Maç: **${stats.appearances}**`
            );
        }

        /* =================================================
           TAKIM PROFİL
        ================================================= */

        if (command === "takımprofil") {

            const teamName =
                args.join(" ");

            const team =
                Object.values(data.teams)
                    .find(
                        t =>
                            t.name.toLowerCase() ===
                            teamName.toLowerCase()
                    );

            if (!team) {
                return message.reply(
                    "❌ Takım bulunamadı."
                );
            }

            return message.reply(
                `🏟️ **${team.name}**\n\n` +
                `👔 TD: <@${team.td}>\n` +
                `💰 Bütçe: **${money(team.budget || 0)}**\n` +
                `⭐ Puan: **${team.points || 0}**\n` +
                `⚽ Attığı Gol: **${team.gf || 0}**\n` +
                `🥅 Yediği Gol: **${team.ga || 0}**\n` +
                `👥 Kadro: **${(team.players || []).length}**`
            );
        }

        /* =================================================
           ÇEKİLİŞ
        ================================================= */

        if (command === "çekiliş") {

            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Çekiliş Yetkilisi değilsin."
                );
            }

            const prize =
                args[0];

            const durationText =
                args[1];

            const duration =
                parseDuration(durationText);

            if (!prize || !duration) {
                return message.reply(
                    "❌ Kullanım: `.çekiliş 30M€ 1s`\n\n" +
                    "s = saniye\n" +
                    "d = dakika\n" +
                    "saat = saat"
                );
            }

            const id =
                Date.now().toString();

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                `cekilis_${id}`
                            )
                            .setLabel("🎁 Katıl")
                            .setStyle(
                                ButtonStyle.Success
                            )
                    );

            data.giveaways[id] = {
                prize,
                users: [],
                end: Date.now() + duration
            };

            saveData();

            const msg =
                await message.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "🎁 UNITED LEAGUE ÇEKİLİŞİ"
                            )
                            .setDescription(
                                `🎁 Ödül: **${prize}**\n\n` +
                                `⏳ Süre: **${durationText}**\n\n` +
                                "Katılmak için aşağıdaki butona bas!"
                            )
                    ],
                    components: [row]
                });

            setTimeout(async () => {

                const giveaway =
                    data.giveaways[id];

                if (!giveaway) return;

                if (giveaway.users.length === 0) {

                    await msg.edit({
                        content:
                            "❌ Çekilişe kimse katılmadı.",
                        components: []
                    }).catch(() => {});

                } else {

                    const winner =
                        giveaway.users[
                            Math.floor(
                                Math.random() *
                                giveaway.users.length
                            )
                        ];

                    await msg.edit({
                        content:
                            `🎉 **ÇEKİLİŞ BİTTİ!**\n\n` +
                            `🏆 Ödül: **${giveaway.prize}**\n` +
                            `👑 Kazanan: <@${winner}>`,
                        components: []
                    }).catch(() => {});
                }

                delete data.giveaways[id];
                saveData();

            }, duration);

            return;
        }

        /* =================================================
           TWEET
        ================================================= */

        if (command === "tweet") {

            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Medya Yetkilisi değilsin."
                );
            }

            const text =
                args.join(" ");

            if (!text) {
                return message.reply(
                    "❌ Tweet mesajını yaz."
                );
            }

            const embed =
                new EmbedBuilder()
                    .setAuthor({
                        name:
                            message.guild.name
                    })
                    .setDescription(
                        `🐦 ${text}`
                    )
                    .setFooter({
                        text:
                            "United League Media"
                    })
                    .setTimestamp();

            return message.channel.send({
                embeds: [embed]
            });
        }

        /* =================================================
           HABER
        ================================================= */

        if (command === "haber") {

            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Medya Yetkilisi değilsin."
                );
            }

            const text =
                args.join(" ");

            if (!text) {
                return message.reply(
                    "❌ Haber yaz."
                );
            }

            return message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("📰 SON DAKİKA")
                        .setDescription(text)
                        .setTimestamp()
                ]
            });
        }

        /* =================================================
           TRANSFER DUYURU
        ================================================= */

        if (command === "transferduyuru") {

            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Medya Yetkilisi değilsin."
                );
            }

            const text =
                args.join(" ");

            const channel =
                message.guild.channels.cache.get(
                    data.channels.transferDuyuru
                );

            if (!channel) {
                return message.
