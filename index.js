const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ActivityType,
  ChannelType,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ======================================================
// UNITED LEAGUE • FUTBOL RP BOT
// ======================================================

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN bulunamadı! Railway/Rainway Variables kısmına TOKEN ekleyin.");
  process.exit(1);
}

// ======================================================
// AYARLAR
// ======================================================

const ANNOUNCEMENT_CHANNEL_ID = "1544653653330108477";

const ROLES = {
  ADMIN: "1544449436011339806",
  KAYIT: "1544452022764568656",
  DEGER: "1544451743746891806",
};

const ROLE_NAMES = {
  KAYITSIZ: "Kayıtsız",
  FUTBOLCU: "Futbolcu",
  TD: "Teknik Direktör",
};

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// ======================================================
// DATA
// ======================================================

const DATA_FILE = path.join(__dirname, "data.json");

const DEFAULT_DATA = {
  players: {},
  teams: {},
  transfers: [],
  kap: {},
  matches: [],
  giveaways: {},
  companies: {},
  sponsors: {},
  ads: {},
  season: {
    number: 1,
    startedAt: Date.now(),
  },
};

let data = DEFAULT_DATA;

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
      data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      return;
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    data = JSON.parse(raw);

    for (const key of Object.keys(DEFAULT_DATA)) {
      if (data[key] === undefined) {
        data[key] = DEFAULT_DATA[key];
      }
    }
  } catch (err) {
    console.error("Data yükleme hatası:", err);
    data = JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Data kaydetme hatası:", err);
  }
}

loadData();

// ======================================================
// YARDIMCI FONKSİYONLAR
// ======================================================

function getPlayer(userId) {
  if (!data.players[userId]) {
    data.players[userId] = {
      value: 0,
      xp: 0,
      level: 1,
      training: 0,
      goals: 0,
      assists: 0,
      matches: 0,
      penalties: 0,
      penaltyGoals: 0,
      achievements: [],
      budget: 0,
      registered: false,
      roleType: null,
      teamId: null,
      salary: 0,
    };
  }

  return data.players[userId];
}

function parseMoney(input) {
  if (!input) return null;

  let str = String(input)
    .toLowerCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");

  let multiplier = 1;

  if (str.endsWith("m")) {
    multiplier = 1000000;
    str = str.slice(0, -1);
  } else if (str.endsWith("k")) {
    multiplier = 1000;
    str = str.slice(0, -1);
  } else if (str.endsWith("b")) {
    multiplier = 1000000000;
    str = str.slice(0, -1);
  }

  const number = parseFloat(str);

  if (isNaN(number)) return null;

  return Math.round(number * multiplier);
}

function formatMoney(amount) {
  amount = Math.max(0, Math.round(Number(amount) || 0));

  if (amount >= 1000000000) {
    const value = amount / 1000000000;
    return `${Number(value.toFixed(2))}B€`;
  }

  if (amount >= 1000000) {
    const value = amount / 1000000;
    return `${Number(value.toFixed(2))}M€`;
  }

  if (amount >= 1000) {
    const value = amount / 1000;
    return `${Number(value.toFixed(2))}K€`;
  }

  return `${amount}€`;
}

function hasRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

function isAdmin(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    hasRole(member, ROLES.ADMIN)
  );
}

function isRegistrationStaff(member) {
  return isAdmin(member) || hasRole(member, ROLES.KAYIT);
}

function isValueStaff(member) {
  return isAdmin(member) || hasRole(member, ROLES.DEGER);
}

function getMention(userId) {
  return `<@${userId}>`;
}

function getLogChannel(guild) {
  const names = [
    "bot-log",
    "bot-logs",
    "logs",
    "log",
    "kayıt-log",
    "kayıt-logları",
  ];

  return guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && names.includes(c.name.toLowerCase())
  );
}

async function logAction(guild, title, description) {
  try {
    const channel = getLogChannel(guild);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`United League • ${title}`)
      .setDescription(description)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch {}
}

// ======================================================
// ROL OLUŞTURMA
// ======================================================

async function getOrCreateRole(guild, name, options = {}) {
  let role = guild.roles.cache.find(r => r.name === name);

  if (role) return role;

  try {
    role = await guild.roles.create({
      name,
      color: options.color || null,
      hoist: options.hoist ?? true,
      reason: "United League otomatik rol sistemi",
    });

    return role;
  } catch (err) {
    console.error(`Rol oluşturulamadı: ${name}`, err);
    return null;
  }
}

async function setupRegistrationRoles(guild) {
  const kayitsiz = await getOrCreateRole(guild, ROLE_NAMES.KAYITSIZ, {
    color: 0x747f8d,
    hoist: true,
  });

  const futbolcu = await getOrCreateRole(guild, ROLE_NAMES.FUTBOLCU, {
    color: 0x3498db,
    hoist: true,
  });

  const td = await getOrCreateRole(guild, ROLE_NAMES.TD, {
    color: 0xf1c40f,
    hoist: true,
  });

  return {
    kayitsiz,
    futbolcu,
    td,
  };
}

// ======================================================
// NICKNAME DEĞER SİSTEMİ
// ======================================================

function getNicknameValue(nickname) {
  if (!nickname) return 0;

  const match = nickname.match(/([\d.,]+)\s*([KMB])?\s*€?\s*$/i);

  if (!match) return 0;

  let number = parseFloat(match[1].replace(/,/g, "."));
  const unit = (match[2] || "").toUpperCase();

  if (isNaN(number)) return 0;

  if (unit === "K") number *= 1000;
  if (unit === "M") number *= 1000000;
  if (unit === "B") number *= 1000000000;

  return Math.round(number);
}

function replaceNicknameValue(nickname, newValue) {
  const formatted = formatMoney(newValue);

  if (/([\d.,]+)\s*([KMB])?\s*€?\s*$/i.test(nickname)) {
    return nickname.replace(
      /([\d.,]+)\s*([KMB])?\s*€?\s*$/i,
      formatted
    );
  }

  return `${nickname} | ${formatted}`;
}

async function updatePlayerNickname(member, amount) {
  const oldNickname = member.nickname || member.user.username;
  const newNickname = replaceNicknameValue(oldNickname, amount);

  let finalNickname = newNickname;

  if (finalNickname.length > 32) {
    const valueText = ` | ${formatMoney(amount)}`;
    const base = finalNickname.slice(0, 32 - valueText.length);
    finalNickname = base + valueText;
  }

  try {
    await member.setNickname(finalNickname);

    const player = getPlayer(member.id);
    player.value = amount;

    saveData();

    return true;
  } catch (err) {
    console.error("Nickname değiştirilemedi:", err);
    return false;
  }
}

async function addPlayerValue(member, amount) {
  const player = getPlayer(member.id);

  let current = getNicknameValue(member.nickname || member.user.username);

  if (!current && player.value) {
    current = player.value;
  }

  const newValue = current + amount;

  return await updatePlayerNickname(member, newValue);
}

async function removePlayerValue(member, amount) {
  const player = getPlayer(member.id);

  let current = getNicknameValue(member.nickname || member.user.username);

  if (!current && player.value) {
    current = player.value;
  }

  const newValue = Math.max(0, current - amount);

  return await updatePlayerNickname(member, newValue);
}

// ======================================================
// XP / BAŞARIM
// ======================================================

function addXP(userId, amount) {
  const player = getPlayer(userId);

  player.xp += amount;

  while (player.xp >= player.level * 100) {
    player.xp -= player.level * 100;
    player.level++;
  }

  saveData();
}

function achievement(userId, name) {
  const player = getPlayer(userId);

  if (!player.achievements.includes(name)) {
    player.achievements.push(name);
    saveData();
    return true;
  }

  return false;
}

// ======================================================
// EMBED
// ======================================================

function makeEmbed(title, description, color = 0x5865f2) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: "United League • Futbol RP",
    })
    .setTimestamp();
}

// ======================================================
// BOT READY
// ======================================================

