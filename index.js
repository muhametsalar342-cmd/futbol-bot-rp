/*
========================================================
        FOOTBALL RP DISCORD BOT
        DISCORD.JS v14
        PREFIX: .
        DATABASE: database.json
        HOST: RAILWAY / LOCAL
========================================================
*/

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

// ======================================================
// CONFIG
// ======================================================

const PREFIX = ".";

const CONFIG = {

    roles: {

        yonetici: "1544449436011339806",

        kayitYetkilisi:
            "1544452022764568656",

        degerYetkilisi:
            "1544451743746891806",

        macYetkilisi: null,
        cekilisYetkilisi: null,
        medyaYetkilisi: null,
        dmYetkilisi: null,

        muteYetkilisi: null,
        muteKaldirma: null,
        kickYetkilisi: null,

        kanalAcma: null,
        kanalKilitleme: null,

        futbolcu: null,
        teknikDirektor: null,
        kayitsiz: null
    },

    channels: {

        kayit: null,
        genel: null,
        log: null,
        mac: null,
        transfer: null,
        cekilis: null,
        reklam: null
    },

    rewards: {

        training: 3000000,
        penalty: 2000000,

        mineMin: 100000,
        mineMax: 750000
    },

    cooldowns: {

        training: 30 * 60 * 1000,
        penalty: 60 * 1000,
        mine: 10 * 60 * 1000
    }
};

// ======================================================
// DATABASE
// ======================================================

const DB_PATH = path.join(__dirname, "database.json");

const defaultDB = {
    users: {},
    teams: {},
    transfers: {},
    giveaways: {},
    sponsors: {},
    matches: {},
    cooldowns: {},
    settings: {},
    channels: {}
};

function cloneDefault() {
    return JSON.parse(JSON.stringify(defaultDB));
}

function loadDatabase() {

    if (!fs.existsSync(DB_PATH)) {

        fs.writeFileSync(
            DB_PATH,
            JSON.stringify(defaultDB, null, 2)
        );

        return cloneDefault();
    }

    try {

        const data = JSON.parse(
            fs.readFileSync(DB_PATH, "utf8")
        );

        return {
            ...cloneDefault(),
            ...data
        };

    } catch {

        console.log(
            "database.json bozuk. Yeni database oluşturuluyor."
        );

        return cloneDefault();
    }
}

let db = loadDatabase();

function saveDatabase() {

    try {

        fs.writeFileSync(
            DB_PATH,
            JSON.stringify(db, null, 2)
        );

    } catch (err) {

        console.error(
            "Database kayıt hatası:",
            err
        );
    }
}

// ======================================================
// CLIENT
// ======================================================

const client = new Client({

    intents: [

        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],

    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User
    ]
});

// ======================================================
// USER DATABASE
// ======================================================

function userKey(guildId, userId) {

    return `${guildId}_${userId}`;
}

function getUser(guildId, userId) {

    const key = userKey(
        guildId,
        userId
    );

    if (!db.users[key]) {

        db.users[key] = {

            guildId,
            userId,

            registered: false,
            type: null,

            value: 0,
            budget: 0,

            training: 0,

            goals: 0,
            assists: 0,

            ovr: 60,
            pot: 70,
            xp: 0,
            level: 1,
            form: 50,

            team: null,

            createdAt: Date.now()
        };

        saveDatabase();
    }

    return db.users[key];
}

// ======================================================
// MONEY
// ======================================================

function formatMoney(value) {

    value = Number(value) || 0;

    if (value >= 1000000000) {

        return `${Number(
            (value / 1000000000).toFixed(2)
        )}B€`;
    }

    if (value >= 1000000) {

        return `${Number(
            (value / 1000000).toFixed(2)
        )}M€`;
    }

    if (value >= 1000) {

        return `${Number(
            (value / 1000).toFixed(2)
        )}K€`;
    }

    return `${value}€`;
}

function parseMoney(input) {

    if (!input) return NaN;

    let text = String(input)
        .toLowerCase()
        .replace(/€/g, "")
        .replace(/\s/g, "")
        .replace(",", ".");

    let multiplier = 1;

    if (text.endsWith("b")) {

        multiplier = 1_000_000_000;
        text = text.slice(0, -1);

    } else if (text.endsWith("m")) {

        multiplier = 1_000_000;
        text = text.slice(0, -1);

    } else if (text.endsWith("k")) {

        multiplier = 1_000;
        text = text.slice(0, -1);
    }

    const number = Number(text);

    if (!Number.isFinite(number)) {
        return NaN;
    }

    return Math.floor(
        number * multiplier
    );
}

// ======================================================
// DURATION
// ======================================================

function parseDuration(input) {

    if (!input) return NaN;

    const text = String(input)
        .toLowerCase()
        .replace(/\s/g, "");

    const match = text.match(
        /^(\d+(?:\.\d+)?)(s|m|h|d)$/
    );

    if (!match) return NaN;

    const number = Number(match[1]);
    const unit = match[2];

    if (unit === "s") {
        return number * 1000;
    }

    if (unit === "m") {
        return number * 60 * 1000;
    }

    if (unit === "h") {
        return number * 60 * 60 * 1000;
    }

    if (unit === "d") {
        return number * 24 * 60 * 60 * 1000;
    }

    return NaN;
}

// ======================================================
// EMBEDS
// ======================================================

