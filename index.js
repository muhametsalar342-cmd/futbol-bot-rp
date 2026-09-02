const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ChannelType,
    StringSelectMenuBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ======================================================
// AYARLAR
// ======================================================

const TOKEN = process.env.TOKEN;
const PREFIX = ".";

// Bilinen rol ID'leri
const ROLES = {
    YONETICI: "1544449436011339806",
    KAYIT: "1544452022764568656",
    DEGER: "1544451743746891806"
};

// Bilinmeyen bütün yetkiler Yönetici rolünü kullanır.
const ADMIN_ROLE_ID = ROLES.YONETICI;

// ======================================================
// CLIENT
// ======================================================

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
        Partials.User,
        Partials.GuildMember
    ]
});

// ======================================================
// VERİTABANI
// ======================================================

const DB_FILE = path.join(__dirname, "data.json");

const DEFAULT_DATA = {
    players: {},
    teams: {},
    fixtures: [],
    results: [],
    giveaways: {},
    tickets: {},
    museums: {},
    settings: {},
    counters: {
        ticket: 0,
        giveaway: 0,
        team: 0
    }
};

let db;

function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            db = JSON.parse(JSON.stringify(DEFAULT_DATA));
            saveDB();
            return;
        }

        db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

        for (const key of Object.keys(DEFAULT_DATA)) {
            if (db[key] === undefined) {
                db[key] = JSON.parse(JSON.stringify(DEFAULT_DATA[key]));
            }
        }

        saveDB();
    } catch (error) {
        console.error("DB yükleme hatası:", error);
        db = JSON.parse(JSON.stringify(DEFAULT_DATA));
        saveDB();
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error("DB kayıt hatası:", error);
    }
}

loadDB();

// ======================================================
// TOKEN
// ======================================================

if (!TOKEN) {
    console.error("❌ TOKEN bulunamadı!");
    console.error("Railway > Variables > TOKEN ekle.");
    process.exit(1);
}

// ======================================================
// GENEL YARDIMCILAR
// ======================================================

function hasRole(member, roleId) {
    return member.roles.cache.has(roleId);
}

function isAdmin(member) {
    return (
        member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        hasRole(member, ADMIN_ROLE_ID)
    );
}

function canUse(member, roleId) {
    return isAdmin(member) || hasRole(member, roleId);
}

function replyNoPermission(message) {
    return message.reply("❌ Bu komutu kullanmak için yetkin yok.");
}

function parseMoney(input) {
    if (!input) return null;

    let text = String(input)
        .toLowerCase()
        .replace(/€/g, "")
        .replace(/\s/g, "")
        .replace(/,/g, "");

    let multiplier = 1;

    if (text.endsWith("k")) {
        multiplier = 1000;
        text = text.slice(0, -1);
    } else if (text.endsWith("m")) {
        multiplier = 1000000;
        text = text.slice(0, -1);
    } else if (text.endsWith("b")) {
        multiplier = 1000000000;
        text = text.slice(0, -1);
    }

    const number = Number(text);

    if (!Number.isFinite(number)) return null;

    return Math.round(number * multiplier);
}

function formatMoney(value) {
    value = Number(value) || 0;

    if (value >= 1000000000) {
        return `${Number((value / 1000000000).toFixed(2))}B€`;
    }

    if (value >= 1000000) {
        return `${Number((value / 1000000).toFixed(2))}M€`;
    }

    if (value >= 1000) {
        return `${Number((value / 1000).toFixed(2))}K€`;
    }

    return `${value}€`;
}

function getPlayer(userId) {
    if (!db.players[userId]) {
        db.players[userId] = {
            value: 0,
            training: 0,
            goals: 0,
            assists: 0,
            team: null,
            position: "SNT",
            registered: false
        };
    }

    return db.players[userId];
}

function getMemberFromMention(message, text) {
    return (
        message.mentions.members.first() ||
        message.guild.members.cache.get(text)
    );
}

function cleanName(text) {
    return String(text || "")
        .replace(/[|]/g, "")
        .trim();
}

function getPlayerNickname(member) {
    const player = getPlayer(member.id);

    const current = member.nickname || member.user.username;

    if (current.includes("|")) {
        const parts = current.split("|").map(x => x.trim());

        if (parts.length >= 4) {
            return `${parts[0]} | ${parts[1]} | ${parts[2]} | ${formatMoney(player.value)}`;
        }
    }

    return `${current} | 🇹🇷 | SNT | ${formatMoney(player.value)}`;
}

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getTeamByName(name) {
    if (!name) return null;

    const wanted = name.toLowerCase();

    return Object.values(db.teams).find(
        team => team.name.toLowerCase() === wanted
    );
}

function getTeamFromMention(message, text) {
    if (message.mentions.roles.first()) {
        const role = message.mentions.roles.first();

        return Object.values(db.teams).find(
            team => team.roleId === role.id
        );
    }

    return getTeamByName(text);
}

function ensureTeamStats(team) {
    if (!team.players) team.players = [];
    if (!team.played) team.played = 0;
    if (!team.wins) team.wins = 0;
    if (!team.draws) team.draws = 0;
    if (!team.losses) team.losses = 0;
    if (!team.gf) team.gf = 0;
    if (!team.ga) team.ga = 0;
    if (!team.points) team.points = 0;
    if (!team.budget) team.budget = 0;
}

async function createRoleIfMissing(guild, name, options = {}) {
    let role = guild.roles.cache.find(
        r => r.name.toLowerCase() === name.toLowerCase()
    );

    if (role) return role;

    try {
        role = await guild.roles.create({
            name,
            reason: "Futbol RP Bot otomatik rol sistemi",
            ...options
        });

        return role;
    } catch (error) {
        console.error(`Rol oluşturulamadı: ${name}`, error);
        return null;
    }
}

// ======================================================
// HAZIR
// ======================================================

