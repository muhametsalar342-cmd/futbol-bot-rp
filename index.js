const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    ActivityType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

/* =========================================================
   UNITED LEAGUE • FUTBOL RP BOT
   Discord.js v14
   ========================================================= */

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
    console.error("TOKEN bulunamadı.");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

/* =========================
   AYARLAR
========================= */

const CONFIG = {
    NAME: "United League | Futbol Rp",

    ANNOUNCEMENT_CHANNEL_ID: "1544653653330108477",

    ROLES: {
        ADMIN: "1544449436011339806",
        REGISTER: "1544452022764568656",
        VALUE: "1544451743746891806"
    },

    START_PLAYER_VALUE: 1000000,
    START_PLAYER_BUDGET: 10000000,
    START_TEAM_BUDGET: 100000000,

    TRAINING_REWARD: 3000000,
    PENALTY_REWARD: 2000000,

    MATCH_DURATION: 300000,

    PREFIX: "."
};

/* =========================
   VERİ
========================= */

const DATA_FILE = path.join(__dirname, "data.json");

let data = {
    players: {},
    teams: {},
    transfers: [],
    matches: [],
    giveaways: {},
    companies: {},
    sponsors: {},
    ads: {},
    tickets: {},
    season: {
        number: 1,
        startedAt: Date.now()
    }
};

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

            data = {
                ...data,
                ...saved,
                players: saved.players || {},
                teams: saved.teams || {},
                transfers: saved.transfers || [],
                matches: saved.matches || [],
                giveaways: saved.giveaways || {},
                companies: saved.companies || {},
                sponsors: saved.sponsors || {},
                ads: saved.ads || {},
                tickets: saved.tickets || {},
                season: saved.season || {
                    number: 1,
                    startedAt: Date.now()
                }
            };
        }
    } catch (err) {
        console.error("data.json okunamadı:", err);
    }
}

function saveData() {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(data, null, 2),
            "utf8"
        );
    } catch (err) {
        console.error("Veri kaydedilemedi:", err);
    }
}

loadData();

/* =========================
   YARDIMCI FONKSİYONLAR
========================= */

function getPlayer(userId) {
    if (!data.players[userId]) {
        data.players[userId] = {
            value: CONFIG.START_PLAYER_VALUE,
            budget: CONFIG.START_PLAYER_BUDGET,
            training: 0,
            penaltyGoals: 0,
            xp: 0,
            level: 1,
            matches: 0,
            goals: 0,
            assists: 0,
            trophies: 0,
            achievements: [],
            teamId: null,
            registered: false,
            roleType: null
        };
    }

    const p = data.players[userId];

    p.value ??= CONFIG.START_PLAYER_VALUE;
    p.budget ??= CONFIG.START_PLAYER_BUDGET;
    p.training ??= 0;
    p.penaltyGoals ??= 0;
    p.xp ??= 0;
    p.level ??= 1;
    p.matches ??= 0;
    p.goals ??= 0;
    p.assists ??= 0;
    p.trophies ??= 0;
    p.achievements ??= [];
    p.teamId ??= null;

    return p;
}

function getTeam(teamId) {
    return data.teams[teamId] || null;
}

function parseMoney(input) {
    if (!input) return 0;

    let value = String(input)
        .toUpperCase()
        .replace(/€/g, "")
        .replace(/\s/g, "")
        .replace(/,/g, ".");

    let multiplier = 1;

    if (value.endsWith("B")) {
        multiplier = 1000000000;
        value = value.slice(0, -1);
    } else if (value.endsWith("M")) {
        multiplier = 1000000;
        value = value.slice(0, -1);
    } else if (value.endsWith("K")) {
        multiplier = 1000;
        value = value.slice(0, -1);
    }

    const number = Number(value);

    if (!Number.isFinite(number)) return 0;

    return Math.round(number * multiplier);
}

function formatMoney(value) {
    value = Number(value) || 0;

    if (value >= 1000000000) {
        return `${parseFloat((value / 1000000000).toFixed(2))}B€`;
    }

    if (value >= 1000000) {
        return `${parseFloat((value / 1000000).toFixed(2))}M€`;
    }

    if (value >= 1000) {
        return `${parseFloat((value / 1000).toFixed(2))}K€`;
    }

    return `${Math.round(value)}€`;
}

function randomColor() {
    const colors = [
        "#5865F2",
        "#57F287",
        "#FEE75C",
        "#EB459E",
        "#ED4245",
        "#00B0F4",
        "#9B59B6",
        "#E67E22"
    ];

    return colors[Math.floor(Math.random() * colors.length)];
}

function isAdmin(member) {
    return (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.roles.cache.has(CONFIG.ROLES.ADMIN)
    );
}

function hasRole(member, roleId, roleName) {
    return (
        isAdmin(member) ||
        (roleId && member.roles.cache.has(roleId)) ||
        (roleName && member.roles.cache.some(r => r.name === roleName))
    );
}

function isRegisterStaff(member) {
    return hasRole(
        member,
        CONFIG.ROLES.REGISTER,
        "Kayıt Yetkilisi"
    );
}

function isValueStaff(member) {
    return hasRole(
        member,
        CONFIG.ROLES.VALUE,
        "Değer Yetkilisi"
    );
}

function isMatchStaff(member) {
    return hasRole(member, null, "Maç Yetkilisi");
}

function isGiveawayStaff(member) {
    return hasRole(member, null, "Çekiliş Yetkilisi");
}

function isMediaStaff(member) {
    return hasRole(member, null, "Medya Yetkilisi");
}

function isDMStaff(member) {
    return hasRole(member, null, "DM/SM Yetkilisi");
}

function isChannelStaff(member) {
    return hasRole(member, null, "Kanal Yetkilisi");
}

function isKickStaff(member) {
    return hasRole(member, null, "Kick Yetkilisi");
}

function isBanStaff(member) {
    return hasRole(member, null, "Ban Yetkilisi");
}

function isMuteStaff(member) {
    return hasRole(member, null, "Mute Yetkilisi");
}

async function getOrCreateRole(
    guild,
    name,
    color = "#5865F2",
    hoist = true
) {
    let role = guild.roles.cache.find(r => r.name === name);

    if (!role) {
        role = await guild.roles.create({
            name,
            color,
            hoist,
            reason: "United League otomatik rol sistemi"
        });
    }

    return role;
}

async function ensureMainRoles(guild) {
    await getOrCreateRole(guild, "Kayıtsız", "#747F8D", true);
    await getOrCreateRole(guild, "Futbolcu", "#57F287", true);
    await getOrCreateRole(guild, "Teknik Direktör", "#5865F2", true);
}

function getPlayerMember(guild, userId) {
    return guild.members.cache.get(userId);
}

/* =========================
   SADECE DEĞER KISMI
   DEĞİŞTİRİLİR
========================= */

async function updatePlayerValueNickname(member, newValue) {
    if (!member) return false;

    const oldNickname = member.nickname || member.user.username;

    let parts = oldNickname
        .split("|")
        .map(x => x.trim());

    const valueText = formatMoney(newValue);

    if (parts.length >= 2) {
        const last = parts[parts.length - 1];

        if (/^[\d.,]+\s*[KMB]?\s*€?$/i.test(last)) {
            parts[parts.length - 1] = valueText;
        } else {
            parts.push(valueText);
        }
    } else {
        parts.push(valueText);
    }

    let newNickname = parts.join(" | ");

    if (newNickname.length > 32) {
        const value = valueText;
        const prefix = parts.slice(0, -1).join(" | ");

        newNickname =
            prefix.slice(0, Math.max(1, 32 - value.length - 3)) +
            " | " +
            value;
    }

    try {
        await member.setNickname(newNickname);
        return true;
    } catch (err) {
        console.error("Nickname değiştirilemedi:", err.message);
        return false;
    }
}

/* =========================
   XP / BAŞARIM
========================= */

function addXP(userId, amount) {
    const player = getPlayer(userId);

    player.xp += amount;

    const newLevel = Math.floor(player.xp / 1000) + 1;

    if (newLevel > player.level) {
        player.level = newLevel;
    }
}

function awardAchievement(userId, achievement) {
    const player = getPlayer(userId);

    if (!player.achievements.includes(achievement)) {
        player.achievements.push(achievement);
        addXP(userId, 250);
        return true;
    }

    return false;
}

/* =========================
   LOG
========================= */