function success(title, description) {

    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

function errorEmbed(title, description) {

    return new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

function infoEmbed(title, description) {

    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

// ======================================================
// PERMISSION
// ======================================================

function isAdmin(member) {

    if (!member) return false;

    if (
        member.permissions.has(
            PermissionsBitField.Flags.Administrator
        )
    ) {

        return true;
    }

    return member.roles.cache.has(
        CONFIG.roles.yonetici
    );
}

function hasRole(member, roleId) {

    if (!member || !roleId) {
        return false;
    }

    return member.roles.cache.has(roleId);
}

function canValue(member) {

    return (
        isAdmin(member) ||
        hasRole(
            member,
            CONFIG.roles.degerYetkilisi
        )
    );
}

function canRegister(member) {

    return (
        isAdmin(member) ||
        hasRole(
            member,
            CONFIG.roles.kayitYetkilisi
        )
    );
}

function canModerate(member) {

    return isAdmin(member);
}

function canGiveaway(member) {

    return (
        isAdmin(member) ||
        hasRole(
            member,
            CONFIG.roles.cekilisYetkilisi
        )
    );
}

function canDM(member) {

    return (
        isAdmin(member) ||
        hasRole(
            member,
            CONFIG.roles.dmYetkilisi
        )
    );
}

// ======================================================
// LOG
// ======================================================

async function sendLog(guild, text) {

    const channelId =
        CONFIG.channels.log;

    if (!channelId) return;

    const channel =
        guild.channels.cache.get(channelId);

    if (!channel) return;

    try {

        await channel.send({
            embeds: [
                infoEmbed(
                    "Sistem Log",
                    text
                )
            ]
        });

    } catch {}
}

// ======================================================
// NICKNAME VALUE
// ======================================================

function replaceValueInNickname(
    nickname,
    value
) {

    if (!nickname) {

        return `Oyuncu | ${formatMoney(value)}`;
    }

    const moneyRegex =
        /(?:\d+(?:[.,]\d+)?\s*[KMB]?€)/gi;

    if (moneyRegex.test(nickname)) {

        return nickname.replace(
            moneyRegex,
            formatMoney(value)
        );
    }

    return `${nickname} | ${formatMoney(value)}`;
}

async function updatePlayerNickname(
    member,
    value
) {

    if (!member.manageable) {
        return false;
    }

    const oldNickname =
        member.nickname ||
        member.user.username;

    const newNickname =
        replaceValueInNickname(
            oldNickname,
            value
        );

    if (
        newNickname.length > 32
    ) {

        return false;
    }

    try {

        await member.setNickname(
            newNickname
        );

        return true;

    } catch {

        return false;
    }
}

// ======================================================
// COOLDOWN
// ======================================================

function cooldownKey(
    guildId,
    userId,
    command
) {

    return `${guildId}_${userId}_${command}`;
}

function checkCooldown(
    guildId,
    userId,
    command,
    duration
) {

    const key =
        cooldownKey(
            guildId,
            userId,
            command
        );

    const last =
        db.cooldowns[key] || 0;

    const remaining =
        duration -
        (Date.now() - last);

    if (remaining > 0) {

        return remaining;
    }

    return 0;
}

function setCooldown(
    guildId,
    userId,
    command
) {

    db.cooldowns[
        cooldownKey(
            guildId,
            userId,
            command
        )
    ] = Date.now();

    saveDatabase();
}

function cooldownText(ms) {

    const seconds =
        Math.ceil(ms / 1000);

    if (seconds < 60) {

        return `${seconds} saniye`;
    }

    const minutes =
        Math.ceil(seconds / 60);

    if (minutes < 60) {

        return `${minutes} dakika`;
    }

    const hours =
        Math.ceil(minutes / 60);

    return `${hours} saat`;
}

// ======================================================
// REGISTER PANEL
// ======================================================

function registrationPanel() {

    const row =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "register_player"
                    )
                    .setLabel(
                        "Futbolcu Kaydı"
                    )
                    .setEmoji("⚽")
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "register_manager"
                    )
                    .setLabel(
                        "Teknik Direktör"
                    )
                    .setEmoji("👔")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    return row;
}

// ======================================================
// TEAM
// ======================================================

function getTeamByName(
    guildId,
    name
) {

    return Object.values(
        db.teams
    ).find(
        team =>
            team.guildId === guildId &&
            team.name.toLowerCase() ===
            name.toLowerCase()
    );
}

function getTeamById(id) {

    return db.teams[id];
}

function getUserTeam(
    guildId,
    userId
) {

    const user =
        getUser(
            guildId,
            userId
        );

    if (!user.team) {
        return null;
    }

    return db.teams[user.team] || null;
}

// ======================================================
// RANDOM
// ======================================================

function random(min, max) {

    return Math.floor(
        Math.random() *
        (max - min + 1)
    ) + min;
}

function pick(array) {

    return array[
        Math.floor(
            Math.random() *
            array.length
        )
    ];
}

// ======================================================
// MATCH EVENTS
// ======================================================

const MATCH_EVENTS = [

    "⚡ Orta sahada top kapıldı.",
    "🎯 Tehlikeli bir ara pası!",
    "🧤 Kaleci topu kontrol etti.",
    "🔥 Kanattan etkili bir atak gelişiyor.",
    "⚽ ŞUT! Top az farkla auta çıktı.",
    "🛡️ Savunma son anda araya girdi.",
    "🎯 Ceza sahasına orta açıldı.",
    "🧤 Kaleci harika bir kurtarış yaptı!",
    "⚡ Hızlı kontra atak!",
    "🔥 Tribünler ayağa kalktı!",
    "🎯 Forvet kaleciyle karşı karşıya!",
    "⚽ GOOOOOL!"
];

// ======================================================
// COMMAND HELP
// ======================================================

function helpEmbed() {

    return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("⚽ Futbol RP Bot — Yardım")
        .setDescription(
`
**👤 Oyuncu**

\`.profil\`
\`.değerler\`
\`.antrenman\`
\`.ant\`
\`.pen\`
\`.penaltı\`
\`.mine\`

**🏟️ Takım**

\`.takımkur <isim>\`
\`.takımlar\`
\`.kadro <takım>\`
\`.kadroekle @oyuncu\`
\`.kadroçıkar @oyuncu\`
\`.takımbütçe\`

**⚽ Maç**

\`.maç <takım1> <takım2>\`

**💰 Değer**

\`.dver @oyuncu <miktar>\`
\`.dsil @oyuncu <miktar>\`
\`.değerler\`

**🔄 Transfer**

\`.kap @oyuncu <miktar>\`
\`.transferler\`

**🎁 Çekiliş**

\`.çekiliş <ödül> <süre>\`

Örnek:
\`.çekiliş 5M€ 1h\`

**🛡️ Moderasyon**

\`.kick @üye sebep\`
\`.ban @üye sebep\`
\`.mute @üye süre\`
\`.unmute @üye\`
\`.sil <1-1000>\`
\`.kilit\`
\`.aç\`
\`.kanalaç <isim>\`

**📢 Yönetim**

\`.embed başlık | açıklama\`
\`.dm mesaj\`
\`.sm mesaj\`
\`.rolpanel\`
\`.sponsor <isim> <bütçe>\`
\`.sunucuprofil\`
`
        )
        .setFooter({
            text:
                "Futbol RP • Sistem Yardım Menüsü"
        });
}

// ======================================================
// MESSAGE CREATE
// ======================================================

client.on(
    "messageCreate",
    async message => {

        try {

            if (
                message.author.bot ||
                !message.guild
            ) {

                return;
            }

            if (
                !message.content.startsWith(
                    PREFIX
                )
            ) {

                return;
            }

            const args =
                message.content
                    .slice(PREFIX.length)
                    .trim()
                    .split(/\s+/);

            const command =
                args.shift()
                    ?.toLowerCase();

            if (!command) return;

            const member =
                message.member;

            const guild =
                message.guild;

            const user =
                getUser(
                    guild.id,
                    message.author.id
                );

            // ==================================================
            // YARDIM
            // ==================================================

            if (
                command === "yardım" ||
                command === "yardim" ||
                command === "help"
            ) {

                return message.reply({
                    embeds: [
                        helpEmbed()
                    ]
                });
            }

            // ==================================================
            // PROFİL
            // ==================================================

            if (
                command === "profil" ||
                command === "profile"
            ) {

                const target =
                    message.mentions.users.first() ||
                    message.author;

                const targetUser =
                    getUser(
                        guild.id,
                        target.id
                    );

                let teamText =
                    "Serbest";

                if (
                    targetUser.team &&
                    db.teams[targetUser.team]
                ) {

                    teamText =
                        db.teams[
                            targetUser.team
                        ].name;
                }

                const embed =
                    new EmbedBuilder()
                        .setColor(0x3498db)
                        .setTitle(
                            `👤 ${target.username}`
                        )
                        .setThumbnail(
                            target.displayAvatarURL({
                                size: 256
                            })
                        )
                        .addFields(

                            {
                                name: "💰 Değer",
                                value:
                                    formatMoney(
                                        targetUser.value
                                    ),
                                inline: true
                            },

                            {
                                name: "⭐ OVR",
                                value:
                                    `${targetUser.ovr}`,
                                inline: true
                            },

                            {
                                name: "📈 POT",
                                value:
                                    `${targetUser.pot}`,
                                inline: true
                            },

                            {
                                name: "✨ XP",
                                value:
                                    `${targetUser.xp}`,
                                inline: true
                            },

                            {
                                name: "🏟️ Takım",
                                value:
                                    teamText,
                                inline: true
                            },

                            {
                                name: "⚽ Gol",
                                value:
                                    `${targetUser.goals}`,
                                inline: true
                            },

                            {
                                name: "🎯 Asist",
                                value:
                                    `${targetUser.assists}`,
                                inline: true
                            },

                            {
                                name: "🔥 Form",
                                value:
                                    `${targetUser.form}/100`,
                                inline: true
                            }
                        )
                        .setTimestamp();

                return message.reply({
                    embeds: [embed]
                });
            }

            // ==================================================
            // ANTRENMAN
            // ==================================================

            if (
                command === "antrenman" ||
                command === "ant"
            ) {

                const remaining =
                    checkCooldown(
                        guild.id,
                        message.author.id,
                        "training",
                        CONFIG.cooldowns.training
                    );

                if (remaining > 0) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Antrenman Bekleme",
                                `Tekrar antrenman yapmak için **${cooldownText(
                                    remaining
                                )}** beklemelisin.`
                            )
                        ]
                    });
                }

                setCooldown(
                    guild.id,
                    message.author.id,
                    "training"
                );

                user.training++;

                let completed = false;

                if (user.training >= 10) {

                    user.training = 0;

                    user.value +=
                        CONFIG.rewards.training;

                    user.xp += 100;

                    if (user.ovr < 99) {
                        user.ovr++;
                    }

                    if (user.form < 100) {
                        user.form += 2;
                    }

                    completed = true;
                } else {

                    user.xp += 10;
                }

                saveDatabase();

                if (completed) {

                    await updatePlayerNickname(
                        member,
                        user.value
                    );

                    return message.reply({
                        embeds: [
                            success(
                                "Antrenman Tamamlandı!",
                                `🏋️ **10/10** antrenmanı tamamladın!\n\n` +
                                `💰 Kazanç: **+${formatMoney(
                                    CONFIG.rewards.training
                                )}**\n` +
                                `💎 Yeni değer: **${formatMoney(
                                    user.value
                                )}**\n` +
                                `⭐ OVR: **${user.ovr}**`
                            )
                        ]
                    });
                }

                return message.reply({
                    embeds: [
                        infoEmbed(
                            "Antrenman",
                            `🏋️ Antrenman tamamlandı!\n\n` +
                            `📊 İlerleme: **${user.training}/10**\n` +
                            `✨ XP: **+10**\n\n` +
                            `10/10 olduğunda **+3M€** kazanırsın.`
                        )
                    ]
                });
            }

            // ==================================================
            // PENALTI
            // ==================================================

            if (
                command === "pen" ||
                command === "penaltı" ||
                command === "penalti"
            ) {

                const remaining =
                    checkCooldown(
                        guild.id,
                        message.author.id,
                        "penalty",
                        CONFIG.cooldowns.penalty
                    );

                if (remaining > 0) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Penaltı Bekleme",
                                `Tekrar penaltı kullanmak için **${cooldownText(
                                    remaining
                                )}** beklemelisin.`
                            )
                        ]
                    });
                }

                setCooldown(
                    guild.id,
                    message.author.id,
                    "penalty"
                );

                const chance =
                    random(1, 100);

                if (chance <= 55) {

                    user.goals++;
                    user.xp += 25;

                    user.value +=
                        CONFIG.rewards.penalty;

                    if (user.form < 100) {
                        user.form += 3;
                    }

                    saveDatabase();

                    await updatePlayerNickname(
                        member,
                        user.value
                    );

                    return message.reply({
                        embeds: [
                            success(
                                "GOOOOL! ⚽",
                                `🥅 Penaltıyı gole çevirdin!\n\n` +
                                `💰 Kazanç: **+${formatMoney(
                                    CONFIG.rewards.penalty
                                )}**\n` +
                                `💎 Yeni değer: **${formatMoney(
                                    user.value
                                )}**\n` +
                                `⚽ Toplam gol: **${user.goals}**`
                            )
                        ]
                    });
                }

                user.form =
                    Math.max(
                        0,
                        user.form - 2
                    );

                saveDatabase();

                return message.reply({
                    embeds: [
                        errorEmbed(
                            "Penaltı Kaçtı!",
                            `🥅 Kaleci köşeyi doğru tahmin etti.\n\n` +
                            `💰 Bu atıştan değer kazanamadın.\n` +
                            `🔥 Form: **${user.form}/100**`
                        )
                    ]
                });
            }

            // ==================================================
            // MINE
            // ==================================================

            if (
                command === "mine"
            ) {

                const remaining =
                    checkCooldown(
                        guild.id,
                        message.author.id,
                        "mine",
                        CONFIG.cooldowns.mine
                    );

                if (remaining > 0) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Bekleme Süresi",
                                `Tekrar oynamak için **${cooldownText(
                                    remaining
                                )}** beklemelisin.`
                            )
                        ]
                    });
                }

                setCooldown(
                    guild.id,
                    message.author.id,
                    "mine"
                );

                const cells =
                    Array(9).fill("⬜");

                const winning =
                    random(0, 8);

                cells[winning] = "💎";

                const reward =
                    random(
                        CONFIG.rewards.mineMin,
                        CONFIG.rewards.mineMax
                    );

                const row1 =
                    new ActionRowBuilder();

                const row2 =
                    new ActionRowBuilder();

                const row3 =
                    new ActionRowBuilder();

                for (let i = 0; i < 9; i++) {

                    const button =
                        new ButtonBuilder()
                            .setCustomId(
                                `mine_${message.author.id}_${i}_${winning}_${reward}`
                            )
                            .setLabel("⬜")
                            .setStyle(
                                ButtonStyle.Secondary
                            );

                    if (i < 3) {
                        row1.addComponents(button);
                    } else if (i < 6) {
                        row2.addComponents(button);
                    } else {
                        row3.addComponents(button);
                    }
                }

                return message.reply({
                    embeds: [
                        infoEmbed(
                            "💎 Mine",
                            `9 kutudan birini seç.\n\n` +
                            `🎁 Kazanırsan **${formatMoney(
                                reward
                            )}** sanal ödül alırsın.\n\n` +
                            `Bu oyun ücretsizdir; para yatırma veya bahis yoktur.`
                        )
                    ],
                    components: [
                        row1,
                        row2,
                        row3
                    ]
                });
            }

            // ==================================================
            // DEĞER VER
            // ==================================================

            if (
                command === "dver" ||
                command === "değerver" ||
                command === "degerver"
            ) {

                if (!canValue(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Bu komutu sadece **Yönetici** veya **Değer Yetkilisi** kullanabilir."
                            )
                        ]
                    });
                }

                const target =
                    message.mentions.members.first();

                const amount =
                    parseMoney(args[1]);

                if (
                    !target ||
                    !Number.isFinite(amount) ||
                    amount <= 0
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Kullanım",
                                "`.dver @Oyuncu 5M` şeklinde kullan."
                            )
                        ]
                    });
                }

                const targetUser =
                    getUser(
                        guild.id,
                        target.id
                    );

                targetUser.value += amount;

                saveDatabase();

                const nicknameUpdated =
                    await updatePlayerNickname(
                        target,
                        targetUser.value
                    );

                await sendLog(
                    guild,
                    `${message.author} → ${target.user} oyuncusuna **+${formatMoney(
                        amount
                    )}** değer verdi.`
                );

                return message.reply({
                    embeds: [
                        success(
                            "Değer Güncellendi",
                            `👤 Oyuncu: ${target}\n` +
                            `➕ Eklenen: **${formatMoney(
                                amount
                            )}**\n` +
                            `💎 Yeni değer: **${formatMoney(
                                targetUser.value
                            )}**\n\n` +
                            `${
                                nicknameUpdated
                                    ? "✅ Takma ad güncellendi."
                                    : "⚠️ Takma ad güncellenemedi."
                            }`
                        )
                    ]
                });
            }

            // ==================================================
            // DEĞER SİL
            // ==================================================

            if (
                command === "dsil" ||
                command === "değersil" ||
                command === "degersil"
            ) {

                if (!canValue(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Bu komutu sadece Yönetici veya Değer Yetkilisi kullanabilir."
                            )
                        ]
                    });
                }

                const target =
                    message.mentions.members.first();

                const amount =
                    parseMoney(args[1]);

                if (
                    !target ||
                    !Number.isFinite(amount) ||
                    amount <= 0
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Kullanım",
                                "`.dsil @Oyuncu 5M` şeklinde kullan."
                            )
                        ]
                    });
                }

                const targetUser =
                    getUser(
                        guild.id,
                        target.id
                    );

                targetUser.value =
                    Math.max(
                        0,
                        targetUser.value - amount
                    );

                saveDatabase();

                await updatePlayerNickname(
                    target,
                    targetUser.value
                );

                return message.reply({
                    embeds: [
                        success(
                            "Değer Azaltıldı",
                            `👤 ${target}\n` +
                            `➖ Silinen: **${formatMoney(
                                amount
                            )}**\n` +
                            `💎 Yeni değer: **${formatMoney(
                                targetUser.value
                            )}**`
                        )
                    ]
                });
            }

            // ==================================================
            // DEĞERLER
            // ==================================================

            if (
                command === "değerler" ||
                command === "degerler"
            ) {

                const players =
                    Object.values(
                        db.users
                    )
                    .filter(
                        u =>
                            u.guildId === guild.id &&
                            u.registered
                    )
                    .sort(
                        (a, b) =>
                            b.value - a.value
                    )
                    .slice(0, 20);

                if (!players.length) {

                    return message.reply({
                        embeds: [
                            infoEmbed(
                                "Değer Listesi",
                                "Henüz kayıtlı oyuncu bulunmuyor."
                            )
                        ]
                    });
                }

                let text = "";

                players.forEach(
                    (p, index) => {

                        const member2 =
                            guild.members.cache.get(
                                p.userId
                            );

                        const name =
                            member2
                                ? member2.user.username
                                : p.userId;

                        text +=
                            `**${index + 1}.** ${name} — **${formatMoney(
                                p.value
                            )}**\n`;
                    }
                );

                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xf1c40f)
                            .setTitle(
                                "💰 Oyuncu Değerleri"
                            )
                            .setDescription(text)
                            .setTimestamp()
                    ]
                });
            }

            // ==================================================
            // KAYIT PANELİ
            // ==================================================

            if (
                command === "kayıtpanel" ||
                command === "kayitpanel"
            ) {

                if (!canRegister(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Kayıt Yetkilisi veya Yönetici olmalısın."
                            )
                        ]
                    });
                }

                const embed =
                    new EmbedBuilder()
                        .setColor(0x5865f2)
                        .setTitle(
                            "⚽ Oyuncu Kayıt Sistemi"
                        )
                        .setDescription(
                            "Sunucuya kayıt olmak için aşağıdaki butonlardan uygun olanı seç."
                        )
                        .addFields(
                            {
                                name: "⚽ Futbolcu",
                                value:
                                    "Futbolcu olarak kayıt ol.",
                                inline: true
                            },
                            {
                                name: "👔 Teknik Direktör",
                                value:
                                    "Teknik Direktör olarak kayıt ol.",
                                inline: true
                            }
                        );

                return message.channel.send({
                    embeds: [embed],
                    components: [
                        registrationPanel()
                    ]
                });
            }

            // ==================================================
            // TAKIM KUR
            // ==================================================

            if (
                command === "takımkur" ||
                command === "takimkur"
            ) {

                if (!user.registered) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Kayıt Gerekli",
                                "Önce kayıt olmalısın."
                            )
                        ]
                    });
                }

                if (
                    user.type !== "manager" &&
                    !isAdmin(member)
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Takım kurmak için Teknik Direktör olmalısın."
                            )
                        ]
                    });
                }

                if (user.team) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Takımın Var",
                                "Zaten bir takımın bulunuyor."
                            )
                        ]
                    });
                }

                const name =
                    args.join(" ").trim();

                if (
                    !name ||
                    name.length < 2 ||
                    name.length > 30
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Geçersiz İsim",
                                "Takım adı 2-30 karakter arasında olmalı."
                            )
                        ]
                    });
                }

                if (
                    getTeamByName(
                        guild.id,
                        name
                    )
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Takım Mevcut",
                                "Bu isimde bir takım zaten bulunuyor."
                            )
                        ]
                    });
                }

                const teamId =
                    `${guild.id}_${message.author.id}_${Date.now()}`;

                db.teams[teamId] = {

                    id: teamId,
                    guildId: guild.id,

                    name,

                    manager:
                        message.author.id,

                    budget: 100000000,

                    players: [],

                    createdAt: Date.now()
                };

                user.team = teamId;

                saveDatabase();

                let teamRole = null;

                try {

                    teamRole =
                        await guild.roles.create({
                            name,
                            reason:
                                "Futbol RP takım oluşturma"
                        });

                    await member.roles.add(
                        teamRole
                    );

                } catch {}

                if (
                    CONFIG.roles.teknikDirektor
                ) {

                    try {

                        await member.roles.add(
                            CONFIG.roles.teknikDirektor
                        );

                    } catch {}
                }

                return message.reply({
                    embeds: [
                        success(
                            "Takım Oluşturuldu",
                            `🏟️ Takım: **${name}**\n` +
                            `👔 Teknik Direktör: ${member}\n` +
                            `💰 Başlangıç bütçesi: **${formatMoney(
                                100000000
                            )}**`
                        )
                    ]
                });
            }

            // ==================================================
            // TAKIMLAR
            // ==================================================

            if (
                command === "takımlar" ||
                command === "takimlar"
            ) {

                const teams =
                    Object.values(
                        db.teams
                    )
                    .filter(
                        t =>
                            t.guildId === guild.id
                    );

                if (!teams.length) {

                    return message.reply({
                        embeds: [
                            infoEmbed(
                                "Takımlar",
                                "Henüz takım oluşturulmamış."
                            )
                        ]
                    });
                }

                let text = "";

                teams.forEach(
                    (team, index) => {

                        const manager =
                            guild.members.cache.get(
                                team.manager
                            );

                        text +=
                            `**${index + 1}. ${team.name}**\n` +
                            `👔 ${manager || "Bilinmiyor"}\n` +
                            `💰 ${formatMoney(team.budget)}\n` +
                            `👥 ${team.players.length} oyuncu\n\n`;
                    }
                );

                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x2ecc71)
                            .setTitle(
                                "🏟️ Takımlar"
                            )
                            .setDescription(text)
                    ]
                });
            }

            // ==================================================
            // KADRO
            // ==================================================

            if (
                command === "kadro"
            ) {

                const name =
                    args.join(" ");

                let team =
                    name
                        ? getTeamByName(
                            guild.id,
                            name
                        )
                        : getUserTeam(
                            guild.id,
                            message.author.id
                        );

                if (!team) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Takım Bulunamadı",
                                "Takım adı yaz veya bir takıma katıl."
                            )
                        ]
                    });
                }

                let text = "";

                if (!team.players.length) {

                    text =
                        "Kadroda henüz oyuncu yok.";

                } else {

                    team.players.forEach(
                        (playerId, index) => {

                            const player =
                                guild.members.cache.get(
                                    playerId
                                );

                            const playerData =
                                getUser(
                                    guild.id,
                                    playerId
                                );

                            text +=
                                `**${index + 1}.** ${
                                    player || playerId
                                } — ${formatMoney(
                                    playerData.value
                                )}\n`;
                        }
                    );
                }

                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x3498db)
                            .setTitle(
                                `👥 ${team.name} Kadrosu`
                            )
                            .setDescription(text)
                            .addFields({
                                name: "💰 Bütçe",
                                value:
                                    formatMoney(
                                        team.budget
                                    )
                            })
                    ]
                });
            }

            // ==================================================
            // KADRO EKLE
            // ==================================================

            if (
                command === "kadroekle"
            ) {

                const team =
                    getUserTeam(
                        guild.id,
                        message.author.id
                    );

                if (!team) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Takım Yok",
                                "Önce takım oluşturmalısın."
                            )
                        ]
                    });
                }

                if (
                    team.manager !==
                    message.author.id &&
                    !isAdmin(member)
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Bu işlemi sadece Teknik Direktör yapabilir."
                            )
                        ]
                    });
                }

                const target =
                    message.mentions.members.first();

                if (!target) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Kullanım",
                                "`.kadroekle @Oyuncu`"
                            )
                        ]
                    });
                }

                if (
                    team.players.includes(
                        target.id
                    )
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Zaten Kadroda",
                                "Bu oyuncu zaten kadroda."
                            )
                        ]
                    });
                }

                const targetUser =
                    getUser(
                        guild.id,
                        target.id
                    );

                if (targetUser.team) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Oyuncu Takımda",
                                "Oyuncu başka bir takımda."
                            )
                        ]
                    });
                }

                team.players.push(
                    target.id
                );

                targetUser.team =
                    team.id;

                saveDatabase();

                return message.reply({
                    embeds: [
                        success(
                            "Oyuncu Kadroya Eklendi",
                            `${target} artık **${team.name}** kadrosunda.`
                        )
                    ]
                });
            }

            // ==================================================
            // KADRO ÇIKAR
            // ==================================================

            if (
                command === "kadroçıkar" ||
                command === "kadroçikar" ||
                command === "kadroci̇kar"
            ) {

                const team =
                    getUserTeam(
                        guild.id,
                        message.author.id
                    );

                if (!team) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Takım Yok",
                                "Takımın bulunmuyor."
                            )
                        ]
                    });
                }

                if (
                    team.manager !==
                    message.author.id &&
                    !isAdmin(member)
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Sadece Teknik Direktör kullanabilir."
                            )
                        ]
                    });
                }

                const target =
                    message.mentions.members.first();

                if (!target) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Kullanım",
                                "`.kadroçıkar @Oyuncu`"
                            )
                        ]
                    });
                }

                const index =
                    team.players.indexOf(
                        target.id
                    );

                if (index === -1) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Oyuncu Yok",
                                "Oyuncu bu takımda değil."
                            )
                        ]
                    });
                }

                team.players.splice(
                    index,
                    1
                );

                const targetUser =
                    getUser(
                        guild.id,
                        target.id
                    );

                targetUser.team = null;

                saveDatabase();

                return message.reply({
                    embeds: [
                        success(
                            "Oyuncu Çıkarıldı",
                            `${target} takımdan çıkarıldı.`
                        )
                    ]
                });
            }

            // ==================================================
            // TAKIM BÜTÇE
            // ==================================================

            if (
                command === "takımbütçe" ||
                command === "takimbutce"
            ) {

                const team =
                    getUserTeam(
                        guild.id,
                        message.author.id
                    );

                if (!team) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Takım Yok",
                                "Takımın bulunmuyor."
                            )
                        ]
                    });
                }

                return message.reply({
                    embeds: [
                        infoEmbed(
                            `💰 ${team.name}`,
                            `Takım bütçesi: **${formatMoney(
                                team.budget
                            )}**`
                        )
                    ]
                });
            }

            // ==================================================
            // KAP
            // ==================================================

            if (
                command === "kap"
            ) {

                const target =
                    message.mentions.members.first();

                const amount =
                    parseMoney(args[1]);

                if (
                    !target ||
                    !Number.isFinite(amount) ||
                    amount <= 0
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Kullanım",
                                "`.kap @Oyuncu 10M` şeklinde kullan."
                            )
                        ]
                    });
                }

                const seller =
                    getUser(
                        guild.id,
                        target.id
                    );

                if (!seller.team) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Oyuncu Takımsız",
                                "Bu oyuncunun bir takımı bulunmuyor."
                            )
                        ]
                    });
                }

                const buyerTeam =
                    getUserTeam(
                        guild.id,
                        message.author.id
                    );

                if (!buyerTeam) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Takım Gerekli",
                                "Transfer teklifi yapmak için takımın olmalı."
                            )
                        ]
                    });
                }

                if (
                    buyerTeam.id ===
                    seller.team
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Geçersiz Transfer",
                                "Kendi takımındaki oyuncuya teklif veremezsin."
                            )
                        ]
                    });
                }

                if (
                    buyerTeam.budget <
                    amount
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetersiz Bütçe",
                                "Takım bütçen bu transfer için yeterli değil."
                            )
                        ]
                    });
                }

                const transferId =
                    `TR_${Date.now()}_${random(
                        100,
                        999
                    )}`;

                db.transfers[
                    transferId
                ] = {

                    id: transferId,

                    guildId:
                        guild.id,

                    buyer:
                        message.author.id,

                    buyerTeam:
                        buyerTeam.id,

                    seller:
                        target.id,

                    sellerTeam:
                        seller.team,

                    amount,

                    status: "pending",

                    createdAt: Date.now()
                };

                saveDatabase();

                const row =
                    new ActionRowBuilder()
                        .addComponents(

                            new ButtonBuilder()
                                .setCustomId(
                                    `transfer_accept_${transferId}`
                                )
                                .setLabel(
                                    "Kabul Et"
                                )
                                .setEmoji("✅")
                                .setStyle(
                                    ButtonStyle.Success
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    `transfer_reject_${transferId}`
                                )
                                .setLabel(
                                    "Reddet"
                                )
                                .setEmoji("❌")
                                .setStyle(
                                    ButtonStyle.Danger
                                )
                        );

                return message.reply({
                    content:
                        `${target}`,
                    embeds: [
                        infoEmbed(
                            "📋 Transfer Teklifi",
                            `👤 Oyuncu: ${target}\n` +
                            `🏟️ Alıcı takım: **${buyerTeam.name}**\n` +
                            `💰 Teklif: **${formatMoney(
                                amount
                            )}**\n\n` +
                            `Oyuncunun transferi kabul veya reddetmesi bekleniyor.`
                        )
                    ],
                    components: [row]
                });
            }

            // ==================================================
            // TRANSFERLER
            // ==================================================

            if (
                command === "transferler"
            ) {

                const transfers =
                    Object.values(
                        db.transfers
                    )
                    .filter(
                        t =>
                            t.guildId === guild.id &&
                            t.status === "pending"
                    )
                    .slice(0, 15);

                if (!transfers.length) {

                    return message.reply({
                        embeds: [
                            infoEmbed(
                                "Transferler",
                                "Bekleyen transfer teklifi yok."
                            )
                        ]
                    });
                }

                let text = "";

                transfers.forEach(
                    t => {

                        const buyer =
                            guild.members.cache.get(
                                t.buyer
                            );

                        const seller =
                            guild.members.cache.get(
                                t.seller
                            );

                        const buyerTeam =
                            db.teams[
                                t.buyerTeam
                            ];

                        text +=
                            `📋 ${seller || t.seller} → ${
                                buyerTeam?.name || "Takım"
                            }\n` +
                            `💰 ${formatMoney(
                                t.amount
                            )}\n` +
                            `👔 Teklif sahibi: ${
                                buyer || t.buyer
                            }\n\n`;
                    }
                );

                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xf1c40f)
                            .setTitle(
                                "🔄 Bekleyen Transferler"
                            )
                            .setDescription(text)
                    ]
                });
            }

            // ==================================================
            // MAÇ
            // ==================================================

            if (
                command === "maç" ||
                command === "mac"
            ) {

                if (
                    !isAdmin(member) &&
                    CONFIG.roles.macYetkilisi &&
                    !hasRole(
                        member,
                        CONFIG.roles.macYetkilisi
                    )
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Maç Yetkilisi olmalısın."
                            )
                        ]
                    });
                }

                const team1Name =
                    args[0];

                const team2Name =
                    args.slice(1).join(" ");

                if (
                    !team1Name ||
                    !team2Name
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Kullanım",
                                "`.maç Takım1 Takım2`"
                            )
                        ]
                    });
                }

                const team1 =
                    getTeamByName(
                        guild.id,
                        team1Name
                    );

                const team2 =
                    getTeamByName(
                        guild.id,
                        team2Name
                    );

                if (!team1 || !team2) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Takım Bulunamadı",
                                "İki takım da kayıtlı olmalı."
                            )
                        ]
                    });
                }

                if (
                    team1.id === team2.id
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Geçersiz Maç",
                                "Bir takım kendi kendisiyle oynayamaz."
                            )
                        ]
                    });
                }

                const matchId =
                    `MATCH_${Date.now()}`;

                const messageMatch =
                    await message.channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x2ecc71)
                                .setTitle(
                                    `⚽ ${team1.name} - ${team2.name}`
                                )
                                .setDescription(
                                    "🏟️ Maç başlıyor...\n\n⏱️ Hakem düdüğü bekleniyor."
                                )
                                .setTimestamp()
                        ]
                    });

                let score1 = 0;
                let score2 = 0;

                const totalEvents = 12;

                for (
                    let i = 0;
                    i < totalEvents;
                    i++
                ) {

                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                1000
                            )
                    );

                    const event =
                        pick(
                            MATCH_EVENTS
                        );

                    if (
                        event.includes(
                            "GOOOOOOL"
                        )
                    ) {

                        if (
                            random(0, 1) === 0
                        ) {
                            score1++;
                        } else {
                            score2++;
                        }
                    }

                    await messageMatch.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(
                                    0x3498db
                                )
                                .setTitle(
                                    `⚽ ${team1.name} ${score1} - ${score2} ${team2.name}`
                                )
                                .setDescription(
                                    `⏱️ Dakika: ${
                                        Math.min(
                                            90,
                                            Math.floor(
                                                (
                                                    i + 1
                                                ) *
                                                90 /
                                                totalEvents
                                            )
                                        )
                                    }\n\n${event}`
                                )
                        ]
                    });
                }

                let result;

                if (
                    score1 > score2
                ) {

                    result =
                        `🏆 **${team1.name}** kazandı!`;

                } else if (
                    score2 > score1
                ) {

                    result =
                        `🏆 **${team2.name}** kazandı!`;

                } else {

                    result =
                        "🤝 Maç berabere bitti!";
                }

                db.matches[
                    matchId
                ] = {

                    id: matchId,

                    guildId:
                        guild.id,

                    team1:
                        team1.id,

                    team2:
                        team2.id,

                    score1,
                    score2,

                    createdAt:
                        Date.now()
                };

                saveDatabase();

                return messageMatch.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xf1c40f)
                            .setTitle(
                                "🏁 MAÇ SONA ERDİ"
                            )
                            .setDescription(
                                `# ${team1.name} ${score1} - ${score2} ${team2.name}\n\n` +
                                result
                            )
                            .setTimestamp()
                    ]
                });
            }

            // ==================================================
            // KICK
            // ==================================================

            if (
                command === "kick"
            ) {

                if (!canModerate(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Yönetici yetkisi gerekiyor."
                            )
                        ]
                    });
                }

                const target =
                    message.mentions.members.first();

                if (!target) {

                    return message.reply(
                        "Kullanım: `.kick @üye sebep`"
                    );
                }

                if (
                    !target.kickable
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "İşlem Başarısız",
                                "Bu kullanıcıyı atamıyorum."
                            )
                        ]
                    });
                }

                const reason =
                    args
                        .slice(1)
                        .join(" ") ||
                    "Sebep belirtilmedi.";

                await target.kick(
                    reason
                );

                await sendLog(
                    guild,
                    `${target.user.tag} sunucudan atıldı.\nSebep: ${reason}`
                );

                return message.reply({
                    embeds: [
                        success(
                            "Kullanıcı Atıldı",
                            `${target.user.tag} sunucudan atıldı.\nSebep: ${reason}`
                        )
                    ]
                });
            }

            // ==================================================
            // BAN
            // ==================================================

            if (
                command === "ban"
            ) {

                if (!canModerate(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Yönetici yetkisi gerekiyor."
                            )
                        ]
                    });
                }

                const target =
                    message.mentions.members.first();

                if (!target) {

                    return message.reply(
                        "Kullanım: `.ban @üye sebep`"
                    );
                }

                if (
                    !target.bannable
                ) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "İşlem Başarısız",
                                "Bu kullanıcıyı banlayamıyorum."
                            )
                        ]
                    });
                }

                const reason =
                    args
                        .slice(1)
                        .join(" ") ||
                    "Sebep belirtilmedi.";

                await target.ban({
                    reason
                });

                await sendLog(
                    guild,
                    `${target.user.tag} banlandı.\nSebep: ${reason}`
                );

                return message.reply({
                    embeds: [
                        success(
                            "Kullanıcı Banlandı",
                            `${target.user.tag} banlandı.\nSebep: ${reason}`
                        )
                    ]
                });
            }

            // ==================================================
            // MUTE
            // ==================================================

            if (
                command === "mute"
            ) {

                if (!canModerate(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Yönetici yetkisi gerekiyor."
                            )
                        ]
                    });
                }

                const target =
                    message.mentions.members.first();

                const duration =
                    parseDuration(
                        args[1] || "10m"
                    );

                if (
                    !target ||
                    !Number.isFinite(duration)
                ) {

                    return message.reply(
                        "Kullanım: `.mute @üye 10m`"
                    );
                }

                try {

                    await target.timeout(
                        duration,
                        "Futbol RP mute"
                    );

                    return message.reply({
                        embeds: [
                            success(
                                "Mute",
                                `${target} **${cooldownText(
                                    duration
                                )}** boyunca susturuldu.`
                            )
                        ]
                    });

                } catch {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Hata",
                                "Mute uygulanamadı."
                            )
                        ]
                    });
                }
            }

            // ==================================================
            // UNMUTE
            // ==================================================

            if (
                command === "unmute"
            ) {

                if (!canModerate(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Yönetici yetkisi gerekiyor."
                            )
                        ]
                    });
                }

                const target =
                    message.mentions.members.first();

                if (!target) {

                    return message.reply(
                        "Kullanım: `.unmute @üye`"
                    );
                }

                try {

                    await target.timeout(
                        null,
                        "Mute kaldırıldı"
                    );

                    return message.reply({
                        embeds: [
                            success(
                                "Mute Kaldırıldı",
                                `${target} artık konuşabilir.`
                            )
                        ]
                    });

                } catch {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Hata",
                                "Mute kaldırılamadı."
                            )
                        ]
                    });
                }
            }

            // ==================================================
            // KİLİT
            // ==================================================

            if (
                command === "kilit"
            ) {

                if (!canModerate(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Yönetici yetkisi gerekiyor."
                            )
                        ]
                    });
                }

                try {

                    await message.channel.permissionOverwrites.edit(
                        guild.roles.everyone,
                        {
                            SendMessages: false
                        }
                    );

                    return message.reply({
                        embeds: [
                            success(
                                "Kanal Kilitlendi",
                                "🔒 Bu kanal artık mesaj kabul etmiyor."
                            )
                        ]
                    });

                } catch {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Hata",
                                "Kanal kilitlenemedi."
                            )
                        ]
                    });
                }
            }

            // ==================================================
            // AÇ
            // ==================================================

            if (
                command === "aç" ||
                command === "ac"
            ) {

                if (!canModerate(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Yönetici yetkisi gerekiyor."
                            )
                        ]
                    });
                }

                try {

                    await message.channel.permissionOverwrites.edit(
                        guild.roles.everyone,
                        {
                            SendMessages: null
                        }
                    );

                    return message.reply({
                        embeds: [
                            success(
                                "Kanal Açıldı",
                                "🔓 Kanal tekrar kullanıma açıldı."
                            )
                        ]
                    });

                } catch {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Hata",
                                "Kanal açılamadı."
                            )
                        ]
                    });
                }
            }

            // ==================================================
            // KANAL AÇ
            // ==================================================

            if (
                command === "kanalaç" ||
                command === "kanalac"
            ) {

                if (!isAdmin(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Yönetici yetkisi gerekiyor."
                            )
                        ]
                    });
                }

                const name =
                    args.join("-")
                        .toLowerCase()
                        .replace(
                            /[^a-z0-9-_ğüşöçıİĞÜŞÖÇ]/gi,
                            ""
                        )
                        .slice(0, 90);

                if (!name) {

                    return message.reply(
                        "Kullanım: `.kanalaç kanal-ismi`"
                    );
                }

                const channel =
                    await guild.channels.create({
                        name,
                        type:
                            ChannelType.GuildText
                    });

                return message.reply({
                    embeds: [
                        success(
                            "Kanal Oluşturuldu",
                            `${channel} oluşturuldu.`
                        )
                    ]
                });
            }

            // ==================================================
            // SİL
            // ==================================================

            if (
                command === "sil"
            ) {

                if (!isAdmin(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Yönetici yetkisi gerekiyor."
                            )
                        ]
                    });
                }

                let amount =
                    Number(args[0]);

                if (
                    !Number.isInteger(
                        amount
                    ) ||
                    amount < 1
                ) {

                    return message.reply(
                        "1 ile 1000 arasında bir sayı yaz."
                    );
                }

                amount =
                    Math.min(
                        amount,
                        1000
                    );

                let remaining =
                    amount;

                let deleted = 0;

                while (
                    remaining > 0
                ) {

                    const chunk =
                        Math.min(
                            remaining,
                            100
                        );

                    const messages =
                        await message.channel.messages.fetch({
                            limit: chunk
                        });

                    if (!messages.size) {
                        break;
                    }

                    const valid =
                        messages.filter(
                            m =>
                                Date.now() -
                                m.createdTimestamp <
                                14 *
                                24 *
                                60 *
                                60 *
                                1000
                        );

                    if (!valid.size) {
                        break;
                    }

                    await message.channel.bulkDelete(
                        valid,
                        true
                    );

                    deleted +=
                        valid.size;

                    remaining -=
                        valid.size;

                    if (
                        valid.size < chunk
                    ) {
                        break;
                    }
                }

                const msg =
                    await message.channel.send({
                        embeds: [
                            success(
                                "Mesajlar Silindi",
                                `🗑️ **${deleted}** mesaj silindi.`
                            )
                        ]
                    });

                setTimeout(
                    () =>
                        msg.delete()
                            .catch(() => {}),
                    5000
                );

                return;
            }

            // ==================================================
            // EMBED
            // ==================================================

            if (
                command === "embed"
            ) {

                if (!isAdmin(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Sadece Yönetici kullanabilir."
                            )
                        ]
                    });
                }

                const raw =
                    args.join(" ");

                const parts =
                    raw.split("|");

                const title =
                    parts[0]?.trim() ||
                    "Duyuru";

                const description =
                    parts
                        .slice(1)
                        .join("|")
                        .trim() ||
                    "Duyuru içeriği.";

                const embed =
                    new EmbedBuilder()
                        .setColor(0x5865f2)
                        .setTitle(title)
                        .setDescription(
                            description
                        )
                        .setTimestamp();

                await message.channel.send({
                    embeds: [embed]
                });

                return message.delete()
                    .catch(() => {});
            }

            // ==================================================
            // DM
            // ==================================================

            if (
                command === "dm" ||
                command === "sm"
            ) {

                if (!canDM(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Bu komutu kullanamazsın."
                            )
                        ]
                    });
                }

                const text =
                    args.join(" ");

                if (!text) {

                    return message.reply(
                        "Kullanım: `.dm mesaj`"
                    );
                }

                let sent = 0;
                let failed = 0;

                await message.reply({
                    embeds: [
                        infoEmbed(
                            "DM Gönderiliyor",
                            "Üyelere DM gönderimi başlatıldı."
                        )
                    ]
                });

                for (
                    const member2
                    of guild.members.cache.values()
                ) {

                    if (
                        member2.user.bot
                    ) continue;

                    try {

                        await member2.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(
                                        0x5865f2
                                    )
                                    .setTitle(
                                        guild.name
                                    )
                                    .setDescription(
                                        text
                                    )
                                    .setTimestamp()
                            ]
                        });

                        sent++;

                    } catch {

                        failed++;
                    }

                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                250
                            )
                    );
                }

                return message.channel.send({
                    embeds: [
                        success(
                            "DM Tamamlandı",
                            `✅ Başarılı: **${sent}**\n` +
                            `❌ Başarısız: **${failed}**`
                        )
                    ]
                });
            }

            // ==================================================
            // ROL PANEL
            // ==================================================

            if (
                command === "rolpanel"
            ) {

                if (!isAdmin(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Sadece Yönetici kullanabilir."
                            )
                        ]
                    });
                }

                const row =
                    new ActionRowBuilder()
                        .addComponents(

                            new ButtonBuilder()
                                .setCustomId(
                                    "role_futbolcu"
                                )
                                .setLabel(
                                    "Futbolcu"
                                )
                                .setEmoji("⚽")
                                .setStyle(
                                    ButtonStyle.Success
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    "role_td"
                                )
                                .setLabel(
                                    "Teknik Direktör"
                                )
                                .setEmoji("👔")
                                .setStyle(
                                    ButtonStyle.Primary
                                )
                        );

                return message.channel.send({
                    embeds: [
                        infoEmbed(
                            "🎭 Rol Paneli",
                            "Almak istediğin rolü seç."
                        )
                    ],
                    components: [row]
                });
            }

            // ==================================================
            // SUNUCU PROFİLİ
            // ==================================================

            if (
                command === "sunucuprofil" ||
                command === "sunucuprofil"
            ) {

                const owner =
                    await guild.fetchOwner()
                        .catch(() => null);

                const teams =
                    Object.values(
                        db.teams
                    )
                    .filter(
                        t =>
                            t.guildId === guild.id
                    );

                const players =
                    Object.values(
                        db.users
                    )
                    .filter(
                        u =>
                            u.guildId === guild.id &&
                            u.registered
                    );

                const embed =
                    new EmbedBuilder()
                        .setColor(0x5865f2)
                        .setTitle(
                            `🏟️ ${guild.name}`
                        )
                        .setThumbnail(
                            guild.iconURL({
                                size: 512
                            })
                        )
                        .addFields(

                            {
                                name: "👑 Kurucu",
                                value:
                                    owner
                                        ? owner.user.tag
                                        : "Bilinmiyor",
                                inline: true
                            },

                            {
                                name: "👥 Üye",
                                value:
                                    `${guild.memberCount}`,
                                inline: true
                            },

                            {
                                name: "⚽ Oyuncu",
                                value:
                                    `${players.length}`,
                                inline: true
                            },

                            {
                                name: "🏟️ Takım",
                                value:
                                    `${teams.length}`,
                                inline: true
                            },

                            {
                                name: "💬 Kanal",
                                value:
                                    `${guild.channels.cache.size}`,
                                inline: true
                            },

                            {
                                name: "🎭 Rol",
                                value:
                                    `${guild.roles.cache.size}`,
                                inline: true
                            }
                        )
                        .setFooter({
                            text:
                                "Football RP System"
                        })
                        .setTimestamp();

                return message.reply({
                    embeds: [embed]
                });
            }

            // ==================================================
            // SPONSOR
            // ==================================================

            if (
                command === "sponsor"
            ) {

                if (!isAdmin(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Sadece Yönetici kullanabilir."
                            )
                        ]
                    });
                }

                const sponsorName =
                    args[0];

                const budget =
                    parseMoney(args[1]);

                if (
                    !sponsorName ||
                    !Number.isFinite(
                        budget
                    )
                ) {

                    return message.reply(
                        "Kullanım: `.sponsor Şirket 50M`"
                    );
                }

                const id =
                    `SP_${Date.now()}`;

                db.sponsors[id] = {

                    id,

                    guildId:
                        guild.id,

                    name:
                        sponsorName,

                    budget,

                    createdBy:
                        message.author.id,

                    createdAt:
                        Date.now()
                };

                saveDatabase();

                return message.reply({
                    embeds: [
                        success(
                            "Sponsor Eklendi",
                            `🏢 **${sponsorName}**\n` +
                            `💰 Sponsor bütçesi: **${formatMoney(
                                budget
                            )}**`
                        )
                    ]
                });
            }

            // ==================================================
            // ÇEKİLİŞ
            // ==================================================

            if (
                command === "çekiliş" ||
                command === "cekilis"
            ) {

                if (!canGiveaway(member)) {

                    return message.reply({
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Çekiliş Yetkilisi veya Yönetici olmalısın."
                            )
                        ]
                    });
                }

                const prize =
                    parseMoney(args[0]);

                const duration =
                    parseDuration(args[1]);

                if (
                    !Number.isFinite(prize) ||
                    !Number.isFinite(duration) ||
                    prize <= 0
                ) {

                    return message.reply(
                        "Örnek: `.çekiliş 5M 1h`"
                    );
                }

                const id =
                    `GW_${Date.now()}`;

                db.giveaways[id] = {

                    id,

                    guildId:
                        guild.id,

                    channelId:
                        message.channel.id,

                    messageId:
                        null,

                    prize,

                    endsAt:
                        Date.now() +
                        duration,

                    participants: [],

                    ended: false
                };

                saveDatabase();

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `giveaway_join_${id}`
                                )
                                .setLabel(
                                    "Katıl"
                                )
                                .setEmoji("🎁")
                                .setStyle(
                                    ButtonStyle.Success
                                )
                        );

                const giveawayMessage =
                    await message.channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(
                                    0xf1c40f
                                )
                                .setTitle(
                                    "🎁 ÇEKİLİŞ"
                                )
                                .setDescription(
                                    `💰 Ödül: **${formatMoney(
                                        prize
                                    )}**\n\n` +
                                    `⏱️ Süre: **${cooldownText(
                                        duration
                                    )}**\n\n` +
                                    `Katılmak için aşağıdaki butona bas.`
                                )
                                .setTimestamp(
                                    db.giveaways[id].endsAt
                                )
                        ],
                        components: [row]
                    });

                db.giveaways[id].messageId =
                    giveawayMessage.id;

                saveDatabase();

                setTimeout(
                    async () => {

                        const giveaway =
                            db.giveaways[id];

                        if (
                            !giveaway ||
                            giveaway.ended
                        ) return;

                        giveaway.ended = true;

                        let winnerId = null;

                        if (
                            giveaway.participants.length
                        ) {

                            winnerId =
                                pick(
                                    giveaway.participants
                                );
                        }

                        saveDatabase();

                        const disabledRow =
                            new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(
                                            `giveaway_finished_${id}`
                                        )
                                        .setLabel(
                                            "Çekiliş Bitti"
                                        )
                                        .setStyle(
                                            ButtonStyle.Secondary
                                        )
                                        .setDisabled(true)
                                );

                        if (winnerId) {

                            await message.channel.send({
                                embeds: [
                                    success(
                                        "Çekiliş Sonucu",
                                        `🎉 Kazanan: <@${winnerId}>\n\n` +
                                        `🎁 Ödül: **${formatMoney(
                                            prize
                                        )}**`
                                    )
                                ]
                            });

                        } else {

                            await message.channel.send({
                                embeds: [
                                    infoEmbed(
                                        "Çekiliş Sonucu",
                                        "Katılım olmadığı için kazanan bulunamadı."
                                    )
                                ]
                            });
                        }

                        await giveawayMessage.edit({
                            components: [
                                disabledRow
                            ]
                        }).catch(() => {});

                    },
                    duration
                );

                return;
            }

            // ==================================================
            // UNKNOWN COMMAND
            // ==================================================

            return message.reply({
                embeds: [
                    errorEmbed(
                        "Bilinmeyen Komut",
                        `\`${PREFIX}${command}\` diye bir komut bulunamadı.\n` +
                        `Yardım için \`.yardım\` yaz.`
                    )
                ]
            });

        } catch (error) {

            console.error(
                "COMMAND ERROR:",
                error
            );

            try {

                await message.reply({
                    embeds: [
                        errorEmbed(
                            "Sistem Hatası",
                            "Komut çalıştırılırken beklenmeyen bir hata oluştu."
                        )
                    ]
                });

            } catch {}
        }
    }
);

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
    "interactionCreate",
    async interaction => {

        try {

            if (!interaction.isButton()) {
                return;
            }

            const guild =
                interaction.guild;

            if (!guild) return;

            const member =
                interaction.member;

            // ==================================================
            // REGISTER PLAYER
            // ==================================================

            if (
                interaction.customId ===
                "register_player"
            ) {

                const user =
                    getUser(
                        guild.id,
                        interaction.user.id
                    );

                user.registered =
                    true;

                user.type =
                    "player";

                saveDatabase();

                if (
                    CONFIG.roles.kayitsiz
                ) {

                    await member.roles.remove(
                        CONFIG.roles.kayitsiz
                    ).catch(() => {});
                }

                if (
                    CONFIG.roles.futbolcu
                ) {

                    await member.roles.add(
                        CONFIG.roles.futbolcu
                    ).catch(() => {});
                }

                await interaction.reply({
                    ephemeral: true,
                    embeds: [
                        success(
                            "Kayıt Tamamlandı",
                            "⚽ Futbolcu olarak kayıt oldun."
                        )
                    ]
                });

                const registrationChannel =
                    CONFIG.channels.kayit
                        ? guild.channels.cache.get(
                            CONFIG.channels.kayit
                        )
                        : null;

                if (registrationChannel) {

                    registrationChannel.send({
                        embeds: [
                            success(
                                "Yeni Oyuncu Kaydı",
                                `⚽ ${interaction.user} futbolcu olarak kayıt oldu.\n` +
                                `👮 Kayıt Yetkilisi: <@&${CONFIG.roles.kayitYetkilisi}>`
                            )
                        ]
                    }).catch(() => {});
                }

                if (
                    CONFIG.channels.genel
                ) {

                    const general =
                        guild.channels.cache.get(
                            CONFIG.channels.genel
                        );

                    if (general) {

                        general.send(
                            `🎉 Hoş geldin ${interaction.user}! Futbol RP'ye katıldın. ⚽`
                        ).catch(() => {});
                    }
                }

                return;
            }

            // ==================================================
            // REGISTER MANAGER
            // ==================================================

            if (
                interaction.customId ===
                "register_manager"
            ) {

                const user =
                    getUser(
                        guild.id,
                        interaction.user.id
                    );

                user.registered =
                    true;

                user.type =
                    "manager";

                saveDatabase();

                if (
                    CONFIG.roles.kayitsiz
                ) {

                    await member.roles.remove(
                        CONFIG.roles.kayitsiz
                    ).catch(() => {});
                }

                if (
                    CONFIG.roles.teknikDirektor
                ) {

                    await member.roles.add(
                        CONFIG.roles.teknikDirektor
                    ).catch(() => {});
                }

                await interaction.reply({
                    ephemeral: true,
                    embeds: [
                        success(
                            "Kayıt Tamamlandı",
                            "👔 Teknik Direktör olarak kayıt oldun."
                        )
                    ]
                });

                const registrationChannel =
                    CONFIG.channels.kayit
                        ? guild.channels.cache.get(
                            CONFIG.channels.kayit
                        )
                        : null;

                if (registrationChannel) {

                    registrationChannel.send({
                        embeds: [
                            success(
                                "Yeni Teknik Direktör",
                                `👔 ${interaction.user} Teknik Direktör olarak kayıt oldu.\n` +
                                `👮 Kayıt Yetkilisi: <@&${CONFIG.roles.kayitYetkilisi}>`
                            )
                        ]
                    }).catch(() => {});
                }

                return;
            }

            // ==================================================
            // ROLE PLAYER
            // ==================================================

            if (
                interaction.customId ===
                "role_futbolcu"
            ) {

                if (
                    CONFIG.roles.futbolcu
                ) {

                    await member.roles.add(
                        CONFIG.roles.futbolcu
                    ).catch(() => {});
                }

                return interaction.reply({
                    ephemeral: true,
                    embeds: [
                        success(
                            "Rol Verildi",
                            "⚽ Futbolcu rolü verildi."
                        )
                    ]
                });
            }

            // ==================================================
            // ROLE TD
            // ==================================================

            if (
                interaction.customId ===
                "role_td"
            ) {

                if (
                    CONFIG.roles.teknikDirektor
                ) {

                    await member.roles.add(
                        CONFIG.roles.teknikDirektor
                    ).catch(() => {});
                }

                return interaction.reply({
                    ephemeral: true,
                    embeds: [
                        success(
                            "Rol Verildi",
                            "👔 Teknik Direktör rolü verildi."
                        )
                    ]
                });
            }

            // ==================================================
            // MINE
            // ==================================================

            if (
                interaction.customId.startsWith(
                    "mine_"
                )
            ) {

                const parts =
                    interaction.customId.split("_");

                const ownerId =
                    parts[1];

                const selected =
                    Number(parts[2]);

                const winning =
                    Number(parts[3]);

                const reward =
                    Number(parts[4]);

                if (
                    interaction.user.id !==
                    ownerId
                ) {

                    return interaction.reply({
                        ephemeral: true,
                        embeds: [
                            errorEmbed(
                                "Bu Oyun Sana Ait Değil",
                                "Kendi `.mine` oyununu başlatmalısın."
                            )
                        ]
                    });
                }

                const components =
                    interaction.message.components;

                const buttons = [];

                for (
                    const row of components
                ) {

                    for (
                        const component
                        of row.components
                    ) {

                        buttons.push(
                            component
                        );
                    }
                }

                const newRows = [];

                for (
                    let i = 0;
                    i < 9;
                    i += 3
                ) {

                    const row =
                        new ActionRowBuilder();

                    for (
                        let j = i;
                        j < i + 3;
                        j++
                    ) {

                        const old =
                            buttons[j];

                        const b =
                            ButtonBuilder.from(
                                old
                            )
                            .setDisabled(
                                true
                            );

                        if (
                            j === selected
                        ) {

                            b.setLabel(
                                j === winning
                                    ? "💎"
                                    : "💥"
                            );
                        }

                        row.addComponents(b);
                    }

                    newRows.push(row);
                }

                if (
                    selected === winning
                ) {

                    const user =
                        getUser(
                            guild.id,
                            interaction.user.id
                        );

                    user.budget += reward;

                    saveDatabase();

                    return interaction.update({
                        embeds: [
                            success(
                                "💎 Kazandın!",
                                `Tebrikler!\n\n` +
                                `🎁 Ödül: **${formatMoney(
                                    reward
                                )}**\n` +
                                `💰 Sanal bakiyen: **${formatMoney(
                                    user.budget
                                )}**`
                            )
                        ],
                        components:
                            newRows
                    });
                }

                return interaction.update({
                    embeds: [
                        errorEmbed(
                            "💥 Boş Kutu!",
                            "Bu kutuda ödül yoktu."
                        )
                    ],
                    components:
                        newRows
                });
            }

            // ==================================================
            // TRANSFER ACCEPT
            // ==================================================

            if (
                interaction.customId.startsWith(
                    "transfer_accept_"
                )
            ) {

                const id =
                    interaction.customId.replace(
                        "transfer_accept_",
                        ""
                    );

                const transfer =
                    db.transfers[id];

                if (!transfer) {

                    return interaction.reply({
                        ephemeral: true,
                        embeds: [
                            errorEmbed(
                                "Transfer Bulunamadı",
                                "Bu teklif artık mevcut değil."
                            )
                        ]
                    });
                }

                if (
                    transfer.status !==
                    "pending"
                ) {

                    return interaction.reply({
                        ephemeral: true,
                        embeds: [
                            errorEmbed(
                                "Transfer Sonuçlandı",
                                "Bu teklif daha önce sonuçlandırılmış."
                            )
                        ]
                    });
                }

                if (
                    interaction.user.id !==
                    transfer.seller
                ) {

                    return interaction.reply({
                        ephemeral: true,
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Bu transfer teklifini sadece oyuncu kabul edebilir."
                            )
                        ]
                    });
                }

                const buyerTeam =
                    db.teams[
                        transfer.buyerTeam
                    ];

                const sellerTeam =
                    db.teams[
                        transfer.sellerTeam
                    ];

                if (
                    !buyerTeam ||
                    !sellerTeam
                ) {

                    return interaction.reply({
                        ephemeral: true,
                        embeds: [
                            errorEmbed(
                                "Takım Hatası",
                                "Transfer takımlarından biri bulunamadı."
                            )
                        ]
                    });
                }

                if (
                    buyerTeam.budget <
                    transfer.amount
                ) {

                    transfer.status =
                        "cancelled";

                    saveDatabase();

                    return interaction.reply({
                        ephemeral: true,
                        embeds: [
                            errorEmbed(
                                "Yetersiz Bütçe",
                                "Alıcı takımın bütçesi artık yeterli değil."
                            )
                        ]
                    });
                }

                const index =
                    sellerTeam.players.indexOf(
                        transfer.seller
                    );

                if (index !== -1) {

                    sellerTeam.players.splice(
                        index,
                        1
                    );
                }

                buyerTeam.players.push(
                    transfer.seller
                );

                buyerTeam.budget -=
                    transfer.amount;

                sellerTeam.budget +=
                    transfer.amount;

                const sellerUser =
                    getUser(
                        guild.id,
                        transfer.seller
                    );

                sellerUser.team =
                    buyerTeam.id;

                transfer.status =
                    "accepted";

                saveDatabase();

                return interaction.update({
                    embeds: [
                        success(
                            "Transfer Tamamlandı",
                            `⚽ <@${transfer.seller}> artık **${buyerTeam.name}** takımında.\n\n` +
                            `💰 Transfer bedeli: **${formatMoney(
                                transfer.amount
                            )}**`
                        )
                    ],
                    components: []
                });
            }

            // ==================================================
            // TRANSFER REJECT
            // ==================================================

            if (
                interaction.customId.startsWith(
                    "transfer_reject_"
                )
            ) {

                const id =
                    interaction.customId.replace(
                        "transfer_reject_",
                        ""
                    );

                const transfer =
                    db.transfers[id];

                if (!transfer) {

                    return interaction.reply({
                        ephemeral: true,
                        embeds: [
                            errorEmbed(
                                "Transfer Bulunamadı",
                                "Teklif bulunamadı."
                            )
                        ]
                    });
                }

                if (
                    interaction.user.id !==
                    transfer.seller
                ) {

                    return interaction.reply({
                        ephemeral: true,
                        embeds: [
                            errorEmbed(
                                "Yetki Yok",
                                "Bu teklifi sadece oyuncu reddedebilir."
                            )
                        ]
                    });
                }

                transfer.status =
                    "rejected";

                saveDatabase();

                return interaction.update({
                    embeds: [
                        errorEmbed(
                            "Transfer Reddedildi",
                            "Oyuncu transfer teklifini reddetti."
                        )
                    ],
                    components: []
                });
            }

            // ==================================================
            // GIVEAWAY JOIN
            // ==================================================

            if (
                interaction.customId.startsWith(
                    "giveaway_join_"
                )
            ) {

                const id =
                    interaction.customId.replace(
                        "giveaway_join_",
                        ""
                    );

                const giveaway =
                    db.giveaways[id];

                if (
                    !giveaway ||
                    giveaway.ended
                ) {

                    return interaction.reply({
                        ephemeral: true,
                        embeds: [
                            errorEmbed(
                                "Çekiliş Bitti",
                                "Bu çekiliş artık aktif değil."
                            )
                        ]
                    });
                }

                if (
                    giveaway.participants.includes(
                        interaction.user.id
                    )
                ) {

                    return interaction.reply({
                        ephemeral: true,
                        embeds: [
                            infoEmbed(
                                "Zaten Katıldın",
                                "Bu çekilişe zaten katıldın."
                            )
                        ]
                    });
                }

                giveaway.participants.push(
                    interaction.user.id
                );

                saveDatabase();

                return interaction.reply({
                    ephemeral: true,
                    embeds: [
                        success(
                            "Çekilişe Katıldın",
                            `🎁 **${formatMoney(
                                giveaway.prize
                            )}** ödüllü çekilişe katılımın alındı.`
                        )
                    ]
                });
            }

        } catch (error) {

            console.error(
                "INTERACTION ERROR:",
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                interaction.reply({
                    ephemeral: true,
                    embeds: [
                        errorEmbed(
                            "Hata",
                            "İşlem sırasında hata oluştu."
                        )
                    ]
                }).catch(() => {});
            }
        }
    }
);