let lastHourlyStatus = "";

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} aktif!`);
  console.log(`🌐 ${client.guilds.cache.size} sunucuda çalışıyor.`);

  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "United League | Futbol Rp",
        type: ActivityType.Playing,
      },
    ],
  });

  for (const guild of client.guilds.cache.values()) {
    try {
      await setupRegistrationRoles(guild);
    } catch {}
  }

  checkHourlyStatus();

  setInterval(checkHourlyStatus, 20000);
});

// ======================================================
// SAAT BAŞI DURUM
// ======================================================

async function checkHourlyStatus() {
  const now = new Date();

  const minute = now.getMinutes();

  if (minute !== 0) return;

  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;

  if (lastHourlyStatus === key) return;

  lastHourlyStatus = key;

  const channel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);

  if (!channel || !channel.isTextBased()) return;

  const uptime = Math.floor(process.uptime());

  const days = Math.floor(uptime / 86400);
  uptime %= 86400;

  const hours = Math.floor(uptime / 3600);
  uptime %= 3600;

  const minutes = Math.floor(uptime / 60);
  const seconds = uptime % 60;

  const ping = client.ws.ping;

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("United League • Bot Durumu")
    .addFields(
      {
        name: "🟢 Durum",
        value: "Aktif",
        inline: true,
      },
      {
        name: "🏓 Ping",
        value: `${ping}ms`,
        inline: true,
      },
      {
        name: "🌐 Sunucu",
        value: `${client.guilds.cache.size}`,
        inline: true,
      },
      {
        name: "⏱️ Uptime",
        value: `${days}g ${hours}s ${minutes}d ${seconds}s`,
        inline: false,
      }
    )
    .setFooter({
      text: "United League • Futbol Rp",
    })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Saat başı durum gönderilemedi:", err);
  }
}

// ======================================================
// YENİ ÜYE KAYIT SİSTEMİ
// ======================================================

client.on("guildMemberAdd", async member => {
  try {
    const roles = await setupRegistrationRoles(member.guild);

    if (roles.kayitsiz) {
      await member.roles.add(roles.kayitsiz);
    }

    const kayıtChannel = member.guild.channels.cache.find(
      c =>
        c.type === ChannelType.GuildText &&
        ["kayıt", "kayit"].includes(c.name.toLowerCase())
    );

    if (!kayıtChannel) return;

    const kayıtRole = member.guild.roles.cache.get(ROLES.KAYIT);

    const kayıtYetkilisi = kayıtRole
      ? `<@&${ROLES.KAYIT}>`
      : "Kayıt Yetkilisi";

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("👋 Yeni Oyuncu Geldi!")
      .setDescription(
        `Sunucumuza yeni bir oyuncu katıldı!\n\n` +
        `👤 **Oyuncu:** ${member}\n` +
        `🆔 **ID:** \`${member.id}\`\n\n` +
        `📋 **Kayıt işlemi için:** ${kayıtYetkilisi}\n\n` +
        `Oyuncunun kaydını gerçekleştirerek uygun rolü vermeyi unutmayın.`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({
        text: "United League • Kayıt Sistemi",
      })
      .setTimestamp();

    await kayıtChannel.send({
      content: `${member} ${kayıtYetkilisi} ilgilen!`,
      embeds: [embed],
    });

    await logAction(
      member.guild,
      "Yeni Üye",
      `${member} sunucuya katıldı. Kayıtsız rolü verildi.`
    );
  } catch (err) {
    console.error("Yeni üye sistemi hatası:", err);
  }
});

// ======================================================
// MESAJ KOMUTLARI
// ======================================================