async function logAction(guild, title, description) {
    try {
        const channel =
            guild.channels.cache.find(c =>
                c.isTextBased() &&
                [
                    "bot-log",
                    "bot-logs",
                    "logs",
                    "kayıt-log",
                    "log"
                ].includes(c.name.toLowerCase())
            );

        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle(`United League • ${title}`)
            .setDescription(description)
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch {}
}

/* =========================
   KAYIT
========================= */

async function sendRegistrationMessage(message) {
    const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🇹🇷 United League • Kayıt")
        .setDescription(
            "United League'e hoş geldin!\n\n" +
            "Aşağıdaki butonlardan sunucudaki rolünü seçebilirsin.\n\n" +
            "⚽ **Futbolcu**\n" +
            "🎩 **Teknik Direktör**"
        )
        .setFooter({
            text: "United League • Kayıt Sistemi"
        })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("register_player")
            .setLabel("Futbolcu")
            .setEmoji("⚽")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("register_td")
            .setLabel("Teknik Direktör")
            .setEmoji("🎩")
            .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({
        embeds: [embed],
        components: [row]
    });
}

/* =========================
   TAKIM
========================= */

async function createTeam(guild, ownerId, teamName) {
    const already = Object.values(data.teams)
        .find(t => t.ownerId === ownerId);

    if (already) {
        return {
            error: `Zaten **${already.name}** takımına sahipsin.`
        };
    }

    const exists = Object.values(data.teams)
        .find(t =>
            t.name.toLowerCase() === teamName.toLowerCase()
        );

    if (exists) {
        return {
            error: "Bu takım zaten sistemde bulunuyor."
        };
    }

    const role = await guild.roles.create({
        name: teamName,
        color: randomColor(),
        hoist: true,
        reason: "United League takım sistemi"
    });

    const id = `${Date.now()}_${ownerId}`;

    data.teams[id] = {
        id,
        name: teamName,
        ownerId,
        roleId: role.id,
        budget: CONFIG.START_TEAM_BUDGET,
        squad: [],
        formation: "4-3-3",
        company: null,
        sponsor: null,
        stats: {
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            gf: 0,
            ga: 0,
            points: 0
        }
    };

    await guild.members.cache.get(ownerId)?.roles.add(role);

    saveData();

    return {
        team: data.teams[id]
    };
}

function getUserTeam(userId) {
    return Object.values(data.teams)
        .find(t => t.ownerId === userId);
}

function getTeamByMention(message, mention) {
    if (!mention) return null;

    const id = mention.replace(/[<@&>]/g, "");

    return getTeam(id);
}

/* =========================
   FORMASYON
========================= */

const FORMATIONS = [
    "4-3-3",
    "4-2-3-1",
    "4-4-2",
    "3-5-2",
    "3-4-3",
    "5-3-2",
    "5-4-1",
    "4-1-4-1",
    "4-3-2-1",
    "4-2-2-2",
    "3-4-1-2"
];

/* =========================
   KAP / TRANSFER
========================= */

async function createKAP(
    message,
    playerId,
    buyerTeam,
    amount
) {
    const player = getPlayer(playerId);

    const sellerTeam = player.teamId
        ? getTeam(player.teamId)
        : null;

    if (!buyerTeam) {
        return message.reply("❌ Alıcı takım bulunamadı.");
    }

    if (sellerTeam && sellerTeam.id === buyerTeam.id) {
        return message.reply("❌ Oyuncu zaten bu takımda.");
    }

    if (buyerTeam.budget < amount) {
        return message.reply(
            `❌ Takım bütçesi yetersiz. Mevcut bütçe: **${formatMoney(buyerTeam.budget)}**`
        );
    }

    const kapId = `KAP-${Date.now()}`;

    data.transfers.push({
        id: kapId,
        playerId,
        buyerTeamId: buyerTeam.id,
        sellerTeamId: sellerTeam?.id || null,
        amount,
        playerApproved: false,
        buyerApproved: false,
        sellerApproved: sellerTeam ? false : true,
        status: "pending",
        createdAt: Date.now()
    });

    saveData();

    const embed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("📄 United League • KAP")
        .setDescription(
            `**Oyuncu:** <@${playerId}>\n` +
            `**Alıcı:** ${buyerTeam.name}\n` +
            `**Satıcı:** ${sellerTeam ? sellerTeam.name : "Serbest Oyuncu"}\n` +
            `**Bonservis:** ${formatMoney(amount)}\n\n` +
            `Transferin tamamlanması için gerekli onaylar alınmalıdır.`
        )
        .addFields(
            {
                name: "Oyuncu",
                value: "⏳ Bekliyor",
                inline: true
            },
            {
                name: "Alıcı TD",
                value: "⏳ Bekliyor",
                inline: true
            },
            {
                name: "Satıcı TD",
                value: sellerTeam ? "⏳ Bekliyor" : "✅ Gerekli değil",
                inline: true
            }
        )
        .setFooter({
            text: `KAP ID: ${kapId}`
        })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`kap_player_${kapId}`)
            .setLabel("Oyuncu Onayı")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId(`kap_buyer_${kapId}`)
            .setLabel("Alıcı TD")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId(`kap_seller_${kapId}`)
            .setLabel("Satıcı TD")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId(`kap_reject_${kapId}`)
            .setLabel("Reddet")
            .setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({
        embeds: [embed],
        components: [row]
    });

    return null;
}

async function completeKAP(kap, guild) {
    const player = getPlayer(kap.playerId);

    const buyer = getTeam(kap.buyerTeamId);
    const seller = kap.sellerTeamId
        ? getTeam(kap.sellerTeamId)
        : null;

    if (!buyer) return false;

    if (buyer.budget < kap.amount) {
        return false;
    }

    if (seller) {
        seller.squad = seller.squad.filter(
            id => id !== kap.playerId
        );

        seller.budget += kap.amount;
    }

    buyer.budget -= kap.amount;

    if (!buyer.squad.includes(kap.playerId)) {
        buyer.squad.push(kap.playerId);
    }

    player.teamId = buyer.id;

    kap.status = "completed";
    kap.completedAt = Date.now();

    addXP(kap.playerId, 500);

    saveData();

    await logAction(
        guild,
        "Transfer",
        `<@${kap.playerId}> → **${buyer.name}**\n` +
        `Bonservis: **${formatMoney(kap.amount)}**`
    );

    return true;
}

/* =========================
   MAÇ
========================= */

const MATCH_EVENTS = [
    "orta saha mücadelesi",
    "kanattan hızlı bir atak",
    "savunmada kritik müdahale",
    "tehlikeli bir korner",
    "uzaktan şut",
    "kalecinin başarılı kurtarışı",
    "hızlı kontra atak",
    "ceza sahasına gönderilen tehlikeli orta",
    "orta sahada top kapma",
    "savunmanın çizgi halinde yaptığı müdahale",
    "hücum oyuncusunun rakibini geçmesi",
    "teknik bir paslaşma",
    "tehlikeli serbest vuruş",
    "rakip savunmanın topu uzaklaştırması"
];

async function startMatch(message, team1, team2) {
    if (team1.id === team2.id) {
        return message.reply("❌ Aynı takım kendisiyle maç yapamaz.");
    }

    const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("⚽ United League • Maç Başladı")
        .setDescription(
            `🏟️ **${team1.name}** vs **${team2.name}**\n\n` +
            `⏱️ Maç süresi: **5 dakika**\n` +
            `🔢 Skor: **0 - 0**\n\n` +
            `Maç başlıyor...`
        )
        .setTimestamp();

    const sent = await message.channel.send({
        embeds: [embed]
    });

    const state = {
        score1: 0,
        score2: 0,
        seconds: 0,
        lastEvents: [],
        scorers1: [],
        scorers2: []
    };

    const match = {
        id: `MATCH-${Date.now()}`,
        team1: team1.id,
        team2: team2.id,
        score1: 0,
        score2: 0,
        status: "live",
        startedAt: Date.now()
    };

    data.matches.push(match);
    saveData();

    const interval = setInterval(async () => {
        try {
            state.seconds++;

            const attackingTeam =
                Math.random() < 0.5 ? team1 : team2;

            let event =
                MATCH_EVENTS[
                    Math.floor(
                        Math.random() * MATCH_EVENTS.length
                    )
                ];

            let tries = 0;

            while (
                state.lastEvents.includes(event) &&
                tries < 10
            ) {
                event =
                    MATCH_EVENTS[
                        Math.floor(
                            Math.random() * MATCH_EVENTS.length
                        )
                    ];

                tries++;
            }

            state.lastEvents.push(event);

            if (state.lastEvents.length > 5) {
                state.lastEvents.shift();
            }

            let goal = false;

            if (Math.random() < 0.012) {
                goal = true;

                if (attackingTeam.id === team1.id) {
                    state.score1++;
                } else {
                    state.score2++;
                }

                const scorerId =
                    attackingTeam.squad.length
                        ? attackingTeam.squad[
                              Math.floor(
                                  Math.random() *
                                      attackingTeam.squad.length
                              )
                          ]
                        : attackingTeam.ownerId;

                const scorer = getPlayer(scorerId);

                scorer.goals++;
                scorer.matches++;

                addXP(scorerId, 200);
                awardAchievement(scorerId, "İlk Gol");

                if (attackingTeam.id === team1.id) {
                    state.scorers1.push(scorerId);
                } else {
                    state.scorers2.push(scorerId);
                }

                event = `⚽ **GOOOL!** ${attackingTeam.name} golü buldu! <@${scorerId}> ağları havalandırdı!`;
            }

            if (Math.random() < 0.018) {
                const assisterId =
                    attackingTeam.squad.length
                        ? attackingTeam.squad[
                              Math.floor(
                                  Math.random() *
                                      attackingTeam.squad.length
                              )
                          ]
                        : attackingTeam.ownerId;

                getPlayer(assisterId).assists++;
                addXP(assisterId, 100);

                event += `\n🎯 <@${assisterId}> hücumun hazırlanmasında önemli rol oynadı.`;
            }

            const minutes = Math.floor(state.seconds / 60);
            const seconds = String(state.seconds % 60).padStart(2, "0");

            const updated = new EmbedBuilder()
                .setColor(goal ? "#57F287" : "#5865F2")
                .setTitle("⚽ United League • Canlı Maç")
                .setDescription(
                    `🏟️ **${team1.name}** vs **${team2.name}**\n\n` +
                    `# ${state.score1} - ${state.score2}\n\n` +
                    `⏱️ ${minutes}:${seconds}\n\n` +
                    `📢 ${event}`
                )
                .setFooter({
                    text: "United League • Canlı Maç Sistemi"
                })
                .setTimestamp();

            await sent.edit({
                embeds: [updated]
            });

            if (state.seconds >= 300) {
                clearInterval(interval);

                match.score1 = state.score1;
                match.score2 = state.score2;
                match.status = "finished";
                match.finishedAt = Date.now();

                team1.stats.played++;
                team2.stats.played++;

                team1.stats.gf += state.score1;
                team1.stats.ga += state.score2;

                team2.stats.gf += state.score2;
                team2.stats.ga += state.score1;

                if (state.score1 > state.score2) {
                    team1.stats.wins++;
                    team2.stats.losses++;
                    team1.stats.points += 3;
                } else if (state.score2 > state.score1) {
                    team2.stats.wins++;
                    team1.stats.losses++;
                    team2.stats.points += 3;
                } else {
                    team1.stats.draws++;
                    team2.stats.draws++;
                    team1.stats.points++;
                    team2.stats.points++;
                }

                const allPlayers = [
                    ...new Set([
                        ...team1.squad,
                        ...team2.squad
                    ])
                ];

                for (const id of allPlayers) {
                    const p = getPlayer(id);
                    p.matches++;
                    addXP(id, 100);
                    awardAchievement(id, "İlk Maç");
                }

                saveData();

                const finalEmbed = new EmbedBuilder()
                    .setColor("#FEE75C")
                    .setTitle("🏁 United League • Maç Bitti")
                    .setDescription(
                        `🏟️ **${team1.name}** vs **${team2.name}**\n\n` +
                        `# ${state.score1} - ${state.score2}\n\n` +
                        `🏁 **Maç tamamlandı.**`
                    )
                    .addFields(
                        {
                            name: team1.name,
                            value: `⚽ ${state.score1}`,
                            inline: true
                        },
                        {
                            name: team2.name,
                            value: `⚽ ${state.score2}`,
                            inline: true
                        }
                    )
                    .setTimestamp();

                await sent.edit({
                    embeds: [finalEmbed]
                });

                await logAction(
                    message.guild,
                    "Maç",
                    `**${team1.name} ${state.score1}-${state.score2} ${team2.name}**`
                );
            }
        } catch (err) {
            console.error("Maç hatası:", err.message);
            clearInterval(interval);
        }
    }, 1000);
}

/* =========================
   ÇEKİLİŞ
========================= */

