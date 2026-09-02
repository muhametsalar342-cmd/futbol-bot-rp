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
// ROLLER
// =========================

const ROLES = {
  YONETICI: "1544449436011339806",
  KAYIT_YETKILISI: "1544452022764568656",
  DEGER_YETKILISI: "1544451743746891806"
};

// =========================
// DOSYA SİSTEMİ
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
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    data = {
      ...data,
      ...loaded,
      players: loaded.players || {},
      teams: loaded.teams || {},
      fixtures: loaded.fixtures || [],
      results: loaded.results || [],
      giveaways: loaded.giveaways || {},
      tickets: loaded.tickets || {},
      museums: loaded.museums || {},
      settings: {
        ...data.settings,
        ...(loaded.settings || {})
      }
    };
  } catch (err) {
    console.log("data.json okunamadı, yeni veri dosyası oluşturuluyor.");
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// =========================
// CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
    Partials.User
  ]
});

// =========================
// YARDIMCI FONKSİYONLAR
// =========================

function isAdmin(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(ROLES.YONETICI)
  );
}

function isValueStaff(member) {
  return (
    isAdmin(member) ||
    member.roles.cache.has(ROLES.DEGER_YETKILISI)
  );
}

function isRegisterStaff(member) {
  return (
    isAdmin(member) ||
    member.roles.cache.has(ROLES.KAYIT_YETKILISI)
  );
}

function getPlayer(id) {
  if (!data.players[id]) {
    data.players[id] = {
      value: 1000000,
      budget: 0,
      training: 0,
      goals: 0,
      assists: 0,
      penalties: 0,
      team: null
    };
  }

  if (typeof data.players[id].value !== "number") {
    data.players[id].value = 1000000;
  }

  if (typeof data.players[id].budget !== "number") {
    data.players[id].budget = 0;
  }

  if (typeof data.players[id].training !== "number") {
    data.players[id].training = 0;
  }

  if (typeof data.players[id].goals !== "number") {
    data.players[id].goals = 0;
  }

  if (typeof data.players[id].assists !== "number") {
    data.players[id].assists = 0;
  }

  if (typeof data.players[id].penalties !== "number") {
    data.players[id].penalties = 0;
  }

  if (!("team" in data.players[id])) {
    data.players[id].team = null;
  }

  return data.players[id];
}

function cleanName(name) {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 90);
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

  if (!Number.isFinite(number)) return NaN;

  return Math.floor(number * multiplier);
}

function formatMoney(amount) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));

  if (amount >= 1000000000) {
    const n = amount / 1000000000;
    return `${Number(n.toFixed(2))}B€`;
  }

  if (amount >= 1000000) {
    const n = amount / 1000000;
    return `${Number(n.toFixed(2))}M€`;
  }

  if (amount >= 1000) {
    const n = amount / 1000;
    return `${Number(n.toFixed(2))}K€`;
  }

  return `${amount}€`;
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTeam(id) {
  return data.teams[id] || null;
}

function findTeamByRole(roleId) {
  for (const [id, team] of Object.entries(data.teams)) {
    if (team.roleId === roleId) {
      return team;
    }
  }

  return null;
}

function findTeamByName(name) {
  if (!name) return null;

  const target = name.toLowerCase().trim();

  return Object.values(data.teams).find(
    team => team.name.toLowerCase() === target
  ) || null;
}

async function createRole(guild, name, color = null) {
  let role = guild.roles.cache.find(r => r.name === name);

  if (!role) {
    role = await guild.roles.create({
      name,
      color: color || undefined,
      reason: "Futbol RP Bot otomatik rol sistemi"
    });
  }

  return role;
}

async function updateNickname(member) {
  try {
    const player = getPlayer(member.id);

    let nickname = member.nickname || member.user.username;

    const parts = nickname.split("|").map(x => x.trim());

    if (parts.length >= 4) {
      parts[parts.length - 1] = formatMoney(player.value);
      nickname = parts.join(" | ");
    }

    if (nickname.length > 32) {
      nickname = nickname.slice(0, 32);
    }

    if (member.manageable) {
      await member.setNickname(nickname).catch(() => {});
    }
  } catch {}
}

function durationToMs(input) {
  if (!input) return NaN;

  const match = String(input)
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)(s|m|h|d)$/);

  if (!match) return NaN;

  const value = Number(match[1]);
  const unit = match[2];

  const units = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000
  };

  return value * units[unit];
}

function mentionUser(id) {
  return `<@${id}>`;
}

function findChannelByNames(guild, names) {
  return guild.channels.cache.find(channel =>
    names.includes(channel.name.toLowerCase())
  );
}

function getTeamOfUser(userId) {
  return Object.values(data.teams).find(
    team => team.creatorId === userId
  ) || null;
}

function getTeamMemberCount(team) {
  return Object.values(data.players).filter(
    player => player.team === team.id
  ).length;
}

