const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const fs = require("fs");

const TOKEN = process.env.TOKEN;
const PREFIX = ".";

// =========================
// ROL ID'LERİ
// =========================

const YONETICI_ROLE = "1544449436011339806";
const KAYIT_ROLE = "1544452022764568656";
const DEGER_ROLE = "1544451743746891806";

// =========================
// DOSYA / VERİ
// =========================

const DATA_FILE = "./data.json";

let data = {
  players: {},
  teams: {},
  fixtures: [],
  results: [],
  giveaways: {},
  tickets: {},
  museums: {},
  settings: {
    pingRoles: {},
    ticketCategory: null
  }
};

if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    data = {
      ...data,
      ...saved,
      players: saved.players || {},
      teams: saved.teams || {},
      fixtures: saved.fixtures || [],
      results: saved.results || [],
      giveaways: saved.giveaways || {},
      tickets: saved.tickets || {},
      museums: saved.museums || {},
      settings: saved.settings || {
        pingRoles: {},
        ticketCategory: null
      }
    };
  } catch {
    console.log("data.json okunamadı, yeni veri dosyası oluşturuluyor.");
  }
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.log("Veri kaydedilemedi:", err.message);
  }
}

// =========================
// CLIENT
// =========================

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

// =========================
// YARDIMCI FONKSİYONLAR
// =========================

function isAdmin(member) {
  return (
    member.roles.cache.has(YONETICI_ROLE) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

function isValueStaff(member) {
  return isAdmin(member) || member.roles.cache.has(DEGER_ROLE);
}

function isRegisterStaff(member) {
  return isAdmin(member) || member.roles.cache.has(KAYIT_ROLE);
}

function cleanName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]/gi, "")
    .slice(0, 25) || "oyuncu";
}

function parseMoney(input) {
  if (!input) return null;

  let text = input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");

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

  const value = Number(text);

  if (!Number.isFinite(value)) return null;

  return Math.floor(value * multiplier);
}