client.once("ready", async () => {
    console.log("======================================");
    console.log("✅ FUTBOL RP BOTU AKTİF");
    console.log(`🤖 ${client.user.tag}`);
    console.log(`🆔 ${client.user.id}`);
    console.log(`🌐 ${client.guilds.cache.size} sunucu`);
    console.log(`🏓 ${client.ws.ping}ms`);
    console.log("======================================");

    client.user.setActivity(".yardım | Futbol RP", {
        type: 0
    });

    for (const guild of client.guilds.cache.values()) {
        try {
            await createRoleIfMissing(guild, "⚽ Maç Ping");
            await createRoleIfMissing(guild, "📢 Duyuru Ping");
            await createRoleIfMissing(guild, "🎉 Etkinlik Ping");
            await createRoleIfMissing(guild, "📰 Haber Ping");
            await createRoleIfMissing(guild, "🔄 Transfer Ping");
            await createRoleIfMissing(guild, "⚽ Futbolcu");
            await createRoleIfMissing(guild, "🎩 Teknik Direktör");
            await createRoleIfMissing(guild, "🔒 Kayıtsız");
        } catch (error) {
            console.error("Otomatik rol hatası:", error);
        }
    }
});

// ======================================================
// YARDIM
// ======================================================

function helpText() {
    return `
# ⚽ FUTBOL RP BOTU

## 👤 Kayıt
\`.k @oyuncu İsim\`
\`.td @oyuncu\`

## 💰 Oyuncu
\`.profil @oyuncu\`
\`.dver @oyuncu 5M\`
\`.antrenman @oyuncu\`
\`.ant @oyuncu\`
\`.pen @oyuncu\`
\`.penaltı @oyuncu\`

## 🏟️ Takım
\`.takımkur Takım Adı\`
\`.takımlar\`
\`.kadro Takım Adı\`
\`.takımbilgi Takım Adı\`

## ⚽ Maç
\`.maç Takım1 Takım2\`
\`.puan\`
\`.fikstur\`
\`.macsonuclari\`
\`.istatistik\`

## 🔄 Transfer
\`.transfer @oyuncu Takım Adı\`
\`.transferler\`

## 🏆 Lig
\`.golkral\`
\`.asistkral\`
\`.puan\`

## 🏛️ Müze
\`.müze Takım Adı\`
\`.kupaekle Takım Adı Kupa Adı\`
\`.kupasil Takım Adı Kupa Adı\`

## 🎁 Çekiliş
\`.çekiliş 5M 5m\`
\`.çekilişbitir ID\`

## 🎫 Destek
\`.ticketpanel\`

## 🔔 Ping
\`.rolpanel\`

## 🛡️ Yönetim
\`.sil 50\`
\`.embed Başlık | Açıklama\`
\`.kick @oyuncu\`
\`.mute @oyuncu\`
\`.unmute @oyuncu\`
\`.kilit\`
\`.aç\`

## 📚 Genel
\`.ping\`
\`.bot\`
\`.yardım\`
`;
}

// ======================================================
// MESAJ SİSTEMİ
// ======================================================