client.on("messageCreate", async message => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = message.content.trim();

    if (!content.startsWith(".")) return;

    const args = content.slice(1).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    // ==================================================
    // YARDIM
    // ==================================================

    if (command === "yardım" || command === "yardim" || command === "help") {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📚 United League • Yardım")
        .setDescription(
          "United League Futbol RP botundaki komutlar aşağıdadır."
        )
        .addFields(
          {
            name: "👤 Kayıt",
            value:
              "`.k @oyuncu İsim`\nKayıt paneli oluşturur.",
            inline: false,
          },
          {
            name: "💰 Değer",
            value:
              "`.dver @oyuncu 5m`\n`.değer @oyuncu`\n`.değer sil @oyuncu 5m`\n`.değerler`",
            inline: false,
          },
          {
            name: "🏋️ Antrenman",
            value:
              "`.ant`\n`.antrenman`",
            inline: true,
          },
          {
            name: "⚽ Penaltı",
            value:
              "`.pen`\n`.penaltı`",
            inline: true,
          },
          {
            name: "👤 Profil",
            value:
              "`.profil @oyuncu`\n`.istatistik @oyuncu`",
            inline: true,
          },
          {
            name: "🏟️ Takım",
            value:
              "`.takımoluştur İsim`\n`.takım`\n`.takımlar`\n`.takımım`",
            inline: false,
          },
          {
            name: "👥 Kadro",
            value:
              "`.kadro`\n`.kadro @oyuncu`\n`.kadrocikar @oyuncu`\n`.formasyon 4-3-3`",
            inline: false,
          },
          {
            name: "💶 Takım Bütçesi",
            value:
              "`.takımbütçe`\n`.takımpara miktar`\n`.takımharca miktar`",
            inline: false,
          },
          {
            name: "📄 KAP / Transfer",
            value:
              "`.kap @oyuncu`\n`.transferler`\n`.transfergeçmişi`",
            inline: false,
          },
          {
            name: "⚽ Maç",
            value:
              "`.maç @takım1 @takım2`\n`.maçlar`\n`.maçsonucu`",
            inline: false,
          },
          {
            name: "🏆 Lig",
            value:
              "`.lig`\n`.puan`\n`.golkrallığı`\n`.asistkrallığı`\n`.sezon`",
            inline: false,
          },
          {
            name: "🎁 Çekiliş",
            value:
              "`.çekiliş 5m 5saat`\n`.yenikazanan`",
            inline: false,
          },
          {
            name: "📨 DM",
            value:
              "`.dm all Mesaj`\n`.dm @oyuncu Mesaj`",
            inline: false,
          },
          {
            name: "📰 Medya",
            value:
              "`.tweet Mesaj`\n`.haber Mesaj`",
            inline: true,
          },
          {
            name: "🎫 Ticket",
            value:
              "`.ticket`\n`.ticketkapat`",
            inline: true,
          },
          {
            name: "🛡️ Moderasyon",
            value:
              "`.kick @oyuncu`\n`.ban @oyuncu`\n`.mute @oyuncu`\n`.unmute @oyuncu`\n`.sil miktar`\n`.kilitle`\n`.kilitaç`",
            inline: false,
          },
          {
            name: "📢 Reklam",
            value:
              "`.reklampaketleri`\n`.reklam`",
            inline: false,
          },
          {
            name: "🏢 Şirket / Sponsor",
            value:
              "`.şirketler`\n`.şirketbaşvur Marka`\n`.sponsorlar`\n`.sponsorbaşvur Marka`",
            inline: false,
          },
          {
            name: "🏓 Sistem",
            value:
              "`.ping`",
            inline: true,
          }
        )
        .setFooter({
          text: "United League • Futbol Rp",
        })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ==================================================
    // PING
    // ==================================================

    if (command === "ping") {
      const start = Date.now();

      const reply = await message.reply("🏓 Hesaplanıyor...");

      const roundtrip = Date.now() - start;

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🏓 United League • Ping")
        .addFields(
          {
            name: "📡 WebSocket",
            value: `${client.ws.ping}ms`,
            inline: true,
          },
          {
            name: "⚡ Yanıt",
            value: `${roundtrip}ms`,
            inline: true,
          },
          {
            name: "🟢 Durum",
            value: "Aktif",
            inline: true,
          }
        )
        .setTimestamp();

      return reply.edit({
        content: "",
        embeds: [embed],
      });
    }

    // ==================================================
    // KAYIT PANELİ
    // .k @oyuncu İsim
    // ==================================================

    if (command === "k" || command === "kayıt" || command === "kayit") {
      if (!isRegistrationStaff(message.member)) {
        return message.reply("❌ Bu komutu sadece **Kayıt Yetkilisi** veya **Yönetici** kullanabilir.");
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Kullanım: `.k @oyuncu İsim`");
      }

      const isim = args
        .filter(a => !a.startsWith("<@"))
        .join(" ")
        .trim();

      if (!isim) {
        return message.reply("❌ Oyuncunun ismini yazmalısın.\nÖrnek: `.k @Oyuncu W.Sneijder`");
      }

      const roles = await setupRegistrationRoles(message.guild);

      if (!roles.futbolcu || !roles.td || !roles.kayitsiz) {
        return message.reply("❌ Kayıt rolleri oluşturulamadı. Botun **Rol Yönet** yetkisini kontrol edin.");
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📋 United League • Oyuncu Kaydı")
        .setDescription(
          `**Oyuncu:** ${target}\n` +
          `**İsim:** ${isim}\n\n` +
          `Oyuncunun sunucudaki rolünü seçmek için aşağıdaki butonlardan birine basın.\n\n` +
          `⚽ **Futbolcu:** Futbolcu rolü verir.\n` +
          `🎙️ **Teknik Direktör:** Teknik Direktör rolü verir.`
        )
        .setFooter({
          text: "United League • Kayıt Sistemi",
        })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`register:player:${target.id}:${encodeURIComponent(isim)}`)
          .setLabel("Futbolcu")
          .setEmoji("⚽")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`register:td:${target.id}:${encodeURIComponent(isim)}`)
          .setLabel("Teknik Direktör")
          .setEmoji("🎙️")
          .setStyle(ButtonStyle.Success)
      );

      return message.channel.send({
        embeds: [embed],
        components: [row],
      });
    }

    // ==================================================
    // DEĞER
    // ==================================================

    if (
      command === "dver" ||
      command === "değer" ||
      command === "deger"
    ) {
      if (args[0]?.toLowerCase() === "sil") {
        if (!isValueStaff(message.member)) {
          return message.reply("❌ Bu komutu sadece **Değer Yetkilisi** veya **Yönetici** kullanabilir.");
        }

        const target = message.mentions.members.first();
        const amountText = args[2];

        if (!target || !amountText) {
          return message.reply(
            "❌ Kullanım: `.değer sil @oyuncu 5m`"
          );
        }

        const amount = parseMoney(amountText);

        if (!amount || amount <= 0) {
          return message.reply("❌ Geçerli bir miktar yaz.");
        }

        const oldValue = getNicknameValue(
          target.nickname || target.user.username
        );

        const newValue = Math.max(0, oldValue - amount);

        const success = await updatePlayerNickname(target, newValue);

        if (!success) {
          return message.reply(
            "❌ Değer değiştirilemedi. Botun **Takma Adları Yönet** yetkisini ve rol sırasını kontrol edin."
          );
        }

        await logAction(
          message.guild,
          "Değer Silme",
          `${message.author} → ${target} oyuncusundan **${formatMoney(amount)}** değer sildi.\nYeni değer: **${formatMoney(newValue)}**`
        );

        return message.reply(
          `✅ ${target} oyuncusunun değeri **${formatMoney(amount)}** azaltıldı.\nYeni değer: **${formatMoney(newValue)}**`
        );
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Kullanım:\n`.dver @oyuncu 5m`\n`.değer @oyuncu`\n`.değer sil @oyuncu 5m`"
        );
      }

      const amountText = args.find(a => !a.startsWith("<@"));

      if (!amountText) {
        const value = getNicknameValue(
          target.nickname || target.user.username
        );

        return message.reply(
          `💰 ${target} oyuncusunun değeri: **${formatMoney(value)}**`
        );
      }

      if (!isValueStaff(message.member)) {
        return message.reply("❌ Bu komutu sadece **Değer Yetkilisi** veya **Yönetici** kullanabilir.");
      }

      const amount = parseMoney(amountText);

      if (!amount || amount <= 0) {
        return message.reply("❌ Geçerli bir miktar yaz.\nÖrnek: `5m`, `500k`, `1.5m`");
      }

      const oldValue = getNicknameValue(
        target.nickname || target.user.username
      );

      const success = await addPlayerValue(target, amount);

      if (!success) {
        return message.reply(
          "❌ Değer verilemedi. Botun **Takma Adları Yönet** yetkisini ve rol sırasını kontrol edin."
        );
      }

      await logAction(
        message.guild,
        "Değer Verildi",
        `${message.author} → ${target} oyuncusuna **${formatMoney(amount)}** değer verdi.\nEski: **${formatMoney(oldValue)}**\nYeni: **${formatMoney(oldValue + amount)}**`
      );

      return message.reply(
        `✅ ${target} oyuncusuna **${formatMoney(amount)}** değer verildi.\n💰 Yeni değer: **${formatMoney(oldValue + amount)}**`
      );
    }

    // ==================================================
    // DEĞERLER
    // ==================================================

    if (command === "değerler" || command === "degerler") {
      const players = Object.entries(data.players)
        .map(([id, p]) => ({
          id,
          value: p.value || 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      if (!players.length) {
        return message.reply("❌ Henüz kayıtlı değer bulunmuyor.");
      }

      const lines = [];

      for (let i = 0; i < players.length; i++) {
        const p = players[i];

        const member = await message.guild.members
          .fetch(p.id)
          .catch(() => null);

        if (!member) continue;

        lines.push(
          `**${i + 1}.** ${member} — **${formatMoney(p.value)}**`
        );
      }

      return message.reply({
        embeds: [
          makeEmbed(
            "💰 United League • Değer Sıralaması",
            lines.join("\n") || "Veri bulunamadı."
          ),
        ],
      });
    }

    // ==================================================
    // ANTRENMAN
    // ==================================================

    if (command === "ant" || command === "antrenman") {
      const player = getPlayer(message.author.id);

      player.training++;

      let reward = 0;

      if (player.training >= 10) {
        player.training = 0;
        reward = 300000;

        await addPlayerValue(message.member, reward);

        achievement(message.author.id, "🏋️ Antrenman Ustası");
      }

      addXP(message.author.id, 20);

      saveData();

      return message.reply(
        `🏋️ **Antrenman tamamlandı!**\n\n` +
        `📊 İlerleme: **${player.training}/10**\n` +
        (reward
          ? `\n💰 **10/10 tamamlandı! +3M€ değer kazandın.**`
          : `\n🎯 10/10 olduğunda **+3M€** kazanırsın.`)
      );
    }

    // ==================================================
    // PENALTI
    // ==================================================

    if (command === "pen" || command === "penaltı" || command === "penalti") {
      const player = getPlayer(message.author.id);

      player.penalties++;

      const goal = Math.random() < 0.7;

      if (goal) {
        player.penaltyGoals++;

        await addPlayerValue(message.member, 200000);

        achievement(message.author.id, "⚽ Penaltı Uzmanı");
        addXP(message.author.id, 25);

        saveData();

        return message.reply(
          `⚽ **GOOOL!**\n\n` +
          `🥅 Penaltı başarılı!\n` +
          `💰 **+2M€ değer kazandın.**\n` +
          `🎯 Penaltı golleri: **${player.penaltyGoals}**`
        );
      }

      addXP(message.author.id, 10);
      saveData();

      return message.reply(
        `❌ **KAÇTI!**\n\n` +
        `🥅 Penaltı başarısız oldu.\n` +
        `🎯 Penaltı denemeleri: **${player.penalties}**`
      );
    }

    // ==================================================
    // PROFİL
    // ==================================================

    if (command === "profil" || command === "istatistik") {
      const target = message.mentions.members.first() || message.member;
      const player = getPlayer(target.id);

      const value =
        getNicknameValue(target.nickname || target.user.username) ||
        player.value;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`👤 ${target.user.username} • Profil`)
        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          {
            name: "💰 Değer",
            value: formatMoney(value),
            inline: true,
          },
          {
            name: "💵 Bütçe",
            value: formatMoney(player.budget),
            inline: true,
          },
          {
            name: "⭐ Seviye",
            value: `${player.level}`,
            inline: true,
          },
          {
            name: "⚽ Maç",
            value: `${player.matches}`,
            inline: true,
          },
          {
            name: "🥅 Gol",
            value: `${player.goals}`,
            inline: true,
          },
          {
            name: "🎯 Asist",
            value: `${player.assists}`,
            inline: true,
          },
          {
            name: "⚽ Penaltı Golü",
            value: `${player.penaltyGoals}`,
            inline: true,
          },
          {
            name: "🏋️ Antrenman",
            value: `${player.training}/10`,
            inline: true,
          }
        )
        .setFooter({
          text: "United League • Futbol Rp",
        })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ==================================================
    // BÜTÇE
    // ==================================================

    if (command === "bütçe" || command === "butce" || command === "para") {
      const target = message.mentions.members.first() || message.member;
      const player = getPlayer(target.id);

      return message.reply(
        `💵 ${target} oyuncusunun bütçesi: **${formatMoney(player.budget)}**`
      );
    }

    // ==================================================
    // PARA GÖNDER
    // ==================================================

    if (command === "paragönder" || command === "paragonder") {
      const target = message.mentions.members.first();
      const amountText = args.find(a => !a.startsWith("<@"));

      if (!target || !amountText) {
        return message.reply(
          "❌ Kullanım: `.paragönder @oyuncu 5m`"
        );
      }

      const amount = parseMoney(amountText);

      if (!amount || amount <= 0) {
        return message.reply("❌ Geçerli miktar gir.");
      }

      const sender = getPlayer(message.author.id);
      const receiver = getPlayer(target.id);

      if (sender.budget < amount) {
        return message.reply("❌ Bütçen yeterli değil.");
      }

      sender.budget -= amount;
      receiver.budget += amount;

      saveData();

      return message.reply(
        `✅ ${target} oyuncusuna **${formatMoney(amount)}** gönderildi.`
      );
    }

    // ==================================================
    // TAKIM OLUŞTUR
    // ==================================================

    if (command === "takımoluştur" || command === "takimolustur") {
      if (!hasRole(message.member, (
        await setupRegistrationRoles(message.guild)
      ).td?.id) && !isAdmin(message.member)) {
        return message.reply(
          "❌ Takım oluşturmak için **Teknik Direktör** olmalısın."
        );
      }

      const teamName = args.join(" ").trim();

      if (!teamName) {
        return message.reply(
          "❌ Kullanım: `.takımoluştur Barcelona`"
        );
      }

      const already = Object.values(data.teams).find(
        t => t.ownerId === message.author.id
      );

      if (already) {
        return message.reply(
          `❌ Zaten bir takımın var: **${already.name}**`
        );
      }

      const exists = Object.values(data.teams).find(
        t => t.name.toLowerCase() === teamName.toLowerCase()
      );

      if (exists) {
        return message.reply("❌ Bu takım zaten mevcut.");
      }

      const teamId = `${Date.now()}_${message.author.id}`;

      const teamRole = await getOrCreateRole(message.guild, teamName, {
        color: 0xe67e22,
        hoist: true,
      });

      data.teams[teamId] = {
        id: teamId,
        name: teamName,
        ownerId: message.author.id,
        budget: 10000000,
        players: [],
        formation: "4-3-3",
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        roleId: teamRole?.id || null,
      };

      const player = getPlayer(message.author.id);
      player.teamId = teamId;

      if (teamRole) {
        await message.member.roles.add(teamRole).catch(() => {});
      }

      saveData();

      await logAction(
        message.guild,
        "Takım Oluşturuldu",
        `${message.author} **${teamName}** takımını oluşturdu.`
      );

      return message.reply(
        `✅ **${teamName}** takımı oluşturuldu!\n` +
        `💰 Başlangıç bütçesi: **10M€**\n` +
        `📋 Formasyon: **4-3-3**`
      );
    }

    // ==================================================
    // TAKIMLAR
    // ==================================================

    if (command === "takımlar" || command === "takimlar") {
      const teams = Object.values(data.teams);

      if (!teams.length) {
        return message.reply("❌ Henüz takım oluşturulmamış.");
      }

      const text = teams
        .map(
          (t, i) =>
            `**${i + 1}. ${t.name}**\n` +
            `👤 Sahip: <@${t.ownerId}>\n` +
            `💰 Bütçe: ${formatMoney(t.budget)}\n` +
            `🏆 Puan: ${t.points}`
        )
        .join("\n\n");

      return message.reply({
        embeds: [
          makeEmbed("🏟️ United League • Takımlar", text),
        ],
      });
    }

    // ==================================================
    // TAKIM
    // ==================================================

    if (
      command === "takım" ||
      command === "takim" ||
      command === "takımım" ||
      command === "takimim"
    ) {
      const player = getPlayer(message.author.id);

      if (!player.teamId || !data.teams[player.teamId]) {
        return message.reply("❌ Bir takıma bağlı değilsin.");
      }

      const team = data.teams[player.teamId];

      return message.reply({
        embeds: [
          makeEmbed(
            `🏟️ ${team.name}`,
            `👤 Takım Sahibi: <@${team.ownerId}>\n` +
            `💰 Bütçe: **${formatMoney(team.budget)}**\n` +
            `👥 Kadro: **${team.players.length}** oyuncu\n` +
            `📋 Formasyon: **${team.formation}**\n\n` +
            `🏆 Puan: **${team.points}**\n` +
            `🟢 Galibiyet: **${team.wins}**\n` +
            `🟡 Beraberlik: **${team.draws}**\n` +
            `🔴 Mağlubiyet: **${team.losses}**`
          ),
        ],
      });
    }

    // ==================================================
    // FORMASYON
    // ==================================================

    if (command === "formasyon") {
      const player = getPlayer(message.author.id);

      if (!player.teamId || !data.teams[player.teamId]) {
        return message.reply("❌ Bir takımın yok.");
      }

      const team = data.teams[player.teamId];

      if (
        team.ownerId !== message.author.id &&
        !isAdmin(message.member)
      ) {
        return message.reply(
          "❌ Formasyonu sadece takım sahibi değiştirebilir."
        );
      }

      const formation = args[0];

      if (!formation) {
        return message.reply(
          `📋 Mevcut formasyon: **${team.formation}**\n\n` +
          `Örnekler:\n` +
          `\`.formasyon 4-3-3\`\n` +
          `\`.formasyon 4-4-2\`\n` +
          `\`.formasyon 3-5-2\``
        );
      }

      if (!/^\d-\d-\d(?:-\d)?$/.test(formation)) {
        return message.reply(
          "❌ Geçerli bir formasyon yaz.\nÖrnek: `4-3-3`"
        );
      }

      team.formation = formation;

      saveData();

      return message.reply(
        `✅ **${team.name}** takımının formasyonu **${formation}** olarak ayarlandı.`
      );
    }

    // ==================================================
    // KADRO
    // ==================================================

    if (command === "kadro") {
      const target = message.mentions.members.first();

      const player = getPlayer(message.author.id);

      if (!player.teamId || !data.teams[player.teamId]) {
        return message.reply("❌ Bir takımın yok.");
      }

      const team = data.teams[player.teamId];

      if (target) {
        if (
          team.ownerId !== message.author.id &&
          !isAdmin(message.member)
        ) {
          return message.reply(
            "❌ Kadroya oyuncu ekleme yetkin yok."
          );
        }

        if (team.players.includes(target.id)) {
          return message.reply("❌ Oyuncu zaten kadroda.");
        }

        const targetPlayer = getPlayer(target.id);

        if (targetPlayer.teamId) {
          return message.reply("❌ Oyuncu zaten başka bir takımda.");
        }

        team.players.push(target.id);
        targetPlayer.teamId = team.id;

        saveData();

        return message.reply(
          `✅ ${target} **${team.name}** kadrosuna eklendi.`
        );
      }

      if (!team.players.length) {
        return message.reply(
          `👥 **${team.name}** kadrosunda henüz oyuncu yok.`
        );
      }

      const list = [];

      for (let i = 0; i < team.players.length; i++) {
        list.push(`${i + 1}. <@${team.players[i]}>`);
      }

      return message.reply({
        embeds: [
          makeEmbed(
            `👥 ${team.name} • Kadro`,
            `📋 Formasyon: **${team.formation}**\n\n${list.join("\n")}`
          ),
        ],
      });
    }

    // ==================================================
    // KADRODAN ÇIKAR
    // ==================================================

    if (command === "kadrocikar" || command === "kadroçıkar") {
      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Kullanım: `.kadrocikar @oyuncu`");
      }

      const player = getPlayer(message.author.id);

      if (!player.teamId || !data.teams[player.teamId]) {
        return message.reply("❌ Bir takımın yok.");
      }

      const team = data.teams[player.teamId];

      if (
        team.ownerId !== message.author.id &&
        !isAdmin(message.member)
      ) {
        return message.reply("❌ Bu işlem için yetkin yok.");
      }

      const index = team.players.indexOf(target.id);

      if (index === -1) {
        return message.reply("❌ Oyuncu kadroda değil.");
      }

      team.players.splice(index, 1);

      const targetPlayer = getPlayer(target.id);
      targetPlayer.teamId = null;

      saveData();

      return message.reply(
        `✅ ${target} **${team.name}** kadrosundan çıkarıldı.`
      );
    }

    // ==================================================
    // TAKIM BÜTÇESİ
    // ==================================================

    if (
      command === "takımbütçe" ||
      command === "takimbutce"
    ) {
      const player = getPlayer(message.author.id);

      if (!player.teamId || !data.teams[player.teamId]) {
        return message.reply("❌ Bir takımın yok.");
      }

      const team = data.teams[player.teamId];

      return message.reply(
        `💰 **${team.name}** takım bütçesi: **${formatMoney(team.budget)}**`
      );
    }

    // ==================================================
    // TAKIM PARA
    // ==================================================

    if (
      command === "takımpara" ||
      command === "takimpara"
    ) {
      const amount = parseMoney(args[0]);

      if (!amount || amount <= 0) {
        return message.reply(
          "❌ Kullanım: `.takımpara 5m`"
        );
      }

      const player = getPlayer(message.author.id);

      if (!player.teamId || !data.teams[player.teamId]) {
        return message.reply("❌ Bir takımın yok.");
      }

      const team = data.teams[player.teamId];

      if (
        team.ownerId !== message.author.id &&
        !isAdmin(message.member)
      ) {
        return message.reply(
          "❌ Takım bütçesini sadece takım sahibi kullanabilir."
        );
      }

      team.budget += amount;

      saveData();

      return message.reply(
        `✅ Takım bütçesine **${formatMoney(amount)}** eklendi.\n` +
        `💰 Yeni bütçe: **${formatMoney(team.budget)}**`
      );
    }

    // ==================================================
    // TAKIM HARCAMA
    // ==================================================

    if (
      command === "takımharca" ||
      command === "takimharca"
    ) {
      const amount = parseMoney(args[0]);

      if (!amount || amount <= 0) {
        return message.reply(
          "❌ Kullanım: `.takımharca 5m`"
        );
      }

      const player = getPlayer(message.author.id);

      if (!player.teamId || !data.teams[player.teamId]) {
        return message.reply("❌ Bir takımın yok.");
      }

      const team = data.teams[player.teamId];

      if (
        team.ownerId !== message.author.id &&
        !isAdmin(message.member)
      ) {
        return message.reply(
          "❌ Takım bütçesini sadece takım sahibi kullanabilir."
        );
      }

      if (team.budget < amount) {
        return message.reply("❌ Takım bütçesi yeterli değil.");
      }

      team.budget -= amount;

      saveData();

      return message.reply(
        `✅ **${formatMoney(amount)}** takım bütçesinden harcandı.\n` +
        `💰 Kalan: **${formatMoney(team.budget)}**`
      );
    }

    // ==================================================
    // KAP
    // .kap @oyuncu
    // ==================================================

    if (command === "kap") {
      const target = message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Kullanım: `.kap @oyuncu`"
        );
      }

      const senderPlayer = getPlayer(message.author.id);
      const targetPlayer = getPlayer(target.id);

      if (!senderPlayer.teamId || !data.teams[senderPlayer.teamId]) {
        return message.reply(
          "❌ KAP açmak için bir takımın olmalı."
        );
      }

      const buyingTeam = data.teams[senderPlayer.teamId];

      if (
        buyingTeam.ownerId !== message.author.id &&
        !isAdmin(message.member)
      ) {
        return message.reply(
          "❌ KAP komutunu sadece **Teknik Direktör / Takım Sahibi** kullanabilir."
        );
      }

      const currentValue =
        getNicknameValue(target.nickname || target.user.username) ||
        targetPlayer.value ||
        0;

      const kapId = `KAP-${Date.now()}`;

      data.kap[kapId] = {
        id: kapId,
        buyerId: message.author.id,
        buyingTeamId: buyingTeam.id,
        playerId: target.id,
        sellerTeamId: targetPlayer.teamId || null,
        status: "pending",
        createdAt: Date.now(),
        amount: currentValue,
        salary: targetPlayer.salary || 0,
      };

      saveData();

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("📄 United League • KAP Formu")
        .setDescription(
          `**${target.user.username}** oyuncusu için transfer formu oluşturuldu.\n\n` +
          `👤 Oyuncu: ${target}\n` +
          `🏟️ Talip takım: **${buyingTeam.name}**\n\n` +
          `Oyuncunun **maaş ve transfer şartlarını düzenleyebilmesi için** aşağıdaki form kullanılacaktır.`
        )
        .addFields(
          {
            name: "💰 Mevcut Değer",
            value: formatMoney(currentValue),
            inline: true,
          },
          {
            name: "💵 Mevcut Maaş",
            value: formatMoney(targetPlayer.salary || 0),
            inline: true,
          }
        )
        .setFooter({
          text: `KAP ID: ${kapId}`,
        })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`kap:accept:${kapId}`)
          .setLabel("Oyuncuya Gönder")
          .setEmoji("📨")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`kap:cancel:${kapId}`)
          .setLabel("İptal")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger)
      );

      return message.channel.send({
        embeds: [embed],
        components: [row],
      });
    }

    // ==================================================
    // TRANSFERLER
    // ==================================================

    if (command === "transferler") {
      const pending = Object.values(data.kap).filter(
        k => k.status === "pending"
      );

      if (!pending.length) {
        return message.reply("📭 Bekleyen transfer bulunmuyor.");
      }

      const text = pending
        .slice(0, 15)
        .map(
          k =>
            `📄 **${k.id}** — <@${k.playerId}> → **${
              data.teams[k.buyingTeamId]?.name || "Bilinmeyen"
            }**`
        )
        .join("\n");

      return message.reply({
        embeds: [
          makeEmbed(
            "📄 United League • Transferler",
            text
          ),
        ],
      });
    }

    // ==================================================
    // MAÇ
    // ==================================================

    if (command === "maç" || command === "mac") {
      const mentioned = message.mentions.members;

      if (mentioned.size < 2) {
        return message.reply(
          "❌ Kullanım: `.maç @takım1 @takım2`"
        );
      }

      const members = [...mentioned.values()];

      const p1 = getPlayer(members[0].id);
      const p2 = getPlayer(members[1].id);

      if (!p1.teamId || !p2.teamId) {
        return message.reply(
          "❌ Etiketlenen kullanıcıların takım bilgisi bulunamadı."
        );
      }

      const team1 = data.teams[p1.teamId];
      const team2 = data.teams[p2.teamId];

      if (!team1 || !team2) {
        return message.reply("❌ Takımlar bulunamadı.");
      }

      const score1 = Math.floor(Math.random() * 5);
      const score2 = Math.floor(Math.random() * 5);

      const match = {
        id: `MATCH-${Date.now()}`,
        team1: team1.id,
        team2: team2.id,
        score1,
        score2,
        createdAt: Date.now(),
      };

      data.matches.push(match);

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

      team1.players.forEach(id => {
        const pl = getPlayer(id);
        pl.matches++;
        addXP(id, 15);
      });

      team2.players.forEach(id => {
        const pl = getPlayer(id);
        pl.matches++;
        addXP(id, 15);
      });

      saveData();

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("⚽ United League • Maç Sonucu")
        .setDescription(
          `🏟️ **${team1.name}** vs **${team2.name}**\n\n` +
          `# ${score1} - ${score2}\n\n` +
          `📋 ${team1.name}: **${team1.formation}**\n` +
          `📋 ${team2.name}: **${team2.formation}**`
        )
        .setTimestamp();

      return message.channel.send({
        embeds: [embed],
      });
    }

    // ==================================================
    // MAÇLAR
    // ==================================================

    if (command === "maçlar" || command === "maclar") {
      if (!data.matches.length) {
        return message.reply("❌ Henüz maç oynanmadı.");
      }

      const list = data.matches
        .slice(-10)
        .reverse()
        .map(m => {
          const t1 = data.teams[m.team1]?.name || "?";
          const t2 = data.teams[m.team2]?.name || "?";

          return `⚽ **${t1}** ${m.score1} - ${m.score2} **${t2}**`;
        })
        .join("\n");

      return message.reply({
        embeds: [
          makeEmbed(
            "⚽ United League • Son Maçlar",
            list
          ),
        ],
      });
    }

    // ==================================================
    // PUAN DURUMU
    // ==================================================

    if (
      command === "puan" ||
      command === "lig"
    ) {
      const teams = Object.values(data.teams).sort(
        (a, b) => b.points - a.points
      );

      if (!teams.length) {
        return message.reply("❌ Henüz ligde takım yok.");
      }

      const text = teams
        .map(
          (t, i) =>
            `**${i + 1}. ${t.name}** — ${t.points} puan | ${t.wins}G ${t.draws}B ${t.losses}M`
        )
        .join("\n");

      return message.reply({
        embeds: [
          makeEmbed(
            `🏆 United League • Sezon ${data.season.number}`,
            text
          ),
        ],
      });
    }

    // ==================================================
    // GOL KRALLIĞI
    // ==================================================

    if (command === "golkrallığı" || command === "golkralligi") {
      const list = Object.entries(data.players)
        .sort((a, b) => (b[1].goals || 0) - (a[1].goals || 0))
        .slice(0, 10);

      const lines = [];

      for (let i = 0; i < list.length; i++) {
        lines.push(
          `**${i + 1}.** <@${list[i][0]}> — **${list[i][1].goals || 0} gol**`
        );
      }

      return message.reply({
        embeds: [
          makeEmbed(
            "🥅 United League • Gol Krallığı",
            lines.join("\n") || "Veri yok."
          ),
        ],
      });
    }

    // ==================================================
    // ASİST KRALLIĞI
    // ==================================================

    if (command === "asistkrallığı" || command === "asistkralligi") {
      const list = Object.entries(data.players)
        .sort((a, b) => (b[1].assists || 0) - (a[1].assists || 0))
        .slice(0, 10);

      const lines = [];

      for (let i = 0; i < list.length; i++) {
        lines.push(
          `**${i + 1}.** <@${list[i][0]}> — **${list[i][1].assists || 0} asist**`
        );
      }

      return message.reply({
        embeds: [
          makeEmbed(
            "🎯 United League • Asist Krallığı",
            lines.join("\n") || "Veri yok."
          ),
        ],
      });
    }

    // ==================================================
    // SEZON
    // ==================================================

    if (command === "sezon") {
      return message.reply({
        embeds: [
          makeEmbed(
            `🏆 United League • Sezon ${data.season.number}`,
            `📅 Sezon başlangıcı: <t:${Math.floor(
              data.season.startedAt / 1000
            )}:F>`
          ),
        ],
      });
    }

    // ==================================================
    // ÇEKİLİŞ
    // ==================================================

    if (command === "çekiliş" || command === "cekilis") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
      }

      const prize = args[0];
      const timeText = args[1];

      if (!prize || !timeText) {
        return message.reply(
          "❌ Kullanım: `.çekiliş 5m 5saat`"
        );
      }

      const amount = parseMoney(prize);

      if (!amount) {
        return message.reply("❌ Geçerli ödül yaz.");
      }

      const timeMatch = timeText.match(/^(\d+(?:\.\d+)?)(s|dk|m|h|sa|saat|d)$/i);

      if (!timeMatch) {
        return message.reply(
          "❌ Süre örnekleri: `30s`, `5dk`, `5dk`, `2saat`"
        );
      }

      const number = Number(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();

      let milliseconds = 0;

      if (unit === "s") milliseconds = number * 1000;
      else if (unit === "dk" || unit === "m") milliseconds = number * 60000;
      else if (unit === "h" || unit === "sa" || unit === "saat")
        milliseconds = number * 3600000;
      else if (unit === "d") milliseconds = number * 86400000;

      const giveawayId = `GW-${Date.now()}`;

      data.giveaways[giveawayId] = {
        id: giveawayId,
        prize: amount,
        channelId: message.channel.id,
        participants: [],
        endAt: Date.now() + milliseconds,
        ended: false,
      };

      saveData();

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("🎉 United League • Çekiliş")
        .setDescription(
          `💰 Ödül: **${formatMoney(amount)}**\n\n` +
          `🎟️ Katılmak için 🎉 butonuna bas.\n` +
          `⏰ Bitiş: <t:${Math.floor(
            (Date.now() + milliseconds) / 1000
          )}:R>`
        )
        .setFooter({
          text: `Çekiliş ID: ${giveawayId}`,
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway:join:${giveawayId}`)
          .setLabel("Katıl")
          .setEmoji("🎉")
          .setStyle(ButtonStyle.Success)
      );

      const sent = await message.channel.send({
        embeds: [embed],
        components: [row],
      });

      setTimeout(async () => {
        try {
          const giveaway = data.giveaways[giveawayId];

          if (!giveaway || giveaway.ended) return;

          giveaway.ended = true;

          const participants = giveaway.participants;

          if (!participants.length) {
            await sent.edit({
              content: "❌ Çekiliş sona erdi fakat katılımcı yok.",
              components: [],
            });

            saveData();
            return;
          }

          const winner =
            participants[Math.floor(Math.random() * participants.length)];

          await sent.edit({
            content: `🎉 **Çekiliş sona erdi!** Kazanan: <@${winner}>`,
            components: [],
          });

          const player = getPlayer(winner);
          player.budget += giveaway.prize;

          saveData();

          await message.channel.send(
            `🎉 Tebrikler <@${winner}>! **${formatMoney(
              giveaway.prize
            )}** kazandın!`
          );
        } catch (err) {
          console.error("Çekiliş bitirme hatası:", err);
        }
      }, Math.min(milliseconds, 2147483647));

      return;
    }

    // ==================================================
    // YENİ KAZANAN
    // ==================================================

    if (command === "yenikazanan") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Yetkin yok.");
      }

      const giveaway = Object.values(data.giveaways)
        .filter(g => g.ended)
        .sort((a, b) => b.endAt - a.endAt)[0];

      if (!giveaway) {
        return message.reply("❌ Yeniden seçilecek çekiliş bulunamadı.");
      }

      if (!giveaway.participants.length) {
        return message.reply("❌ Katılımcı bulunmuyor.");
      }

      const winner =
        giveaway.participants[
          Math.floor(Math.random() * giveaway.participants.length)
        ];

      return message.reply(
        `🎉 Yeni kazanan: <@${winner}>`
      );
    }

    // ==================================================
    // DM
    // ==================================================

    if (command === "dm") {
      if (
        !isAdmin(message.member) &&
        !hasRole(message.member, ROLES.ADMIN)
      ) {
        return message.reply("❌ Bu komut için yetkin yok.");
      }

      const first = args.shift();

      if (!first) {
        return message.reply(
          "❌ Kullanım:\n`.dm all Mesaj`\n`.dm @oyuncu Mesaj`"
        );
      }

      const text = args.join(" ");

      if (!text) {
        return message.reply("❌ Gönderilecek mesajı yaz.");
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("United League")
        .setDescription(text)
        .setFooter({
          text: "United League • Resmî Bildirim",
        })
        .setTimestamp();

      if (first.toLowerCase() === "all") {
        await message.guild.members.fetch();

        let sent = 0;
        let failed = 0;

        for (const member of message.guild.members.cache.values()) {
          if (member.user.bot) continue;

          try {
            await member.send({ embeds: [embed] });
            sent++;
          } catch {
            failed++;
          }
        }

        return message.reply(
          `📨 DM gönderimi tamamlandı.\n✅ Başarılı: **${sent}**\n❌ Başarısız: **${failed}**`
        );
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Oyuncuyu etiketle.");
      }

      try {
        await target.send({ embeds: [embed] });

        return message.reply(
          `✅ ${target} kullanıcısına DM gönderildi.`
        );
      } catch {
        return message.reply(
          "❌ Kullanıcıya DM gönderilemedi."
        );
      }
    }

    // ==================================================
    // TWEET
    // ==================================================

    if (command === "tweet") {
      const text = args.join(" ");

      if (!text) {
        return message.reply(
          "❌ Kullanım: `.tweet Mesaj`"
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0x1da1f2)
        .setTitle("🐦 United League • Tweet")
        .setDescription(text)
        .setAuthor({
          name: message.member.displayName,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

      return message.channel.send({
        embeds: [embed],
      });
    }

    // ==================================================
    // HABER
    // ==================================================

    if (command === "haber") {
      const text = args.join(" ");

      if (!text) {
        return message.reply(
          "❌ Kullanım: `.haber Haber metni`"
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("📰 United League • Son Dakika")
        .setDescription(text)
        .setTimestamp();

      return message.channel.send({
        embeds: [embed],
      });
    }

    // ==================================================
    // EMBED
    // ==================================================

    if (command === "embed") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
      }

      const text = args.join(" ");

      if (!text) {
        return message.reply(
          "❌ Kullanım: `.embed Mesaj`"
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(text)
        .setFooter({
          text: "United League",
        })
        .setTimestamp();

      return message.channel.send({
        embeds: [embed],
      });
    }

    // ==================================================
    // SİL
    // ==================================================

    if (command === "sil") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Yetkin yok.");
      }

      const amount = parseInt(args[0]);

      if (!amount || amount < 1 || amount > 1000) {
        return message.reply(
          "❌ 1 ile 1000 arasında bir miktar yaz."
        );
      }

      const deleted = await message.channel.bulkDelete(amount, true);

      const msg = await message.channel.send(
        `🗑️ **${deleted.size}** mesaj silindi.`
      );

      setTimeout(() => msg.delete().catch(() => {}), 3000);

      return;
    }

    // ==================================================
    // KİLİTLE
    // ==================================================

    if (command === "kilitle") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Yetkin yok.");
      }

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: false,
        }
      );

      return message.channel.send(
        "🔒 Bu kanal kilitlendi."
      );
    }

    // ==================================================
    // KİLİT AÇ
    // ==================================================

    if (
      command === "kilitaç" ||
      command === "kilitac"
    ) {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Yetkin yok.");
      }

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: null,
        }
      );

      return message.channel.send(
        "🔓 Bu kanalın kilidi açıldı."
      );
    }

    // ==================================================
    // KICK
    // ==================================================

    if (command === "kick") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Yetkin yok.");
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Kullanım: `.kick @oyuncu`");
      }

      if (!target.kickable) {
        return message.reply("❌ Bu oyuncuyu atamıyorum.");
      }

      await target.kick(
        `United League | ${message.author.tag}`
      );

      return message.reply(
        `👢 ${target.user.tag} sunucudan atıldı.`
      );
    }

    // ==================================================
    // BAN
    // ==================================================

    if (command === "ban") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Yetkin yok.");
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Kullanım: `.ban @oyuncu`");
      }

      if (!target.bannable) {
        return message.reply("❌ Bu oyuncuyu banlayamıyorum.");
      }

      await target.ban({
        reason: `United League | ${message.author.tag}`,
      });

      return message.reply(
        `🔨 ${target.user.tag} sunucudan banlandı.`
      );
    }

    // ==================================================
    // MUTE
    // ==================================================

    if (command === "mute") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Yetkin yok.");
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Kullanım: `.mute @oyuncu`");
      }

      let muteRole = message.guild.roles.cache.find(
        r => r.name === "Muted"
      );

      if (!muteRole) {
        muteRole = await getOrCreateRole(message.guild, "Muted", {
          color: 0x808080,
          hoist: false,
        });
      }

      if (!muteRole) {
        return message.reply("❌ Muted rolü oluşturulamadı.");
      }

      await target.roles.add(muteRole);

      return message.reply(
        `🔇 ${target} susturuldu.`
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
        return message.reply("❌ Yetkin yok.");
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Kullanım: `.unmute @oyuncu`");
      }

      const muteRole = message.guild.roles.cache.find(
        r => r.name === "Muted"
      );

      if (!muteRole) {
        return message.reply("❌ Muted rolü bulunamadı.");
      }

      await target.roles.remove(muteRole);

      return message.reply(
        `🔊 ${target} kullanıcısının susturması kaldırıldı.`
      );
    }

    // ==================================================
    // TICKET
    // ==================================================

    if (command === "ticket") {
      const channel = await message.guild.channels.create({
        name: `ticket-${message.author.username}`.toLowerCase().slice(0, 90),
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: message.guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: message.author.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎫 United League • Ticket")
        .setDescription(
          `Merhaba ${message.author}, yetkililer en kısa sürede ilgilenecektir.\n\n` +
          `Ticketı kapatmak için \`.ticketkapat\` yaz.`
        );

      await channel.send({
        content: `${message.author}`,
        embeds: [embed],
      });

      return message.reply(
        `✅ Ticket oluşturuldu: ${channel}`
      );
    }

    // ==================================================
    // TICKET KAPAT
    // ==================================================

    if (
      command === "ticketkapat" ||
      command === "ticketkapat"
    ) {
      if (!message.channel.name.startsWith("ticket-")) {
        return message.reply(
          "❌ Bu komut sadece ticket kanalında kullanılabilir."
        );
      }

      await message.reply("🔒 Ticket kapatılıyor...");

      setTimeout(() => {
        message.channel.delete().catch(() => {});
      }, 1500);

      return;
    }

    // ==================================================
    // REKLAM PAKETLERİ
    // ==================================================

    if (
      command === "reklampaketleri" ||
      command === "reklampaket"
    ) {
      return message.reply({
        embeds: [
          makeEmbed(
            "📢 United League • Reklam Paketleri",
            `🥉 **Bronz:** 150K€\n` +
            `🥈 **Gümüş:** 300K€\n` +
            `🥇 **Altın:** 600K€\n` +
            `💎 **Platin:** 1.2M€\n` +
            `👑 **Legendary:** 2.4M€\n` +
            `🌟 **Ultimate:** 4.8M€\n\n` +
            `@everyone: **100K€**\n` +
            `@here: **50K€**\n\n` +
            `600K€ sonrası everyone/here hakları artar.\n` +
            `Maksimum **5** everyone/here hakkı vardır.\n` +
            `700K€ sonrası özel kanal açılabilir.`
          ),
        ],
      });
    }

    // ==================================================
    // ŞİRKETLER
    // ==================================================

    if (command === "şirketler" || command === "sirketler") {
      return message.reply({
        embeds: [
          makeEmbed(
            "🏢 United League • Şirketler",
            `✈️ Emirates\n` +
            `👟 Adidas\n` +
            `👟 Puma\n` +
            `👟 Nike\n` +
            `🥤 Coca-Cola\n` +
            `🥤 Pepsi\n` +
            `🔴 Red Bull\n` +
            `🏎️ Mercedes`
          ),
        ],
      });
    }

    // ==================================================
    // ŞİRKET BAŞVURU
    // ==================================================

    if (
      command === "şirketbaşvur" ||
      command === "sirketbasvur"
    ) {
      const brand = args.join(" ");

      if (!brand) {
        return message.reply(
          "❌ Kullanım: `.şirketbaşvur Adidas`"
        );
      }

      const chance = Math.floor(Math.random() * 100) + 1;

      const accepted = chance <= 60;

      if (accepted) {
        data.companies[message.author.id] = {
          brand,
          acceptedAt: Date.now(),
        };

        saveData();

        return message.reply(
          `🏢 Tebrikler! **${brand}** şirket başvurun kabul edildi.`
        );
      }

      return message.reply(
        `❌ **${brand}** şirket başvurun NPC yönetimi tarafından reddedildi.`
      );
    }

    // ==================================================
    // SPONSORLAR
    // ==================================================

    if (command === "sponsorlar") {
      return message.reply({
        embeds: [
          makeEmbed(
            "🤝 United League • Sponsorlar",
            `✈️ Emirates\n` +
            `👟 Adidas\n` +
            `👟 Puma\n` +
            `👟 Nike\n` +
            `🥤 Coca-Cola\n` +
            `🥤 Pepsi\n` +
            `🔴 Red Bull\n` +
            `🏎️ Mercedes`
          ),
        ],
      });
    }

    // ==================================================
    // SPONSOR BAŞVURU
    // ==================================================

    if (
      command === "sponsorbaşvur" ||
      command === "sponsorbasvur"
    ) {
      const brand = args.join(" ");

      if (!brand) {
        return message.reply(
          "❌ Kullanım: `.sponsorbaşvur Nike`"
        );
      }

      const chance = Math.floor(Math.random() * 100) + 1;

      if (chance <= 65) {
        data.sponsors[message.author.id] = {
          brand,
          acceptedAt: Date.now(),
        };

        saveData();

        return message.reply(
          `🤝 Tebrikler! **${brand}** sponsor başvurun kabul edildi.`
        );
      }

      return message.reply(
        `❌ **${brand}** sponsor başvurun reddedildi.`
      );
    }

  } catch (err) {
    console.error("Komut hatası:", err);

    try {
      await message.reply(
        "❌ İşlem sırasında bir hata oluştu. Konsol/Railway loglarını kontrol edin."
      );
    } catch {}
  }
});