function formatMoney(value) {
  value = Number(value) || 0;

  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1).replace(".0", "")}B€`;
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace(".0", "")}M€`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(".0", "")}K€`;
  }

  return `${value}€`;
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getPlayer(id) {
  if (!data.players[id]) {
    data.players[id] = {
      value: 1000000,
      training: 0,
      goals: 0,
      assists: 0,
      penalties: 0,
      team: null
    };
  }

  return data.players[id];
}

function getTeam(name) {
  if (!name) return null;

  const key = Object.keys(data.teams).find(
    x => x.toLowerCase() === name.toLowerCase()
  );

  return key ? data.teams[key] : null;
}

function findTeamByRole(roleId) {
  return Object.entries(data.teams).find(
    ([, team]) => team.roleId === roleId
  );
}

async function createRole(guild, name, color = null) {
  let role = guild.roles.cache.find(r => r.name === name);

  if (!role) {
    try {
      role = await guild.roles.create({
        name,
        color: color || undefined,
        reason: "Futbol RP Bot"
      });
    } catch {
      return null;
    }
  }

  return role;
}

function updateNicknameText(member, value) {
  const current = member.nickname || member.user.username;

  const parts = current.split("|");

  if (parts.length >= 4) {
    parts[parts.length - 1] = ` ${formatMoney(value)}`;
    return parts.join("|").trim();
  }

  return `${current} | ${formatMoney(value)}`;
}

async function updateNickname(member, value) {
  try {
    await member.setNickname(updateNicknameText(member, value));
    return true;
  } catch {
    return false;
  }
}

function durationToMs(text) {
  if (!text) return null;

  const match = text
    .toLowerCase()
    .trim()
    .match(/^(\d+(?:\.\d+)?)(s|sn|m|dk|h|sa|d|g)$/);

  if (!match) return null;

  const number = Number(match[1]);
  const unit = match[2];

  const units = {
    s: 1000,
    sn: 1000,
    m: 60000,
    dk: 60000,
    h: 3600000,
    sa: 3600000,
    d: 86400000,
    g: 86400000
  };

  return number * units[unit];
}

function mentionUser(id) {
  return `<@${id}>`;
}

// =========================
// READY
// =========================

client.once("ready", async () => {
  console.log(`BOT AKTİF: ${client.user.tag}`);

  client.user.setActivity(".yardım | Futbol RP", {
    type: 0
  });

  for (const guild of client.guilds.cache.values()) {
    await createRole(guild, "⚽ Maç Ping");
    await createRole(guild, "📢 Duyuru Ping");
    await createRole(guild, "🎉 Etkinlik Ping");
    await createRole(guild, "📰 Haber Ping");
    await createRole(guild, "🔄 Transfer Ping");

    await createRole(guild, "⚽ Futbolcu");
    await createRole(guild, "🎯 Teknik Direktör");
    await createRole(guild, "❌ Kayıtsız");
  }

  save();
});

// =========================
// MESAJLAR
// =========================

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // TICKET AKTİFLİK
  const ticket = Object.entries(data.tickets).find(
    ([, t]) => t.channelId === message.channel.id && !t.closed
  );

  if (ticket) {
    ticket[1].lastMessage = Date.now();
    save();
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;

  // =========================
  // PING
  // =========================

  if (command === "ping") {
    const sent = await message.reply("🏓 Hesaplanıyor...");

    const latency = sent.createdTimestamp - message.createdTimestamp;

    return sent.edit(
      `🏓 **Pong!**\nBot gecikmesi: **${latency}ms**\nAPI: **${client.ws.ping}ms**`
    );
  }

  // =========================
  // BOT
  // =========================

  if (command === "bot") {
    const embed = new EmbedBuilder()
      .setTitle("🤖 Bot Bilgileri")
      .setDescription(
        `**Bot:** ${client.user}\n` +
        `**Sunucular:** ${client.guilds.cache.size}\n` +
        `**Kullanıcılar:** ${client.users.cache.size}\n` +
        `**Prefix:** \`.\`\n` +
        `**Durum:** 🟢 Aktif`
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // YARDIM
  // =========================

  if (command === "yardım" || command === "yardim" || command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("⚽ Futbol RP Bot")
      .setDescription(
        "**Temel Komutlar**\n" +
        "` .ping ` — Bot gecikmesi\n" +
        "` .bot ` — Bot bilgileri\n" +
        "` .profil ` — Oyuncu profili\n" +
        "` .yardım ` — Yardım menüsü\n\n" +

        "**Oyuncu Sistemleri**\n" +
        "`.dver @oyuncu 5M`\n" +
        "`.antrenman` / `.ant`\n" +
        "`.pen` / `.penaltı`\n" +
        "`.kadro`\n" +
        "`.istatistik`\n\n" +

        "**Kayıt**\n" +
        "`.k @oyuncu İsim`\n" +
        "`.td @oyuncu`\n\n" +

        "**Takım / Lig**\n" +
        "`.takımlar`\n" +
        "`.takımbilgi Takım`\n" +
        "`.takımkur Takım`\n" +
        "`.transfer @oyuncu Takım`\n" +
        "`.maç @takım1 @takım2`\n" +
        "`.puan`\n" +
        "`.golkral`\n" +
        "`.asistkral`\n" +
        "`.fikstur`\n" +
        "`.macsonuclari`\n\n" +

        "**Kupa / Müze**\n" +
        "`.müze Takım`\n" +
        "`.kupaekle Takım Kupa`\n" +
        "`.kupasil Takım Kupa`\n\n" +

        "**Etkinlik**\n" +
        "`.çekiliş 5M 5saat`\n" +
        "`.çekilişbitir ID`\n" +
        "`.rolpanel`\n" +
        "`.ticketpanel`\n\n" +

        "**Yetkili**\n" +
        "`.sil 100`\n" +
        "`.kick @oyuncu`\n" +
        "`.mute @oyuncu`\n" +
        "`.unmute @oyuncu`\n" +
        "`.kilit`\n" +
        "`.aç`\n" +
        "`.embed Başlık | Açıklama`"
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // PROFİL
  // =========================

  if (command === "profil") {
    const member = message.mentions.members.first() || message.member;
    const player = getPlayer(member.id);

    const team = player.team || "Takımsız";

    const embed = new EmbedBuilder()
      .setTitle(`⚽ ${member.displayName}`)
      .setThumbnail(member.displayAvatarURL())
      .addFields(
        {
          name: "💰 Değer",
          value: formatMoney(player.value),
          inline: true
        },
        {
          name: "🏟️ Takım",
          value: team,
          inline: true
        },
        {
          name: "🏋️ Antrenman",
          value: `${player.training}/10`,
          inline: true
        },
        {
          name: "⚽ Gol",
          value: `${player.goals}`,
          inline: true
        },
        {
          name: "🎯 Asist",
          value: `${player.assists}`,
          inline: true
        },
        {
          name: "🥅 Penaltı",
          value: `${player.penalties}`,
          inline: true
        }
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // DEĞER
  // =========================

  if (command === "dver") {
    if (!isValueStaff(message.member)) {
      return message.reply("❌ Bu komutu kullanmak için Değer Yetkilisi olmalısın.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Kullanım: `.dver @oyuncu 5M`");
    }

    const amount = parseMoney(args[0]);

    if (!amount || amount <= 0) {
      return message.reply("❌ Geçerli bir miktar gir.");
    }

    const player = getPlayer(member.id);

    player.value += amount;

    await updateNickname(member, player.value);

    save();

    return message.reply(
      `✅ ${member} oyuncusuna **${formatMoney(amount)}** değer eklendi.\n` +
      `💰 Yeni değer: **${formatMoney(player.value)}**`
    );
  }

  // =========================
  // ANTRENMAN
  // =========================

  if (command === "antrenman" || command === "ant") {
    const player = getPlayer(message.author.id);

    player.training++;

    if (player.training >= 10) {
      player.training = 0;
      player.value += 3000000;

      await updateNickname(message.member, player.value);

      save();

      return message.reply(
        `🏋️ **Antrenman tamamlandı!**\n\n` +
        `📈 İlerleme: **10/10**\n` +
        `💰 Kazanç: **+3M€**\n` +
        `💵 Yeni değer: **${formatMoney(player.value)}**`
      );
    }

    save();

    return message.reply(
      `🏋️ Antrenman yapıldı!\n` +
      `📈 İlerleme: **${player.training}/10**\n` +
      `🎯 10/10 olduğunda **+3M€** kazanırsın.`
    );
  }

  // =========================
  // PENALTI
  // =========================

  if (command === "pen" || command === "penaltı" || command === "penalti") {
    const player = getPlayer(message.author.id);

    const scored = Math.random() < 0.75;

    if (!scored) {
      return message.reply(
        "🥅 Penaltı kullanıldı...\n❌ **Kaçtı!**"
      );
    }

    player.penalties++;
    player.goals++;
    player.value += 2000000;

    await updateNickname(message.member, player.value);

    save();

    return message.reply(
      `🥅 Penaltı kullanıldı...\n` +
      `⚽ **GOOOL!**\n` +
      `💰 +2M€\n` +
      `💵 Yeni değer: **${formatMoney(player.value)}**`
    );
  }

  // =========================
  // KAYIT
  // =========================

  if (command === "k" || command === "kayıt" || command === "kayit") {
    if (!isRegisterStaff(message.member)) {
      return message.reply("❌ Kayıt yetkin yok.");
    }

    const member = message.mentions.members.first();
    const name = args.slice(1).join(" ");

    if (!member || !name) {
      return message.reply("❌ Kullanım: `.k @oyuncu İsim`");
    }

    const player = getPlayer(member.id);

    try {
      const footballerRole =
        message.guild.roles.cache.find(r => r.name === "⚽ Futbolcu") ||
        await createRole(message.guild, "⚽ Futbolcu");

      const unregisteredRole =
        message.guild.roles.cache.find(r => r.name === "❌ Kayıtsız");

      if (footballerRole) await member.roles.add(footballerRole);
      if (unregisteredRole) await member.roles.remove(unregisteredRole);

      await member.setNickname(
        `${name} | 🇹🇷 | SNT | ${formatMoney(player.value)}`
      );
    } catch {}

    save();

    const embed = new EmbedBuilder()
      .setTitle("✅ Oyuncu Kaydı")
      .setDescription(
        `${member} başarıyla kayıt edildi.\n\n` +
        `👤 **İsim:** ${name}\n` +
        `💰 **Değer:** ${formatMoney(player.value)}`
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // TEKNİK DİREKTÖR
  // =========================

  if (command === "td") {
    if (!isRegisterStaff(message.member)) {
      return message.reply("❌ Bu komutu kullanamazsın.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Kullanım: `.td @oyuncu`");
    }

    const role =
      message.guild.roles.cache.find(
        r => r.name === "🎯 Teknik Direktör"
      ) ||
      await createRole(message.guild, "🎯 Teknik Direktör");

    if (!role) {
      return message.reply("❌ Teknik Direktör rolü oluşturulamadı.");
    }

    try {
      await member.roles.add(role);
    } catch {
      return message.reply("❌ Rol verilemedi. Botun rol hiyerarşisini kontrol et.");
    }

    return message.reply(`🎯 ${member} artık **Teknik Direktör**.`);
  }

  // =========================
  // TAKIM KUR
  // =========================

  if (command === "takımkur" || command === "takimkur") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const teamName = args.join(" ");

    if (!teamName) {
      return message.reply("❌ Kullanım: `.takımkur Takım Adı`");
    }

    if (getTeam(teamName)) {
      return message.reply("❌ Bu takım zaten mevcut.");
    }

    const existing = Object.values(data.teams).find(
      team => team.creatorId === message.author.id
    );

    if (existing) {
      return message.reply("❌ Her kullanıcı yalnızca 1 takım kurabilir.");
    }

    const role = await createRole(message.guild, `🏟️ ${teamName}`);

    data.teams[teamName] = {
      creatorId: message.author.id,
      roleId: role?.id || null,
      budget: 50000000,
      players: [],
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0
    };

    if (role) {
      try {
        await message.member.roles.add(role);
      } catch {}
    }

    const tdRole =
      message.guild.roles.cache.find(
        r => r.name === "🎯 Teknik Direktör"
      ) ||
      await createRole(message.guild, "🎯 Teknik Direktör");

    if (tdRole) {
      try {
        await message.member.roles.add(tdRole);
      } catch {}
    }

    save();

    return message.reply(
      `✅ **${teamName}** takımı oluşturuldu!\n\n` +
      `👤 Teknik Direktör: ${message.author}\n` +
      `💰 Takım bütçesi: **50M€**`
    );
  }

  // =========================
  // TAKIMLAR
  // =========================

  if (command === "takımlar" || command === "takimlar") {
    const teams = Object.entries(data.teams);

    if (!teams.length) {
      return message.reply("❌ Henüz takım bulunmuyor.");
    }

    const text = teams
      .map(
        ([name, team], i) =>
          `**${i + 1}. ${name}** — 💰 ${formatMoney(team.budget)}`
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🏟️ Takımlar")
      .setDescription(text)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // TAKIM BİLGİ
  // =========================

  if (command === "takımbilgi" || command === "takimbilgi") {
    const name = args.join(" ");
    const team = getTeam(name);

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    const playerNames = team.players.length
      ? team.players.map(id => `<@${id}>`).join("\n")
      : "Henüz oyuncu yok.";

    const embed = new EmbedBuilder()
      .setTitle(`🏟️ ${name}`)
      .addFields(
        {
          name: "💰 Bütçe",
          value: formatMoney(team.budget),
          inline: true
        },
        {
          name: "🏆 Galibiyet",
          value: `${team.wins}`,
          inline: true
        },
        {
          name: "🤝 Beraberlik",
          value: `${team.draws}`,
          inline: true
        },
        {
          name: "❌ Mağlubiyet",
          value: `${team.losses}`,
          inline: true
        },
        {
          name: "⚽ Gol",
          value: `${team.goalsFor}`,
          inline: true
        },
        {
          name: "🥅 Yenilen",
          value: `${team.goalsAgainst}`,
          inline: true
        },
        {
          name: "👥 Kadro",
          value: playerNames
        }
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // KADRO
  // =========================

  if (command === "kadro") {
    let teamName = args.join(" ");

    if (!teamName) {
      const player = getPlayer(message.author.id);
      teamName = player.team;
    }

    if (!teamName) {
      return message.reply("❌ Bir takım belirtmelisin.");
    }

    const team = getTeam(teamName);

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    if (!team.players.length) {
      return message.reply(`❌ **${teamName}** kadrosu boş.`);
    }

    const list = team.players
      .map((id, index) => `${index + 1}. <@${id}>`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`👥 ${teamName} Kadrosu`)
      .setDescription(list)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // TRANSFER
  // =========================

  if (command === "transfer") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Transfer yetkin yok.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Kullanım: `.transfer @oyuncu Takım`");
    }

    const teamName = args.slice(1).join(" ");
    const team = getTeam(teamName);

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    const player = getPlayer(member.id);

    if (player.team) {
      const oldTeam = getTeam(player.team);

      if (oldTeam) {
        oldTeam.players = oldTeam.players.filter(
          id => id !== member.id
        );
      }
    }

    player.team = teamName;

    if (!team.players.includes(member.id)) {
      team.players.push(member.id);
    }

    if (team.roleId) {
      try {
        await member.roles.add(team.roleId);
      } catch {}
    }

    save();

    return message.reply(
      `🔄 ${member} **${teamName}** takımına transfer edildi!`
    );
  }

  // =========================
  // MAÇ
  // =========================

  if (command === "maç" || command === "mac") {
    const mentionedTeams = [...message.mentions.roles.values()];

    let teamNames = [];

    if (mentionedTeams.length >= 2) {
      for (const role of mentionedTeams.slice(0, 2)) {
        const found = findTeamByRole(role.id);
        if (found) teamNames.push(found[0]);
      }
    }

    if (teamNames.length < 2) {
      const text = args.join(" ").split(/\s+vs\s+|\s+-\s+/i);

      if (text.length >= 2) {
        const t1 = getTeam(text[0]);
        const t2 = getTeam(text[1]);

        if (t1 && t2) {
          teamNames = [text[0], text[1]];
        }
      }
    }

    if (teamNames.length < 2) {
      return message.reply(
        "❌ Kullanım: `.maç @takım1 @takım2`\n" +
        "Takımların rolünü etiketleyebilirsin."
      );
    }

    const team1 = getTeam(teamNames[0]);
    const team2 = getTeam(teamNames[1]);

    if (!team1 || !team2) {
      return message.reply("❌ Takımlardan biri bulunamadı.");
    }

    let score1 = 0;
    let score2 = 0;

    const start = new EmbedBuilder()
      .setTitle("⚽ MAÇ BAŞLADI")
      .setDescription(
        `🏟️ **${teamNames[0]}** vs **${teamNames[1]}**\n\n` +
        `⏱️ Maç simülasyonu başlıyor...`
      )
      .setTimestamp();

    const msg = await message.reply({ embeds: [start] });

    const events = [
      "⚡ Orta sahada top kapma mücadelesi!",
      "🎯 Tehlikeli bir hücum gelişiyor!",
      "🧤 Kaleci kritik bir kurtarış yaptı!",
      "🔥 Hücum baskısı artıyor!",
      "⚽ ŞUT! Top kaleyi sıyırdı!",
      "🎯 Harika bir paslaşma!",
      "🚨 Savunma son anda araya girdi!"
    ];

    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const scoringChance = Math.random();

      let event = events[random(0, events.length - 1)];

      if (scoringChance < 0.20) {
        score1++;

        const possiblePlayers =
          team1.players.length
            ? team1.players
            : [message.author.id];

        const scorer =
          possiblePlayers[random(0, possiblePlayers.length - 1)];

        getPlayer(scorer).goals++;

        event =
          `⚽ **GOOOL! ${teamNames[0]}!**\n` +
          `${mentionUser(scorer)} fileleri havalandırdı!`;
      } else if (scoringChance < 0.40) {
        score2++;

        const possiblePlayers =
          team2.players.length
            ? team2.players
            : [message.author.id];

        const scorer =
          possiblePlayers[random(0, possiblePlayers.length - 1)];

        getPlayer(scorer).goals++;

        event =
          `⚽ **GOOOL! ${teamNames[1]}!**\n` +
          `${mentionUser(scorer)} fileleri havalandırdı!`;
      }

      const embed = new EmbedBuilder()
        .setTitle("⚽ MAÇ DEVAM EDİYOR")
        .setDescription(
          `🏟️ **${teamNames[0]}** vs **${teamNames[1]}**\n\n` +
          `${event}\n\n` +
          `📊 Skor: **${score1} - ${score2}**`
        )
        .setTimestamp();

      await msg.edit({ embeds: [embed] });
    }

    team1.goalsFor += score1;
    team1.goalsAgainst += score2;

    team2.goalsFor += score2;
    team2.goalsAgainst += score1;

    if (score1 > score2) {
      team1.wins++;
      team2.losses++;
    } else if (score2 > score1) {
      team2.wins++;
      team1.losses++;
    } else {
      team1.draws++;
      team2.draws++;
    }

    const result = {
      id: Date.now().toString(),
      team1: teamNames[0],
      team2: teamNames[1],
      score1,
      score2,
      date: Date.now()
    };

    data.results.push(result);

    save();

    const final = new EmbedBuilder()
      .setTitle("🏁 MAÇ SONA ERDİ")
      .setDescription(
        `🏟️ **${teamNames[0]}** ${score1} - ${score2} **${teamNames[1]}**\n\n` +
        (score1 > score2
          ? `🏆 Kazanan: **${teamNames[0]}**`
          : score2 > score1
          ? `🏆 Kazanan: **${teamNames[1]}**`
          : `🤝 Maç berabere bitti!`)
      )
      .setTimestamp();

    return msg.edit({ embeds: [final] });
  }

  // =========================
  // PUAN DURUMU
  // =========================

  if (command === "puan") {
    const teams = Object.entries(data.teams)
      .map(([name, team]) => {
        const points =
          team.wins * 3 +
          team.draws;

        const average =
          team.goalsFor - team.goalsAgainst;

        return {
          name,
          team,
          points,
          average
        };
      })
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.average - a.average
      );

    if (!teams.length) {
      return message.reply("❌ Puan durumu boş.");
    }

    const text = teams
      .map(
        (x, i) =>
          `**${i + 1}. ${x.name}** — ${x.points} P\n` +
          `⚽ ${x.team.goalsFor} | 🥅 ${x.team.goalsAgainst}`
      )
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle("🏆 Puan Durumu")
      .setDescription(text)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // GOL KRALLIĞI
  // =========================

  if (command === "golkral") {
    const players = Object.entries(data.players)
      .sort(([, a], [, b]) => b.goals - a.goals)
      .slice(0, 10);

    if (!players.length) {
      return message.reply("❌ Henüz gol atan oyuncu yok.");
    }

    const text = players
      .map(
        ([id, player], i) =>
          `**${i + 1}.** <@${id}> — ⚽ **${player.goals} gol**`
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("👑 Gol Krallığı")
      .setDescription(text)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // ASİST KRALLIĞI
  // =========================

  if (command === "asistkral") {
    const players = Object.entries(data.players)
      .sort(([, a], [, b]) => b.assists - a.assists)
      .slice(0, 10);

    if (!players.length) {
      return message.reply("❌ Henüz asist bulunmuyor.");
    }

    const text = players
      .map(
        ([id, player], i) =>
          `**${i + 1}.** <@${id}> — 🎯 **${player.assists} asist**`
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🎯 Asist Krallığı")
      .setDescription(text)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // FİKSTÜR
  // =========================

  if (command === "fikstur") {
    if (!data.fixtures.length) {
      return message.reply("📅 Henüz fikstür bulunmuyor.");
    }

    const text = data.fixtures
      .slice(-20)
      .map(
        (x, i) =>
          `**${i + 1}.** ${x.team1} 🆚 ${x.team2}`
      )
      .join("\n");

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📅 Fikstür")
          .setDescription(text)
          .setTimestamp()
      ]
    });
  }

  // =========================
  // MAÇ SONUÇLARI
  // =========================

  if (command === "macsonuclari") {
    if (!data.results.length) {
      return message.reply("❌ Henüz maç sonucu yok.");
    }

    const text = data.results
      .slice(-15)
      .reverse()
      .map(
        x =>
          `⚽ **${x.team1}** ${x.score1} - ${x.score2} **${x.team2}**`
      )
      .join("\n");

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📋 Maç Sonuçları")
          .setDescription(text)
          .setTimestamp()
      ]
    });
  }

  // =========================
  // İSTATİSTİK
  // =========================

  if (command === "istatistik") {
    const member =
      message.mentions.members.first() || message.member;

    const player = getPlayer(member.id);

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${member.displayName} İstatistikleri`)
      .addFields(
        {
          name: "⚽ Goller",
          value: `${player.goals}`,
          inline: true
        },
        {
          name: "🎯 Asistler",
          value: `${player.assists}`,
          inline: true
        },
        {
          name: "🥅 Penaltılar",
          value: `${player.penalties}`,
          inline: true
        },
        {
          name: "🏋️ Antrenman",
          value: `${player.training}/10`,
          inline: true
        },
        {
          name: "💰 Değer",
          value: formatMoney(player.value),
          inline: true
        },
        {
          name: "🏟️ Takım",
          value: player.team || "Takımsız",
          inline: true
        }
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // MÜZE
  // =========================

  if (command === "müze" || command === "muze") {
    const teamName = args.join(" ");
    const team = getTeam(teamName);

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    const cups = data.museums[teamName] || [];

    const text = cups.length
      ? cups.map((x, i) => `🏆 ${i + 1}. ${x}`).join("\n")
      : "Henüz kupa kazanılmamış.";

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🏆 ${teamName} Müze`)
          .setDescription(text)
          .setTimestamp()
      ]
    });
  }

  // =========================
  // KUPA EKLE
  // =========================

  if (command === "kupaekle") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const teamName = args.shift();
    const cupName = args.join(" ");

    if (!teamName || !cupName) {
      return message.reply(
        "❌ Kullanım: `.kupaekle Takım Kupa Adı`"
      );
    }

    const team = getTeam(teamName);

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    if (!data.museums[teamName]) {
      data.museums[teamName] = [];
    }

    data.museums[teamName].push(cupName);

    save();

    return message.reply(
      `🏆 **${teamName}** müzesine **${cupName}** eklendi.`
    );
  }

  // =========================
  // KUPA SİL
  // =========================

  if (command === "kupasil") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const teamName = args.shift();
    const cupName = args.join(" ");

    if (!teamName || !cupName) {
      return message.reply(
        "❌ Kullanım: `.kupasil Takım Kupa Adı`"
      );
    }

    if (!data.museums[teamName]) {
      return message.reply("❌ Bu takımın müzesi bulunmuyor.");
    }

    const index = data.museums[teamName].findIndex(
      x => x.toLowerCase() === cupName.toLowerCase()
    );

    if (index === -1) {
      return message.reply("❌ Kupa bulunamadı.");
    }

    data.museums[teamName].splice(index, 1);

    save();

    return message.reply(
      `🗑️ **${cupName}** kupası silindi.`
    );
  }

  // =========================
  // PING ROL PANELİ
  // =========================

  if (command === "rolpanel") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const roles = [
      ["⚽ Maç Ping", "ping_mac"],
      ["📢 Duyuru Ping", "ping_duyuru"],
      ["🎉 Etkinlik Ping", "ping_etkinlik"],
      ["📰 Haber Ping", "ping_haber"],
      ["🔄 Transfer Ping", "ping_transfer"]
    ];

    const buttons = [];

    for (const [name, id] of roles) {
      const role = await createRole(message.guild, name);

      if (role) {
        data.settings.pingRoles[id] = role.id;
      }

      buttons.push(
        new ButtonBuilder()
          .setCustomId(`ping_${id}`)
          .setLabel(name)
          .setStyle(ButtonStyle.Secondary)
      );
    }

    save();

    const rows = [];

    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(
        new ActionRowBuilder().addComponents(
          buttons.slice(i, i + 2)
        )
      );
    }

    const embed = new EmbedBuilder()
      .setTitle("🔔 Bildirim Rolleri")
      .setDescription(
        "İstediğin bildirim rolüne basarak rolü alabilir veya kaldırabilirsin."
      )
      .setTimestamp();

    return message.channel.send({
      embeds: [embed],
      components: rows
    });
  }

  // =========================
  // TICKET PANEL
  // =========================

  if (command === "ticketpanel") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_type")
      .setPlaceholder("🎫 Destek türünü seç")
      .addOptions([
        {
          label: "Genel Destek",
          value: "genel",
          emoji: "💬"
        },
        {
          label: "Teknik Destek",
          value: "teknik",
          emoji: "🔧"
        },
        {
          label: "Yönetim Desteği",
          value: "yonetim",
          emoji: "👑"
        }
      ]);

    const embed = new EmbedBuilder()
      .setTitle("🎫 Destek Merkezi")
      .setDescription(
        "Aşağıdaki menüden destek türünü seçerek ticket oluşturabilirsin.\n\n" +
        "💬 Genel Destek\n" +
        "🔧 Teknik Destek\n" +
        "👑 Yönetim Desteği\n\n" +
        "⏱️ Ticket 60 dakika aktiflik olmazsa otomatik kapanır."
      )
      .setTimestamp();

    return message.channel.send({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(menu)
      ]
    });
  }

  // =========================
  // ÇEKİLİŞ
  // =========================

  if (
    command === "çekiliş" ||
    command === "cekilis"
  ) {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const prize = args[0];
    const duration = args[1];

    const amount = parseMoney(prize);
    const durationMs = durationToMs(duration);

    if (!amount || !durationMs) {
      return message.reply(
        "❌ Kullanım: `.çekiliş 5M 5saat`\n" +
        "Örnek: `.çekiliş 60M 2g`"
      );
    }

    const giveawayId = Date.now().toString();

    data.giveaways[giveawayId] = {
      prize: amount,
      channelId: message.channel.id,
      creatorId: message.author.id,
      participants: [],
      endsAt: Date.now() + durationMs,
      ended: false
    };

    save();

    const button = new ButtonBuilder()
      .setCustomId(`giveaway_${giveawayId}`)
      .setLabel("🎉 Katıl")
      .setStyle(ButtonStyle.Success);

    const embed = new EmbedBuilder()
      .setTitle("🎉 ÇEKİLİŞ")
      .setDescription(
        `💰 **Ödül:** ${formatMoney(amount)}\n\n` +
        `⏱️ **Süre:** ${duration}\n\n` +
        `👥 Katılmak için aşağıdaki butona bas!\n\n` +
        `🆔 Çekiliş ID: \`${giveawayId}\``
      )
      .setTimestamp();

    const giveawayMessage = await message.channel.send({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(button)
      ]
    });

    data.giveaways[giveawayId].messageId =
      giveawayMessage.id;

    save();

    setTimeout(
      () => endGiveaway(giveawayId),
      durationMs
    );

    return;
  }

  // =========================
  // ÇEKİLİŞ BİTİR
  // =========================

  if (
    command === "çekilişbitir" ||
    command === "cekilisbitir"
  ) {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const id = args[0];

    if (!id || !data.giveaways[id]) {
      return message.reply("❌ Çekiliş bulunamadı.");
    }

    await endGiveaway(id);

    return message.reply("✅ Çekiliş bitirildi.");
  }

  // =========================
  // EMBED
  // =========================

  if (command === "embed") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const text = args.join(" ");
    const parts = text.split("|");

    const title = parts[0]?.trim() || "Duyuru";
    const description =
      parts.slice(1).join("|").trim() ||
      "Açıklama bulunmuyor.";

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();

    return message.channel.send({
      embeds: [embed]
    });
  }

  // =========================
  // SİL
  // =========================

  if (command === "sil") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    let amount = Number(args[0]);

    if (!Number.isInteger(amount) || amount < 1) {
      return message.reply("❌ Geçerli bir sayı gir.");
    }

    if (amount > 1000) amount = 1000;

    let deleted = 0;

    while (deleted < amount) {
      const remaining = Math.min(100, amount - deleted);

      try {
        const messages =
          await message.channel.bulkDelete(
            remaining,
            true
          );

        deleted += messages.size;

        if (messages.size === 0) break;

        if (deleted < amount) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch {
        break;
      }
    }

    const info = await message.channel.send(
      `🗑️ **${deleted}** mesaj silindi.`
    );

    setTimeout(() => {
      info.delete().catch(() => {});
    }, 3000);

    return;
  }

  // =========================
  // KICK
  // =========================

  if (command === "kick") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Bir kullanıcı etiketle.");
    }

    if (!member.kickable) {
      return message.reply(
        "❌ Bu kullanıcıyı atamıyorum. Rol hiyerarşisini kontrol et."
      );
    }

    try {
      await member.kick(
        `Yetkili: ${message.author.tag}`
      );
    } catch {
      return message.reply("❌ Kullanıcı atılamadı.");
    }

    return message.reply(
      `👢 **${member.user.tag}** sunucudan atıldı.`
    );
  }

  // =========================
  // MUTE
  // =========================

  if (command === "mute") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Bir kullanıcı etiketle.");
    }

    let role =
      message.guild.roles.cache.find(
        r => r.name === "🔇 Muted"
      );

    if (!role) {
      role = await createRole(
        message.guild,
        "🔇 Muted"
      );
    }

    if (!role) {
      return message.reply("❌ Mute rolü oluşturulamadı.");
    }

    try {
      await member.roles.add(role);
    } catch {
      return message.reply("❌ Mute verilemedi.");
    }

    return message.reply(
      `🔇 ${member} susturuldu.`
    );
  }

  // =========================
  // UNMUTE
  // =========================

  if (command === "unmute") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Bir kullanıcı etiketle.");
    }

    const role =
      message.guild.roles.cache.find(
        r => r.name === "🔇 Muted"
      );

    if (role) {
      try {
        await member.roles.remove(role);
      } catch {}
    }

    return message.reply(
      `🔊 ${member} susturması kaldırıldı.`
    );
  }

  // =========================
  // KANAL KİLİT
  // =========================

  if (command === "kilit") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    try {
      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: false
        }
      );
    } catch {
      return message.reply("❌ Kanal kilitlenemedi.");
    }

    return message.reply(
      "🔒 Kanal kilitlendi."
    );
  }

  // =========================
  // KANAL AÇ
  // =========================

  if (
    command === "aç" ||
    command === "ac" ||
    command === "kilitaç"
  ) {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    try {
      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: null
        }
      );
    } catch {
      return message.reply("❌ Kanal açılamadı.");
    }

    return message.reply(
      "🔓 Kanal tekrar açıldı."
    );
  }
});

