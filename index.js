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
    TextInputStyle
} = require("discord.js");

const fs = require("fs");

// ======================================================
// UNITED LEAGUE BOT
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// ======================================================
// ROLLER
// ======================================================

const ROLES = {
    YONETICI: "1544449436011339806",
    KAYIT: "1544452022764568656",
    DEGER: "1544451743746891806",
    MOD: "1544450307088715917",
    TD: "1544452323450032229",
    OYUNCU: "1544452779156709516",
    KAYITSIZ: "1544488182027133030"
};

// ======================================================
// KANALLAR
// ======================================================

const CHANNELS = {
    GELEN_GIDEN: "gelen-giden",
    SOHBET: "sohbet",
    KAYIT: "kayıt",
    KAYIT_LOG: "kayıt-log",
    TRANSFER: "transfer",
    TRANSFER_LOG: "transfer-log",
    TRANSFER_DUYURU: "transfer-duyuruları",
    MAÇ: "maçlar",
    LOG: "yetkili-log",
    MOD_LOG: "moderasyon-log",
    CEKILIS_LOG: "çekiliş-log",
    BOT: "bot-komut",
    DEGER: "değerler",
    BUTCE_LOG: "bütçelog"
};

// ======================================================
// DOSYA SİSTEMİ
// ======================================================

const DATA_FILE = "./unitedleague-data.json";

let data = {
    players: {},
    teams: {},
    usedTeams: [],
    contracts: {},
    transfers: [],
    valuesHistory: {},
    training: {},
    stats: {},
    personalBudget: {},
    companies: {},
    sponsors: {},
    giveaways: {},
    warnings: {},
    matches: [],
    standings: {}
};

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        }
    } catch (err) {
        console.error("Veri yükleme hatası:", err);
    }
}

function saveData() {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(data, null, 2)
        );
    } catch (err) {
        console.error("Veri kaydetme hatası:", err);
    }
}

loadData();

// ======================================================
// YARDIMCI FONKSİYONLAR
// ======================================================

function money(value) {
    return `${Number(value || 0).toLocaleString("tr-TR")}€`;
}

function parseMoney(text) {
    if (!text) return 0;

    let clean = String(text)
        .toLowerCase()
        .replace(/€/g, "")
        .replace(/\./g, "")
        .replace(/,/g, "")
        .trim();

    let multiplier = 1;

    if (clean.endsWith("k")) {
        multiplier = 1000;
        clean = clean.slice(0, -1);
    }

    if (clean.endsWith("m")) {
        multiplier = 1000000;
        clean = clean.slice(0, -1);
    }

    if (clean.endsWith("b")) {
        multiplier = 1000000000;
        clean = clean.slice(0, -1);
    }

    const number = Number(clean);

    if (isNaN(number)) return 0;

    return Math.floor(number * multiplier);
}

function hasRole(member, roleId) {
    return member.roles.cache.has(roleId);
}

function isAdmin(member) {
    return (
        member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        hasRole(member, ROLES.YONETICI)
    );
}

function isMod(member) {
    return (
        isAdmin(member) ||
        hasRole(member, ROLES.MOD)
    );
}

function isValueStaff(member) {
    return (
        isAdmin(member) ||
        hasRole(member, ROLES.DEGER)
    );
}

function isRegistrationStaff(member) {
    return (
        isAdmin(member) ||
        hasRole(member, ROLES.KAYIT)
    );
}

function isTeamDirector(member) {
    return hasRole(member, ROLES.TD);
}

function getUserData(id) {
    if (!data.players[id]) {
        data.players[id] = {
            team: null,
            value: 0,
            training: 0,
            goals: 0,
            assists: 0,
            yellow: 0,
            red: 0,
            matches: 0,
            wins: 0,
            losses: 0,
            draws: 0
        };
    }

    return data.players[id];
}

function getStats(id) {
    if (!data.stats[id]) {
        data.stats[id] = {
            goals: 0,
            assists: 0,
            yellow: 0,
            red: 0,
            matches: 0
        };
    }

    return data.stats[id];
}

function findTeamByDirector(id) {
    return Object.values(data.teams).find(
        team => team.director === id
    );
}

function findTeam(name) {
    if (!name) return null;

    const lower = name.toLowerCase();

    return Object.values(data.teams).find(
        t => t.name.toLowerCase() === lower
    );
}

function getPlayerTeam(id) {
    const player = getUserData(id);

    if (!player.team) return null;

    return data.teams[player.team] || null;
}

function addPlayerToTeam(userId, teamName) {
    const player = getUserData(userId);

    if (player.team) {
        const oldTeam = data.teams[player.team];

        if (oldTeam) {
            oldTeam.squad = oldTeam.squad.filter(
                id => id !== userId
            );
        }
    }

    player.team = teamName;

    if (data.teams[teamName]) {
        if (!data.teams[teamName].squad.includes(userId)) {
            data.teams[teamName].squad.push(userId);
        }
    }
}

function removePlayerFromTeam(userId) {
    const player = getUserData(userId);

    if (!player.team) return;

    const team = data.teams[player.team];

    if (team) {
        team.squad = team.squad.filter(
            id => id !== userId
        );
    }

    player.team = null;
}

function getFinalValueFromNickname(nickname) {
    if (!nickname) return 0;

    const parts = nickname.split("|");
    const last = parts[parts.length - 1];

    return parseMoney(last);
}

function replaceNicknameValue(nickname, newValue) {
    if (!nickname) return nickname;

    const parts = nickname.split("|");

    if (parts.length === 1) {
        return `${nickname} | ${money(newValue)}`;
    }

    parts[parts.length - 1] = ` ${money(newValue)}`;

    return parts.join("|");
}

async function sendChannelMessage(guild, channelName, message) {
    const channel = guild.channels.cache.find(
        c => c.name === channelName &&
        c.isTextBased()
    );

    if (!channel) return null;

    return channel.send(message);
}