function parseDuration(input) {
    if (!input) return 0;

    const text = String(input)
        .toLowerCase()
        .replace(/\s/g, "");

    const match = text.match(
        /^(\d+(?:\.\d+)?)(s|sn|sec|saniye|m|dk|dakika|h|sa|saat|d|g|gün)$/
    );

    if (!match) return 0;

    const number = Number(match[1]);
    const unit = match[2];

    if (
        ["s", "sn", "sec", "saniye"].includes(unit)
    ) return number * 1000;

    if (
        ["m", "dk", "dakika"].includes(unit)
    ) return number * 60000;

    if (
        ["h", "sa", "saat"].includes(unit)
    ) return number * 3600000;

    if (
        ["d", "g", "gün"].includes(unit)
    ) return number * 86400000;

    return 0;
}

async function finishGiveaway(id) {
    const giveaway = data.giveaways[id];

    if (!giveaway || giveaway.finished) return;

    giveaway.finished = true;

    const guild = client.guilds.cache.get(giveaway.guildId);

    if (!guild) return;

    const channel = guild.channels.cache.get(
        giveaway.channelId
    );

    if (!channel) return;

    const members = [
        ...new Set(giveaway.entries || [])
    ];

    if (!members.length) {
        await channel.send(
            `🎁 **Çekiliş sona erdi fakat katılım olmadığı için kazanan çıkmadı.**`
        );

        saveData();
        return;
    }

    const winnerId =
        members[Math.floor(Math.random() * members.length)];

    const prize = giveaway.prize;

    if (prize > 0) {
        getPlayer(winnerId).budget += prize;
    }

    awardAchievement(winnerId, "Çekiliş Kazananı");

    await channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor("#FEE75C")
                .setTitle("🎉 Çekiliş Sonucu")
                .setDescription(
                    `🏆 Kazanan: <@${winnerId}>\n\n` +
                    `🎁 Ödül: **${formatMoney(prize)}**`
                )
                .setTimestamp()
        ]
    });

    saveData();
}

function scheduleGiveaway(id) {
    const giveaway = data.giveaways[id];

    if (!giveaway || giveaway.finished) return;

    const remaining =
        giveaway.endsAt - Date.now();

    if (remaining <= 0) {
        finishGiveaway(id);
        return;
    }

    setTimeout(
        () => finishGiveaway(id),
        Math.min(remaining, 2147483647)
    );
}

/* =========================
   ŞİRKET / SPONSOR
========================= */

const NPC_COMPANIES = {
    Emirates: {
        company: 65,
        sponsor: 65
    },
    Adidas: {
        company: 60,
        sponsor: 75
    },
    Puma: {
        company: 55,
        sponsor: 60
    },
    Nike: {
        company: 50,
        sponsor: 65
    },
    "Coca-Cola": {
        company: 45,
        sponsor: 55
    },
    Pepsi: {
        company: 40,
        sponsor: 50
    },
    "Red Bull": {
        company: 35,
        sponsor: 50
    },
    Mercedes: {
        company: 30,
        sponsor: 45
    }
};

function npcDecision(chance) {
    return Math.random() * 100 <= chance;
}

/* =========================
   REKLAM
========================= */

const AD_PACKAGES = {
    Bronz: 150000,
    Gümüş: 300000,
    Altın: 600000,
    Platin: 1200000,
    Legendary: 2400000,
    Ultimate: 4800000,
    everyone: 100000,
    here: 50000
};

/* =========================
   BOT PROFİLİ
========================= */

async function updateBotPresence() {
    try {
        let invite = process.env.SERVER_INVITE || "";

        const guild = client.guilds.cache.first();

        if (!invite && guild) {
            try {
                const channel =
                    guild.channels.cache.get(
                        CONFIG.ANNOUNCEMENT_CHANNEL_ID
                    ) ||
                    guild.channels.cache.find(
                        c =>
                            c.isTextBased() &&
                            c
                                .permissionsFor(
                                    guild.members.me
                                )
                                ?.has(
                                    PermissionFlagsBits.CreateInstantInvite
                                )
                    );

                if (channel) {
                    const created =
                        await channel.createInvite({
                            maxAge: 0,
                            maxUses: 0,
                            unique: false,
                            reason: "United League bot profili"
                        });

                    invite = `discord.gg/${created.code}`;
                }
            } catch {}
        }

        client.user.setPresence({
            status: "online",
            activities: [
                {
                    name: "United League | Futbol Rp",
                    type: ActivityType.Playing,
                    state: invite
                        ? invite
                        : "United League | Futbol Rp"
                }
            ]
        });
    } catch (err) {
        console.error("Presence hatası:", err.message);
    }
}

/* =========================
   SAAT BAŞI DURUM
========================= */

let lastHourlyStatus = "";