// ======================================================
// MEMBER JOIN
// ======================================================

client.on(
    "guildMemberAdd",
    async member => {

        try {

            if (
                CONFIG.roles.kayitsiz
            ) {

                await member.roles.add(
                    CONFIG.roles.kayitsiz
                ).catch(() => {});
            }

            const user =
                getUser(
                    member.guild.id,
                    member.id
                );

            user.registered =
                false;

            saveDatabase();

            const channel =
                CONFIG.channels.kayit
                    ? member.guild.channels.cache.get(
                        CONFIG.channels.kayit
                    )
                    : null;

            if (channel) {

                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x5865f2)
                            .setTitle(
                                "👋 Yeni Oyuncu Geldi!"
                            )
                            .setDescription(
                                `${member} sunucuya katıldı.\n\n` +
                                `Kayıt işlemi için yetkililer ilgilenebilir.\n` +
                                `👮 Kayıt Yetkilisi: <@&${CONFIG.roles.kayitYetkilisi}>`
                            )
                            .setThumbnail(
                                member.user.displayAvatarURL()
                            )
                            .setTimestamp()
                    ]
                });
            }

        } catch (
            error
        ) {

            console.error(
                "JOIN ERROR:",
                error
            );
        }
    }
);

// ======================================================
// READY
// ======================================================

client.once(
    "ready",
    () => {

        console.log(
            "================================="
        );

        console.log(
            `BOT AKTİF: ${client.user.tag}`
        );

        console.log(
            `SUNUCU SAYISI: ${client.guilds.cache.size}`
        );

        console.log(
            "Football RP sistemi hazır."
        );

        console.log(
            "================================="
        );

        client.user.setPresence({

            activities: [
                {
                    name:
                        "⚽ Football RP",
                    type: 3
                }
            ],

            status:
                "online"
        });
    }
);

// ======================================================
// ERROR HANDLERS
// ======================================================

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "UNHANDLED REJECTION:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {

        console.error(
            "UNCAUGHT EXCEPTION:",
            error
        );
    }
);

// ======================================================
// LOGIN
// ======================================================

if (!process.env.TOKEN) {

    console.error(
        "TOKEN bulunamadı! Railway Variables kısmına TOKEN ekle."
    );

} else {

    client.login(
        process.env.TOKEN
    );
}