async function logMessage(guild, message) {
    const channel = guild.channels.cache.find(
        c => c.name === CHANNELS.LOG &&
        c.isTextBased()
    );

    if (!channel) return;

    channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("📋 Sistem Logu")
                .setDescription(message)
                .setTimestamp()
        ]
    }).catch(() => {});
}

// ======================================================
// TAKIMLAR
// ======================================================

const FOOTBALL_TEAMS = [
    "Galatasaray",
    "Fenerbahçe",
    "Beşiktaş",
    "Trabzonspor",
    "Başakşehir",
    "Konyaspor",
    "Antalyaspor",
    "Bursaspor",
    "Real Madrid",
    "Barcelona",
    "Atlético Madrid",
    "Manchester United",
    "Manchester City",
    "Liverpool",
    "Arsenal",
    "Chelsea",
    "Tottenham Hotspur",
    "Bayern Münih",
    "Borussia Dortmund",
    "Bayer Leverkusen",
    "Paris Saint-Germain",
    "Olympique de Marseille",
    "Inter",
    "Milan",
    "Juventus",
    "Napoli",
    "Roma",
    "Lazio",
    "Ajax",
    "PSV Eindhoven",
    "Benfica",
    "Porto"
];

// ======================================================
// ŞİRKETLER
// ======================================================

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

// ======================================================
// SPONSORLAR
// ======================================================

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
        income: 8000000
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
        income: 6500000
    },
    {
        name: "Red Bull",
        income: 5500000
    }
];

// ======================================================
// BOT HAZIR
// ======================================================

client.once("ready", async () => {
    console.log("================================");
    console.log("✅ UNITED LEAGUE BOT AKTİF");
    console.log(`🤖 ${client.user.tag}`);
    console.log(`🏠 ${client.guilds.cache.size} sunucu`);
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

// ======================================================
// YENİ ÜYE
// ======================================================

client.on("guildMemberAdd", async member => {
    try {
        const kayitsiz = member.guild.roles.cache.get(
            ROLES.KAYITSIZ
        );

        if (kayitsiz) {
            await member.roles.add(kayitsiz);
        }

        const channel = member.guild.channels.cache.find(
            c =>
                c.name === CHANNELS.GELEN_GIDEN &&
                c.isTextBased()
        );

        if (channel) {
            channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2ecc71)
                        .setTitle("👋 Yeni Oyuncu Geldi")
                        .setDescription(
                            `**${member.user.tag}** sunucuya katıldı.\n\n` +
                            `Kayıt olmak için kayıt kanalına geçebilirsin.`
                        )
                        .setThumbnail(member.user.displayAvatarURL())
                        .setTimestamp()
                ]
            });
        }
    } catch (err) {
        console.error("Üye giriş hatası:", err);
    }
});

// ======================================================
// ÜYE ÇIKIŞ
// ======================================================

client.on("guildMemberRemove", async member => {
    try {
        const team = findTeamByDirector(member.id);

        if (team) {
            team.director = null;
            team.budget = 0;
            team.status = "Boş Takım";
            saveData();

            await logMessage(
                member.guild,
                `⚠️ ${member.user.tag} ayrıldı.\n` +
                `🏟️ Takım: ${team.name}\n` +
                `Takım boş duruma getirildi.\n` +
                `👥 Oyuncular takımda bırakıldı.`
            );
        }
    } catch (err) {
        console.error("Üye çıkış hatası:", err);
    }
});

// ======================================================
// MESAJ KOMUTLARI
// ======================================================