async function sendHourlyStatus() {
    try {
        const now = new Date();

        const key =
            `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;

        if (now.getMinutes() !== 0) return;

        if (lastHourlyStatus === key) return;

        lastHourlyStatus = key;

        const channel = client.channels.cache.get(
            CONFIG.ANNOUNCEMENT_CHANNEL_ID
        );

        if (!channel || !channel.isTextBased()) return;

        const users = client.guilds.cache.reduce(
            (total, guild) =>
                total + (guild.memberCount || 0),
            0
        );

        const ping = client.ws.ping;

        const embed = new EmbedBuilder()
            .setColor("#57F287")
            .setTitle("🤖 United League • Bot Durumu")
            .setDescription(
                "United League botu aktif ve sistemler çalışıyor."
            )
            .addFields(
                {
                    name: "🟢 Durum",
                    value: "**Aktif**",
                    inline: true
                },
                {
                    name: "🏓 Ping",
                    value: `**${ping}ms**`,
                    inline: true
                },
                {
                    name: "🌐 Sunucu",
                    value: `**${client.guilds.cache.size}**`,
                    inline: true
                },
                {
                    name: "👥 Kullanıcı",
                    value: `**${users}**`,
                    inline: true
                },
                {
                    name: "🕐 Saat",
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                    inline: true
                },
                {
                    name: "⚽ Sistem",
                    value: "**United League | Futbol Rp**",
                    inline: true
                }
            )
            .setFooter({
                text: "United League • Her saat başı otomatik durum"
            })
            .setTimestamp();

        await channel.send({
            embeds: [embed]
        });
    } catch (err) {
        console.error("Saatlik durum hatası:", err.message);
    }
}

/* =========================
   READY
========================= */

client.once("ready", async () => {
    console.log(
        `United League bot aktif: ${client.user.tag}`
    );

    for (const guild of client.guilds.cache.values()) {
        try {
            await ensureMainRoles(guild);
        } catch {}
    }

    await updateBotPresence();

    for (const id of Object.keys(data.giveaways)) {
        scheduleGiveaway(id);
    }

    setInterval(async () => {
        await updateBotPresence();
        await sendHourlyStatus();
    }, 20000);

    console.log("Tüm sistemler hazır.");
});

/* =========================
   ÜYE GİRİŞİ
========================= */

client.on("guildMemberAdd", async member => {
    try {
        await ensureMainRoles(member.guild);

        const kayitsiz = member.guild.roles.cache.find(
            r => r.name === "Kayıtsız"
        );

        if (kayitsiz) {
            await member.roles.add(kayitsiz);
        }

        getPlayer(member.id);
        saveData();

        const channel =
            member.guild.channels.cache.get(
                CONFIG.ANNOUNCEMENT_CHANNEL_ID
            );

        const registerChannel =
            member.guild.channels.cache.find(
                c =>
                    c.isTextBased() &&
                    [
                        "kayıt",
                        "kayit",
                        "kayıt-kanalı",
                        "kayit-kanali"
                    ].includes(c.name.toLowerCase())
            );

        const target = registerChannel || channel;

        if (target) {
            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle("👋 Yeni Oyuncu")
                .setDescription(
                    `**${member.user.username}** sunucuya katıldı.\n\n` +
                    `Kayıt Yetkilisi: <@&${CONFIG.ROLES.REGISTER}>`
                )
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            await target.send({
                content: `<@&${CONFIG.ROLES.REGISTER}>`,
                embeds: [embed]
            });
        }
    } catch (err) {
        console.error("Üye giriş hatası:", err.message);
    }
});

/* =========================
   BUTONLAR
========================= */

client.on("interactionCreate", async interaction => {
    try {
        if (!interaction.isButton()) return;

        if (
            interaction.customId === "register_player" ||
            interaction.customId === "register_td"
        ) {
            if (!isRegisterStaff(interaction.member)) {
                return interaction.reply({
                    content:
                        "❌ Bu butonu sadece Kayıt Yetkilisi kullanabilir.",
                    ephemeral: true
                });
            }

            const playerRole =
                await getOrCreateRole(
                    interaction.guild,
                    "Futbolcu",
                    "#57F287",
                    true
                );

            const tdRole =
                await getOrCreateRole(
                    interaction.guild,
                    "Teknik Direktör",
                    "#5865F2",
                    true
                );

            const kayitsiz =
                interaction.guild.roles.cache.find(
                    r => r.name === "Kayıtsız"
                );

            const player =
                getPlayer(interaction.user.id);

            if (interaction.customId === "register_player") {
                await interaction.member.roles.add(playerRole);

                if (kayitsiz) {
                    await interaction.member.roles.remove(
                        kayitsiz
                    );
                }

                player.registered = true;
                player.roleType = "Futbolcu";

                saveData();

                await interaction.reply({
                    content:
                        `⚽ ${interaction.member} artık **Futbolcu** olarak kayıtlı.`,
                    ephemeral: false
                });
            }

            if (interaction.customId === "register_td") {
                await interaction.member.roles.add(tdRole);

                if (kayitsiz) {
                    await interaction.member.roles.remove(
                        kayitsiz
                    );
                }

                player.registered = true;
                player.roleType = "Teknik Direktör";

                saveData();

                await interaction.reply({
                    content:
                        `🎩 ${interaction.member} artık **Teknik Direktör** olarak kayıtlı.`,
                    ephemeral: false
                });
            }

            return;
        }

        if (interaction.customId.startsWith("kap_")) {
            const parts =
                interaction.customId.split("_");

            const type = parts[1];
            const kapId = parts.slice(2).join("_");

            const kap =
                data.transfers.find(
                    t => t.id === kapId
                );

            if (!kap || kap.status !== "pending") {
                return interaction.reply({
                    content:
                        "❌ Bu KAP artık aktif değil.",
                    ephemeral: true
                });
            }

            if (type === "reject") {
                const player = getPlayer(
                    kap.playerId
                );

                const buyer = getTeam(
                    kap.buyerTeamId
                );

                const seller = kap.sellerTeamId
                    ? getTeam(kap.sellerTeamId)
                    : null;

                const allowed =
                    interaction.user.id ===
                        kap.playerId ||
                    interaction.user.id ===
                        buyer?.ownerId ||
                    interaction.user.id ===
                        seller?.ownerId ||
                    isAdmin(interaction.member);

                if (!allowed) {
                    return interaction.reply({
                        content:
                            "❌ Bu KAP'ı reddetme yetkin yok.",
                        ephemeral: true
                    });
                }

                kap.status = "rejected";
                saveData();

                return interaction.reply({
                    content:
                        "❌ KAP reddedildi ve transfer iptal edildi."
                });
            }

            if (type === "player") {
                if (
                    interaction.user.id !==
                    kap.playerId
                ) {
                    return interaction.reply({
                        content:
                            "❌ Bu onayı sadece oyuncu verebilir.",
                        ephemeral: true
                    });
                }

                kap.playerApproved = true;
            }

            if (type === "buyer") {
                const buyer =
                    getTeam(kap.buyerTeamId);

                if (
                    !buyer ||
                    interaction.user.id !==
                        buyer.ownerId
                ) {
                    return interaction.reply({
                        content:
                            "❌ Bu onayı sadece alıcı takımın Teknik Direktörü verebilir.",
                        ephemeral: true
                    });
                }

                kap.buyerApproved = true;
            }

            if (type === "seller") {
                const seller =
                    kap.sellerTeamId
                        ? getTeam(kap.sellerTeamId)
                        : null;

                if (
                    !seller ||
                    interaction.user.id !==
                        seller.ownerId
                ) {
                    return interaction.reply({
                        content:
                            "❌ Bu onayı sadece satıcı takımın Teknik Direktörü verebilir.",
                        ephemeral: true
                    });
                }

                kap.sellerApproved = true;
            }

            if (
                kap.playerApproved &&
                kap.buyerApproved &&
                kap.sellerApproved
            ) {
                const completed =
                    await completeKAP(
                        kap,
                        interaction.guild
                    );

                if (completed) {
                    return interaction.reply({
                        content:
                            "✅ Tüm onaylar tamamlandı. Transfer başarıyla gerçekleşti."
                    });
                }
            }

            saveData();

            return interaction.reply({
                content:
                    "✅ Onay kaydedildi. Diğer onaylar bekleniyor."
            });
        }
    } catch (err) {
        console.error("Interaction hatası:", err.message);

        if (!interaction.replied) {
            try {
                await interaction.reply({
                    content: "❌ İşlem sırasında hata oluştu.",
                    ephemeral: true
                });
            } catch {}
        }
    }
});

/* =========================
   MESAJ KOMUTLARI
========================= */

client.on("messageCreate", async message => {
    try {
        if (!message.guild) return;
        if (message.author.bot) return;

        const content = message.content.trim();

        if (!content.startsWith(CONFIG.PREFIX)) {
            return;
        }

        const parts = content.split(/\s+/);

        const command =
            parts.shift().toLocaleLowerCase("tr-TR");

        const args = parts;

        /* =====================
           PING
        ===================== */

        if (command === ".ping") {
            const start = Date.now();

            const msg = await message.reply("🏓 Pong!");

            const latency =
                Date.now() - start;

            await msg.edit(
                `🏓 **Pong!**\n` +
                `📡 WebSocket: **${client.ws.ping}ms**\n` +
                `💬 Gecikme: **${latency}ms**`
            );

            return;
        }

        /* =====================
           YARDIM
        ===================== */

        if (
            command === ".yardım" ||
            command === ".help"
        ) {
            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle("📚 United League • Komutlar")
                .setDescription(
                    [
                        "**👤 Oyuncu**",
                        "`.k @oyuncu`",
                        "`.profil @oyuncu`",
                        "`.istatistik @oyuncu`",
                        "`.değer @oyuncu`",
                        "`.değerler`",
                        "`.ant` / `.antrenman`",
                        "`.pen` / `.penaltı`",
                        "`.bütçe`",
                        "`.para @oyuncu miktar`",
                        "`.paragönder @oyuncu miktar`",
                        "",
                        "**⚽ Takım**",
                        "`.takımoluştur Takım`",
                        "`.takım`",
                        "`.takımım`",
                        "`.takımlar`",
                        "`.kadro`",
                        "`.kadro @oyuncu`",
                        "`.kadrocikar @oyuncu`",
                        "`.formasyon 4-3-3`",
                        "`.takımbütçe`",
                        "`.takımpara miktar`",
                        "`.takımharca miktar`",
                        "`.takımbütçegönder @takım miktar`",
                        "",
                        "**💰 Değer**",
                        "`.dver @oyuncu 5M`",
                        "`.değersil @oyuncu 2M`",
                        "`.dsil @oyuncu 2M`",
                        "",
                        "**🔄 Transfer**",
                        "`.kap @oyuncu @takım 5M`",
                        "`.transfer @oyuncu @takım 5M`",
                        "`.transferler`",
                        "`.transfergeçmişi`",
                        "",
                        "**🏟️ Maç**",
                        "`.maç @takım1 @takım2`",
                        "`.maçlar`",
                        "`.maçsonucu`",
                        "`.lig`",
                        "`.puan`",
                        "`.golkrallığı`",
                        "`.asistkrallığı`",
                        "`.sezon`",
                        "",
                        "**🎁 Etkinlik**",
                        "`.çekiliş 5M€ 5saat`",
                        "`.yenikazanan`",
                        "",
                        "**🛡️ Moderasyon**",
                        "`.sil 100`",
                        "`.kick @oyuncu`",
                        "`.ban @oyuncu`",
                        "`.mute @oyuncu`",
                        "`.unmute @oyuncu`",
                        "`.kilitle`",
                        "`.kilitaç`",
                        "",
                        "**📢 Medya / DM**",
                        "`.tweet Mesaj`",
                        "`.haber Mesaj`",
                        "`.dm all Mesaj`",
                        "`.dm @oyuncu Mesaj`",
                        "",
                        "**🏢 NPC**",
                        "`.şirketler`",
                        "`.şirketbaşvur Marka`",
                        "`.şirketbaşvurularım`",
                        "`.sponsorlar`",
                        "`.sponsorbaşvur Marka`",
                        "`.sponsorlarım`",
                        "",
                        "**🎫 Ticket**",
                        "`.ticket`",
                        "`.ticketkapat`",
                        "",
                        "**📣 Reklam**",
                        "`.reklampaketleri`",
                        "`.reklam Paket Mesaj`"
                    ].join("\n")
                );

            await message.reply({
                embeds: [embed]
            });

            return;
        }

        /* =====================
           KAYIT
        ===================== */

        if (
            command === ".k" ||
            command === ".kayıt"
        ) {
            if (!isRegisterStaff(message.member)) {
                return message.reply(
                    "❌ Bu komutu sadece **Kayıt Yetkilisi** kullanabilir."
                );
            }

            await sendRegistrationMessage(message);
            return;
        }

        /* =====================
           DEĞER VER
        ===================== */

        if (command === ".dver") {
            if (!isValueStaff(message.member)) {
                return message.reply(
                    "❌ Bu komutu sadece **Değer Yetkilisi** kullanabilir."
                );
            }

            const target =
                message.mentions.members.first();

            const amount =
                parseMoney(args[1]);

            if (!target) {
                return message.reply(
                    "❌ Kullanım: `.dver @oyuncu 5M`"
                );
            }

            if (!amount || amount <= 0) {
                return message.reply(
                    "❌ Geçerli miktar gir."
                );
            }

            const player =
                getPlayer(target.id);

            const oldValue =
                player.value;

            player.value += amount;

            saveData();

            const changed =
                await updatePlayerValueNickname(
                    target,
                    player.value
                );

            await logAction(
                message.guild,
                "Değer Verildi",
                `${target} **${formatMoney(amount)}** değer aldı.\n` +
                `Eski: **${formatMoney(oldValue)}**\n` +
                `Yeni: **${formatMoney(player.value)}**`
            );

            return message.reply(
                `✅ ${target} değerine **${formatMoney(amount)}** eklendi.\n` +
                `💰 **${formatMoney(oldValue)} → ${formatMoney(player.value)}**` +
                (changed
                    ? "\n🏷️ Sadece değer kısmı değiştirildi."
                    : "\n⚠️ Değer değişti fakat takma ad değiştirilemedi.")
            );
        }

        /* =====================
           DEĞER SİL
        ===================== */

        if (
            command === ".değersil" ||
            command === ".dsil"
        ) {
            if (!isValueStaff(message.member)) {
                return message.reply(
                    "❌ Bu komutu sadece **Değer Yetkilisi** kullanabilir."
                );
            }

            const target =
                message.mentions.members.first();

            const amount =
                parseMoney(args[1]);

            if (!target) {
                return message.reply(
                    "❌ Kullanım: `.değersil @oyuncu 2M`"
                );
            }

            if (!amount || amount <= 0) {
                return message.reply(
                    "❌ Geçerli miktar gir."
                );
            }

            const player =
                getPlayer(target.id);

            const oldValue =
                player.value;

            player.value =
                Math.max(
                    0,
                    player.value - amount
                );

            saveData();

            const changed =
                await updatePlayerValueNickname(
                    target,
                    player.value
                );

            await logAction(
                message.guild,
                "Değer Silindi",
                `${target} değerinden **${formatMoney(amount)}** silindi.\n` +
                `Eski: **${formatMoney(oldValue)}**\n` +
                `Yeni: **${formatMoney(player.value)}**`
            );

            return message.reply(
                `✅ ${target} değerinden **${formatMoney(amount)}** silindi.\n` +
                `💰 **${formatMoney(oldValue)} → ${formatMoney(player.value)}**` +
                (changed
                    ? "\n🏷️ Sadece değer kısmı değiştirildi."
                    : "\n⚠️ Değer değişti fakat takma ad değiştirilemedi.")
            );
        }

        /* =====================
           DEĞER GÖR
        ===================== */

        if (command === ".değer") {
            const target =
                message.mentions.members.first() ||
                message.member;

            const player =
                getPlayer(target.id);

            return message.reply(
                `💰 ${target} oyuncusunun değeri: **${formatMoney(player.value)}**`
            );
        }

        /* =====================
           DEĞERLER
        ===================== */

        if (command === ".değerler") {
            const list =
                Object.entries(data.players)
                    .sort(
                        (a, b) =>
                            b[1].value - a[1].value
                    )
                    .slice(0, 10);

            const text = list.length
                ? list.map(
                      ([id, p], i) =>
                          `**${i + 1}.** <@${id}> — **${formatMoney(p.value)}**`
                  ).join("\n")
                : "Henüz oyuncu yok.";

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FEE75C")
                        .setTitle("💰 Değer Sıralaması")
                        .setDescription(text)
                ]
            });
        }

        /* =====================
           ANTRENMAN
        ===================== */

        if (
            command === ".ant" ||
            command === ".antrenman"
        ) {
            const player =
                getPlayer(message.author.id);

            player.training++;

            if (player.training >= 10) {
                player.training = 1;

                player.value +=
                    CONFIG.TRAINING_REWARD;

                addXP(
                    message.author.id,
                    300
                );

                awardAchievement(
                    message.author.id,
                    "Antrenman Ustası"
                );

                saveData();

                const changed =
                    await updatePlayerValueNickname(
                        message.member,
                        player.value
                    );

                return message.reply(
                    `🏋️ **10/10 antrenman tamamlandı!**\n` +
                    `💰 Otomatik değer ödülü: **+${formatMoney(CONFIG.TRAINING_REWARD)}**\n` +
                    `💎 Yeni değer: **${formatMoney(player.value)}**\n` +
                    `📊 Yeni seri: **1/10**` +
                    (changed
                        ? "\n🏷️ Takma addaki sadece değer güncellendi."
                        : "")
                );
            }

            saveData();

            return message.reply(
                `🏋️ Antrenman ilerlemesi: **${player.training}/10**`
            );
        }

        /* =====================
           PENALTI
        ===================== */

        if (
            command === ".pen" ||
            command === ".penaltı"
        ) {
            const player =
                getPlayer(message.author.id);

            const goal =
                Math.random() < 0.65;

            if (!goal) {
                addXP(
                    message.author.id,
                    50
                );

                saveData();

                return message.reply(
                    "❌ **KAÇIRDI!** Top kalenin yanından dışarı çıktı."
                );
            }

            player.penaltyGoals++;
            player.goals++;
            player.value +=
                CONFIG.PENALTY_REWARD;

            addXP(
                message.author.id,
                150
            );

            awardAchievement(
                message.author.id,
                "Penaltı Uzmanı"
            );

            saveData();

            const changed =
                await updatePlayerValueNickname(
                    message.member,
                    player.value
                );

            return message.reply(
                `⚽ **GOOOL!** Penaltı başarıyla gole çevrildi!\n` +
                `💰 Otomatik değer: **+${formatMoney(CONFIG.PENALTY_REWARD)}**\n` +
                `💎 Yeni değer: **${formatMoney(player.value)}**` +
                (changed
                    ? "\n🏷️ Takma addaki sadece değer güncellendi."
                    : "")
            );
        }

        /* =====================
           PROFİL
        ===================== */

        if (command === ".profil") {
            const target =
                message.mentions.members.first() ||
                message.member;

            const player =
                getPlayer(target.id);

            const team =
                player.teamId
                    ? getTeam(player.teamId)
                    : null;

            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle(`👤 ${target.user.username}`)
                .setThumbnail(
                    target.user.displayAvatarURL()
                )
                .addFields(
                    {
                        name: "💰 Değer",
                        value: formatMoney(player.value),
                        inline: true
                    },
                    {
                        name: "💵 Bütçe",
                        value: formatMoney(player.budget),
                        inline: true
                    },
                    {
                        name: "⚽ Takım",
                        value: team
                            ? team.name
                            : "Serbest",
                        inline: true
                    },
                    {
                        name: "🏟️ Maç",
                        value: String(player.matches),
                        inline: true
                    },
                    {
                        name: "⚽ Gol",
                        value: String(player.goals),
                        inline: true
                    },
                    {
                        name: "🎯 Asist",
                        value: String(player.assists),
                        inline: true
                    },
                    {
                        name: "⭐ XP",
                        value: String(player.xp),
                        inline: true
                    },
                    {
                        name: "🏆 Başarım",
                        value: String(
                            player.achievements.length
                        ),
                        inline: true
                    }
                )
                .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        /* =====================
           İSTATİSTİK
        ===================== */

        if (command === ".istatistik") {
            const target =
                message.mentions.members.first() ||
                message.member;

            const p =
                getPlayer(target.id);

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#57F287")
                        .setTitle(
                            `📊 ${target.user.username} • İstatistik`
                        )
                        .addFields(
                            {
                                name: "Maç",
                                value: `${p.matches}`,
                                inline: true
                            },
                            {
                                name: "Gol",
                                value: `${p.goals}`,
                                inline: true
                            },
                            {
                                name: "Asist",
                                value: `${p.assists}`,
                                inline: true
                            },
                            {
                                name: "Penaltı Golü",
                                value: `${p.penaltyGoals}`,
                                inline: true
                            },
                            {
                                name: "Antrenman",
                                value: `${p.training}/10`,
                                inline: true
                            },
                            {
                                name: "XP",
                                value: `${p.xp}`,
                                inline: true
                            }
                        )
                ]
            });
        }

        /* =====================
           OYUNCU BÜTÇE
        ===================== */

        if (command === ".bütçe") {
            const target =
                message.mentions.members.first();

            if (
                target &&
                !isAdmin(message.member)
            ) {
                return message.reply(
                    `💰 Bütçen: **${formatMoney(getPlayer(message.author.id).budget)}**`
                );
            }

            const member =
                target || message.member;

            return message.reply(
                `💰 ${member} bütçesi: **${formatMoney(getPlayer(member.id).budget)}**`
            );
        }

        /* =====================
           PARA VER
        ===================== */

        if (command === ".para") {
            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Bu komutu sadece yönetici kullanabilir."
                );
            }

            const target =
                message.mentions.members.first();

            const amount =
                parseMoney(args[1]);

            if (!target || amount <= 0) {
                return message.reply(
                    "❌ Kullanım: `.para @oyuncu 5M`"
                );
            }

            getPlayer(target.id).budget += amount;

            saveData();

            return message.reply(
                `💵 ${target} hesabına **${formatMoney(amount)}** eklendi.`
            );
        }

        /* =====================
           PARA GÖNDER
        ===================== */

        if (command === ".paragönder") {
            const target =
                message.mentions.members.first();

            const amount =
                parseMoney(args[1]);

            if (
                !target ||
                target.id === message.author.id ||
                amount <= 0
            ) {
                return message.reply(
                    "❌ Kullanım: `.paragönder @oyuncu 5M`"
                );
            }

            const sender =
                getPlayer(message.author.id);

            if (sender.budget < amount) {
                return message.reply(
                    "❌ Yeterli bütçen yok."
                );
            }

            sender.budget -= amount;

            getPlayer(target.id).budget += amount;

            saveData();

            return message.reply(
                `💸 ${target} kullanıcısına **${formatMoney(amount)}** gönderildi.`
            );
        }

        /* =====================
           TAKIM OLUŞTUR
        ===================== */

        if (command === ".takımoluştur") {
            const tdRole =
                message.guild.roles.cache.find(
                    r => r.name === "Teknik Direktör"
                );

            if (
                !tdRole ||
                !message.member.roles.cache.has(
                    tdRole.id
                )
            ) {
                return message.reply(
                    "❌ Takım oluşturmak için **Teknik Direktör** olmalısın."
                );
            }

            const teamName =
                args.join(" ").trim();

            if (!teamName) {
                return message.reply(
                    "❌ Kullanım: `.takımoluştur Galatasaray`"
                );
            }

            const result =
                await createTeam(
                    message.guild,
                    message.author.id,
                    teamName
                );

            if (result.error) {
                return message.reply(
                    `❌ ${result.error}`
                );
            }

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#57F287")
                        .setTitle("⚽ Takım Oluşturuldu")
                        .setDescription(
                            `🏟️ **${result.team.name}**\n\n` +
                            `👤 Teknik Direktör: ${message.member}\n` +
                            `💰 Başlangıç bütçesi: **${formatMoney(result.team.budget)}**\n` +
                            `📋 Formasyon: **${result.team.formation}**`
                        )
                        .setTimestamp()
                ]
            });
        }

        /* =====================
           TAKIM
        ===================== */

        if (
            command === ".takım" ||
            command === ".takımım"
        ) {
            const team =
                getUserTeam(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Bir takımın yok."
                );
            }

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#5865F2")
                        .setTitle(
                            `⚽ ${team.name}`
                        )
                        .addFields(
                            {
                                name: "🎩 TD",
                                value: `<@${team.ownerId}>`,
                                inline: true
                            },
                            {
                                name: "💰 Bütçe",
                                value: formatMoney(team.budget),
                                inline: true
                            },
                            {
                                name: "📋 Formasyon",
                                value: team.formation,
                                inline: true
                            },
                            {
                                name: "👥 Kadro",
                                value: `${team.squad.length} oyuncu`,
                                inline: true
                            },
                            {
                                name: "🏆 Puan",
                                value: `${team.stats.points}`,
                                inline: true
                            },
                            {
                                name: "⚽ Averaj",
                                value: `${team.stats.gf}-${team.stats.ga}`,
                                inline: true
                            }
                        )
                ]
            });
        }

        /* =====================
           TAKIMLAR
        ===================== */

        if (command === ".takımlar") {
            const teams =
                Object.values(data.teams);

            const text = teams.length
                ? teams.map(
                      (t, i) =>
                          `**${i + 1}.** ${t.name} — ${formatMoney(t.budget)}`
                  ).join("\n")
                : "Henüz takım oluşturulmadı.";

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#5865F2")
                        .setTitle("🏟️ United League • Takımlar")
                        .setDescription(text)
                ]
            });
        }

        /* =====================
           FORMASYON
        ===================== */

        if (command === ".formasyon") {
            const team =
                getUserTeam(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Bir takımın yok."
                );
            }

            if (!args[0]) {
                return message.reply(
                    `📋 Mevcut formasyonun: **${team.formation}**\n\n` +
                    `Geçerli formasyonlar:\n${FORMATIONS.join(" • ")}`
                );
            }

            const formation =
                args[0].replace(/\s/g, "");

            if (!FORMATIONS.includes(formation)) {
                return message.reply(
                    `❌ Geçersiz formasyon.\n\nGeçerli: ${FORMATIONS.join(" • ")}`
                );
            }

            team.formation = formation;

            saveData();

            return message.reply(
                `✅ **${team.name}** formasyonu **${formation}** olarak ayarlandı.`
            );
        }

        /* =====================
           KADRO
        ===================== */

        if (command === ".kadro") {
            const team =
                getUserTeam(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Bir takımın yok."
                );
            }

            if (!args[0]) {
                const players =
                    team.squad.length
                        ? team.squad.map(
                              (id, i) =>
                                  `**${i + 1}.** <@${id}>`
                          ).join("\n")
                        : "Kadro boş.";

                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#5865F2")
                            .setTitle(
                                `📋 ${team.name} • Kadro`
                            )
                            .setDescription(
                                `📐 **Formasyon:** ${team.formation}\n\n${players}`
                            )
                    ]
                });
            }

            if (message.mentions.members.size === 0) {
                return message.reply(
                    "❌ Oyuncuyu etiketle."
                );
            }

            const target =
                message.mentions.members.first();

            if (
                message.author.id !==
                team.ownerId &&
                !isAdmin(message.member)
            ) {
                return message.reply(
                    "❌ Kadroyu sadece takımın Teknik Direktörü düzenleyebilir."
                );
            }

            if (
                !team.squad.includes(
                    target.id
                )
            ) {
                team.squad.push(target.id);
            }

            getPlayer(target.id).teamId =
                team.id;

            saveData();

            return message.reply(
                `✅ ${target} **${team.name}** kadrosuna eklendi.`
            );
        }

        /* =====================
           KADRO ÇIKAR
        ===================== */

        if (command === ".kadrocikar") {
            const team =
                getUserTeam(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Bir takımın yok."
                );
            }

            if (
                message.author.id !==
                team.ownerId &&
                !isAdmin(message.member)
            ) {
                return message.reply(
                    "❌ Bu işlem için takım TD'si olmalısın."
                );
            }

            const target =
                message.mentions.members.first();

            if (!target) {
                return message.reply(
                    "❌ Oyuncuyu etiketle."
                );
            }

            team.squad =
                team.squad.filter(
                    id => id !== target.id
                );

            const player =
                getPlayer(target.id);

            if (player.teamId === team.id) {
                player.teamId = null;
            }

            saveData();

            return message.reply(
                `✅ ${target} **${team.name}** kadrosundan çıkarıldı.`
            );
        }

        /* =====================
           TAKIM BÜTÇE
        ===================== */

        if (command === ".takımbütçe") {
            const team =
                getUserTeam(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Bir takımın yok."
                );
            }

            return message.reply(
                `💰 **${team.name}** takım bütçesi: **${formatMoney(team.budget)}**`
            );
        }

        /* =====================
           TAKIM PARA
        ===================== */

        if (command === ".takımpara") {
            const team =
                getUserTeam(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Bir takımın yok."
                );
            }

            const amount =
                parseMoney(args[0]);

            if (
                message.author.id !==
                team.ownerId &&
                !isAdmin(message.member)
            ) {
                return message.reply(
                    "❌ Takım bütçesini sadece Teknik Direktör kullanabilir."
                );
            }

            if (amount <= 0) {
                return message.reply(
                    "❌ Geçerli miktar gir."
                );
            }

            team.budget += amount;

            saveData();

            return message.reply(
                `💰 **${formatMoney(amount)}** takım bütçesine eklendi.`
            );
        }

        /* =====================
           TAKIM HARCAMA
        ===================== */

        if (command === ".takımharca") {
            const team =
                getUserTeam(message.author.id);

            if (!team) {
                return message.reply(
                    "❌ Bir takımın yok."
                );
            }

            const amount =
                parseMoney(args[0]);

            if (
                message.author.id !==
                team.ownerId &&
                !isAdmin(message.member)
            ) {
                return message.reply(
                    "❌ Takım bütçesini sadece Teknik Direktör kullanabilir."
                );
            }

            if (
                amount <= 0 ||
                team.budget < amount
            ) {
                return message.reply(
                    "❌ Yetersiz takım bütçesi."
                );
            }

            team.budget -= amount;

            saveData();

            return message.reply(
                `💸 Takım bütçesinden **${formatMoney(amount)}** harcandı.`
            );
        }

        /* =====================
           TAKIM BÜTÇE GÖNDER
        ===================== */

        if (command === ".takımbütçegönder") {
            const sender =
                getUserTeam(message.author.id);

            if (!sender) {
                return message.reply(
                    "❌ Bir takımın yok."
                );
            }

            if (
                message.author.id !==
                sender.ownerId &&
                !isAdmin(message.member)
            ) {
                return message.reply(
                    "❌ Sadece takım TD'si kullanabilir."
                );
            }

            const targetMention =
                message.mentions.roles.first();

            const amount =
                parseMoney(
                    args[args.length - 1]
                );

            let targetTeam = null;

            if (targetMention) {
                targetTeam =
                    Object.values(data.teams)
                        .find(
                            t =>
                                t.roleId ===
                                targetMention.id
                        );
            }

            if (!targetTeam) {
                const name =
                    args
                        .slice(
                            0,
                            args.length - 1
                        )
                        .join(" ");

                targetTeam =
                    Object.values(data.teams)
                        .find(
                            t =>
                                t.name.toLowerCase() ===
                                name.toLowerCase()
                        );
            }

            if (!targetTeam) {
                return message.reply(
                    "❌ Hedef takım bulunamadı."
                );
            }

            if (
                targetTeam.id === sender.id
            ) {
                return message.reply(
                    "❌ Aynı takıma para gönderemezsin."
                );
            }

            if (
                amount <= 0 ||
                sender.budget < amount
            ) {
                return message.reply(
                    "❌ Yetersiz bütçe."
                );
            }

            sender.budget -= amount;
            targetTeam.budget += amount;

            saveData();

            return message.reply(
                `💸 **${sender.name}** → **${targetTeam.name}**\n` +
                `💰 Gönderilen: **${formatMoney(amount)}**`
            );
        }

        /* =====================
           TRANSFER / KAP
        ===================== */

        if (
            command === ".kap" ||
            command === ".transfer"
        ) {
            const target =
                message.mentions.members.first();

            const teamMention =
                message.mentions.roles.first();

            const amount =
                parseMoney(
                    args[args.length - 1]
                );

            if (!target || amount <= 0) {
                return message.reply(
                    `❌ Kullanım: \`${command} @oyuncu @takım 5M\``
                );
            }

            let buyerTeam = null;

            if (teamMention) {
                buyerTeam =
                    Object.values(data.teams)
                        .find(
                            t =>
                                t.roleId ===
                                teamMention.id
                        );
            }

            if (!buyerTeam) {
                const possibleName =
                    args
                        .slice(
                            1,
                            args.length - 1
                        )
                        .join(" ");

                buyerTeam =
                    Object.values(data.teams)
                        .find(
                            t =>
                                t.name.toLowerCase() ===
                                possibleName.toLowerCase()
                        );
            }

            if (!buyerTeam) {
                return message.reply(
                    "❌ Alıcı takım bulunamadı."
                );
            }

            if (
                message.author.id !==
                    buyerTeam.ownerId &&
                !isAdmin(message.member)
            ) {
                return message.reply(
                    "❌ KAP'ı alıcı takımın Teknik Direktörü başlatabilir."
                );
            }

            await createKAP(
                message,
                target.id,
                buyerTeam,
                amount
            );

            return;
        }

        /* =====================
           TRANSFERLER
        ===================== */

        if (command === ".transferler") {
            const pending =
                data.transfers.filter(
                    t =>
                        t.status ===
                        "pending"
                );

            if (!pending.length) {
                return message.reply(
                    "📄 Aktif KAP bulunmuyor."
                );
            }

            const text =
                pending
                    .slice(-10)
                    .map(t => {
                        const buyer =
                            getTeam(
                                t.buyerTeamId
                            );

                        return `**${t.id}** • <@${t.playerId}> → **${buyer?.name || "?"}** • ${formatMoney(t.amount)}`;
                    })
                    .join("\n");

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FEE75C")
                        .setTitle(
                            "📄 Aktif Transferler"
                        )
                        .setDescription(text)
                ]
            });
        }

        /* =====================
           TRANSFER GEÇMİŞİ
        ===================== */

        if (
            command === ".transfergeçmişi"
        ) {
            const completed =
                data.transfers.filter(
                    t =>
                        t.status ===
                        "completed"
                );

            const text =
                completed.length
                    ? completed
                          .slice(-10)
                          .reverse()
                          .map(t => {
                              const buyer =
                                  getTeam(
                                      t.buyerTeamId
                                  );

                              return `<@${t.playerId}> → **${buyer?.name || "?"}** — ${formatMoney(t.amount)}`;
                          })
                          .join("\n")
                    : "Transfer geçmişi boş.";

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#5865F2")
                        .setTitle(
                            "📜 Transfer Geçmişi"
                        )
                        .setDescription(text)
                ]
            });
        }

        /* =====================
           MAÇ
        ===================== */

        if (command === ".maç") {
            if (
                !isMatchStaff(message.member)
            ) {
                return message.reply(
                    "❌ Bu komutu sadece Maç Yetkilisi kullanabilir."
                );
            }

            const roles =
                [...message.mentions.roles.values()];

            if (roles.length < 2) {
                return message.reply(
                    "❌ Kullanım: `.maç @takım1 @takım2`"
                );
            }

            const team1 =
                Object.values(data.teams)
                    .find(
                        t =>
                            t.roleId ===
                            roles[0].id
                    );

            const team2 =
                Object.values(data.teams)
                    .find(
                        t =>
                            t.roleId ===
                            roles[1].id
                    );

            if (!team1 || !team2) {
                return message.reply(
                    "❌ Takımlardan biri bulunamadı."
                );
            }

            await startMatch(
                message,
                team1,
                team2
            );

            return;
        }

        /* =====================
           MAÇLAR
        ===================== */

        if (command === ".maçlar") {
            const matches =
                data.matches
                    .slice(-10)
                    .reverse();

            const text =
                matches.length
                    ? matches.map(m => {
                          const t1 =
                              getTeam(m.team1);

                          const t2 =
                              getTeam(m.team2);

                          return `⚽ **${t1?.name || "?"} ${m.score1}-${m.score2} ${t2?.name || "?"}**`;
                      }).join("\n")
                    : "Henüz maç oynanmadı.";

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#5865F2")
                        .setTitle(
                            "🏟️ Son Maçlar"
                        )
                        .setDescription(text)
                ]
            });
        }

        /* =====================
           MAÇ SONUCU
        ===================== */

        if (command === ".maçsonucu") {
            const match =
                data.matches
                    .filter(
                        m =>
                            m.status ===
                            "finished"
                    )
                    .at(-1);

            if (!match) {
                return message.reply(
                    "❌ Henüz tamamlanan maç yok."
                );
            }

            const t1 =
                getTeam(match.team1);

            const t2 =
                getTeam(match.team2);

            return message.reply(
                `🏁 **${t1?.name} ${match.score1}-${match.score2} ${t2?.name}**`
            );
        }

        /* =====================
           LİG
        ===================== */

        if (
            command === ".lig" ||
            command === ".puan"
        ) {
            const teams =
                Object.values(data.teams)
                    .sort(
                        (a, b) =>
                            b.stats.points -
                            a.stats.points ||
                            (b.stats.gf -
                                b.stats.ga) -
                            (a.stats.gf -
                                a.stats.ga)
                    );

            const text =
                teams.length
                    ? teams.map(
                          (t, i) =>
                              `**${i + 1}. ${t.name}** — ${t.stats.points} puan | ${t.stats.gf}:${t.stats.ga}`
                      ).join("\n")
                    : "Henüz takım yok.";

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FEE75C")
                        .setTitle(
                            "🏆 United League • Puan Durumu"
                        )
                        .setDescription(text)
                ]
            });
        }

        /* =====================
           GOL KRALLIĞI
        ===================== */

        if (command === ".golkrallığı") {
            const players =
                Object.entries(data.players)
                    .sort(
                        (a, b) =>
                            b[1].goals -
                            a[1].goals
                    )
                    .slice(0, 10);

            const text =
                players.length
                    ? players.map(
                          ([id, p], i) =>
                              `**${i + 1}.** <@${id}> — **${p.goals} gol**`
                      ).join("\n")
                    : "Henüz gol istatistiği yok.";

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#57F287")
                        .setTitle(
                            "⚽ Gol Krallığı"
                        )
                        .setDescription(text)
                ]
            });
        }

        /* =====================
           ASİST KRALLIĞI
        ===================== */

        if (command === ".asistkrallığı") {
            const players =
                Object.entries(data.players)
                    .sort(
                        (a, b) =>
                            b[1].assists -
                            a[1].assists
                    )
                    .slice(0, 10);

            const text =
                players.length
                    ? players.map(
                          ([id, p], i) =>
                              `**${i + 1}.** <@${id}> — **${p.assists} asist**`
                      ).join("\n")
                    : "Henüz asist istatistiği yok.";

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#5865F2")
                        .setTitle(
                            "🎯 Asist Krallığı"
                        )
                        .setDescription(text)
                ]
            });
        }

        /* =====================
           SEZON
        ===================== */

        if (command === ".sezon") {
            const days =
                Math.floor(
                    (Date.now() -
                        data.season.startedAt) /
                        86400000
                );

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FEE75C")
                        .setTitle(
                            "🏆 United League • Sezon"
                        )
                        .setDescription(
                            `📅 Sezon: **${data.season.number}**\n` +
                            `⏱️ Sezon süresi: **${days} gün**`
                        )
                ]
            });
        }

        /* =====================
           ÇEKİLİŞ
        ===================== */

        if (command === ".çekiliş") {
            if (
                !isGiveawayStaff(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ Bu komutu sadece Çekiliş Yetkilisi kullanabilir."
                );
            }

            const prize =
                parseMoney(args[0]);

            const duration =
                parseDuration(
                    args.slice(1).join("")
                );

            if (
                prize <= 0 ||
                duration <= 0
            ) {
                return message.reply(
                    "❌ Kullanım: `.çekiliş 5M€ 5saat`"
                );
            }

            const id =
                `GW-${Date.now()}`;

            data.giveaways[id] = {
                id,
                guildId:
                    message.guild.id,
                channelId:
                    message.channel.id,
                prize,
                endsAt:
                    Date.now() +
                    duration,
                entries: [],
                finished: false
            };

            saveData();

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                `giveaway_${id}`
                            )
                            .setLabel(
                                "Katıl"
                            )
                            .setEmoji("🎉")
                            .setStyle(
                                ButtonStyle.Success
                            )
                    );

            const embed =
                new EmbedBuilder()
                    .setColor("#FEE75C")
                    .setTitle(
                        "🎁 United League • Çekiliş"
                    )
                    .setDescription(
                        `🎁 Ödül: **${formatMoney(prize)}**\n\n` +
                        `⏰ Bitiş: <t:${Math.floor((Date.now() + duration) / 1000)}:R>\n\n` +
                        `Katılmak için aşağıdaki butona bas.`
                    )
                    .setTimestamp();

            await message.channel.send({
                embeds: [embed],
                components: [row]
            });

            scheduleGiveaway(id);

            return;
        }

        /* =====================
           ÇEKİLİŞ BUTONU
        ===================== */

        if (
            command === ".yenikazanan"
        ) {
            if (
                !isGiveawayStaff(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ Çekiliş Yetkilisi gerekli."
                );
            }

            const finished =
                Object.values(
                    data.giveaways
                )
                    .filter(
                        g =>
                            g.guildId ===
                                message.guild.id &&
                            g.finished &&
                            g.entries?.length
                    )
                    .at(-1);

            if (!finished) {
                return message.reply(
                    "❌ Yeniden seçilecek çekiliş bulunamadı."
                );
            }

            const winner =
                finished.entries[
                    Math.floor(
                        Math.random() *
                            finished.entries.length
                    )
                ];

            getPlayer(winner).budget +=
                finished.prize;

            saveData();

            return message.reply(
                `🎉 Yeni kazanan: <@${winner}>`
            );
        }

        /* =====================
           TICKET
        ===================== */

        if (command === ".ticket") {
            const existing =
                message.guild.channels.cache.find(
                    c =>
                        c.type ===
                            ChannelType.GuildText &&
                        c.name ===
                            `ticket-${message.author.id}`
                );

            if (existing) {
                return message.reply(
                    `❌ Zaten açık ticketin var: ${existing}`
                );
            }

            const channel =
                await message.guild.channels.create(
                    {
                        name:
                            `ticket-${message.author.id}`,
                        type:
                            ChannelType.GuildText,
                        permissionOverwrites: [
                            {
                                id:
                                    message.guild
                                        .roles
                                        .everyone.id,
                                deny: [
                                    PermissionFlagsBits.ViewChannel
                                ]
                            },
                            {
                                id:
                                    message.author.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            }
                        ]
                    }
                );

            await channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#5865F2")
                        .setTitle(
                            "🎫 United League • Ticket"
                        )
                        .setDescription(
                            `${message.author}, destek talebini buraya yaz.\n\n` +
                            "Kapatmak için `.ticketkapat` kullan."
                        )
                ]
            });

            return message.reply(
                `🎫 Ticket oluşturuldu: ${channel}`
            );
        }

        /* =====================
           TICKET KAPAT
        ===================== */

        if (command === ".ticketkapat") {
            if (
                !message.channel.name.startsWith(
                    "ticket-"
                )
            ) {
                return message.reply(
                    "❌ Bu kanal bir ticket değil."
                );
            }

            await message.reply(
                "🔒 Ticket kapatılıyor..."
            );

            setTimeout(
                () =>
                    message.channel
                        .delete()
                        .catch(() => {}),
                1500
            );

            return;
        }

        /* =====================
           SİL
        ===================== */

        if (command === ".sil") {
            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Bu komutu sadece yönetici kullanabilir."
                );
            }

            let amount =
                parseInt(args[0]);

            if (
                !Number.isInteger(amount) ||
                amount < 1
            ) {
                return message.reply(
                    "❌ Kullanım: `.sil 100`"
                );
            }

            amount =
                Math.min(amount, 1000);

            let remaining = amount;

            while (remaining > 0) {
                const chunk =
                    Math.min(
                        remaining,
                        100
                    );

                const deleted =
                    await message.channel.bulkDelete(
                        chunk,
                        true
                    );

                remaining -= deleted.size;

                if (deleted.size === 0) break;

                if (remaining > 0) {
                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                700
                            )
                    );
                }
            }

            const notice =
                await message.channel.send(
                    `🗑️ **${amount}** mesaja kadar silme işlemi tamamlandı.`
                );

            setTimeout(
                () =>
                    notice
                        .delete()
                        .catch(() => {}),
                3000
            );

            return;
        }

        /* =====================
           KİLİTLE
        ===================== */

        if (command === ".kilitle") {
            if (
                !isChannelStaff(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ Kanal Yetkilisi gerekli."
                );
            }

            await message.channel.permissionOverwrites.edit(
                message.guild.roles.everyone,
                {
                    SendMessages: false
                }
            );

            return message.reply(
                "🔒 Kanal kilitlendi."
            );
        }

        /* =====================
           KİLİT AÇ
        ===================== */

        if (command === ".kilitaç") {
            if (
                !isChannelStaff(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ Kanal Yetkilisi gerekli."
                );
            }

            await message.channel.permissionOverwrites.edit(
                message.guild.roles.everyone,
                {
                    SendMessages: null
                }
            );

            return message.reply(
                "🔓 Kanalın kilidi açıldı."
            );
        }

        /* =====================
           KICK
        ===================== */

        if (command === ".kick") {
            if (
                !isKickStaff(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ Kick Yetkilisi gerekli."
                );
            }

            const target =
                message.mentions.members.first();

            if (!target) {
                return message.reply(
                    "❌ Oyuncuyu etiketle."
                );
            }

            await target.kick(
                `United League • ${message.author.tag}`
            );

            return message.reply(
                `👢 ${target.user.tag} sunucudan atıldı.`
            );
        }

        /* =====================
           BAN
        ===================== */

        if (command === ".ban") {
            if (
                !isBanStaff(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ Ban Yetkilisi gerekli."
                );
            }

            const target =
                message.mentions.members.first();

            if (!target) {
                return message.reply(
                    "❌ Oyuncuyu etiketle."
                );
            }

            await target.ban({
                reason:
                    `United League • ${message.author.tag}`
            });

            return message.reply(
                `🔨 ${target.user.tag} banlandı.`
            );
        }

        /* =====================
           MUTE
        ===================== */

        if (command === ".mute") {
            if (
                !isMuteStaff(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ Mute Yetkilisi gerekli."
                );
            }

            const target =
                message.mentions.members.first();

            if (!target) {
                return message.reply(
                    "❌ Oyuncuyu etiketle."
                );
            }

            const muted =
                await getOrCreateRole(
                    message.guild,
                    "Muted",
                    "#747F8D",
                    false
                );

            await target.roles.add(muted);

            for (
                const channel
                of message.guild.channels.cache.values()
            ) {
                if (
                    channel.type ===
                    ChannelType.GuildText
                ) {
                    await channel.permissionOverwrites
                        .edit(
                            muted,
                            {
                                SendMessages: false,
                                AddReactions: false
                            }
                        )
                        .catch(() => {});
                }
            }

            return message.reply(
                `🔇 ${target} susturuldu.`
            );
        }

        /* =====================
           UNMUTE
        ===================== */

        if (command === ".unmute") {
            if (
                !isMuteStaff(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ Mute Yetkilisi gerekli."
                );
            }

            const target =
                message.mentions.members.first();

            if (!target) {
                return message.reply(
                    "❌ Oyuncuyu etiketle."
                );
            }

            const muted =
                message.guild.roles.cache.find(
                    r => r.name === "Muted"
                );

            if (muted) {
                await target.roles.remove(
                    muted
                );
            }

            return message.reply(
                `🔊 ${target} susturması kaldırıldı.`
            );
        }

        /* =====================
           EMBED
        ===================== */

        if (command === ".embed") {
            if (!isAdmin(message.member)) {
                return message.reply(
                    "❌ Bu komutu sadece yönetici kullanabilir."
                );
            }

            const text =
                args.join(" ");

            const split =
                text.split("|");

            const title =
                split.shift()?.trim() ||
                "United League";

            const description =
                split.join("|").trim() ||
                "United League";

            return message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#5865F2")
                        .setTitle(title)
                        .setDescription(
                            description
                        )
                        .setTimestamp()
                ]
            });
        }

        /* =====================
           TWEET
        ===================== */

        if (command === ".tweet") {
            if (
                !isMediaStaff(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ Medya Yetkilisi gerekli."
                );
            }

            const text =
                args.join(" ");

            const embed =
                new EmbedBuilder()
                    .setColor("#5865F2")
                    .setTitle(
                        "🐦 United League • Tweet"
                    )
                    .setDescription(
                        text ||
                            "United League"
                    )
                    .setTimestamp();

            const attachment =
                message.attachments.first();

            if (
                attachment &&
                attachment.contentType?.startsWith(
                    "image/"
                )
            ) {
                embed.setImage(
                    attachment.url
                );
            }

            return message.channel.send({
                embeds: [embed]
            });
        }

        /* =====================
           HABER
        ===================== */

        if (command === ".haber") {
            if (
                !isMediaStaff(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ Medya Yetkilisi gerekli."
                );
            }

            const text =
                args.join(" ");

            return message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#ED4245")
                        .setTitle(
                            "📰 United League • Son Dakika"
                        )
                        .setDescription(
                            text
                        )
                        .setTimestamp()
                ]
            });
        }

        /* =====================
           DM
        ===================== */

        if (command === ".dm") {
            if (
                !isDMStaff(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ DM/SM Yetkilisi gerekli."
                );
            }

            const targetText =
                args.shift();

            const dmText =
                args.join(" ");

            if (
                !targetText ||
                !dmText
            ) {
                return message.reply(
                    "❌ Kullanım: `.dm all Mesaj` veya `.dm @oyuncu Mesaj`"
                );
            }

            const embed =
                new EmbedBuilder()
                    .setColor("#5865F2")
                    .setTitle(
                        "United League"
                    )
                    .setDescription(
                        dmText
                    )
                    .setFooter({
                        text:
                            "United League • Resmî Bildirim"
                    })
                    .setTimestamp();

            if (
                targetText.toLowerCase() ===
                "all"
            ) {
                let sent = 0;

                for (
                    const member
                    of message.guild.members.cache.values()
                ) {
                    if (
                        member.user.bot
                    ) continue;

                    try {
                        await member.send({
                            embeds: [embed]
                        });

                        sent++;
                    } catch {}

                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                100
                            )
                    );
                }

                return message.reply(
                    `📨 DM gönderimi tamamlandı. Başarılı: **${sent}**`
                );
            }

            const target =
                message.mentions.members.first();

            if (!target) {
                return message.reply(
                    "❌ Oyuncuyu etiketle."
                );
            }

            try {
                await target.send({
                    embeds: [embed]
                });

                return message.reply(
                    `📨 ${target} kullanıcısına DM gönderildi.`
                );
            } catch {
                return message.reply(
                    "❌ Kullanıcının DM'leri kapalı."
                );
            }
        }

        /* =====================
           ŞİRKETLER
        ===================== */

        if (command === ".şirketler") {
            const text =
                Object.entries(
                    NPC_COMPANIES
                ).map(
                    ([name, info]) =>
                        `🏢 **${name}** — Şirket: **%${info.company}** | Sponsor: **%${info.sponsor}**`
                ).join("\n");

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FEE75C")
                        .setTitle(
                            "🏢 NPC Şirketleri"
                        )
                        .setDescription(text)
                ]
            });
        }

        /* =====================
           ŞİRKET BAŞVURU
        ===================== */

        if (
            command === ".şirketbaşvur"
        ) {
            const team =
                getUserTeam(
                    message.author.id
                );

            if (!team) {
                return message.reply(
                    "❌ Şirket başvurusu için takımın olmalı."
                );
            }

            const name =
                args.join(" ");

            const company =
                NPC_COMPANIES[name];

            if (!company) {
                return message.reply(
                    "❌ Böyle bir NPC şirketi yok."
                );
            }

            const accepted =
                npcDecision(
                    company.company
                );

            if (!accepted) {
                return message.reply(
                    `❌ **${name}** şirketi başvurunu reddetti.`
                );
            }

            team.company = name;

            saveData();

            return message.reply(
                `🏢 **${name}** şirketi **${team.name}** ile anlaşma yaptı!`
            );
        }

        /* =====================
           ŞİRKET BAŞVURULARIM
        ===================== */

        if (
            command ===
            ".şirketbaşvurularım"
        ) {
            const team =
                getUserTeam(
                    message.author.id
                );

            return message.reply(
                team?.company
                    ? `🏢 Şirketin: **${team.company}**`
                    : "🏢 Henüz şirket anlaşman yok."
            );
        }

        /* =====================
           SPONSORLAR
        ===================== */

        if (command === ".sponsorlar") {
            const text =
                Object.entries(
                    NPC_COMPANIES
                ).map(
                    ([name, info]) =>
                        `🤝 **${name}** — Sponsor şansı: **%${info.sponsor}**`
                ).join("\n");

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#57F287")
                        .setTitle(
                            "🤝 NPC Sponsorları"
                        )
                        .setDescription(text)
                ]
            });
        }

        /* =====================
           SPONSOR BAŞVURU
        ===================== */

        if (
            command === ".sponsorbaşvur"
        ) {
            const team =
                getUserTeam(
                    message.author.id
                );

            if (!team) {
                return message.reply(
                    "❌ Sponsor başvurusu için takımın olmalı."
                );
            }

            const name =
                args.join(" ");

            const sponsor =
                NPC_COMPANIES[name];

            if (!sponsor) {
                return message.reply(
                    "❌ Böyle bir NPC sponsoru yok."
                );
            }

            const accepted =
                npcDecision(
                    sponsor.sponsor
                );

            if (!accepted) {
                return message.reply(
                    `❌ **${name}** sponsorluğu başvurunu reddetti.`
                );
            }

            team.sponsor = name;

            saveData();

            return message.reply(
                `🤝 **${name}** artık **${team.name}** takımının sponsoru!`
            );
        }

        /* =====================
           SPONSORLARIM
        ===================== */

        if (command === ".sponsorlarım") {
            const team =
                getUserTeam(
                    message.author.id
                );

            return message.reply(
                team?.sponsor
                    ? `🤝 Sponsorun: **${team.sponsor}**`
                    : "🤝 Henüz sponsorun yok."
            );
        }

        /* =====================
           REKLAM PAKETLERİ
        ===================== */

        if (
            command === ".reklampaketleri"
        ) {
            const text =
                Object.entries(
                    AD_PACKAGES
                ).map(
                    ([name, price]) =>
                        `📢 **${name}** — **${formatMoney(price)}**`
                ).join("\n");

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FEE75C")
                        .setTitle(
                            "📢 Reklam Paketleri"
                        )
                        .setDescription(
                            text +
                            "\n\n" +
                            "📌 600K€ sonrası @everyone/@here hakları artar.\n" +
                            "📌 Maksimum 5 @everyone/@here hakkı.\n" +
                            "📌 700K€ sonrası özel reklam kanalı açılabilir."
                        )
                ]
            });
        }

        /* =====================
           REKLAM
        ===================== */

        if (command === ".reklam") {
            const packageName =
                args.shift();

            const adText =
                args.join(" ");

            if (
                !packageName ||
                !adText
            ) {
                return message.reply(
                    "❌ Kullanım: `.reklam Bronz Reklam mesajı`"
                );
            }

            const price =
                AD_PACKAGES[packageName];

            if (!price) {
                return message.reply(
                    "❌ Geçerli reklam paketi bulunamadı."
                );
            }

            const player =
                getPlayer(
                    message.author.id
                );

            if (
                player.budget < price
            ) {
                return message.reply(
                    "❌ Reklam için yeterli bütçen yok."
                );
            }

            player.budget -= price;

            if (!data.ads[message.author.id]) {
                data.ads[message.author.id] = {
                    used: 0,
                    everyone: 0,
                    here: 0
                };
            }

            data.ads[message.author.id].used++;

            if (
                packageName.toLowerCase() ===
                "everyone"
            ) {
                data.ads[
                    message.author.id
                ].everyone++;
            }

            if (
                packageName.toLowerCase() ===
                "here"
            ) {
                data.ads[
                    message.author.id
                ].here++;
            }

            saveData();

            return message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#5865F2")
                        .setTitle(
                            "📢 United League • Reklam"
                        )
                        .setDescription(
                            adText
                        )
                        .setFooter({
                            text:
                                `Reklam paketi: ${packageName}`
                        })
                        .setTimestamp()
                ]
            });
        }

    } catch (err) {
        console.error(
            "Komut hatası:",
            err
        );

        try {
            await message.reply(
                "❌ İşlem sırasında bir hata oluştu."
            );
        } catch {}
    }
});

/* =========================
   ÇEKİLİŞ BUTONLARI
========================= */

client.on("interactionCreate", async interaction => {
    try {
        if (!interaction.isButton()) return;

        if (
            !interaction.customId.startsWith(
                "giveaway_"
            )
        ) {
            return;
        }

        const id =
            interaction.customId.replace(
                "giveaway_",
                ""
            );

        const giveaway =
            data.giveaways[id];

        if (
            !giveaway ||
            giveaway.finished
        ) {
            return interaction.reply({
                content:
                    "❌ Bu çekiliş sona ermiş.",
                ephemeral: true
            });
        }

        if (
            giveaway.entries.includes(
                interaction.user.id
            )
        ) {
            return interaction.reply({
                content:
                    "⚠️ Zaten çekilişe katıldın.",
                ephemeral: true
            });
        }

        giveaway.entries.push(
            interaction.user.id
        );

        saveData();

        return interaction.reply({
            content:
                "🎉 Çekilişe başarıyla katıldın!",
            ephemeral: true
        });
    } catch (err) {
        console.error(
            "Giveaway interaction:",
            err.message
        );
    }
});

/* =========================
   BOTU BAŞLAT
========================= */

client.login(TOKEN);