// =========================
// INTERACTIONS
// =========================

client.on("interactionCreate", async interaction => {
  try {
    // =========================
    // PING ROLLERİ
    // =========================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("ping_")
    ) {
      const key =
        interaction.customId.replace("ping_", "");

      const roleId =
        data.settings.pingRoles[key];

      if (!roleId) {
        return interaction.reply({
          content: "❌ Bu rol bulunamadı.",
          ephemeral: true
        });
      }

      const role =
        interaction.guild.roles.cache.get(roleId);

      if (!role) {
        return interaction.reply({
          content: "❌ Rol bulunamadı.",
          ephemeral: true
        });
      }

      const member =
        interaction.member;

      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);

        return interaction.reply({
          content: `❌ ${role} rolü kaldırıldı.`,
          ephemeral: true
        });
      }

      await member.roles.add(role);

      return interaction.reply({
        content: `✅ ${role} rolü verildi.`,
        ephemeral: true
      });
    }

    // =========================
    // ÇEKİLİŞ KATILIM
    // =========================

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
        data.giveaways[id];

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

      save();

      return interaction.reply({
        content: "🎉 Çekilişe başarıyla katıldın!",
        ephemeral: true
      });
    }

    // =========================
    // TICKET
    // =========================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_type"
    ) {
      const existing =
        Object.values(data.tickets).find(
          t =>
            t.userId === interaction.user.id &&
            !t.closed
        );

      if (existing) {
        return interaction.reply({
          content: `❌ Zaten açık ticketın var: <#${existing.channelId}>`,
          ephemeral: true
        });
      }

      const type =
        interaction.values[0];

      const typeNames = {
        genel: "Genel Destek",
        teknik: "Teknik Destek",
        yonetim: "Yönetim Desteği"
      };

      const channelName =
        `ticket-${cleanName(
          interaction.user.username
        )}`;

      let channel;

      try {
        channel =
          await interaction.guild.channels.create({
            name: channelName,
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
                id: YONETICI_ROLE,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory
                ]
              }
            ]
          });
      } catch {
        return interaction.reply({
          content: "❌ Ticket kanalı oluşturulamadı.",
          ephemeral: true
        });
      }

      const ticketId =
        Date.now().toString();

      data.tickets[ticketId] = {
        userId: interaction.user.id,
        channelId: channel.id,
        type,
        lastMessage: Date.now(),
        closed: false
      };

      save();

      const closeButton =
        new ButtonBuilder()
          .setCustomId(
            `ticket_close_${ticketId}`
          )
          .setLabel("🔒 Ticket Kapat")
          .setStyle(ButtonStyle.Danger);

      const embed =
        new EmbedBuilder()
          .setTitle(`🎫 ${typeNames[type]}`)
          .setDescription(
            `${interaction.user}, destek talebin oluşturuldu.\n\n` +
            `👑 Yetkililer seninle ilgilenecektir.\n` +
            `⏱️ 60 dakika boyunca mesaj gönderilmezse ticket otomatik kapanır.`
          )
          .setTimestamp();

      await channel.send({
        content:
          `${interaction.user} <@&${YONETICI_ROLE}>`,
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            closeButton
          )
        ]
      });

      return interaction.reply({
        content: `✅ Ticket oluşturuldu: ${channel}`,
        ephemeral: true
      });
    }

    // =========================
    // TICKET KAPAT
    // =========================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "ticket_close_"
      )
    ) {
      if (
        !isAdmin(interaction.member)
      ) {
        return interaction.reply({
          content: "❌ Ticket kapatma yetkin yok.",
          ephemeral: true
        });
      }

      const id =
        interaction.customId.replace(
          "ticket_close_",
          ""
        );

      const ticket =
        data.tickets[id];

      if (!ticket) {
        return interaction.reply({
          content: "❌ Ticket bulunamadı.",
          ephemeral: true
        });
      }

      ticket.closed = true;
      save();

      await interaction.reply(
        "🔒 Ticket 5 saniye içinde kapatılıyor."
      );

      setTimeout(() => {
        interaction.channel
          ?.delete()
          .catch(() => {});
      }, 5000);
    }
  } catch (err) {
    console.log(
      "Interaction hatası:",
      err.message
    );

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ Bir hata oluştu.",
          ephemeral: true
        });
      } catch {}
    }
  }
});