client.on("messageCreate", async message => {
    try {
        if (!message.guild) return;
        if (message.author.bot) return;
        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content
            .slice(PREFIX.length)
            .trim()
            .split(/\s+/);

        const command = (args.shift() || "").toLowerCase();

        if (!command) return;

        // ==================================================
        // PING
        // ==================================================

        if (command === "ping") {
            return message.reply(
                `🏓 **Pong!** ${client.ws.ping}ms`
            );
        }

        // ==================================================
        // BOT
        // ==================================================

        if (command === "bot") {
            const embed = new EmbedBuilder()
                .setTitle("🤖 Bot Bilgileri")
                .setDescription(
                    `**Bot:** ${client.user.tag}\n` +
                    `**Sunucu:** ${client.guilds.cache.size}\n` +
                    `**Ping:** ${client.ws.ping}ms\n` +
                    `**Prefix:** \`.\``
                )
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // ==================================================
        // YARDIM
        // ==================================================

        if (command === "yardım" || command === "help") {
            return message.reply(helpText());
        }

        // ==================================================
        // PROFİL
        // ==================================================

        if (
            command === "profil" ||
            command === "oyuncu" ||
            command === "istatistikoyuncu"
        ) {
            const member =
                getMemberFromMention(message, args[0]) ||
                message.member;

            const player = getPlayer(member.id);

            const embed = new EmbedBuilder()
                .setTitle(`👤 ${member.user.username}`)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    {
                        name: "💰 Değer",
                        value: formatMoney(player.value),
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
                        name: "🏃 Antrenman",
                        value: `${player.training}/10`,
                        inline: true
                    },
                    {
                        name: "🏟️ Takım",
                        value: player.team || "Yok",
                        inline: true
                    },
                    {
                        name: "📍 Pozisyon",
                        value: player.position || "SNT",
                        inline: true
                    }
                )
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // ==================================================
        // DEĞER VER
        // ==================================================

        if (command === "dver" || command === "değer") {
            if (!canUse(message.member, ROLES.DEGER)) {
                return replyNoPermission(message);
            }

            const member = getMemberFromMention(message, args[0]);

            if (!member) {
                return message.reply(
                    "❌ Oyuncu belirtmelisin.\nÖrnek: `.dver @Oyuncu 5M`"
                );
            }

            const amount = parseMoney(args[1]);

            if (!amount || amount <= 0) {
                return message.reply(
                    "❌ Geçerli bir değer gir.\nÖrnek: `.dver @Oyuncu 5M`"
                );
            }

            const player = getPlayer(member.id);

            player.value += amount;

            try {
                await member.setNickname(
                    getPlayerNickname(member)
                );
            } catch (error) {
                console.error("Takma ad değiştirilemedi:", error);
            }

            saveDB();

            return message.reply(
                `💰 ${member} oyuncusuna **${formatMoney(amount)}** değer verildi.\n` +
                `📈 Yeni değer: **${formatMoney(player.value)}**`
            );
        }

        // ==================================================
        // ANTRENMAN
        // ==================================================

        if (command === "antrenman" || command === "ant") {
            const member =
                getMemberFromMention(message, args[0]) ||
                message.member;

            const player = getPlayer(member.id);

            player.training++;

            if (player.training >= 10) {
                player.training = 0;
                player.value += 3000000;

                try {
                    await member.setNickname(
                        getPlayerNickname(member)
                    );
                } catch {}

                saveDB();

                return message.reply(
                    `🏃 **Antrenman tamamlandı!**\n\n` +
                    `${member} → **10/10**\n` +
                    `💰 +3M€ değer kazandı.\n` +
                    `📈 Yeni değer: **${formatMoney(player.value)}**`
                );
            }

            saveDB();

            return message.reply(
                `🏃 ${member} antrenman yaptı.\n` +
                `📊 İlerleme: **${player.training}/10**`
            );
        }

        // ==================================================
        // PENALTI
        // ==================================================

        if (command === "pen" || command === "penaltı") {
            const member =
                getMemberFromMention(message, args[0]) ||
                message.member;

            const scored = Math.random() < 0.7;
            const player = getPlayer(member.id);

            if (!scored) {
                return message.reply(
                    `🥅 ${member} penaltıyı kaçırdı!`
                );
            }

            player.goals++;
            player.value += 2000000;

            try {
                await member.setNickname(
                    getPlayerNickname(member)
                );
            } catch {}

            saveDB();

            return message.reply(
                `⚽ **GOOOL!** ${member} penaltıyı gole çevirdi!\n` +
                `💰 +2M€ değer kazandı.\n` +
                `📈 Yeni değer: **${formatMoney(player.value)}**`
            );
        }

        // ==================================================
        // KAYIT
        // ==================================================

        if (command === "k" || command === "kayıt") {
            if (!canUse(message.member, ROLES.KAYIT)) {
                return replyNoPermission(message);
            }

            const member = getMemberFromMention(message, args[0]);

            if (!member) {
                return message.reply(
                    "❌ Oyuncu belirtmelisin.\nÖrnek: `.k @Oyuncu İsim`"
                );
            }

            const name = cleanName(
                args.slice(1).join(" ")
            );

            if (!name) {
                return message.reply(
                    "❌ Oyuncunun adını yazmalısın."
                );
            }

            const player = getPlayer(member.id);

            player.registered = true;
            player.position = "SNT";

            const footballerRole =
                await createRoleIfMissing(
                    message.guild,
                    "⚽ Futbolcu"
                );

            const unregisteredRole =
                message.guild.roles.cache.find(
                    r => r.name === "🔒 Kayıtsız"
                );

            try {
                if (footballerRole) {
                    await member.roles.add(footballerRole);
                }

                if (unregisteredRole) {
                    await member.roles.remove(unregisteredRole);
                }

                await member.setNickname(
                    `${name} | 🇹🇷 | SNT | ${formatMoney(player.value)}`
                );
            } catch (error) {
                console.error("Kayıt rol/nick hatası:", error);
            }

            saveDB();

            return message.reply(
                `✅ ${member} başarıyla kayıt edildi!\n\n` +
                `👤 İsim: **${name}**\n` +
                `⚽ Rol: **Futbolcu**\n` +
                `💰 Değer: **${formatMoney(player.value)}**`
            );
        }

        // ==================================================
        // TEKNİK DİREKTÖR
        // ==================================================

        if (command === "td" || command === "teknikdirektör") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const member = getMemberFromMention(message, args[0]);

            if (!member) {
                return message.reply(
                    "❌ Oyuncu belirtmelisin."
                );
            }

            const role = await createRoleIfMissing(
                message.guild,
                "🎩 Teknik Direktör"
            );

            if (!role) {
                return message.reply(
                    "❌ Teknik Direktör rolü oluşturulamadı."
                );
            }

            try {
                await member.roles.add(role);
            } catch {
                return message.reply(
                    "❌ Rol verilemedi. Botun rolü yeterince yukarıda olmalı."
                );
            }

            return message.reply(
                `🎩 ${member} artık **Teknik Direktör**.`
            );
        }

        // ==================================================
        // TAKIM KUR
        // ==================================================

        if (command === "takımkur" || command === "takimkur") {
            if (!hasRole(
                message.member,
                await getRoleId(message.guild, "🎩 Teknik Direktör")
            ) && !isAdmin(message.member)) {
                return message.reply(
                    "❌ Takım kurmak için Teknik Direktör olmalısın."
                );
            }

            const teamName = cleanName(args.join(" "));

            if (!teamName) {
                return message.reply(
                    "❌ Takım adı yazmalısın."
                );
            }

            if (getTeamByName(teamName)) {
                return message.reply(
                    "❌ Bu isimde bir takım zaten var."
                );
            }

            const teamId = `team_${++db.counters.team}`;

            let role = null;

            try {
                role = await message.guild.roles.create({
                    name: `⚽ ${teamName}`,
                    reason: "Futbol RP takım sistemi"
                });
            } catch (error) {
                console.error(error);
            }

            db.teams[teamId] = {
                id: teamId,
                name: teamName,
                owner: message.author.id,
                roleId: role ? role.id : null,
                players: [message.author.id],
                budget: 100000000,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                gf: 0,
                ga: 0,
                points: 0
            };

            getPlayer(message.author.id).team = teamName;

            if (role) {
                try {
                    await message.member.roles.add(role);
                } catch {}
            }

            saveDB();

            return message.reply(
                `🏟️ **Takım oluşturuldu!**\n\n` +
                `⚽ Takım: **${teamName}**\n` +
                `👤 Teknik Direktör: ${message.author}\n` +
                `💰 Bütçe: **${formatMoney(100000000)}**`
            );
        }

        // ==================================================
        // TAKIMLAR
        // ==================================================

        if (command === "takımlar" || command === "takimlar") {
            const teams = Object.values(db.teams);

            if (!teams.length) {
                return message.reply(
                    "🏟️ Henüz takım bulunmuyor."
                );
            }

            const list = teams.map((team, index) =>
                `**${index + 1}. ${team.name}** — ${team.players.length} oyuncu`
            ).join("\n");

            return message.reply(
                `# 🏟️ TAKIMLAR\n\n${list}`
            );
        }

        // ==================================================
        // KADRO
        // ==================================================

        if (command === "kadro") {
            const team = getTeamFromMention(
                message,
                args.join(" ")
            );

            if (!team) {
                return message.reply(
                    "❌ Takım bulunamadı."
                );
            }

            ensureTeamStats(team);

            const members = [];

            for (const id of team.players) {
                const member = await message.guild.members
                    .fetch(id)
                    .catch(() => null);

                if (member) {
                    const player = getPlayer(id);

                    members.push(
                        `• ${member} — ${player.position} — ${formatMoney(player.value)}`
                    );
                }
            }

            return message.reply(
                `# ⚽ ${team.name} KADROSU\n\n` +
                (members.join("\n") || "Henüz oyuncu yok.")
            );
        }

        // ==================================================
        // TAKIM BİLGİ
        // ==================================================

        if (command === "takımbilgi" || command === "takimbilgi") {
            const team = getTeamFromMention(
                message,
                args.join(" ")
            );

            if (!team) {
                return message.reply(
                    "❌ Takım bulunamadı."
                );
            }

            ensureTeamStats(team);

            return message.reply(
                `# 🏟️ ${team.name}\n\n` +
                `👤 Teknik Direktör: <@${team.owner}>\n` +
                `👥 Kadro: **${team.players.length}**\n` +
                `💰 Bütçe: **${formatMoney(team.budget)}**\n\n` +
                `🎮 Oynanan: **${team.played}**\n` +
                `✅ Galibiyet: **${team.wins}**\n` +
                `🤝 Beraberlik: **${team.draws}**\n` +
                `❌ Mağlubiyet: **${team.losses}**\n` +
                `⚽ Gol: **${team.gf}**\n` +
                `🥅 Yenen: **${team.ga}**\n` +
                `🏆 Puan: **${team.points}**`
            );
        }

        // ==================================================
        // MAÇ
        // ==================================================

        if (command === "maç" || command === "mac") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const team1 = getTeamFromMention(
                message,
                args[0]
            );

            const team2 = getTeamFromMention(
                message,
                args.slice(1).join(" ")
            );

            if (!team1 || !team2) {
                return message.reply(
                    "❌ İki takım da bulunmalı.\nÖrnek: `.maç Takım1 Takım2`"
                );
            }

            if (team1.id === team2.id) {
                return message.reply(
                    "❌ Bir takım kendisiyle maç yapamaz."
                );
            }

            const score1 = random(0, 5);
            const score2 = random(0, 5);

            let minute = 10;

            const msg = await message.reply(
                `🏟️ **MAÇ BAŞLADI!**\n\n` +
                `⚽ **${team1.name} 0 - 0 ${team2.name}**\n\n` +
                `⏱️ ${minute}'`
            );

            const events = [];

            const totalGoals = score1 + score2;

            for (let i = 0; i < totalGoals; i++) {
                await sleep(1000);

                const isTeam1 = i < score1;

                minute = Math.min(
                    90,
                    5 + Math.floor((i + 1) * (85 / Math.max(totalGoals, 1)))
                );

                events.push({
                    minute,
                    team: isTeam1 ? team1.name : team2.name
                });

                const current1 =
                    events.filter(e => e.team === team1.name).length;

                const current2 =
                    events.filter(e => e.team === team2.name).length;

                await msg.edit(
                    `🏟️ **MAÇ DEVAM EDİYOR!**\n\n` +
                    `⚽ **${team1.name} ${current1} - ${current2} ${team2.name}**\n\n` +
                    `🔥 ${minute}' — **${isTeam1 ? team1.name : team2.name}** gol attı!`
                );
            }

            team1.played++;
            team2.played++;

            team1.gf += score1;
            team1.ga += score2;

            team2.gf += score2;
            team2.ga += score1;

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

            // Gol istatistiği
            for (let i = 0; i < score1; i++) {
                if (team1.players.length) {
                    const id =
                        team1.players[
                            random(0, team1.players.length - 1)
                        ];

                    getPlayer(id).goals++;
                }
            }

            for (let i = 0; i < score2; i++) {
                if (team2.players.length) {
                    const id =
                        team2.players[
                            random(0, team2.players.length - 1)
                        ];

                    getPlayer(id).goals++;
                }
            }

            saveDB();

            await msg.edit(
                `🏁 **MAÇ BİTTİ!**\n\n` +
                `# ⚽ ${team1.name} ${score1} - ${score2} ${team2.name}\n\n` +
                `🏆 ${score1 > score2
                    ? `Kazanan: **${team1.name}**`
                    : score2 > score1
                        ? `Kazanan: **${team2.name}**`
                        : `🤝 Maç berabere bitti.`}`
            );

            db.results.unshift({
                team1: team1.name,
                team2: team2.name,
                score1,
                score2,
                date: Date.now()
            });

            db.results = db.results.slice(0, 100);

            saveDB();

            return;
        }

        // ==================================================
        // PUAN DURUMU
        // ==================================================

        if (command === "puan" || command === "puanlama") {
            const teams = Object.values(db.teams)
                .sort((a, b) => {
                    if (b.points !== a.points) {
                        return b.points - a.points;
                    }

                    return (b.gf - b.ga) - (a.gf - a.ga);
                });

            if (!teams.length) {
                return message.reply(
                    "🏆 Henüz takım yok."
                );
            }

            const list = teams.map((team, index) => {
                const diff = team.gf - team.ga;

                return (
                    `**${index + 1}. ${team.name}**\n` +
                    `🏆 ${team.points} puan | ` +
                    `⚽ ${team.gf}-${team.ga} | ` +
                    `📊 AV: ${diff}`
                );
            }).join("\n\n");

            return message.reply(
                `# 🏆 PUAN DURUMU\n\n${list}`
            );
        }

        // ==================================================
        // GOL KRALI
        // ==================================================

        if (command === "golkral" || command === "golkralligi") {
            const players = [];

            for (const [id, player] of Object.entries(db.players)) {
                const member =
                    await message.guild.members.fetch(id)
                        .catch(() => null);

                if (!member) continue;

                players.push({
                    member,
                    goals: player.goals || 0
                });
            }

            players.sort((a, b) => b.goals - a.goals);

            const top = players.slice(0, 10);

            if (!top.length) {
                return message.reply(
                    "⚽ Henüz gol istatistiği yok."
                );
            }

            const text = top.map(
                (p, i) =>
                    `**${i + 1}.** ${p.member} — **${p.goals} gol**`
            ).join("\n");

            return message.reply(
                `# ⚽ GOL KRALLIĞI\n\n${text}`
            );
        }

        // ==================================================
        // ASİST KRALI
        // ==================================================

        if (command === "asistkral" || command === "asistkrali") {
            const players = [];

            for (const [id, player] of Object.entries(db.players)) {
                const member =
                    await message.guild.members.fetch(id)
                        .catch(() => null);

                if (!member) continue;

                players.push({
                    member,
                    assists: player.assists || 0
                });
            }

            players.sort((a, b) => b.assists - a.assists);

            const top = players.slice(0, 10);

            if (!top.length) {
                return message.reply(
                    "🎯 Henüz asist istatistiği yok."
                );
            }

            const text = top.map(
                (p, i) =>
                    `**${i + 1}.** ${p.member} — **${p.assists} asist**`
            ).join("\n");

            return message.reply(
                `# 🎯 ASİST KRALLIĞI\n\n${text}`
            );
        }

        // ==================================================
        // FİKSTÜR
        // ==================================================

        if (command === "fikstur" || command === "fikstür") {
            if (!db.fixtures.length) {
                return message.reply(
                    "📅 Henüz fikstür bulunmuyor."
                );
            }

            const text = db.fixtures
                .slice(0, 20)
                .map(
                    (x, i) =>
                        `**${i + 1}.** ${x.team1} 🆚 ${x.team2}`
                )
                .join("\n");

            return message.reply(
                `# 📅 FİKSTÜR\n\n${text}`
            );
        }

        // ==================================================
        // MAÇ SONUÇLARI
        // ==================================================

        if (
            command === "macsonuclari" ||
            command === "maçsonuçları"
        ) {
            if (!db.results.length) {
                return message.reply(
                    "🏁 Henüz maç sonucu yok."
                );
            }

            const text = db.results
                .slice(0, 20)
                .map(
                    (x, i) =>
                        `**${i + 1}.** ${x.team1} **${x.score1}-${x.score2}** ${x.team2}`
                )
                .join("\n");

            return message.reply(
                `# 🏁 MAÇ SONUÇLARI\n\n${text}`
            );
        }

        // ==================================================
        // GENEL İSTATİSTİK
        // ==================================================

        if (command === "istatistik") {
            const totalPlayers =
                Object.keys(db.players).length;

            const totalTeams =
                Object.keys(db.teams).length;

            const totalGoals =
                Object.values(db.players)
                    .reduce(
                        (sum, p) => sum + (p.goals || 0),
                        0
                    );

            return message.reply(
                `# 📊 SUNUCU İSTATİSTİKLERİ\n\n` +
                `👤 Oyuncular: **${totalPlayers}**\n` +
                `🏟️ Takımlar: **${totalTeams}**\n` +
                `⚽ Toplam Goller: **${totalGoals}**\n` +
                `🏁 Maçlar: **${db.results.length}**`
            );
        }

        // ==================================================
        // TRANSFER
        // ==================================================

        if (command === "transfer") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const member = getMemberFromMention(
                message,
                args[0]
            );

            if (!member) {
                return message.reply(
                    "❌ Oyuncu belirtmelisin."
                );
            }

            const teamName = cleanName(
                args.slice(1).join(" ")
            );

            const team = getTeamByName(teamName);

            if (!team) {
                return message.reply(
                    "❌ Takım bulunamadı."
                );
            }

            const player = getPlayer(member.id);

            if (player.team) {
                const oldTeam = getTeamByName(player.team);

                if (oldTeam) {
                    oldTeam.players =
                        oldTeam.players.filter(
                            id => id !== member.id
                        );

                    if (
                        oldTeam.roleId &&
                        member.roles.cache.has(oldTeam.roleId)
                    ) {
                        await member.roles.remove(
                            oldTeam.roleId
                        ).catch(() => {});
                    }
                }
            }

            if (!team.players.includes(member.id)) {
                team.players.push(member.id);
            }

            player.team = team.name;

            if (team.roleId) {
                await member.roles.add(team.roleId)
                    .catch(() => {});
            }

            saveDB();

            return message.reply(
                `🔄 **Transfer tamamlandı!**\n\n` +
                `👤 Oyuncu: ${member}\n` +
                `🏟️ Yeni takım: **${team.name}**`
            );
        }

        // ==================================================
        // TRANSFERLER
        // ==================================================

        if (command === "transferler") {
            return message.reply(
                `# 🔄 TRANSFER MERKEZİ\n\n` +
                `Transfer işlemleri yetkililer tarafından gerçekleştirilir.\n\n` +
                `Kullanım:\n` +
                `\`.transfer @Oyuncu Takım Adı\``
            );
        }

        // ==================================================
        // MÜZE
        // ==================================================

        if (command === "müze" || command === "muze") {
            const teamName = cleanName(args.join(" "));
            const team = getTeamByName(teamName);

            if (!team) {
                return message.reply(
                    "❌ Takım bulunamadı."
                );
            }

            const cups = db.museums[team.id] || [];

            return message.reply(
                `# 🏛️ ${team.name} MÜZESİ\n\n` +
                (cups.length
                    ? cups.map(
                        (cup, i) => `🏆 **${i + 1}.** ${cup}`
                    ).join("\n")
                    : "Henüz kupa bulunmuyor.")
            );
        }

        // ==================================================
        // KUPA EKLE
        // ==================================================

        if (command === "kupaekle") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const teamName = args.shift();
            const cupName = cleanName(args.join(" "));

            const team = getTeamByName(teamName);

            if (!team || !cupName) {
                return message.reply(
                    "❌ Kullanım: `.kupaekle Takım Kupa Adı`"
                );
            }

            if (!db.museums[team.id]) {
                db.museums[team.id] = [];
            }

            db.museums[team.id].push(cupName);

            saveDB();

            return message.reply(
                `🏆 **${cupName}** kupası ${team.name} müzesine eklendi.`
            );
        }

        // ==================================================
        // KUPA SİL
        // ==================================================

        if (command === "kupasil") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const teamName = args.shift();
            const cupName = cleanName(args.join(" "));

            const team = getTeamByName(teamName);

            if (!team) {
                return message.reply(
                    "❌ Takım bulunamadı."
                );
            }

            if (!db.museums[team.id]) {
                return message.reply(
                    "❌ Bu takımın müzesinde kupa yok."
                );
            }

            const index =
                db.museums[team.id].findIndex(
                    x => x.toLowerCase() === cupName.toLowerCase()
                );

            if (index === -1) {
                return message.reply(
                    "❌ Bu kupa bulunamadı."
                );
            }

            db.museums[team.id].splice(index, 1);

            saveDB();

            return message.reply(
                `🗑️ **${cupName}** müzeden kaldırıldı.`
            );
        }

        // ==================================================
        // PING ROL PANELİ
        // ==================================================

        if (command === "rolpanel") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const roleNames = [
                "⚽ Maç Ping",
                "📢 Duyuru Ping",
                "🎉 Etkinlik Ping",
                "📰 Haber Ping",
                "🔄 Transfer Ping"
            ];

            const buttons = [];

            for (let i = 0; i < roleNames.length; i++) {
                const role = await createRoleIfMissing(
                    message.guild,
                    roleNames[i]
                );

                if (!role) continue;

                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`pingrole_${role.id}`)
                        .setLabel(roleNames[i])
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            const rows = [];

            for (let i = 0; i < buttons.length; i += 5) {
                rows.push(
                    new ActionRowBuilder()
                        .addComponents(
                            buttons.slice(i, i + 5)
                        )
                );
            }

            const embed = new EmbedBuilder()
                .setTitle("🔔 Bildirim Rolleri")
                .setDescription(
                    "İstediğin bildirim rolünü almak için aşağıdaki butona bas."
                );

            return message.channel.send({
                embeds: [embed],
                components: rows
            });
        }

        // ==================================================
        // TICKET PANELİ
        // ==================================================

        if (command === "ticketpanel") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId("ticket_select")
                .setPlaceholder("Destek türünü seç")
                .addOptions(
                    {
                        label: "Genel Destek",
                        description: "Genel yardım ve sorular",
                        value: "genel",
                        emoji: "📝"
                    },
                    {
                        label: "Teknik Destek",
                        description: "Bot ve teknik sorunlar",
                        value: "teknik",
                        emoji: "⚙️"
                    },
                    {
                        label: "Yönetim Desteği",
                        description: "Yönetim ile iletişim",
                        value: "yonetim",
                        emoji: "👑"
                    }
                );

            const row =
                new ActionRowBuilder().addComponents(menu);

            const embed = new EmbedBuilder()
                .setTitle("🎫 Destek Merkezi")
                .setDescription(
                    "Destek almak için aşağıdaki menüden uygun kategoriyi seç."
                );

            return message.channel.send({
                embeds: [embed],
                components: [row]
            });
        }

        // ==================================================
        // ÇEKİLİŞ
        // ==================================================

        if (command === "çekiliş" || command === "cekilis") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const prize = args[0];
            const durationText = args[1];

            if (!prize || !durationText) {
                return message.reply(
                    "❌ Kullanım: `.çekiliş 5M 5m`"
                );
            }

            const duration = parseDuration(durationText);

            if (!duration || duration < 5000) {
                return message.reply(
                    "❌ Geçerli süre gir.\nÖrnek: `5m`, `2h`, `30s`"
                );
            }

            const id = String(++db.counters.giveaway);

            const embed = new EmbedBuilder()
                .setTitle("🎉 ÇEKİLİŞ")
                .setDescription(
                    `🎁 Ödül: **${prize}**\n` +
                    `⏱️ Süre: **${durationText}**\n\n` +
                    `Katılmak için 🎉 butonuna bas!\n` +
                    `👥 Katılımcı: **0**`
                );

            const button =
                new ButtonBuilder()
                    .setCustomId(`giveaway_${id}`)
                    .setLabel("Katıl")
                    .setEmoji("🎉")
                    .setStyle(ButtonStyle.Success);

            const row =
                new ActionRowBuilder()
                    .addComponents(button);

            const sent = await message.channel.send({
                embeds: [embed],
                components: [row]
            });

            db.giveaways[id] = {
                id,
                prize,
                channelId: message.channel.id,
                messageId: sent.id,
                creator: message.author.id,
                participants: [],
                ended: false,
                endAt: Date.now() + duration
            };

            saveDB();

            setTimeout(
                () => finishGiveaway(message.guild.id, id),
                duration
            );

            return;
        }

        // ==================================================
        // ÇEKİLİŞ BİTİR
        // ==================================================

        if (
            command === "çekilişbitir" ||
            command === "cekilisbitir"
        ) {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const id = args[0];

            if (!db.giveaways[id]) {
                return message.reply(
                    "❌ Çekiliş bulunamadı."
                );
            }

            await finishGiveaway(
                message.guild.id,
                id
            );

            return;
        }

        // ==================================================
        // EMBED
        // ==================================================

        if (command === "embed") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const content = args.join(" ");
            const parts = content.split("|");

            const title =
                cleanName(parts[0]) || "Duyuru";

            const description =
                cleanName(parts.slice(1).join("|")) ||
                "Açıklama bulunmuyor.";

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setTimestamp();

            return message.channel.send({
                embeds: [embed]
            });
        }

        // ==================================================
        // SİL
        // ==================================================

        if (command === "sil") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            let amount = Number(args[0]);

            if (!Number.isInteger(amount)) {
                return message.reply(
                    "❌ Geçerli bir miktar yaz."
                );
            }

            if (amount < 1 || amount > 1000) {
                return message.reply(
                    "❌ Silme miktarı **1 ile 1000** arasında olmalı."
                );
            }

            let remaining = amount;

            while (remaining > 0) {
                const batch = Math.min(remaining, 100);

                const deleted =
                    await message.channel.bulkDelete(
                        batch,
                        true
                    ).catch(() => null);

                if (!deleted || deleted.size === 0) {
                    break;
                }

                remaining -= deleted.size;

                if (deleted.size < batch) {
                    break;
                }
            }

            const notice = await message.channel.send(
                `🗑️ **${amount - Math.max(remaining, 0)}** mesaj silindi.`
            );

            setTimeout(
                () => notice.delete().catch(() => {}),
                3000
            );

            return;
        }

        // ==================================================
        // KICK
        // ==================================================

        if (command === "kick") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const member =
                getMemberFromMention(message, args[0]);

            if (!member) {
                return message.reply(
                    "❌ Oyuncu belirtmelisin."
                );
            }

            if (!member.kickable) {
                return message.reply(
                    "❌ Bu oyuncuyu atamıyorum. Bot rolünü kontrol et."
                );
            }

            await member.kick(
                "Futbol RP yönetim komutu"
            );

            return message.reply(
                `👢 ${member.user.tag} sunucudan atıldı.`
            );
        }

        // ==================================================
        // MUTE
        // ==================================================

        if (command === "mute") {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const member =
                getMemberFromMention(message, args[0]);

            if (!member) {
                return message.reply(
                    "❌ Oyuncu belirtmelisin."
                );
            }

            const duration =
                Number(args[1]) || 10;

            await member.timeout(
                duration * 60 * 1000,
                "Futbol RP mute sistemi"
            ).catch(() => null);

            return message.reply(
                `🔇 ${member} **${duration} dakika** susturuldu.`
            );
        }

        // ==================================================
        // UNMUTE
        // ==================================================

        if (
            command === "unmute" ||
            command === "mutekaldır" ||
            command === "mutekaldir"
        ) {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
            }

            const member =
                getMemberFromMention(message, args[0]);

            if (!member) {
                return message.reply(
                    "❌ Oyuncu belirtmelisin."
                );
            }

            await member.timeout(
                null,
                "Mute kaldırma"
            ).catch(() => null);

            return message.reply(
                `🔊 ${member} artık susturulmuyor.`
            );
        }

        // ==================================================
        // KANAL KİLİT
        // ==================================================

        if (
            command === "kilit" ||
            command === "kilitle"
        ) {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
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

        // ==================================================
        // KANAL AÇ
        // ==================================================

        if (
            command === "aç" ||
            command === "ac" ||
            command === "kilitaç"
        ) {
            if (!isAdmin(message.member)) {
                return replyNoPermission(message);
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

    } catch (error) {
        console.error("❌ MESAJ HATASI:");
        console.error(error);

        if (!message.replied && !message.deferred) {
            message.reply(
                "❌ Komut çalıştırılırken bir hata oluştu."
            ).catch(() => {});
        }
    }
});