// ======================================================
// BUTTON SYSTEM
// ======================================================

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isButton()) return;
    if (!interaction.guild) return;

    // ==================================================
    // KAYIT BUTONLARI
    // ==================================================

    if (interaction.customId.startsWith("register:")) {
      const parts = interaction.customId.split(":");

      const type = parts[1];
      const targetId = parts[2];
      const encodedName = parts.slice(3).join(":");

      const target = await interaction.guild.members
        .fetch(targetId)
        .catch(() => null);

      if (!target) {
        return interaction.reply({
          content: "❌ Oyuncu artık sunucuda değil.",
          ephemeral: true,
        });
      }

      const allowed =
        interaction.user.id === targetId ||
        isRegistrationStaff(interaction.member);

      if (!allowed) {
        return interaction.reply({
          content:
            "❌ Bu kayıt butonunu sadece oyuncunun kendisi veya Kayıt Yetkilisi kullanabilir.",
          ephemeral: true,
        });
      }

      const roles = await setupRegistrationRoles(interaction.guild);

      if (!roles.futbolcu || !roles.td || !roles.kayitsiz) {
        return interaction.reply({
          content:
            "❌ Kayıt rolleri oluşturulamadı. Botun Rol Yönet yetkisini kontrol edin.",
          ephemeral: true,
        });
      }

      const botMember = interaction.guild.members.me;

      if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.reply({
          content:
            "❌ Botun **Rolleri Yönet** yetkisi yok.",
          ephemeral: true,
        });
      }

      if (
        roles.futbolcu.position >= botMember.roles.highest.position ||
        roles.td.position >= botMember.roles.highest.position ||
        roles.kayitsiz.position >= botMember.roles.highest.position
      ) {
        return interaction.reply({
          content:
            "❌ Kayıt rolleri botun en yüksek rolünün altında olmalı.",
          ephemeral: true,
        });
      }

      await target.roles.remove(roles.kayitsiz).catch(() => {});

      let selectedRole;
      let roleText;

      if (type === "player") {
        selectedRole = roles.futbolcu;
        roleText = "⚽ Futbolcu";
      } else {
        selectedRole = roles.td;
        roleText = "🎙️ Teknik Direktör";
      }

      await target.roles.add(selectedRole);

      const player = getPlayer(target.id);

      player.registered = true;
      player.roleType = type === "player"
        ? "Futbolcu"
        : "Teknik Direktör";

      if (encodedName) {
        const playerName = decodeURIComponent(encodedName);

        try {
          let nickname = playerName;

          if (nickname.length > 32) {
            nickname = nickname.slice(0, 32);
          }

          await target.setNickname(nickname);
        } catch {}
      }

      saveData();

      await interaction.update({
        embeds: [
          makeEmbed(
            "✅ Kayıt Tamamlandı",
            `${target} başarıyla kayıt edildi.\n\n` +
            `🎭 Verilen rol: **${roleText}**\n` +
            `👤 Kayıt eden: ${interaction.user}`
          ),
        ],
        components: [],
      });

      const kayıtChannel = interaction.guild.channels.cache.find(
        c =>
          c.type === ChannelType.GuildText &&
          ["kayıt", "kayit"].includes(c.name.toLowerCase())
      );

      if (kayıtChannel) {
        await kayıtChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle("🎉 Oyuncu Kaydı Tamamlandı")
              .setDescription(
                `👤 ${target}\n\n` +
                `🎭 Rol: **${roleText}**\n` +
                `🛡️ Kayıt Yetkilisi: ${interaction.user}\n\n` +
                `United League ailesine hoş geldin! ⚽`
              )
              .setThumbnail(
                target.user.displayAvatarURL({ dynamic: true })
              )
              .setTimestamp(),
          ],
        });
      }

      const chatChannel = interaction.guild.channels.cache.find(
        c =>
          c.type === ChannelType.GuildText &&
          ["sohbet", "chat", "genel"].includes(c.name.toLowerCase())
      );

      if (chatChannel) {
        await chatChannel.send(
          `🎉 ${target} **United League** ailesine hoş geldin!\n` +
          `⚽ Rolün: **${roleText}**`
        );
      }

      await logAction(
        interaction.guild,
        "Kayıt Tamamlandı",
        `${target} → ${roleText}\nKayıt eden: ${interaction.user}`
      );

      return;
    }

    // ==================================================
    // KAP OYUNCUYA GÖNDER
    // ==================================================

    if (interaction.customId.startsWith("kap:accept:")) {
      const kapId = interaction.customId.split(":")[2];

      const kap = data.kap[kapId];

      if (!kap) {
        return interaction.reply({
          content: "❌ Bu KAP bulunamadı.",
          ephemeral: true,
        });
      }

      if (kap.status !== "pending") {
        return interaction.reply({
          content: "❌ Bu KAP artık aktif değil.",
          ephemeral: true,
        });
      }

      const player = await interaction.guild.members
        .fetch(kap.playerId)
        .catch(() => null);

      if (!player) {
        return interaction.reply({
          content: "❌ Oyuncu bulunamadı.",
          ephemeral: true,
        });
      }

      kap.status = "player_form";

      saveData();

      const formEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📄 United League • Transfer Teklifi")
        .setDescription(
          `Merhaba ${player}!\n\n` +
          `**${data.teams[kap.buyingTeamId]?.name || "Bir takım"}** senin için transfer teklifi gönderdi.\n\n` +
          `Aşağıdaki butonlardan teklif şartlarını kabul veya reddet.`
        )
        .addFields(
          {
            name: "💰 Transfer Ücreti",
            value: formatMoney(kap.amount),
            inline: true,
          },
          {
            name: "💵 Maaş",
            value: formatMoney(kap.salary),
            inline: true,
          }
        )
        .setFooter({
          text: `KAP: ${kapId}`,
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`kapplayer:accept:${kapId}`)
          .setLabel("Teklifi Kabul Et")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`kapplayer:salary:${kapId}`)
          .setLabel("Maaşı Düzenle")
          .setEmoji("💵")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`kapplayer:reject:${kapId}`)
          .setLabel("Reddet")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger)
      );

      try {
        await player.send({
          embeds: [formEmbed],
          components: [row],
        });
      } catch {
        return interaction.reply({
          content:
            "❌ Oyuncuya DM gönderilemedi. Oyuncunun DM'leri kapalı olabilir.",
          ephemeral: true,
        });
      }

      await interaction.update({
        embeds: [
          makeEmbed(
            "📨 KAP Oyuncuya Gönderildi",
            `${player} oyuncusuna transfer formu DM üzerinden gönderildi.`
          ),
        ],
        components: [],
      });

      return;
    }

    // ==================================================
    // KAP İPTAL
    // ==================================================

    if (interaction.customId.startsWith("kap:cancel:")) {
      const kapId = interaction.customId.split(":")[2];

      const kap = data.kap[kapId];

      if (!kap) {
        return interaction.reply({
          content: "❌ KAP bulunamadı.",
          ephemeral: true,
        });
      }

      kap.status = "cancelled";

      saveData();

      return interaction.update({
        embeds: [
          makeEmbed(
            "❌ KAP İptal Edildi",
            `KAP **${kapId}** iptal edildi.`
          ),
        ],
        components: [],
      });
    }

    // ==================================================
    // KAP MAAŞ DÜZENLE
    // ==================================================

    if (
      interaction.customId.startsWith("kapplayer:salary:")
    ) {
      const kapId = interaction.customId.split(":")[2];

      const kap = data.kap[kapId];

      if (!kap) {
        return interaction.reply({
          content: "❌ KAP bulunamadı.",
          ephemeral: true,
        });
      }

      if (interaction.user.id !== kap.playerId) {
        return interaction.reply({
          content: "❌ Bu transfer formu sana ait değil.",
          ephemeral: true,
        });
      }

      await interaction.reply({
        content:
          "💵 Yeni maaşını yaz.\nÖrnek: `500k` veya `1m`\n\nMaaş mesajını yazdıktan sonra bot otomatik olarak işleyecek.",
        ephemeral: true,
      });

      const filter = m =>
        m.author.id === interaction.user.id &&
        m.channel.id === interaction.channelId;

      const collector =
        interaction.channel.createMessageCollector({
          filter,
          max: 1,
          time: 60000,
        });

      collector.on("collect", async msg => {
        const salary = parseMoney(msg.content);

        if (!salary || salary <= 0) {
          await msg.reply("❌ Geçerli maaş yazmadın.");
          return;
        }

        kap.salary = salary;

        const player = getPlayer(kap.playerId);
        player.salary = salary;

        saveData();

        await msg.reply(
          `✅ Maaşın **${formatMoney(salary)}** olarak güncellendi.`
        );
      });

      return;
    }

    // ==================================================
    // KAP KABUL
    // ==================================================

    if (
      interaction.customId.startsWith("kapplayer:accept:")
    ) {
      const kapId = interaction.customId.split(":")[2];

      const kap = data.kap[kapId];

      if (!kap) {
        return interaction.reply({
          content: "❌ KAP bulunamadı.",
          ephemeral: true,
        });
      }

      if (interaction.user.id !== kap.playerId) {
        return interaction.reply({
          content: "❌ Bu transfer sana ait değil.",
          ephemeral: true,
        });
      }

      const buyingTeam = data.teams[kap.buyingTeamId];

      if (!buyingTeam) {
        return interaction.reply({
          content: "❌ Alıcı takım bulunamadı.",
          ephemeral: true,
        });
      }

      if (buyingTeam.budget < kap.amount) {
        return interaction.reply({
          content:
            "❌ Takımın transfer ücretini karşılayacak bütçeye sahip değil.",
          ephemeral: true,
        });
      }

      const playerData = getPlayer(kap.playerId);

      if (playerData.teamId) {
        const oldTeam = data.teams[playerData.teamId];

        if (oldTeam) {
          oldTeam.players = oldTeam.players.filter(
            id => id !== kap.playerId
          );
        }
      }

      buyingTeam.budget -= kap.amount;
      buyingTeam.players.push(kap.playerId);

      playerData.teamId = buyingTeam.id;

      kap.status = "accepted";

      saveData();

      // Takım sahibi oyuncuysa TD'yi etiketle
      if (playerData.roleType === "Teknik Direktör") {
        const tdMember = await interaction.guild.members
          .fetch(buyingTeam.ownerId)
          .catch(() => null);

        if (tdMember) {
          await interaction.channel.send(
            `📢 ${tdMember} **${interaction.user}** transferi kabul etti!`
          );
        }
      }

      await interaction.update({
        embeds: [
          makeEmbed(
            "✅ Transfer Kabul Edildi",
            `${interaction.user} transfer teklifini kabul etti.\n\n` +
            `🏟️ Yeni takım: **${buyingTeam.name}**\n` +
            `💰 Transfer ücreti: **${formatMoney(kap.amount)}**\n` +
            `💵 Maaş: **${formatMoney(kap.salary)}**`
          ),
        ],
        components: [],
      });

      return;
    }

    // ==================================================
    // KAP RED
    // ==================================================

    if (
      interaction.customId.startsWith("kapplayer:reject:")
    ) {
      const kapId = interaction.customId.split(":")[2];

      const kap = data.kap[kapId];

      if (!kap) {
        return interaction.reply({
          content: "❌ KAP bulunamadı.",
          ephemeral: true,
        });
      }

      if (interaction.user.id !== kap.playerId) {
        return interaction.reply({
          content: "❌ Bu transfer sana ait değil.",
          ephemeral: true,
        });
      }

      kap.status = "rejected";

      saveData();

      return interaction.update({
        embeds: [
          makeEmbed(
            "❌ Transfer Reddedildi",
            "Transfer teklifi oyuncu tarafından reddedildi."
          ),
        ],
        components: [],
      });
    }

    // ==================================================
    // ÇEKİLİŞ KATIL
    // ==================================================

    if (
      interaction.customId.startsWith("giveaway:join:")
    ) {
      const giveawayId = interaction.customId.split(":")[2];

      const giveaway = data.giveaways[giveawayId];

      if (!giveaway || giveaway.ended) {
        return interaction.reply({
          content: "❌ Bu çekiliş sona ermiş.",
          ephemeral: true,
        });
      }

      if (Date.now() >= giveaway.endAt) {
        return interaction.reply({
          content: "❌ Bu çekiliş sona ermiş.",
          ephemeral: true,
        });
      }

      if (giveaway.participants.includes(interaction.user.id)) {
        return interaction.reply({
          content: "❌ Zaten çekilişe katıldın.",
          ephemeral: true,
        });
      }

      giveaway.participants.push(interaction.user.id);

      saveData();

      return interaction.reply({
        content: "🎉 Çekilişe başarıyla katıldın!",
        ephemeral: true,
      });
    }

  } catch (err) {
    console.error("Interaction hatası:", err);

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ İşlem sırasında hata oluştu.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ İşlem sırasında hata oluştu.",
          ephemeral: true,
        });
      }
    } catch {}
  }
});

// ======================================================
// HATA YAKALAMA
// ======================================================

process.on("unhandledRejection", error => {
  console.error("UNHANDLED REJECTION:", error);
});

process.on("uncaughtException", error => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

// ======================================================
// BOTU BAŞLAT
// ======================================================

client.login(TOKEN);