// =========================
// ÇEKİLİŞ BİTİRME
// =========================

async function endGiveaway(id) {
  const giveaway =
    data.giveaways[id];

  if (!giveaway || giveaway.ended) {
    return;
  }

  giveaway.ended = true;

  save();

  const channel =
    client.channels.cache.get(
      giveaway.channelId
    );

  if (!channel) return;

  let winner = null;

  if (giveaway.participants.length) {
    winner =
      giveaway.participants[
        random(
          0,
          giveaway.participants.length - 1
        )
      ];
  }

  const embed =
    new EmbedBuilder()
      .setTitle("🏁 ÇEKİLİŞ SONA ERDİ")
      .setDescription(
        `💰 Ödül: **${formatMoney(
          giveaway.prize
        )}**\n\n` +
        (
          winner
            ? `🎉 Kazanan: <@${winner}>`
            : "❌ Katılımcı olmadığı için kazanan yok."
        )
      )
      .setTimestamp();

  try {
    await channel.send({
      embeds: [embed]
    });
  } catch {}
}

// =========================
// TICKET OTOMATİK KAPATMA
// =========================

setInterval(async () => {
  const now = Date.now();

  for (const [id, ticket] of Object.entries(
    data.tickets
  )) {
    if (ticket.closed) continue;

    if (
      now - ticket.lastMessage >=
      60 * 60 * 1000
    ) {
      ticket.closed = true;

      const channel =
        client.channels.cache.get(
          ticket.channelId
        );

      if (channel) {
        try {
          await channel.send(
            "⏱️ 60 dakika boyunca mesaj gönderilmediği için ticket otomatik kapatılıyor."
          );
        } catch {}

        setTimeout(() => {
          channel.delete().catch(() => {});
        }, 5000);
      }
    }
  }

  save();
}, 60 * 1000);

// =========================
// HATA YAKALAMA
// =========================

process.on("unhandledRejection", error => {
  console.log(
    "Unhandled Rejection:",
    error
  );
});

process.on("uncaughtException", error => {
  console.log(
    "Uncaught Exception:",
    error
  );
});

// =========================
// TOKEN
// =========================

if (!TOKEN) {
  console.error(
    "❌ TOKEN bulunamadı! Railway Variables kısmına TOKEN ekle."
  );
  process.exit(1);
}

client.login(TOKEN);