// ======================================================
// INTERACTION
// ======================================================

client.on("interactionCreate", async interaction => {
    try {

        // ==================================================
        // PING ROLLERİ
        // ==================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith("pingrole_")
        ) {
            const roleId =
                interaction.customId.replace(
                    "pingrole_",
                    ""
                );

            const role =
                interaction.guild.roles.cache.get(roleId);

            if (!role) {
                return interaction.reply({
                    content: "❌ Rol bulunamadı.",
                    ephemeral: true
                });
            }

            const member =
                await interaction.guild.members.fetch(
                    interaction.user.id
                );

            if (member.roles.cache.has(role.id)) {
                await member.roles.remove(role);

                return interaction.reply({
                    content: `🔕 ${role} rolü kaldırıldı.`,
                    ephemeral: true
                });
            }

            await member.roles.add(role);

            return interaction.reply({
                content: `🔔 ${role} rolü verildi.`,
                ephemeral: true
            });
        }

        // ==================================================
        // ÇEKİLİŞ KATIL
        // ==================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith("giveaway_")
        ) {
            const id =
                interaction.customId.replace(
                    "giveaway_",
                    ""
                );

            const giveaway =
                db.giveaways[id];

            if (!giveaway || giveaway.ended) {
                return interaction.reply({
                    content: "❌ Bu çekiliş sona ermiş.",
                    ephemeral: true
                });
            }

            if (
                giveaway.participants.includes(
                    interaction.user.id
                )
            ) {
                return interaction.reply({
                    content: "⚠️ Zaten çekilişe katıldın.",
                    ephemeral: true
                });
            }

            giveaway.participants.push(
                interaction.user.id
            );

            saveDB();

            return interaction.reply({
                content: "🎉 Çekilişe başarıyla katıldın!",
                ephemeral: true
            });
        }

        // ==================================================
        // TICKET MENÜ
        // ==================================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "ticket_select"
        ) {
            const type = interaction.values[0];

            const existing =
                Object.values(db.tickets).find(
                    ticket =>
                        ticket.userId === interaction.user.id &&
                        ticket.closed === false
                );

            if (existing) {
                return interaction.reply({
                    content:
                        `❌ Zaten açık bir ticketın var: <#${existing.channelId}>`,
                    ephemeral: true
                });
            }

            const names = {
                genel: "genel-destek",
                teknik: "teknik-destek",
                yonetim: "yonetim-destegi"
            };

            const channel =
                await interaction.guild.channels.create({
                    name:
                        `${names[type]}-${interaction.user.username}`
                            .toLowerCase()
                            .replace(/[^a-z0-9-_]/g, "-")
                            .slice(0, 90),
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.roles.everyone.id,
                            deny: [
                                PermissionsBitField.Flags.ViewChannel
                            ]
                        },
                        {
                            id: interaction.user.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ]
                        },
                        {
                            id: ADMIN_ROLE_ID,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory,
                                PermissionsBitField.Flags.ManageChannels
                            ]
                        }
                    ]
                });

            const ticketId =
                `ticket_${++db.counters.ticket}`;

            db.tickets[ticketId] = {
                id: ticketId,
                userId: interaction.user.id,
                channelId: channel.id,
                closed: false,
                lastMessage: Date.now()
            };

            saveDB();

            const closeButton =
                new ButtonBuilder()
                    .setCustomId(
                        `ticket_close_${ticketId}`
                    )
                    .setLabel("Ticket Kapat")
                    .setEmoji("🔒")
                    .setStyle(ButtonStyle.Danger);

            const row =
                new ActionRowBuilder()
                    .addComponents(closeButton);

            const embed = new EmbedBuilder()
                .setTitle("🎫 Destek Talebi")
                .setDescription(
                    `Merhaba ${interaction.user}!\n\n` +
                    `📂 Tür: **${type}**\n` +
                    `Yetkililer en kısa sürede ilgilenecektir.\n\n` +
                    `⏰ **60 dakika boyunca mesaj gönderilmezse ticket otomatik kapanır.**`
                )
                .setTimestamp();

            await channel.send({
                content:
                    `${interaction.user} <@&${ADMIN_ROLE_ID}>`,
                embeds: [embed],
                components: [row]
            });

            return interaction.reply({
                content:
                    `✅ Ticket oluşturuldu: ${channel}`,
                ephemeral: true
            });
        }

        // ==================================================
        // TICKET KAPAT
        // ==================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith("ticket_close_")
        ) {
            const id =
                interaction.customId.replace(
                    "ticket_close_",
                    ""
                );

            const ticket =
                db.tickets[id];

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Ticket bulunamadı.",
                    ephemeral: true
                });
            }

            if (
                interaction.user.id !== ticket.userId &&
                !isAdmin(interaction.member)
            ) {
                return interaction.reply({
                    content: "❌ Bu ticketı kapatamazsın.",
                    ephemeral: true
                });
            }

            ticket.closed = true;
            saveDB();

            await interaction.reply(
                "🔒 Ticket kapatılıyor..."
            );

            setTimeout(
                () =>
                    interaction.channel.delete()
                        .catch(() => {}),
                3000
            );

            return;
        }

    } catch (error) {
        console.error("❌ INTERACTION HATASI:");
        console.error(error);

        if (!interaction.replied && !interaction.deferred) {
            interaction.reply({
                content: "❌ İşlem sırasında hata oluştu.",
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// ======================================================
// TICKET AKTİVİTE TAKİBİ
// ======================================================

client.on("messageCreate", message => {
    if (!message.guild || message.author.bot) return;

    for (const ticket of Object.values(db.tickets)) {
        if (
            !ticket.closed &&
            ticket.channelId === message.channel.id
        ) {
            ticket.lastMessage = Date.now();
            saveDB();
            break;
        }
    }
});

// ======================================================
// TICKET OTOMATİK KAPATMA
// ======================================================

setInterval(async () => {
    try {
        const now = Date.now();

        for (const ticket of Object.values(db.tickets)) {
            if (ticket.closed) continue;

            if (
                now - ticket.lastMessage >=
                60 * 60 * 1000
            ) {
                ticket.closed = true;

                const channel =
                    await client.channels.fetch(
                        ticket.channelId
                    ).catch(() => null);

                if (channel) {
                    await channel.send(
                        "⏰ 60 dakika boyunca mesaj gelmediği için ticket otomatik kapatıldı."
                    ).catch(() => {});

                    setTimeout(
                        () => channel.delete().catch(() => {}),
                        3000
                    );
                }
            }
        }

        saveDB();
    } catch (error) {
        console.error(
            "Ticket otomatik kapatma hatası:",
            error
        );
    }
}, 60 * 1000);

// ======================================================
// ÇEKİLİŞ SÜRESİ
// ======================================================

function parseDuration(text) {
    if (!text) return null;

    const match =
        String(text)
            .toLowerCase()
            .match(/^(\d+(?:\.\d+)?)(s|m|h|d)$/);

    if (!match) return null;

    const value = Number(match[1]);
    const unit = match[2];

    const units = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    return value * units[unit];
}

async function finishGiveaway(guildId, id) {
    try {
        const giveaway = db.giveaways[id];

        if (!giveaway || giveaway.ended) return;

        giveaway.ended = true;

        const guild =
            await client.guilds.fetch(guildId)
                .catch(() => null);

        if (!guild) {
            saveDB();
            return;
        }

        const channel =
            await guild.channels.fetch(
                giveaway.channelId
            ).catch(() => null);

        if (!channel) {
            saveDB();
            return;
        }

        let winner = null;

        if (giveaway.participants.length > 0) {
            const winnerId =
                giveaway.participants[
                    random(
                        0,
                        giveaway.participants.length - 1
                    )
                ];

            winner =
                await guild.members.fetch(winnerId)
                    .catch(() => null);
        }

        const embed = new EmbedBuilder()
            .setTitle("🏁 ÇEKİLİŞ BİTTİ")
            .setDescription(
                winner
                    ? `🎁 Ödül: **${giveaway.prize}**\n\n` +
                      `🏆 Kazanan: ${winner}`
                    : `🎁 Ödül: **${giveaway.prize}**\n\n` +
                      `❌ Katılımcı olmadığı için kazanan yok.`
            )
            .setTimestamp();

        const oldMessage =
            await channel.messages.fetch(
                giveaway.messageId
            ).catch(() => null);

        if (oldMessage) {
            await oldMessage.edit({
                embeds: [embed],
                components: []
            }).catch(() => {});
        } else {
            await channel.send({
                embeds: [embed]
            }).catch(() => {});
        }

        saveDB();
    } catch (error) {
        console.error(
            "Çekiliş bitirme hatası:",
            error
        );
    }
}

// ======================================================
// ROL BUL
// ======================================================

async function getRoleId(guild, roleName) {
    const role =
        guild.roles.cache.find(
            r => r.name === roleName
        );

    return role ? role.id : null;
}

// ======================================================
// HATALAR
// ======================================================

client.on("error", error => {
    console.error("❌ CLIENT HATASI:");
    console.error(error);
});

process.on("unhandledRejection", error => {
    console.error("❌ UNHANDLED REJECTION:");
    console.error(error);
});

process.on("uncaughtException", error => {
    console.error("❌ UNCAUGHT EXCEPTION:");
    console.error(error);
});

// ======================================================
// GİRİŞ
// ======================================================

client.login(TOKEN)
    .then(() => {
        console.log("🔄 Discord'a bağlanılıyor...");
    })
    .catch(error => {
        console.error("❌ Discord'a giriş yapılamadı!");
        console.error(error);
    });