// =========================
// BOT HAZIR
// =========================

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} aktif!`);

  client.user.setPresence({
    activities: [
      {
        name: "⚽ Futbol RP",
        type: 3
      }
    ],
    status: "online"
  });

  for (const guild of client.guilds.cache.values()) {
    try {
      await createRole(guild, "Futbolcu");
      await createRole(guild, "Teknik Direktör");
      await createRole(guild, "Kayıtsız");
    } catch (err) {
      console.log("Rol oluşturma hatası:", err.message);
    }

    if (!data.settings.pingRoles[guild.id]) {
      data.settings.pingRoles[guild.id] = {};
    }

    const pingNames = [
      ["mac", "⚽ Maç Ping"],
      ["duyuru", "📢 Duyuru Ping"],
      ["etkinlik", "🎉 Etkinlik Ping"],
      ["haber", "📰 Haber Ping"],
      ["transfer", "🔄 Transfer Ping"]
    ];

    for (const [key, roleName] of pingNames) {
      let role = guild.roles.cache.find(r => r.name === roleName);

      if (!role) {
        try {
          role = await guild.roles.create({
            name: roleName,
            reason: "Ping paneli"
          });
        } catch {}
      }

      if (role) {
        data.settings.pingRoles[guild.id][key] = role.id;
      }
    }
  }

  save();
});

// =========================
// SUNUCUYA YENİ ÜYE GELDİ
// =========================

client.on("guildMemberAdd", async member => {
  try {
    const kayıtKanali = member.guild.channels.cache.find(channel =>
      [
        "kayıt",
        "kayit",
        "kayıt-kanalı",
        "kayit-kanali",
        "kayıt-📝",
        "kayit-📝"
      ].includes(channel.name.toLowerCase())
    );

    if (!kayıtKanali || !kayıtKanali.isTextBased()) return;

    const kayıtRolü =
      member.guild.roles.cache.find(r => r.name === "Kayıtsız");

    if (kayıtRolü) {
      await member.roles.add(kayıtRolü).catch(() => {});
    }

    const embed = new EmbedBuilder()
      .setTitle("🎉 Aramıza Hoş Geldin!")
      .setDescription(
        `Hoş geldin ${member}!\n\n` +
        `⚽ Futbol RP sunucumuza katıldığın için mutluyuz.\n\n` +
        `📋 Kayıt olmak için kayıt yetkilisinin seninle ilgilenmesini bekle.\n` +
        `👤 **Kayıt Yetkilisi:** <@&${ROLES.KAYIT_YETKILISI}>`
      )
      .setColor("Green")
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await kayıtKanali.send({
      content: `${member} <@&${ROLES.KAYIT_YETKILISI}>`,
      embeds: [embed]
    });
  } catch (err) {
    console.log("Yeni üye mesajı hatası:", err.message);
  }
});

// =========================
// MESAJ SİSTEMİ
// =========================

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const raw = message.content.slice(PREFIX.length).trim();

  if (!raw) return;

  const args = raw.split(/\s+/);
  const command = args.shift().toLowerCase();

  const player = getPlayer(message.author.id);

  // =========================
  // PING
  // =========================

  if (command === "ping") {
    const msg = await message.reply("🏓 Ping ölçülüyor...");

    const latency = msg.createdTimestamp - message.createdTimestamp;

    await msg.edit(
      `🏓 **Pong!**\n💻 Bot: \`${latency}ms\`\n🌐 API: \`${Math.round(
        client.ws.ping
      )}ms\``
    );

    return;
  }

  // =========================
  // BOT
  // =========================

  if (command === "bot") {
    const embed = new EmbedBuilder()
      .setTitle("🤖 Bot Bilgileri")
      .setDescription(
        `⚽ Futbol RP Botu\n\n` +
        `👥 Sunucu: ${client.guilds.cache.size}\n` +
        `👤 Kullanıcı: ${client.users.cache.size}\n` +
        `📡 Ping: ${Math.round(client.ws.ping)}ms\n` +
        `⚙️ Discord.js: v14`
      )
      .setColor("Blue");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // YARDIM
  // =========================

  if (command === "yardım" || command === "yardim" || command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("⚽ Futbol RP Komutları")
      .setDescription(
        "**👤 Oyuncu**\n" +
        "`.profil`\n" +
        "`.dver @oyuncu 5M`\n" +
        "`.antrenman`\n" +
        "`.penaltı`\n" +
        "`.transfer @oyuncu Takım`\n\n" +

        "**💰 Bütçe**\n" +
        "`.bütçe`\n" +
        "`.bütçeekle @oyuncu 5M`\n" +
        "`.bütçesil @oyuncu 5M`\n" +
        "`.bütçegönder @oyuncu 5M`\n\n" +

        "**🏟️ Takım**\n" +
        "`.takımkur Takım Adı`\n" +
        "`.takımlar`\n" +
        "`.takımbilgi`\n" +
        "`.kadro`\n" +
        "`.takımbütçe`\n" +
        "`.takımbütçeekle 5M`\n" +
        "`.takımbütçesil 5M`\n" +
        "`.takımbütçegönder @oyuncu 5M`\n\n" +

        "**🏆 Lig**\n" +
        "`.maç @takım1 @takım2`\n" +
        "`.puan`\n" +
        "`.golkral`\n" +
        "`.asistkral`\n" +
        "`.fikstur`\n" +
        "`.macsonuclari`\n" +
        "`.istatistik`\n\n" +

        "**🎉 Etkinlik**\n" +
        "`.çekiliş 5M€ 5saat`\n" +
        "`.çekilişbitir ID`\n\n" +

        "**🛡️ Yönetim**\n" +
        "`.sil 100`\n" +
        "`.kick @oyuncu`\n" +
        "`.mute @oyuncu`\n" +
        "`.unmute @oyuncu`\n" +
        "`.kilit`\n" +
        "`.aç`\n" +
        "`.embed`\n\n" +

        "**📋 Diğer**\n" +
        "`.şart`\n" +
        "`.rolpanel`\n" +
        "`.ticketpanel`"
      )
      .setColor("Blue");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // ŞART
  // =========================

  if (command === "şart" || command === "sart") {
    const rolAl = findChannelByNames(message.guild, [
      "rol-al",
      "rol_al",
      "rolal"
    ]);

    const kaliciTik = findChannelByNames(message.guild, [
      "kalıcı-tik",
      "kalici-tik",
      "kalıcı_tik",
      "kalici_tik"
    ]);

    const rolAlText = rolAl ? `<#${rolAl.id}>` : "`#rol-al`";
    const tikText = kaliciTik ? `<#${kaliciTik.id}>` : "`#kalıcı-tik`";

    const embed = new EmbedBuilder()
      .setTitle("📋 Sunucu Şartları")
      .setDescription(
        "Sunucudaki sistemlerden yararlanabilmek için aşağıdaki şartları tamamlaman gerekiyor.\n\n" +
        `🎭 **1. En az 3 rol al**\n${rolAlText} kanalından **en az 3 rol** alman gerekiyor.\n\n` +
        `✅ **2. Kalıcı Tik**\n${tikText} kanalına girerek **✅ tik butonuna basman** gerekiyor.\n\n` +
        "Bu iki şart tamamlandıktan sonra kayıt işlemlerine devam edebilirsin."
      )
      .setColor("Gold")
      .setFooter({ text: "Futbol RP • Şartlar" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // PROFİL
  // =========================

  if (command === "profil") {
    const member =
      message.mentions.members.first() ||
      message.member;

    const p = getPlayer(member.id);

    const team = p.team ? getTeam(p.team) : null;

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${member.user.username} Profili`)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        {
          name: "💰 Değer",
          value: formatMoney(p.value),
          inline: true
        },
        {
          name: "💳 Bütçe",
          value: formatMoney(p.budget),
          inline: true
        },
        {
          name: "⚽ Takım",
          value: team ? team.name : "Takımsız",
          inline: true
        },
        {
          name: "🏋️ Antrenman",
          value: `${p.training}/10`,
          inline: true
        },
        {
          name: "⚽ Gol",
          value: `${p.goals}`,
          inline: true
        },
        {
          name: "🅰️ Asist",
          value: `${p.assists}`,
          inline: true
        },
        {
          name: "🥅 Penaltı",
          value: `${p.penalties}`,
          inline: true
        }
      )
      .setColor("Blue");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // DEĞER VER
  // =========================

  if (command === "dver") {
    if (!isValueStaff(message.member)) {
      return message.reply("❌ Bu komutu kullanmak için **Değer Yetkilisi** olmalısın.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Kullanım: `.dver @oyuncu 5M`");
    }

    const amount = parseMoney(args[0]);

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply("❌ Geçerli bir değer gir.");
    }

    const targetPlayer = getPlayer(target.id);

    targetPlayer.value += amount;

    await updateNickname(target);

    save();

    return message.reply(
      `✅ ${target} oyuncusuna **${formatMoney(amount)}** değer eklendi.\n` +
      `💰 Yeni değer: **${formatMoney(targetPlayer.value)}**`
    );
  }

  // =========================
  // ANTRENMAN
  // =========================

  if (command === "antrenman" || command === "ant") {
    player.training++;

    if (player.training >= 10) {
      player.training = 0;
      player.value += 3000000;

      await updateNickname(message.member);

      save();

      return message.reply(
        `🏋️ **Antrenman tamamlandı!**\n\n` +
        `🎁 Kazanç: **+3M€ değer**\n` +
        `💰 Yeni değer: **${formatMoney(player.value)}**\n` +
        `🔄 Antrenman: **0/10**`
      );
    }

    save();

    return message.reply(
      `🏋️ Antrenman yapıldı!\n\n` +
      `📈 İlerleme: **${player.training}/10**\n` +
      `🎯 10/10 olduğunda **+3M€ değer** kazanırsın.`
    );
  }

  // =========================
  // PENALTI
  // =========================

  if (command === "pen" || command === "penaltı" || command === "penalti") {
    const scored = Math.random() < 0.7;

    if (scored) {
      player.penalties++;
      player.goals++;
      player.value += 2000000;

      await updateNickname(message.member);

      save();

      return message.reply(
        `🥅⚽ **GOOOOOL!**\n\n` +
        `💰 Kazanç: **+2M€ değer**\n` +
        `⚽ Gol: **+1**\n` +
        `💎 Yeni değer: **${formatMoney(player.value)}**`
      );
    }

    return message.reply(
      `🥅❌ **Kaçtı!**\nKaleci penaltıyı kurtardı.`
    );
  }

  // =========================
  // KAYIT
  // =========================

  if (command === "k" || command === "kayıt" || command === "kayit") {
    if (!isRegisterStaff(message.member)) {
      return message.reply("❌ Bu komutu sadece **Kayıt Yetkilisi** kullanabilir.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Kullanım: `.k @oyuncu İsim`");
    }

    const playerName =
      args.slice(1).join(" ") ||
      target.user.username;

    const futbolcuRole = message.guild.roles.cache.find(
      r => r.name === "Futbolcu"
    );

    const kayitsizRole = message.guild.roles.cache.find(
      r => r.name === "Kayıtsız"
    );

    if (futbolcuRole) {
      await target.roles.add(futbolcuRole).catch(() => {});
    }

    if (kayitsizRole) {
      await target.roles.remove(kayitsizRole).catch(() => {});
    }

    getPlayer(target.id);

    if (playerName) {
      try {
        await target.setNickname(
          `${playerName} | 🇹🇷 | SNT | ${formatMoney(getPlayer(target.id).value)}`
        );
      } catch {}
    }

    save();

    const embed = new EmbedBuilder()
      .setTitle("✅ Kayıt Tamamlandı")
      .setDescription(
        `${target} başarıyla kayıt edildi.\n\n` +
        `⚽ Rol: ${futbolcuRole || "Futbolcu"}\n` +
        `👤 Kayıt Yetkilisi: ${message.author}`
      )
      .setColor("Green")
      .setTimestamp();

    return message.channel.send({
      content: `${target}`,
      embeds: [embed]
    });
  }

  // =========================
  // TEKNİK DİREKTÖR
  // =========================

  if (command === "td") {
    if (!isRegisterStaff(message.member)) {
      return message.reply("❌ Bu komutu sadece Kayıt Yetkilisi kullanabilir.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Kullanım: `.td @oyuncu`");
    }

    const role = message.guild.roles.cache.find(
      r => r.name === "Teknik Direktör"
    );

    if (!role) {
      return message.reply("❌ Teknik Direktör rolü bulunamadı.");
    }

    await target.roles.add(role).catch(() => {});

    return message.reply(
      `👔 ${target} artık **Teknik Direktör**!`
    );
  }

  // =========================
  // KİŞİSEL BÜTÇE
  // =========================

  if (
    command === "bütçe" ||
    command === "butce"
  ) {
    return message.reply(
      `💳 ${message.author}, kişisel bütçen: **${formatMoney(player.budget)}**`
    );
  }

  // =========================
  // KİŞİSEL BÜTÇE EKLE
  // =========================

  if (
    command === "bütçeekle" ||
    command === "butceekle"
  ) {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Kullanım: `.bütçeekle @oyuncu 5M`");
    }

    const amount = parseMoney(args[0]);

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply("❌ Geçerli bir miktar gir.");
    }

    const targetPlayer = getPlayer(target.id);

    targetPlayer.budget += amount;

    save();

    return message.reply(
      `✅ ${target} kişisel bütçesine **${formatMoney(amount)}** eklendi.\n` +
      `💳 Yeni bütçe: **${formatMoney(targetPlayer.budget)}**`
    );
  }

  // =========================
  // KİŞİSEL BÜTÇE SİL
  // =========================

  if (
    command === "bütçesil" ||
    command === "butcesil"
  ) {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Kullanım: `.bütçesil @oyuncu 5M`");
    }

    const amount = parseMoney(args[0]);

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply("❌ Geçerli bir miktar gir.");
    }

    const targetPlayer = getPlayer(target.id);

    if (targetPlayer.budget < amount) {
      return message.reply("❌ Oyuncunun yeterli bütçesi yok.");
    }

    targetPlayer.budget -= amount;

    save();

    return message.reply(
      `✅ ${target} bütçesinden **${formatMoney(amount)}** silindi.\n` +
      `💳 Yeni bütçe: **${formatMoney(targetPlayer.budget)}**`
    );
  }

  // =========================
  // KİŞİSEL BÜTÇE GÖNDER
  // =========================

  if (
    command === "bütçegönder" ||
    command === "butcegonder"
  ) {
    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Kullanım: `.bütçegönder @oyuncu 5M`");
    }

    if (target.id === message.author.id) {
      return message.reply("❌ Kendine bütçe gönderemezsin.");
    }

    const amount = parseMoney(args[0]);

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply("❌ Geçerli bir miktar gir.");
    }

    const sender = getPlayer(message.author.id);
    const receiver = getPlayer(target.id);

    if (sender.budget < amount) {
      return message.reply(
        `❌ Yeterli bütçen yok.\n💳 Mevcut bütçen: **${formatMoney(sender.budget)}**`
      );
    }

    sender.budget -= amount;
    receiver.budget += amount;

    save();

    return message.reply(
      `💸 **Bütçe transferi başarılı!**\n\n` +
      `👤 Gönderen: ${message.author}\n` +
      `👤 Alıcı: ${target}\n` +
      `💰 Miktar: **${formatMoney(amount)}**\n\n` +
      `💳 Yeni bütçen: **${formatMoney(sender.budget)}**`
    );
  }

  // =========================
  // TAKIM KUR
  // =========================

  if (command === "takımkur" || command === "takimkur") {
    if (getTeamOfUser(message.author.id)) {
      return message.reply("❌ Zaten bir takımın var.");
    }

    const teamName = args.join(" ");

    if (!teamName) {
      return message.reply("❌ Kullanım: `.takımkur Takım Adı`");
    }

    const teamId = `${message.guild.id}-${message.author.id}`;

    if (data.teams[teamId]) {
      return message.reply("❌ Bu takım zaten mevcut.");
    }

    try {
      const role = await message.guild.roles.create({
        name: `⚽ ${teamName}`,
        reason: "Futbol RP takım sistemi"
      });

      const tdRole = message.guild.roles.cache.find(
        r => r.name === "Teknik Direktör"
      );

      if (tdRole) {
        await message.member.roles.add(tdRole).catch(() => {});
      }

      await message.member.roles.add(role).catch(() => {});

      data.teams[teamId] = {
        id: teamId,
        name: teamName,
        creatorId: message.author.id,
        roleId: role.id,
        budget: 50000000,
        players: [],
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0
      };

      save();

      return message.reply(
        `🏟️ **${teamName}** kuruldu!\n\n` +
        `👔 Teknik Direktör: ${message.author}\n` +
        `💰 Takım bütçesi: **50M€**\n` +
        `🏷️ Takım rolü: ${role}`
      );
    } catch (err) {
      return message.reply(
        "❌ Takım oluşturulamadı. Botun **Rol Yönet** yetkisini kontrol et."
      );
    }
  }

  // =========================
  // TAKIMLAR
  // =========================

  if (command === "takımlar" || command === "takimlar") {
    const teams = Object.values(data.teams);

    if (!teams.length) {
      return message.reply("❌ Henüz takım oluşturulmamış.");
    }

    const text = teams
      .map(
        (team, index) =>
          `**${index + 1}. ${team.name}**\n` +
          `👔 <@${team.creatorId}>\n` +
          `💰 ${formatMoney(team.budget)}\n` +
          `👥 ${getTeamMemberCount(team)} oyuncu\n` +
          `🏆 ${team.points} puan`
      )
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle("🏟️ Takımlar")
      .setDescription(text)
      .setColor("Blue");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // TAKIM BİLGİ
  // =========================

  if (
    command === "takımbilgi" ||
    command === "takimbilgi"
  ) {
    const team =
      getTeamOfUser(message.author.id) ||
      (message.mentions.roles.first()
        ? findTeamByRole(message.mentions.roles.first().id)
        : null);

    if (!team) {
      return message.reply("❌ Takımın bulunamadı.");
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏟️ ${team.name}`)
      .addFields(
        {
          name: "👔 Teknik Direktör",
          value: `<@${team.creatorId}>`,
          inline: true
        },
        {
          name: "💰 Bütçe",
          value: formatMoney(team.budget),
          inline: true
        },
        {
          name: "👥 Oyuncu",
          value: `${getTeamMemberCount(team)}`,
          inline: true
        },
        {
          name: "🏆 Puan",
          value: `${team.points}`,
          inline: true
        },
        {
          name: "⚽ Attığı Gol",
          value: `${team.goalsFor}`,
          inline: true
        },
        {
          name: "🥅 Yediği Gol",
          value: `${team.goalsAgainst}`,
          inline: true
        }
      )
      .setColor("Green");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // TAKIM BÜTÇE
  // =========================

  if (
    command === "takımbütçe" ||
    command === "takimbutce"
  ) {
    const team = getTeamOfUser(message.author.id);

    if (!team) {
      return message.reply(
        "❌ Bir takımın sahibi / Teknik Direktörü değilsin."
      );
    }

    return message.reply(
      `🏟️ **${team.name}** takımının bütçesi: **${formatMoney(team.budget)}**`
    );
  }

  // =========================
  // TAKIM BÜTÇE EKLE
  // =========================

  if (
    command === "takımbütçeekle" ||
    command === "takimbutceekle"
  ) {
    const team = getTeamOfUser(message.author.id);

    if (!team) {
      return message.reply("❌ Bir takımın sahibi değilsin.");
    }

    const amount = parseMoney(args[0]);

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply("❌ Geçerli bir miktar gir.");
    }

    team.budget += amount;

    save();

    return message.reply(
      `🏟️ **${team.name}** bütçesine **${formatMoney(amount)}** eklendi.\n` +
      `💰 Yeni bütçe: **${formatMoney(team.budget)}**`
    );
  }

  // =========================
  // TAKIM BÜTÇE SİL
  // =========================

  if (
    command === "takımbütçesil" ||
    command === "takimbutcesil"
  ) {
    const team = getTeamOfUser(message.author.id);

    if (!team) {
      return message.reply("❌ Bir takımın sahibi değilsin.");
    }

    const amount = parseMoney(args[0]);

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply("❌ Geçerli bir miktar gir.");
    }

    if (team.budget < amount) {
      return message.reply("❌ Takım bütçesi bu işlem için yetersiz.");
    }

    team.budget -= amount;

    save();

    return message.reply(
      `🏟️ **${team.name}** bütçesinden **${formatMoney(amount)}** silindi.\n` +
      `💰 Yeni bütçe: **${formatMoney(team.budget)}**`
    );
  }

  // =========================
  // TAKIM BÜTÇESİNDEN OYUNCUYA GÖNDER
  // =========================

  if (
    command === "takımbütçegönder" ||
    command === "takimbutcegonder"
  ) {
    const team = getTeamOfUser(message.author.id);

    if (!team) {
      return message.reply(
        "❌ Bu komutu sadece takım sahibi / Teknik Direktör kullanabilir."
      );
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply(
        "❌ Kullanım: `.takımbütçegönder @oyuncu 5M`"
      );
    }

    const amount = parseMoney(args[0]);

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply("❌ Geçerli bir miktar gir.");
    }

    if (team.budget < amount) {
      return message.reply(
        `❌ Takım bütçesi yetersiz.\n` +
        `💰 Mevcut takım bütçesi: **${formatMoney(team.budget)}**`
      );
    }

    const targetPlayer = getPlayer(target.id);

    team.budget -= amount;
    targetPlayer.budget += amount;

    save();

    return message.reply(
      `💸 **Takım bütçesinden oyuncuya ödeme yapıldı!**\n\n` +
      `🏟️ Takım: **${team.name}**\n` +
      `👤 Oyuncu: ${target}\n` +
      `💰 Gönderilen: **${formatMoney(amount)}**\n\n` +
      `🏟️ Kalan takım bütçesi: **${formatMoney(team.budget)}**\n` +
      `💳 Oyuncunun yeni bütçesi: **${formatMoney(targetPlayer.budget)}**`
    );
  }

  // =========================
  // KADRO
  // =========================

  if (command === "kadro") {
    const team =
      getTeamOfUser(message.author.id) ||
      (message.mentions.roles.first()
        ? findTeamByRole(message.mentions.roles.first().id)
        : null);

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    const players = Object.entries(data.players)
      .filter(([id, p]) => p.team === team.id)
      .map(([id]) => `<@${id}>`);

    const embed = new EmbedBuilder()
      .setTitle(`📋 ${team.name} Kadrosu`)
      .setDescription(
        players.length
          ? players.join("\n")
          : "Henüz kadroda oyuncu bulunmuyor."
      )
      .setColor("Blue");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // TRANSFER
  // =========================

  if (command === "transfer") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply(
        "❌ Kullanım: `.transfer @oyuncu Takım Adı`"
      );
    }

    const teamName = args.slice(1).join(" ");
    const team = findTeamByName(teamName);

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    const targetPlayer = getPlayer(target.id);

    if (targetPlayer.team) {
      const oldTeam = getTeam(targetPlayer.team);

      if (oldTeam) {
        oldTeam.players = oldTeam.players.filter(
          id => id !== target.id
        );
      }
    }

    targetPlayer.team = team.id;

    if (!team.players.includes(target.id)) {
      team.players.push(target.id);
    }

    save();

    return message.reply(
      `🔄 ${target} oyuncusu **${team.name}** takımına transfer edildi.`
    );
  }

  // =========================
  // MAÇ
  // =========================

  if (command === "maç" || command === "mac") {
    const mentionedRoles = [...message.mentions.roles.values()];

    if (mentionedRoles.length < 2) {
      return message.reply(
        "❌ İki takım rolünü etiketle.\nÖrnek: `.maç @Takım1 @Takım2`"
      );
    }

    const team1 = findTeamByRole(mentionedRoles[0].id);
    const team2 = findTeamByRole(mentionedRoles[1].id);

    if (!team1 || !team2) {
      return message.reply("❌ Takımlardan biri bulunamadı.");
    }

    if (team1.id === team2.id) {
      return message.reply("❌ Aynı takım kendiyle maç yapamaz.");
    }

    const score1 = random(0, 5);
    const score2 = random(0, 5);

    const events = [
      "⚡ Maç hızlı başladı!",
      "⚽ Orta sahada mücadele devam ediyor.",
      "🔥 Tehlikeli bir atak gelişiyor!",
      "🥅 Kaleci kritik bir kurtarış yaptı.",
      "🎯 Şut kaleyi buldu!",
      "🏃 Kanattan hızlı bir hücum geliyor!"
    ];

    const matchMessage = await message.reply(
      `🏟️ **MAÇ BAŞLADI!**\n\n` +
      `⚽ **${team1.name}** 0 - 0 **${team2.name}**`
    );

    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      let current1 = random(0, score1);
      let current2 = random(0, score2);

      if (i === 5) {
        current1 = score1;
        current2 = score2;
      }

      await matchMessage.edit(
        `🏟️ **MAÇ DEVAM EDİYOR!**\n\n` +
        `${events[i]}\n\n` +
        `⚽ **${team1.name}** ${current1} - ${current2} **${team2.name}**`
      );
    }

    if (score1 > score2) {
      team1.wins++;
      team1.points += 3;
      team2.losses++;
    } else if (score2 > score1) {
      team2.wins++;
      team2.points += 3;
      team1.losses++;
    } else {
      team1.draws++;
      team2.draws++;
      team1.points++;
      team2.points++;
    }

    team1.goalsFor += score1;
    team1.goalsAgainst += score2;
    team2.goalsFor += score2;
    team2.goalsAgainst += score1;

    data.results.push({
      team1: team1.id,
      team2: team2.id,
      score1,
      score2,
      date: Date.now()
    });

    save();

    return matchMessage.edit(
      `🏁 **MAÇ SONA ERDİ!**\n\n` +
      `🏟️ **${team1.name}** ${score1} - ${score2} **${team2.name}**\n\n` +
      `🏆 Maç sonucu puanlara işlendi.`
    );
  }

  // =========================
  // PUAN
  // =========================

  if (command === "puan") {
    const teams = Object.values(data.teams)
      .sort((a, b) => b.points - a.points);

    if (!teams.length) {
      return message.reply("❌ Henüz takım yok.");
    }

    const text = teams
      .map(
        (team, i) =>
          `**${i + 1}. ${team.name}** — 🏆 ${team.points} puan | ` +
          `W:${team.wins} D:${team.draws} L:${team.losses}`
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🏆 Puan Durumu")
      .setDescription(text)
      .setColor("Gold");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // GOL KRALI
  // =========================

  if (command === "golkral") {
    const players = Object.entries(data.players)
      .sort(([, a], [, b]) => b.goals - a.goals)
      .slice(0, 10);

    if (!players.length) {
      return message.reply("❌ Henüz istatistik yok.");
    }

    const text = players
      .map(
        ([id, p], i) =>
          `**${i + 1}.** <@${id}> — ⚽ ${p.goals} gol`
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("⚽ Gol Krallığı")
      .setDescription(text)
      .setColor("Gold");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // ASİST KRALI
  // =========================

  if (command === "asistkral") {
    const players = Object.entries(data.players)
      .sort(([, a], [, b]) => b.assists - a.assists)
      .slice(0, 10);

    const text = players
      .map(
        ([id, p], i) =>
          `**${i + 1}.** <@${id}> — 🅰️ ${p.assists} asist`
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🅰️ Asist Krallığı")
      .setDescription(text || "Henüz asist yok.")
      .setColor("Blue");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // FİKSTÜR
  // =========================

  if (command === "fikstur") {
    const teams = Object.values(data.teams);

    if (teams.length < 2) {
      return message.reply("❌ Fikstür için en az 2 takım gerekli.");
    }

    const fixtures = [];

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        fixtures.push(
          `⚽ ${teams[i].name} vs ${teams[j].name}`
        );
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("📅 Fikstür")
      .setDescription(fixtures.join("\n") || "Fikstür yok.")
      .setColor("Blue");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // MAÇ SONUÇLARI
  // =========================

  if (command === "macsonuclari") {
    if (!data.results.length) {
      return message.reply("❌ Henüz oynanmış maç yok.");
    }

    const results = data.results
      .slice(-15)
      .reverse()
      .map(result => {
        const t1 = getTeam(result.team1);
        const t2 = getTeam(result.team2);

        if (!t1 || !t2) return null;

        return `🏟️ **${t1.name}** ${result.score1} - ${result.score2} **${t2.name}**`;
      })
      .filter(Boolean);

    const embed = new EmbedBuilder()
      .setTitle("🏁 Maç Sonuçları")
      .setDescription(results.join("\n"))
      .setColor("Green");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // İSTATİSTİK
  // =========================

  if (command === "istatistik") {
    const embed = new EmbedBuilder()
      .setTitle("📊 Lig İstatistikleri")
      .addFields(
        {
          name: "🏟️ Takım",
          value: `${Object.keys(data.teams).length}`,
          inline: true
        },
        {
          name: "👤 Oyuncu",
          value: `${Object.keys(data.players).length}`,
          inline: true
        },
        {
          name: "🏁 Maç",
          value: `${data.results.length}`,
          inline: true
        },
        {
          name: "🎉 Çekiliş",
          value: `${Object.keys(data.giveaways).length}`,
          inline: true
        }
      )
      .setColor("Blue");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // MÜZE
  // =========================

  if (
    command === "müze" ||
    command === "muze"
  ) {
    const team =
      getTeamOfUser(message.author.id) ||
      (message.mentions.roles.first()
        ? findTeamByRole(message.mentions.roles.first().id)
        : null);

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    const cups = data.museums[team.id] || [];

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${team.name} Müzesi`)
      .setDescription(
        cups.length
          ? cups.map((cup, i) => `🏆 **${i + 1}.** ${cup}`).join("\n")
          : "Müzede henüz kupa bulunmuyor."
      )
      .setColor("Gold");

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // KUPA EKLE
  // =========================

  if (command === "kupaekle") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const mentionedRole = message.mentions.roles.first();

    if (!mentionedRole) {
      return message.reply(
        "❌ Kullanım: `.kupaekle @takım Kupa Adı`"
      );
    }

    const team = findTeamByRole(mentionedRole.id);

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    const cupName = args.slice(1).join(" ");

    if (!cupName) {
      return message.reply("❌ Kupa adı gir.");
    }

    if (!data.museums[team.id]) {
      data.museums[team.id] = [];
    }

    data.museums[team.id].push(cupName);

    save();

    return message.reply(
      `🏆 **${cupName}** kupası **${team.name}** müzesine eklendi.`
    );
  }

  // =========================
  // KUPA SİL
  // =========================

  if (command === "kupasil") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const mentionedRole = message.mentions.roles.first();

    if (!mentionedRole) {
      return message.reply(
        "❌ Kullanım: `.kupasil @takım Kupa Adı`"
      );
    }

    const team = findTeamByRole(mentionedRole.id);

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    const cupName = args.slice(1).join(" ");

    if (!data.museums[team.id]) {
      return message.reply("❌ Bu takımın müzesinde kupa yok.");
    }

    const index = data.museums[team.id].indexOf(cupName);

    if (index === -1) {
      return message.reply("❌ Bu kupa bulunamadı.");
    }

    data.museums[team.id].splice(index, 1);

    save();

    return message.reply(
      `🗑️ **${cupName}** kupası silindi.`
    );
  }

  // =========================
  // PİNG ROL PANELİ
  // =========================

  if (command === "rolpanel") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const roles = data.settings.pingRoles[message.guild.id] || {};

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ping_mac")
        .setLabel("⚽ Maç")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("ping_duyuru")
        .setLabel("📢 Duyuru")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("ping_etkinlik")
        .setLabel("🎉 Etkinlik")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("ping_haber")
        .setLabel("📰 Haber")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("ping_transfer")
        .setLabel("🔄 Transfer")
        .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle("🔔 Ping Rol Paneli")
      .setDescription(
        "Aşağıdaki butonlardan istediğin bildirim rollerini açıp kapatabilirsin."
      )
      .setColor("Blue");

    return message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }

  // =========================
  // TICKET PANEL
  // =========================

  if (command === "ticketpanel") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("🎫 Destek türünü seç")
      .addOptions([
        {
          label: "Genel Destek",
          description: "Genel yardım ve sorular",
          value: "genel",
          emoji: "💬"
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
          emoji: "🛡️"
        }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    const embed = new EmbedBuilder()
      .setTitle("🎫 Destek Sistemi")
      .setDescription(
        "Destek almak için aşağıdaki menüden uygun destek türünü seç.\n\n" +
        "⏱️ 60 dakika boyunca mesaj gönderilmezse ticket otomatik kapanır."
      )
      .setColor("Blue");

    return message.channel.send({
      embeds: [embed],
      components: [row]
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
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const prize = args[0];
    const duration = args[1];

    if (!prize || !duration) {
      return message.reply(
        "❌ Kullanım: `.çekiliş 5M€ 5h`"
      );
    }

    const amount = parseMoney(prize);
    const ms = durationToMs(duration);

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply("❌ Geçerli bir ödül gir.");
    }

    if (!Number.isFinite(ms) || ms <= 0) {
      return message.reply(
        "❌ Süreyi örneğin `30s`, `5m`, `2h`, `1d` şeklinde yaz."
      );
    }

    const id = `${Date.now()}`;

    data.giveaways[id] = {
      id,
      prize: amount,
      channelId: message.channel.id,
      hostId: message.author.id,
      participants: [],
      endAt: Date.now() + ms,
      ended: false
    };

    const button = new ButtonBuilder()
      .setCustomId(`giveaway_join_${id}`)
      .setLabel("🎉 Katıl")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    const embed = new EmbedBuilder()
      .setTitle("🎉 ÇEKİLİŞ")
      .setDescription(
        `💰 **Ödül:** ${formatMoney(amount)}\n` +
        `⏱️ **Süre:** ${duration}\n` +
        `👥 **Katılımcı:** 0\n\n` +
        `Katılmak için **🎉 Katıl** butonuna bas!`
      )
      .setFooter({ text: `Çekiliş ID: ${id}` })
      .setColor("Purple");

    const sent = await message.channel.send({
      embeds: [embed],
      components: [row]
    });

    data.giveaways[id].messageId = sent.id;

    save();

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
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const id = args[0];

    if (!id || !data.giveaways[id]) {
      return message.reply("❌ Çekiliş bulunamadı.");
    }

    await endGiveaway(id);

    return;
  }

  // =========================
  // EMBED
  // =========================

  if (command === "embed") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const text = args.join(" ");

    if (!text) {
      return message.reply("❌ Kullanım: `.embed Mesaj`");
    }

    const embed = new EmbedBuilder()
      .setDescription(text)
      .setColor("Blue")
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
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const amount = Number(args[0]);

    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > 1000
    ) {
      return message.reply(
        "❌ 1 ile 1000 arasında bir sayı girmelisin."
      );
    }

    try {
      const deleted = await message.channel.bulkDelete(
        amount,
        true
      );

      const response = await message.channel.send(
        `🗑️ **${deleted.size}** mesaj silindi.`
      );

      setTimeout(() => {
        response.delete().catch(() => {});
      }, 3000);
    } catch {
      return message.reply(
        "❌ Mesajlar silinemedi. Botun **Mesajları Yönet** yetkisini kontrol et."
      );
    }

    return;
  }

  // =========================
  // KICK
  // =========================

  if (command === "kick") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Kullanım: `.kick @oyuncu`");
    }

    if (!target.kickable) {
      return message.reply("❌ Bu kullanıcıyı kickleyemiyorum.");
    }

    await target.kick(`Yönetici: ${message.author.tag}`);

    return message.reply(
      `👢 ${target.user.tag} sunucudan atıldı.`
    );
  }

  // =========================
  // MUTE
  // =========================

  if (command === "mute") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Kullanım: `.mute @oyuncu`");
    }

    let muteRole = message.guild.roles.cache.find(
      r => r.name === "Muted"
    );

    if (!muteRole) {
      try {
        muteRole = await message.guild.roles.create({
          name: "Muted",
          reason: "Mute sistemi"
        });
      } catch {
        return message.reply("❌ Muted rolü oluşturulamadı.");
      }
    }

    await target.roles.add(muteRole).catch(() => {});

    return message.reply(
      `🔇 ${target} susturuldu.`
    );
  }

  // =========================
  // UNMUTE
  // =========================

  if (command === "unmute") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Kullanım: `.unmute @oyuncu`");
    }

    const muteRole = message.guild.roles.cache.find(
      r => r.name === "Muted"
    );

    if (muteRole) {
      await target.roles.remove(muteRole).catch(() => {});
    }

    return message.reply(
      `🔊 ${target} artık konuşabilir.`
    );
  }

  // =========================
  // KANAL KİLİT
  // =========================

  if (command === "kilit") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: false
      }
    );

    return message.reply("🔒 Kanal kilitlendi.");
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
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: null
      }
    );

    return message.reply("🔓 Kanal tekrar açıldı.");
  }
});

// =========================
// INTERACTION SİSTEMLERİ
// =========================

client.on("interactionCreate", async interaction => {
  try {
    // =========================
    // PING ROLLERİ
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("ping_")) {
      const type = interaction.customId.replace("ping_", "");

      const roleId =
        data.settings.pingRoles[interaction.guild.id]?.[type];

      if (!roleId) {
        return interaction.reply({
          content: "❌ Ping rolü bulunamadı.",
          ephemeral: true
        });
      }

      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) {
        return interaction.reply({
          content: "❌ Ping rolü bulunamadı.",
          ephemeral: true
        });
      }

      if (interaction.member.roles.cache.has(role.id)) {
        await interaction.member.roles.remove(role);

        return interaction.reply({
          content: `🔕 ${role.name} rolü kaldırıldı.`,
          ephemeral: true
        });
      }

      await interaction.member.roles.add(role);

      return interaction.reply({
        content: `🔔 ${role.name} rolü verildi.`,
        ephemeral: true
      });
    }

    // =========================
    // ÇEKİLİŞ KATIL
    // =========================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("giveaway_join_")
    ) {
      const id = interaction.customId.replace(
        "giveaway_join_",
        ""
      );

      const giveaway = data.giveaways[id];

      if (!giveaway || giveaway.ended) {
        return interaction.reply({
          content: "❌ Bu çekiliş sona ermiş.",
          ephemeral: true
        });
      }

      if (!giveaway.participants.includes(interaction.user.id)) {
        giveaway.participants.push(interaction.user.id);
        save();

        return interaction.reply({
          content: "🎉 Çekilişe başarıyla katıldın!",
          ephemeral: true
        });
      }

      giveaway.participants =
        giveaway.participants.filter(
          id => id !== interaction.user.id
        );

      save();

      return interaction.reply({
        content: "❌ Çekilişten ayrıldın.",
        ephemeral: true
      });
    }

    // =========================
    // TICKET MENÜ
    // =========================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_select"
    ) {
      const type = interaction.values[0];

      const existing = Object.values(data.tickets).find(
        ticket =>
          ticket.userId === interaction.user.id &&
          ticket.guildId === interaction.guild.id &&
          !ticket.closed
      );

      if (existing) {
        return interaction.reply({
          content: `❌ Zaten açık bir ticketın var: <#${existing.channelId}>`,
          ephemeral: true
        });
      }

      const typeNames = {
        genel: "Genel Destek",
        teknik: "Teknik Destek",
        yonetim: "Yönetim Desteği"
      };

      const channelName = cleanName(
        `ticket-${interaction.user.username}`
      );

      const permissionOverwrites = [
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
          id: ROLES.YONETICI,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }
      ];

      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites
      });

      const ticketId = `${Date.now()}-${interaction.user.id}`;

      data.tickets[ticketId] = {
        id: ticketId,
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        channelId: channel.id,
        type,
        lastActivity: Date.now(),
        closed: false
      };

      save();

      const closeButton = new ButtonBuilder()
        .setCustomId(`ticket_close_${ticketId}`)
        .setLabel("🔒 Ticket Kapat")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder()
        .addComponents(closeButton);

      const embed = new EmbedBuilder()
        .setTitle(`🎫 ${typeNames[type] || "Destek"}`)
        .setDescription(
          `${interaction.user}, destek talebin oluşturuldu.\n\n` +
          `🛡️ Yönetim ekibi en kısa sürede seninle ilgilenecektir.\n\n` +
          `⏱️ **60 dakika boyunca mesaj gelmezse ticket otomatik kapanır.**`
        )
        .setColor("Blue")
        .setTimestamp();

      await channel.send({
        content: `${interaction.user} <@&${ROLES.YONETICI}>`,
        embeds: [embed],
        components: [row]
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
      interaction.customId.startsWith("ticket_close_")
    ) {
      const id = interaction.customId.replace(
        "ticket_close_",
        ""
      );

      const ticket = data.tickets[id];

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
          content: "❌ Bu ticketı kapatma yetkin yok.",
          ephemeral: true
        });
      }

      ticket.closed = true;
      save();

      await interaction.reply("🔒 Ticket kapatılıyor...");

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 2000);

      return;
    }
  } catch (err) {
    console.log("Interaction hatası:", err);

    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({
        content: "❌ Bir hata oluştu.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// =========================
// TICKET AKTİVİTE TAKİBİ
// =========================

client.on("messageCreate", message => {
  if (!message.guild || message.author.bot) return;

  const ticket = Object.values(data.tickets).find(
    t =>
      t.channelId === message.channel.id &&
      !t.closed
  );

  if (ticket) {
    ticket.lastActivity = Date.now();
    save();
  }
});

// =========================
// TICKET OTOMATİK KAPATMA
// =========================

setInterval(async () => {
  const now = Date.now();

  for (const ticket of Object.values(data.tickets)) {
    if (ticket.closed) continue;

    if (now - ticket.lastActivity >= 60 * 60 * 1000) {
      ticket.closed = true;

      const channel = client.channels.cache.get(
        ticket.channelId
      );

      if (channel) {
        await channel.send(
          "⏱️ **60 dakika boyunca aktivite olmadığı için ticket otomatik kapatıldı.**"
        ).catch(() => {});

        setTimeout(() => {
          channel.delete().catch(() => {});
        }, 3000);
      }
    }
  }

  save();
}, 60000);

// =========================
// ÇEKİLİŞ BİTİRME FONKSİYONU
// =========================

async function endGiveaway(id) {
  const giveaway = data.giveaways[id];

  if (!giveaway || giveaway.ended) return;

  giveaway.ended = true;

  const channel = client.channels.cache.get(
    giveaway.channelId
  );

  if (!channel) {
    save();
    return;
  }

  let winner = null;

  if (giveaway.participants.length > 0) {
    const winnerId =
      giveaway.participants[
        Math.floor(
          Math.random() * giveaway.participants.length
        )
      ];

    winner = await client.users.fetch(winnerId).catch(
      () => null
    );
  }

  const embed = new EmbedBuilder()
    .setTitle("🎉 ÇEKİLİŞ SONA ERDİ!")
    .setDescription(
      winner
        ? `🏆 **Kazanan:** ${winner}\n💰 **Ödül:** ${formatMoney(
            giveaway.prize
          )}`
        : `❌ Katılımcı olmadığı için kazanan bulunamadı.\n💰 **Ödül:** ${formatMoney(
            giveaway.prize
          )}`
    )
    .setColor("Gold")
    .setTimestamp();

  await channel.send({
    content: winner
      ? `🎉 Tebrikler ${winner}!`
      : "❌ Çekilişte kazanan çıkmadı.",
    embeds: [embed]
  });

  save();
}

// =========================
// ÇEKİLİŞ OTOMATİK BİTİR
// =========================

setInterval(async () => {
  const now = Date.now();

  for (const giveaway of Object.values(data.giveaways)) {
    if (!giveaway.ended && now >= giveaway.endAt) {
      await endGiveaway(giveaway.id);
    }
  }
}, 1000);

// =========================
// HATA SİSTEMLERİ
// =========================

process.on("unhandledRejection", error => {
  console.error("Unhandled Rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("Uncaught Exception:", error);
});

// =========================
// TOKEN
// =========================

if (!TOKEN) {
  console.error("❌ TOKEN bulunamadı!");
  console.error("Railway/Rainway Variables kısmına TOKEN ekle.");
  process.exit(1);
}

client.login(TOKEN);