client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (!message.content.startsWith(".")) return;

    const args = message.content.slice(1).trim().split(/\s+/);

    const command = args.shift()?.toLowerCase();

    if (!command) return;

    // ==================================================
    // YARDIM
    // ==================================================

    if (command === "yardım" || command === "help") {
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
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
                    "`.dsil @oyuncu 5M`",
                    "`.değer @oyuncu`",
                    "`.değergeçmiş @oyuncu`",
                    "",
                    "**⚽ Oyuncu**",
                    "`.oyuncual @oyuncu`",
                    "`.sözleşme @oyuncu`",
                    "`.sözleşmeiptal @oyuncu`",
                    "",
                    "**🏃 Antrenman**",
                    "`.ant`",
                    "`.antrenman`",
                    "",
                    "**🥅 Penaltı**",
                    "`.pen`",
                    "`.penaltı`",
                    "",
                    "**🏆 Maç & Lig**",
                    "`.maç @takım1 @takım2`",
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
                    "**🤝 Sponsor & Şirket**",
                    "`.şirketler`",
                    "`.şirketseç`",
                    "`.şirketim`",
                    "`.sponsorlar`",
                    "`.sponsorseç`",
                    "`.sponsorlarım`",
                    "",
                    "**🎁 Çekiliş**",
                    "`.çekiliş 30M 1s`",
                    "",
                    "**📰 Medya**",
                    "`.tweet mesaj`",
                    "`.haber mesaj`",
                    "`.transferduyuru`",
                    "",
                    "**🛡️ Moderasyon**",
                    "`.sil 10`",
                    "`.kick @oyuncu sebep`",
                    "`.ban @oyuncu sebep`",
                    "`.mute @oyuncu`",
                    "`.unmute @oyuncu`",
                    "`.uyar @oyuncu sebep`",
                    "`.sicil @oyuncu`",
                    "`.kilit`",
                    "`.aç`",
                    "",
                    "**📊 Profil**",
                    "`.profil @oyuncu`",
                    "`.takımprofil @takım`"
                ].join("\n")
            )
            .setFooter({
                text: "United League • Futbol RP"
            });

        return message.channel.send({
            embeds: [embed]
        });
    }

    // ==================================================
    // KAYIT
    // ==================================================

    if (command === "k") {
        if (!isRegistrationStaff(message.member)) {
            return message.reply("❌ Bu komutu kullanmak için Kayıt Yetkilisi olmalısın.");
        }

        const target = message.mentions.members.first();

        if (!target) {
            return message.reply("❌ Kullanım: `.k @oyuncu İsim`");
        }

        const name = args.slice(0).join(" ");

        if (!name) {
            return message.reply("❌ Oyuncunun ismini yazmalısın.");
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`register_player_${target.id}_${name}`)
                .setLabel("Futbolcu")
                .setEmoji("⚽")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`register_td_${target.id}_${name}`)
                .setLabel("Teknik Direktör")
                .setEmoji("👔")
                .setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("📝 Kayıt İşlemi")
            .setDescription(
                `👤 Oyuncu: ${target}\n` +
                `📛 İsim: **${name}**\n\n` +
                `Oyuncunun rolünü seç.`
            );

        return message.channel.send({
            embeds: [embed],
            components: [row]
        });
    }

    // ==================================================
    // TAKIM KUR
    // ==================================================

    if (command === "takımkur") {
        if (!isTeamDirector(message.member)) {
            return message.reply("❌ Bu komutu sadece Teknik Direktörler kullanabilir.");
        }

        if (findTeamByDirector(message.author.id)) {
            return message.reply("❌ Zaten bir takımın bulunuyor.");
        }

        const available = FOOTBALL_TEAMS.filter(
            team => !data.usedTeams.includes(team)
        );

        if (!available.length) {
            return message.reply("❌ Kullanılabilecek takım kalmadı.");
        }

        const options = available
            .slice(0, 25)
            .map(team => ({
                label: team,
                value: team
            }));

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`team_create_${message.author.id}`)
            .setPlaceholder("🏟️ Bir takım seç")
            .addOptions(options);

        const row = new ActionRowBuilder()
            .addComponents(menu);

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setTitle("🏟️ Takım Oluştur")
                    .setDescription(
                        "Aşağıdaki menüden bir takım seç.\n\n" +
                        "💰 Başlangıç bütçesi: **100M€**"
                    )
            ],
            components: [row]
        });
    }

    // ==================================================
    // KADRO
    // ==================================================

    if (
        command === "kadro" ||
        command === "kadrom"
    ) {
        const team = findTeamByDirector(message.author.id);

        if (!team) {
            return message.reply("❌ Bir takımın bulunmuyor.");
        }

        const players = team.squad || [];

        let text = "";

        if (!players.length) {
            text = "Kadroda henüz oyuncu bulunmuyor.";
        } else {
            text = players
                .map((id, index) => `${index + 1}. <@${id}>`)
                .join("\n");
        }

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle(`👥 ${team.name} Kadrosu`)
                    .setDescription(text)
                    .addFields(
                        {
                            name: "🏟️ Takım",
                            value: team.name,
                            inline: true
                        },
                        {
                            name: "💰 Bütçe",
                            value: money(team.budget),
                            inline: true
                        },
                        {
                            name: "📋 Formasyon",
                            value: team.formation || "4-3-3",
                            inline: true
                        }
                    )
            ]
        });
    }

    // ==================================================
    // KADRO EKLE
    // ==================================================

    if (command === "kadroekle") {
        const team = findTeamByDirector(message.author.id);

        if (!team) {
            return message.reply("❌ Bir takımın bulunmuyor.");
        }

        const target = message.mentions.members.first();

        if (!target) {
            return message.reply("❌ Oyuncuyu etiketlemelisin.");
        }

        const player = getUserData(target.id);

        if (player.team !== team.name) {
            return message.reply("❌ Bu oyuncu senin takımında değil.");
        }

        if (team.squad.includes(target.id)) {
            return message.reply("❌ Oyuncu zaten kadroda.");
        }

        team.squad.push(target.id);

        saveData();

        return message.reply(
            `✅ ${target} kadroya eklendi.`
        );
    }

    // ==================================================
    // KADRO ÇIKAR
    // ==================================================

    if (command === "kadroçıkar") {
        const team = findTeamByDirector(message.author.id);

        if (!team) {
            return message.reply("❌ Bir takımın bulunmuyor.");
        }

        const target = message.mentions.members.first();

        if (!target) {
            return message.reply("❌ Oyuncuyu etiketlemelisin.");
        }

        team.squad = team.squad.filter(
            id => id !== target.id
        );

        saveData();

        return message.reply(
            `✅ ${target} kadrodan çıkarıldı.`
        );
    }

    // ==================================================
    // FORMASYON
    // ==================================================

    if (command === "formasyon") {
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
                `❌ Geçersiz formasyon.\n\n` +
                formations.map(x => `• ${x}`).join("\n")
            );
        }

        const team = findTeamByDirector(message.author.id);

        if (!team) {
            return message.reply("❌ Bir takımın bulunmuyor.");
        }

        team.formation = formation;

        saveData();

        return message.reply(
            `✅ Formasyon **${formation}** olarak ayarlandı.`
        );
    }

    // ==================================================
    // DEĞER VER
    // ==================================================

    if (command === "dver") {
        if (!isValueStaff(message.member)) {
            return message.reply("❌ Değer Yetkilisi değilsin.");
        }

        const target = message.mentions.members.first();
        const amount = parseMoney(args[1]);

        if (!target || !amount) {
            return message.reply(
                "❌ Kullanım: `.dver @oyuncu 5M`"
            );
        }

        const player = getUserData(target.id);

        let currentValue = player.value;

        if (!currentValue) {
            currentValue = getFinalValueFromNickname(
                target.nickname || target.user.username
            );
        }

        const oldValue = currentValue;

        player.value = currentValue + amount;

        const nickname =
            target.nickname ||
            target.user.username;

        const newNickname = replaceNicknameValue(
            nickname,
            player.value
        );

        try {
            await target.setNickname(newNickname);
        } catch {}

        if (!data.valuesHistory[target.id]) {
            data.valuesHistory[target.id] = [];
        }

        data.valuesHistory[target.id].push({
            type: "ARTI",
            amount,
            oldValue,
            newValue: player.value,
            by: message.author.id,
            date: Date.now()
        });

        saveData();

        return message.reply(
            `💎 ${target}\n\n` +
            `Eski değer: **${money(oldValue)}**\n` +
            `Eklenen: **+${money(amount)}**\n` +
            `Yeni değer: **${money(player.value)}**`
        );
    }

    // ==================================================
    // DEĞER SİL
    // ==================================================

    if (command === "dsil") {
        if (!isValueStaff(message.member)) {
            return message.reply("❌ Değer Yetkilisi değilsin.");
        }

        const target = message.mentions.members.first();
        const amount = parseMoney(args[1]);

        if (!target || !amount) {
            return message.reply(
                "❌ Kullanım: `.dsil @oyuncu 5M`"
            );
        }

        const player = getUserData(target.id);

        const oldValue = player.value;

        player.value = Math.max(
            0,
            player.value - amount
        );

        const nickname =
            target.nickname ||
            target.user.username;

        const newNickname = replaceNicknameValue(
            nickname,
            player.value
        );

        try {
            await target.setNickname(newNickname);
        } catch {}

        if (!data.valuesHistory[target.id]) {
            data.valuesHistory[target.id] = [];
        }

        data.valuesHistory[target.id].push({
            type: "AZALIŞ",
            amount,
            oldValue,
            newValue: player.value,
            by: message.author.id,
            date: Date.now()
        });

        saveData();

        return message.reply(
            `💎 ${target}\n\n` +
            `Eski değer: **${money(oldValue)}**\n` +
            `Silinen: **-${money(amount)}**\n` +
            `Yeni değer: **${money(player.value)}**`
        );
    }

    // ==================================================
    // DEĞER
    // ==================================================

    if (command === "değer") {
        const target =
            message.mentions.members.first() ||
            message.member;

        const player = getUserData(target.id);

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x9b59b6)
                    .setTitle("💎 Oyuncu Değeri")
                    .setDescription(
                        `${target}\n\n` +
                        `💰 Değer: **${money(player.value)}**`
                    )
            ]
        });
    }

    // ==================================================
    // DEĞER GEÇMİŞİ
    // ==================================================

    if (command === "değergeçmiş") {
        const target =
            message.mentions.members.first() ||
            message.member;

        const history =
            data.valuesHistory[target.id] || [];

        if (!history.length) {
            return message.reply("📋 Değer geçmişi bulunmuyor.");
        }

        const text = history
            .slice(-15)
            .reverse()
            .map(x =>
                `${x.type === "ARTI" ? "📈" : "📉"} ` +
                `${money(x.amount)} → ${money(x.newValue)}`
            )
            .join("\n");

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x9b59b6)
                    .setTitle(`📋 ${target.user.username} Değer Geçmişi`)
                    .setDescription(text)
            ]
        });
    }

    // ==================================================
    // ANTRENMAN
    // ==================================================

    if (
        command === "ant" ||
        command === "antrenman"
    ) {
        const player = getUserData(message.author.id);

        player.training++;

        if (player.training >= 10) {
            player.training = 1;

            player.value += 3000000;

            if (!data.valuesHistory[message.author.id]) {
                data.valuesHistory[message.author.id] = [];
            }

            data.valuesHistory[message.author.id].push({
                type: "ANTRENMAN",
                amount: 3000000,
                newValue: player.value,
                by: message.author.id,
                date: Date.now()
            });

            try {
                const nickname =
                    message.member.nickname ||
                    message.author.username;

                await message.member.setNickname(
                    replaceNicknameValue(
                        nickname,
                        player.value
                    )
                );
            } catch {}

            saveData();

            return message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2ecc71)
                        .setTitle("🏃 ANTRENMAN TAMAMLANDI")
                        .setDescription(
                            `${message.author}\n\n` +
                            `🎯 Antrenman: **10/10**\n` +
                            `💎 Değer artışı: **+3M€**\n` +
                            `💰 Yeni değer: **${money(player.value)}**\n\n` +
                            `🔄 Yeni antrenman: **1/10**`
                        )
                ]
            });
        }

        saveData();

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle("🏃 Antrenman")
                    .setDescription(
                        `${message.author}\n\n` +
                        `📊 İlerleme: **${player.training}/10**`
                    )
            ]
        });
    }

    // ==================================================
    // PENALTI
    // ==================================================

    if (
        command === "pen" ||
        command === "penaltı"
    ) {
        const player = getUserData(message.author.id);
        const stats = getStats(message.author.id);

        const goal = Math.random() < 0.5;

        if (goal) {
            player.value += 2000000;
            player.goals++;
            stats.goals++;

            try {
                const nickname =
                    message.member.nickname ||
                    message.author.username;

                await message.member.setNickname(
                    replaceNicknameValue(
                        nickname,
                        player.value
                    )
                );
            } catch {}

            saveData();

            return message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2ecc71)
                        .setTitle("🥅 PENALTI")
                        .setDescription(
                            `⚽ **GOOOL!**\n\n` +
                            `${message.author} penaltıyı gole çevirdi!\n\n` +
                            `💎 Değer: **+2M€**\n` +
                            `💰 Yeni değer: **${money(player.value)}**`
                        )
                ]
            });
        }

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle("🥅 PENALTI")
                    .setDescription(
                        `❌ **KAÇTI!**\n\n` +
                        `${message.author} penaltıyı kaçırdı.`
                    )
            ]
        });
    }

    // ==================================================
    // OYUNCU AL
    // ==================================================

    if (command === "oyuncual") {
        const team = findTeamByDirector(message.author.id);

        if (!team) {
            return message.reply("❌ Önce takım kurmalısın.");
        }

        const target = message.mentions.members.first();

        if (!target) {
            return message.reply(
                "❌ Kullanım: `.oyuncual @oyuncu`"
            );
        }

        const player = getUserData(target.id);

        if (player.team === team.name) {
            return message.reply("❌ Oyuncu zaten senin takımında.");
        }

        if (team.budget <= 0) {
            return message.reply("❌ Takım bütçen bulunmuyor.");
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `transfer_accept_${message.author.id}_${target.id}`
                )
                .setLabel("Kabul Et")
                .setEmoji("✅")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(
                    `transfer_reject_${message.author.id}_${target.id}`
                )
                .setLabel("Reddet")
                .setEmoji("❌")
                .setStyle(ButtonStyle.Danger)
        );

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle("🤝 Oyuncu Transfer Teklifi")
                    .setDescription(
                        `🏟️ Takım: **${team.name}**\n` +
                        `👤 Oyuncu: ${target}\n\n` +
                        `Teklifi kabul etmek veya reddetmek için aşağıdaki butonları kullan.`
                    )
            ],
            components: [row]
        });
    }

    // ==================================================
    // SÖZLEŞME
    // ==================================================

    if (command === "sözleşme") {
        const target = message.mentions.members.first();

        if (!target) {
            return message.reply(
                "❌ Kullanım: `.sözleşme @oyuncu`"
            );
        }

        const contract = data.contracts[target.id];

        if (!contract) {
            return message.reply("📄 Oyuncunun aktif sözleşmesi yok.");
        }

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setTitle("📄 Oyuncu Sözleşmesi")
                    .setDescription(
                        `👤 Oyuncu: ${target}\n` +
                        `🏟️ Takım: **${contract.team}**\n` +
                        `💰 Maaş: **${money(contract.salary)}**\n` +
                        `💸 Transfer bedeli: **${money(contract.fee)}**\n` +
                        `📅 Süre: **${contract.duration}**\n` +
                        `📝 Şartlar: ${contract.conditions || "Yok"}`
                    )
            ]
        });
    }

    // ==================================================
    // SÖZLEŞME İPTAL
    // ==================================================

    if (command === "sözleşmeiptal") {
        const target = message.mentions.members.first();

        if (!target) {
            return message.reply(
                "❌ Kullanım: `.sözleşmeiptal @oyuncu`"
            );
        }

        if (!data.contracts[target.id]) {
            return message.reply("❌ Aktif sözleşme bulunamadı.");
        }

        delete data.contracts[target.id];

        saveData();

        return message.reply(
            `✅ ${target} sözleşmesi iptal edildi.`
        );
    }

    // ==================================================
    // BÜTÇE
    // ==================================================

    if (command === "bütçe") {
        const amount =
            data.personalBudget[message.author.id] || 0;

        return message.reply(
            `💰 Kişisel bütçen: **${money(amount)}**`
        );
    }

    // ==================================================
    // BÜTÇE VER
    // ==================================================

    if (command === "bütçever") {
        if (!isAdmin(message.member)) {
            return message.reply("❌ Yetkin yok.");
        }

        const target = message.mentions.members.first();
        const amount = parseMoney(args[1]);

        if (!target || !amount) {
            return message.reply(
                "❌ Kullanım: `.bütçever @oyuncu 5M`"
            );
        }

        data.personalBudget[target.id] =
            (data.personalBudget[target.id] || 0) + amount;

        saveData();

        return message.reply(
            `💰 ${target} hesabına **${money(amount)}** eklendi.`
        );
    }

    // ==================================================
    // BÜTÇE AL
    // ==================================================

    if (command === "bütçeal") {
        if (!isAdmin(message.member)) {
            return message.reply("❌ Yetkin yok.");
        }

        const target = message.mentions.members.first();
        const amount = parseMoney(args[1]);

        if (!target || !amount) {
            return message.reply(
                "❌ Kullanım: `.bütçeal @oyuncu 5M`"
            );
        }

        data.personalBudget[target.id] =
            Math.max(
                0,
                (data.personalBudget[target.id] || 0) - amount
            );

        saveData();

        return message.reply(
            `💰 ${target} hesabından **${money(amount)}** alındı.`
        );
    }

    // ==================================================
    // GÖNDER
    // ==================================================

    if (command === "gönder") {
        const target = message.mentions.members.first();
        const amount = parseMoney(args[1]);

        if (!target || !amount) {
            return message.reply(
                "❌ Kullanım: `.gönder @oyuncu 5M`"
            );
        }

        const senderMoney =
            data.personalBudget[message.author.id] || 0;

        if (senderMoney < amount) {
            return message.reply("❌ Yeterli bütçen yok.");
        }

        data.personalBudget[message.author.id] =
            senderMoney - amount;

        data.personalBudget[target.id] =
            (data.personalBudget[target.id] || 0) + amount;

        saveData();

        return message.reply(
            `✅ ${target} kişisine **${money(amount)}** gönderildi.`
        );
    }

    // ==================================================
    // TAKIM BÜTÇESİ
    // ==================================================

    if (command === "takımbütçesi") {
        const team = findTeamByDirector(message.author.id);

        if (!team) {
            return message.reply("❌ Bir takımın bulunmuyor.");
        }

        return message.reply(
            `🏟️ **${team.name}**\n💰 Bütçe: **${money(team.budget)}**`
        );
    }

    // ==================================================
    // TAKIM BÜTÇE VER
    // ==================================================

    if (command === "takımbütçever") {
        if (!isAdmin(message.member)) {
            return message.reply("❌ Yetkin yok.");
        }

        const teamName = args[0];
        const amount = parseMoney(args[1]);

        const team = findTeam(teamName);

        if (!team || !amount) {
            return message.reply(
                "❌ Kullanım: `.takımbütçever Galatasaray 10M`"
            );
        }

        team.budget += amount;

        saveData();

        return message.reply(
            `💰 ${team.name} bütçesine **${money(amount)}** eklendi.`
        );
    }

    // ==================================================
    // TAKIM BÜTÇE AL
    // ==================================================

    if (command === "takımbütçeal") {
        if (!isAdmin(message.member)) {
            return message.reply("❌ Yetkin yok.");
        }

        const teamName = args[0];
        const amount = parseMoney(args[1]);

        const team = findTeam(teamName);

        if (!team || !amount) {
            return message.reply(
                "❌ Kullanım: `.takımbütçeal Galatasaray 10M`"
            );
        }

        team.budget =
            Math.max(0, team.budget - amount);

        saveData();

        return message.reply(
            `💰 ${team.name} bütçesinden **${money(amount)}** alındı.`
        );
    }

    // ==================================================
    // BÜTÇELER
    // ==================================================

    if (command === "bütçeler") {
        const teams = Object.values(data.teams);

        if (!teams.length) {
            return message.reply("Henüz takım oluşturulmadı.");
        }

        const text = teams
            .sort((a, b) => b.budget - a.budget)
            .map(
                (team, i) =>
                    `**${i + 1}.** ${team.name} — **${money(team.budget)}**`
            )
            .join("\n");

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle("💰 Takım Bütçeleri")
                    .setDescription(text)
            ]
        });
    }

    // ==================================================
    // ŞİRKETLER
    // ==================================================

    if (command === "şirketler") {
        const used = Object.values(data.companies)
            .map(x => x.company);

        const available = COMPANIES.filter(
            x => !used.includes(x)
        );

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle("🏢 Şirketler")
                    .setDescription(
                        available.length
                            ? available.map(x => `• ${x}`).join("\n")
                            : "Kullanılabilir şirket kalmadı."
                    )
            ]
        });
    }

    // ==================================================
    // ŞİRKET SEÇ
    // ==================================================

    if (command === "şirketseç") {
        const team = findTeamByDirector(message.author.id);

        if (!team) {
            return message.reply("❌ Bir takımın bulunmuyor.");
        }

        const used = Object.values(data.companies)
            .map(x => x.company);

        const available = COMPANIES.filter(
            x => !used.includes(x)
        );

        if (!available.length) {
            return message.reply("❌ Şirket kalmadı.");
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`company_${message.author.id}`)
            .setPlaceholder("🏢 Şirket seç")
            .addOptions(
                available.slice(0, 25).map(x => ({
                    label: x,
                    value: x
                }))
            );

        return message.channel.send({
            components: [
                new ActionRowBuilder().addComponents(menu)
            ]
        });
    }

    // ==================================================
    // ŞİRKETİM
    // ==================================================

    if (command === "şirketim") {
        const company = data.companies[message.author.id];

        if (!company) {
            return message.reply("❌ Şirketin bulunmuyor.");
        }

        return message.reply(
            `🏢 Şirketin: **${company.company}**`
        );
    }

    // ==================================================
    // ŞİRKET İPTAL
    // ==================================================

    if (command === "şirketiptal") {
        if (!isAdmin(message.member)) {
            return message.reply("❌ Yetkin yok.");
        }

        delete data.companies[message.author.id];

        saveData();

        return message.reply("✅ Şirket bağlantısı kaldırıldı.");
    }

    // ==================================================
    // SPONSORLAR
    // ==================================================

    if (command === "sponsorlar") {
        const used = Object.values(data.sponsors)
            .map(x => x.sponsor);

        const available = SPONSORS.filter(
            x => !used.includes(x.name)
        );

        const text = available
            .map(
                x =>
                    `• **${x.name}** — ${money(x.income)}/hafta`
            )
            .join("\n");

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setTitle("🤝 Sponsorlar")
                    .setDescription(
                        text || "Kullanılabilir sponsor yok."
                    )
            ]
        });
    }

    // ==================================================
    // SPONSOR SEÇ
    // ==================================================

    if (command === "sponsorseç") {
        const team = findTeamByDirector(message.author.id);

        if (!team) {
            return message.reply("❌ Bir takımın bulunmuyor.");
        }

        const used = Object.values(data.sponsors)
            .map(x => x.sponsor);

        const available = SPONSORS.filter(
            x => !used.includes(x.name)
        );

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`sponsor_${message.author.id}`)
            .setPlaceholder("🤝 Sponsor seç")
            .addOptions(
                available.map(x => ({
                    label: x.name,
                    description: `${money(x.income)}/hafta`,
                    value: x.name
                }))
            );

        return message.channel.send({
            components: [
                new ActionRowBuilder().addComponents(menu)
            ]
        });
    }

    // ==================================================
    // SPONSORLARIM
    // ==================================================

    if (command === "sponsorlarım") {
        const sponsor = data.sponsors[message.author.id];

        if (!sponsor) {
            return message.reply("❌ Sponsorun bulunmuyor.");
        }

        return message.reply(
            `🤝 Sponsor: **${sponsor.sponsor}**\n` +
            `💰 Gelir: **${money(sponsor.income)}/hafta**`
        );
    }

    // ==================================================
    // SPONSOR GELİR
    // ==================================================

    if (command === "sponsorgelir") {
        const sponsor = data.sponsors[message.author.id];

        if (!sponsor) {
            return message.reply("❌ Sponsorun bulunmuyor.");
        }

        return message.reply(
            `💰 Sponsor gelirin: **${money(sponsor.income)}/hafta**`
        );
    }

    // ==================================================
    // SPONSOR İPTAL
    // ==================================================

    if (command === "sponsoriptal") {
        if (!isAdmin(message.member)) {
            return message.reply("❌ Yetkin yok.");
        }

        delete data.sponsors[message.author.id];

        saveData();

        return message.reply(
            "✅ Sponsor bağlantısı kaldırıldı."
        );
    }

    // ==================================================
    // MAÇ
    // ==================================================

    if (command === "maç") {
        if (
            !isAdmin(message.member) &&
            !hasRole(message.member, ROLES.YONETICI)
        ) {
            return message.reply(
                "❌ Bu komutu sadece Maç Yetkilisi kullanabilir."
            );
        }

        const mentions = [...message.mentions.members.values()];

        if (mentions.length < 2) {
            return message.reply(
                "❌ İki takımın Teknik Direktörünü etiketlemelisin."
            );
        }

        const team1 = findTeamByDirector(mentions[0].id);
        const team2 = findTeamByDirector(mentions[1].id);

        if (!team1 || !team2) {
            return message.reply(
                "❌ Etiketlenen kişiler takım sahibi olmalı."
            );
        }

        if (team1.name === team2.name) {
            return message.reply("❌ Aynı takım karşılaşamaz.");
        }

        await message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle("⚽ MAÇ BAŞLADI")
                    .setDescription(
                        `🏟️ **${team1.name}** 🆚 **${team2.name}**\n\n` +
                        `⏱️ Karşılaşma başlıyor...`
                    )
            ]
        });

        let score1 = 0;
        let score2 = 0;

        const events = [
            "⚡ Orta saha mücadelesi",
            "🎯 Tehlikeli atak",
            "🧤 Kaleci kurtarışı",
            "🔥 Büyük baskı",
            "⚽ ŞUT!",
            "🟨 Sarı kart",
            "🚀 Hızlı hücum"
        ];

        for (let minute = 1; minute <= 12; minute++) {
            await new Promise(
                resolve => setTimeout(resolve, 1000)
            );

            let event = events[
                Math.floor(Math.random() * events.length)
            ];

            if (Math.random() < 0.22) {
                if (Math.random() < 0.5) {
                    score1++;
                    event =
                        `⚽ **GOOOL!** ${team1.name} öne geçiyor!`;
                } else {
                    score2++;
                    event =
                        `⚽ **GOOOL!** ${team2.name} skoru buluyor!`;
                }
            }

            await message.channel.send(
                `⏱️ **${minute * 5}. dakika** — ${event}\n` +
                `📊 ${team1.name} **${score1} - ${score2}** ${team2.name}`
            );
        }

        let winner = null;

        if (score1 > score2) winner = team1;
        if (score2 > score1) winner = team2;

        if (!data.standings[team1.name]) {
            data.standings[team1.name] = {
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                points: 0,
                gf: 0,
                ga: 0
            };
        }

        if (!data.standings[team2.name]) {
            data.standings[team2.name] = {
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                points: 0,
                gf: 0,
                ga: 0
            };
        }

        const s1 = data.standings[team1.name];
        const s2 = data.standings[team2.name];

        s1.played++;
        s2.played++;

        s1.gf += score1;
        s1.ga += score2;

        s2.gf += score2;
        s2.ga += score1;

        if (score1 > score2) {
            s1.wins++;
            s1.points += 3;
            s2.losses++;
        } else if (score2 > score1) {
            s2.wins++;
            s2.points += 3;
            s1.losses++;
        } else {
            s1.draws++;
            s2.draws++;
            s1.points++;
            s2.points++;
        }

        data.matches.push({
            team1: team1.name,
            team2: team2.name,
            score1,
            score2,
            date: Date.now()
        });

        saveData();

        await message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle("🏁 MAÇ SONA ERDİ")
                    .setDescription(
                        `🏟️ **${team1.name}**\n` +
                        `# ${score1} - ${score2}\n` +
                        `**${team2.name}**`
                    )
                    .addFields({
                        name: "🏆 Sonuç",
                        value:
                            winner
                                ? `Kazanan: **${winner.name}**`
                                : "🤝 Berabere"
                    })
            ]
        });
    }

    // ==================================================
    // MAÇLAR
    // ==================================================

    if (
        command === "maçlar" ||
        command === "maçgeçmişi"
    ) {
        if (!data.matches.length) {
            return message.reply("Henüz maç oynanmadı.");
        }

        const text = data.matches
            .slice(-15)
            .reverse()
            .map(
                x =>
                    `⚽ **${x.team1} ${x.score1}-${x.score2} ${x.team2}**`
            )
            .join("\n");

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle("⚽ Maç Geçmişi")
                    .setDescription(text)
            ]
        });
    }

    // ==================================================
    // LİG
    // ==================================================

    if (
        command === "lig" ||
        command === "puan"
    ) {
        const standings = Object.entries(
            data.standings
        );

        if (!standings.length) {
            return message.reply("Henüz lig verisi bulunmuyor.");
        }

        standings.sort((a, b) => {
            const A = a[1];
            const B = b[1];

            if (B.points !== A.points) {
                return B.points - A.points;
            }

            return (
                (B.gf - B.ga) -
                (A.gf - A.ga)
            );
        });

        const text = standings
            .map(
                ([name, x], i) =>
                    `**${i + 1}. ${name}**\n` +
                    `🕹️ ${x.played} | ` +
                    `🏆 ${x.wins} | ` +
                    `🤝 ${x.draws} | ` +
                    `❌ ${x.losses} | ` +
                    `⭐ ${x.points} Puan`
            )
            .join("\n\n");

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setTitle("🏆 UNITED LEAGUE PUAN DURUMU")
                    .setDescription(text)
            ]
        });
    }

    // ==================================================
    // GOL KRALLIĞI
    // ==================================================

    if (command === "golkrallığı") {
        const entries = Object.entries(data.stats)
            .sort((a, b) => b[1].goals - a[1].goals)
            .slice(0, 20);

        if (!entries.length) {
            return message.reply("Henüz gol istatistiği yok.");
        }

        const text = entries
            .map(
                ([id, stats], i) =>
                    `**${i + 1}.** <@${id}> — ⚽ **${stats.goals}**`
            )
            .join("\n");

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle("⚽ Gol Krallığı")
                    .setDescription(text)
            ]
        });
    }

    // ==================================================
    // ASİST KRALLIĞI
    // ==================================================

    if (command === "asistkrallığı") {
        const entries = Object.entries(data.stats)
            .sort(
                (a, b) =>
                    b[1].assists - a[1].assists
            )
            .slice(0, 20);

        if (!entries.length) {
            return message.reply("Henüz asist istatistiği yok.");
        }

        const text = entries
            .map(
                ([id, stats], i) =>
                    `**${i + 1}.** <@${id}> — 🅰️ **${stats.assists}**`
            )
            .join("\n");

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle("🅰️ Asist Krallığı")
                    .setDescription(text)
            ]
        });
    }

    // ==================================================
    // İSTATİSTİK
    // ==================================================

    if (command === "istatistik") {
        const target =
            message.mentions.members.first() ||
            message.member;

        const stats = getStats(target.id);
        const player = getUserData(target.id);

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x9b59b6)
                    .setTitle(`📊 ${target.user.username}`)
                    .setThumbnail(
                        target.user.displayAvatarURL()
                    )
                    .addFields(
                        {
                            name: "⚽ Gol",
                            value: String(stats.goals),
                            inline: true
                        },
                        {
                            name: "🅰️ Asist",
                            value: String(stats.assists),
                            inline: true
                        },
                        {
                            name: "🟨 Sarı",
                            value: String(stats.yellow),
                            inline: true
                        },
                        {
                            name: "🟥 Kırmızı",
                            value: String(stats.red),
                            inline: true
                        },
                        {
                            name: "💎 Değer",
                            value: money(player.value),
                            inline: true
                        },
                        {
                            name: "🏟️ Takım",
                            value: player.team || "Yok",
                            inline: true
                        }
                    )
            ]
        });
    }

    // ==================================================
    // PROFİL
    // ==================================================

    if (command === "profil") {
        const target =
            message.mentions.members.first() ||
            message.member;

        const player = getUserData(target.id);
        const stats = getStats(target.id);

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle(`👤 ${target.user.username}`)
                    .setThumbnail(
                        target.user.displayAvatarURL()
                    )
                    .setDescription(
                        `🏟️ Takım: **${player.team || "Takımsız"}**\n` +
                        `💎 Değer: **${money(player.value)}**\n` +
                        `🏃 Antrenman: **${player.training}/10**`
                    )
                    .addFields(
                        {
                            name: "⚽ Gol",
                            value: String(stats.goals),
                            inline: true
                        },
                        {
                            name: "🅰️ Asist",
                            value: String(stats.assists),
                            inline: true
                        },
                        {
                            name: "🟨 Sarı",
                            value: String(stats.yellow),
                            inline: true
                        }
                    )
            ]
        });
    }

    // ==================================================
    // TAKIM PROFİL
    // ==================================================

    if (command === "takımprofil") {
        const teamName = args.join(" ");

        const team = findTeam(teamName);

        if (!team) {
            return message.reply("❌ Takım bulunamadı.");
        }

        const standing =
            data.standings[team.name] || {
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                points: 0
            };

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setTitle(`🏟️ ${team.name}`)
                    .setDescription(
                        `👔 Teknik Direktör: ${
                            team.director
                                ? `<@${team.director}>`
                                : "Boş"
                        }\n\n` +
                        `💰 Bütçe: **${money(team.budget)}**\n` +
                        `👥 Kadro: **${team.squad.length}**\n` +
                        `📋 Formasyon: **${team.formation}**`
                    )
                    .addFields({
                        name: "🏆 Lig",
                        value:
                            `Maç: ${standing.played}\n` +
                            `Galibiyet: ${standing.wins}\n` +
                            `Beraberlik: ${standing.draws}\n` +
                            `Mağlubiyet: ${standing.losses}\n` +
                            `Puan: ${standing.points}`
                    })
            ]
        });
    }

    // ==================================================
    // ÇEKİLİŞ
    // ==================================================

    if (command === "çekiliş") {
        if (!isAdmin(message.member)) {
            return message.reply("❌ Yetkin yok.");
        }

        const prize = args[0];
        const durationText = args[1];

        if (!prize || !durationText) {
            return message.reply(
                "❌ Kullanım: `.çekiliş 30M 1s`"
            );
        }

        const duration = parseDuration(
            durationText
        );

        if (!duration) {
            return message.reply(
                "❌ Süre örneği: `30s`, `5m`, `1h`"
            );
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `giveaway_join_${Date.now()}`
                )
                .setLabel("Katıl")
                .setEmoji("🎉")
                .setStyle(ButtonStyle.Success)
        );

        const msg = await message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x9b59b6)
                    .setTitle("🎉 ÇEKİLİŞ")
                    .setDescription(
                        `🎁 Ödül: **${prize}**\n\n` +
                        `⏰ Süre: **${durationText}**\n\n` +
                        `Katılmak için aşağıdaki butona bas!`
                    )
                    .setFooter({
                        text: "United League Çekiliş Sistemi"
                    })
            ],
            components: [row]
        });

        data.giveaways[msg.id] = {
            prize,
            channel: message.channel.id,
            users: [],
            end: Date.now() + duration
        };

        saveData();

        setTimeout(async () => {
            const giveaway = data.giveaways[msg.id];

            if (!giveaway) return;

            const users = giveaway.users;

            let winner = null;

            if (users.length) {
                winner =
                    users[
                        Math.floor(
                            Math.random() *
                            users.length
                        )
                    ];
            }

            const channel =
                message.guild.channels.cache.get(
                    giveaway.channel
                );

            if (channel) {
                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xf1c40f)
                            .setTitle("🎉 ÇEKİLİŞ SONUCU")
                            .setDescription(
                                winner
                                    ? `🎁 Ödül: **${giveaway.prize}**\n\n` +
                                      `🏆 Kazanan: <@${winner}>`
                                    : "❌ Yeterli katılım olmadı."
                            )
                    ]
                });
            }

            delete data.giveaways[msg.id];
            saveData();
        }, duration);

        return;
    }

    // ==================================================
    // TWEET
    // ==================================================

    if (command === "tweet") {
        if (!isAdmin(message.member)) {
            return message.reply("❌ Yetkin yok.");
        }

        const content = args.join(" ");

        if (!content) {
            return message.reply(
                "❌ Kullanım: `.tweet mesaj`"
            );
        }

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle("🐦 UNITED LEAGUE")
                    .setDescription(content)
                    .setFooter({
                        text: "United League Media"
                    })
                    .setTimestamp()
            ]
        });
    }

    // ==================================================
    // HABER
    // ==================================================

    if (command === "haber") {
        if (!isAdmin(message.member)) {
            return message.reply("❌ Yetkin yok.");
        }

        const content = args.join(" ");

        if (!content) {
            return message.reply(
                "❌ Kullanım: `.haber mesaj`"
            );
        }

        return message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xe67e22)
                    .setTitle("📰 UNITED LEAGUE HABER")
                    .setDescription(content)
                    .setTimestamp()
            ]
        });
    }

    // ==================================================
    // TRANSFER DUYURU
    // ============================
