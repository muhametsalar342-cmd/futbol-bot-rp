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

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN bulunamadı! Railway/Rainway Variables kısmına TOKEN ekle.");
  process.exit(1);
}

/* =========================================================
   CLIENT
========================================================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

/* =========================================================
   SABİTLER
========================================================= */

const ROLES = {
  YONETICI: "1544449436011339806",
  KAYIT: "1544452022764568656",
  DEGER: "1544451743746891806"
};

const START_PLAYER_VALUE = 1000000;
const START_TEAM_BUDGET = 50000000;

/* =========================================================
   DATA
========================================================= */

const DATA_FILE = "./data.json";

const defaultData = {
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

let data;

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      data = JSON.parse(JSON.stringify(defaultData));
      save();
      return;
    }

    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    data.players ||= {};
    data.teams ||= {};
    data.fixtures ||= [];
    data.results ||= [];
    data.giveaways ||= {};
    data.tickets ||= {};
    data.museums ||= {};
    data.settings ||= {};
    data.settings.pingRoles ||= {};
  } catch (err) {
    console.error("Data okunamadı:", err);
    data = JSON.parse(JSON.stringify(defaultData));
    save();
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

loadData();

/* =========================================================
   PARA SİSTEMİ
========================================================= */

function parseMoney(input) {
  if (!input) return NaN;

  let value = String(input)
    .toLowerCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, "");

  let multiplier = 1;

  if (value.endsWith("k")) {
    multiplier = 1000;
    value = value.slice(0, -1);
  } else if (value.endsWith("m")) {
    multiplier = 1000000;
    value = value.slice(0, -1);
  } else if (value.endsWith("b")) {
    multiplier = 1000000000;
    value = value.slice(0, -1);
  }

  const number = Number(value);

  if (!Number.isFinite(number)) return NaN;

  return Math.floor(number * multiplier);
}

function formatMoney(amount) {
  amount = Number(amount) || 0;

  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(amount % 1000000000 === 0 ? 0 : 1)}B€`;
  }

  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1)}M€`;
  }

  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K€`;
  }

  return `${amount}€`;
}

/* =========================================================
   YARDIMCI FONKSİYONLAR
========================================================= */

function getPlayer(id) {
  if (!data.players[id]) {
    data.players[id] = {
      value: START_PLAYER_VALUE,
      budget: 0,
      training: 0,
      goals: 0,
      assists: 0,
      penalties: 0,
      team: null
    };
  }

  return data.players[id];
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

function isValueStaff(member) {
  return isAdmin(member) || hasRole(member, ROLES.DEGER);
}

function isRegisterStaff(member) {
  return isAdmin(member) || hasRole(member, ROLES.KAYIT);
}

function getTeamOfUser(userId) {
  return Object.values(data.teams).find(
    team => team.creatorId === userId
  );
}

function findChannelByNames(guild, names) {
  return guild.channels.cache.find(channel =>
    names.includes(channel.name.toLowerCase())
  );
}

function getMentionedMember(message) {
  return message.mentions.members.first();
}

function getMentionedTeamRoles(message) {
  return message.mentions.roles;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanName(name) {
  return name
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .slice(0, 90);
}

function playerNickname(member, player) {
  const current = member.nickname || member.user.username;

  const parts = current.split("|");

  if (parts.length >= 4) {
    parts[parts.length - 1] = ` ${formatMoney(player.value)}`;
    return parts.join("|").trim();
  }

  return `${current} | ${formatMoney(player.value)}`;
}

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {
  console.log("================================");
  console.log(`✅ Bot aktif: ${client.user.tag}`);
  console.log(`🏠 Sunucu sayısı: ${client.guilds.cache.size}`);
  console.log("================================");

  for (const guild of client.guilds.cache.values()) {
    try {
      await ensureRoles(guild);
    } catch (err) {
      console.error(`Rol kontrol hatası: ${guild.name}`, err);
    }
  }

  client.user.setActivity(".yardım | Futbol RP", {
    type: 0
  });
});

/* =========================================================
   ROLLER
========================================================= */

async function ensureRoles(guild) {
  const roleNames = [
    "Futbolcu",
    "Teknik Direktör",
    "Kayıtsız",
    "Muted",
    "⚽ Maç Ping",
    "📢 Duyuru Ping",
    "🎉 Etkinlik Ping",
    "📰 Haber Ping",
    "🔄 Transfer Ping"
  ];

  for (const name of roleNames) {
    if (!guild.roles.cache.find(r => r.name === name)) {
      try {
        await guild.roles.create({
          name,
          reason: "Football RP Bot sistem rolü"
        });
      } catch {}
    }
  }
}

function getRole(guild, name) {
  return guild.roles.cache.find(r => r.name === name);
}

/* =========================================================
   ÜYE GİRİŞİ
========================================================= */

client.on("guildMemberAdd", async member => {
  try {
    const kayitsiz = getRole(member.guild, "Kayıtsız");

    if (kayitsiz) {
      await member.roles.add(kayitsiz).catch(() => {});
    }

    const registrationChannel = findChannelByNames(member.guild, [
      "kayıt",
      "kayit",
      "kayıt-kanalı",
      "kayit-kanali",
      "kayıt-📝",
      "kayit-📝"
    ]);

    if (!registrationChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🎉 Aramıza Hoş Geldin!")
      .setDescription(
        `${member} sunucumuza katıldı!\n\n` +
        `👤 **Oyuncu:** ${member.user.tag}\n` +
        `📝 Kayıt işlemi için Kayıt Yetkilisi ile iletişime geç.\n\n` +
        `<@&${ROLES.KAYIT}>`
      )
      .setTimestamp();

    await registrationChannel.send({
      content: `${member} <@&${ROLES.KAYIT}>`,
      embeds: [embed]
    });
  } catch (err) {
    console.error("GuildMemberAdd:", err);
  }
});

/* =========================================================
   BUTONLAR / MENÜLER
========================================================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  try {
    /* ---------- PING ROLLERİ ---------- */

    if (interaction.isButton() && interaction.customId.startsWith("ping_")) {
      const roleName = interaction.customId.replace("ping_", "");
      const role = getRole(interaction.guild, roleName);

      if (!role) {
        return interaction.reply({
          content: "❌ Rol bulunamadı.",
          ephemeral: true
        });
      }

      if (interaction.member.roles.cache.has(role.id)) {
        await interaction.member.roles.remove(role);

        return interaction.reply({
          content: `❌ **${role.name}** rolü kaldırıldı.`,
          ephemeral: true
        });
      }

      await interaction.member.roles.add(role);

      return interaction.reply({
        content: `✅ **${role.name}** rolü verildi.`,
        ephemeral: true
      });
    }

    /* ---------- TICKET KAPAT ---------- */

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_close"
    ) {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: "❌ Bu işlemi sadece yönetici yapabilir.",
          ephemeral: true
        });
      }

      await interaction.reply("🔒 Ticket kapatılıyor...");

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 1500);

      return;
    }

    /* ---------- KALICI TİK ---------- */

    if (
      interaction.isButton() &&
      interaction.customId === "kalici_tick"
    ) {
      return interaction.reply({
        content: "✅ Kalıcı tik işlemin başarıyla onaylandı.",
        ephemeral: true
      });
    }

    /* ---------- ÇEKİLİŞ ---------- */

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("giveaway_join_")
    ) {
      const id = interaction.customId.replace("giveaway_join_", "");
      const giveaway = data.giveaways[id];

      if (!giveaway || giveaway.ended) {
        return interaction.reply({
          content: "❌ Bu çekiliş sona ermiş.",
          ephemeral: true
        });
      }

      if (!giveaway.entries.includes(interaction.user.id)) {
        giveaway.entries.push(interaction.user.id);
        save();

        return interaction.reply({
          content: "🎉 Çekilişe katıldın!",
          ephemeral: true
        });
      }

      return interaction.reply({
        content: "ℹ️ Zaten çekilişe katılmışsın.",
        ephemeral: true
      });
    }

    /* ---------- TICKET MENÜ ---------- */

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_select"
    ) {
      const type = interaction.values[0];

      const existing = Object.values(data.tickets).find(
        ticket =>
          ticket.guildId === interaction.guild.id &&
          ticket.userId === interaction.user.id
      );

      if (existing) {
        const channel = interaction.guild.channels.cache.get(
          existing.channelId
        );

        if (channel) {
          return interaction.reply({
            content: `❌ Zaten açık ticketın var: ${channel}`,
            ephemeral: true
          });
        }
      }

      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "")
          .slice(0, 90),
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
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
        ]
      });

      data.tickets[channel.id] = {
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        channelId: channel.id,
        type,
        lastActivity: Date.now()
      };

      save();

      const closeButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("🔒 Ticket Kapat")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${interaction.user} <@&${ROLES.YONETICI}>`,
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(`🎫 ${type}`)
            .setDescription(
              "Destek talebin oluşturuldu.\n" +
              "Yetkililer en kısa sürede ilgilenecektir."
            )
            .setTimestamp()
        ],
        components: [closeButton]
      });

      return interaction.reply({
        content: `✅ Ticket oluşturuldu: ${channel}`,
        ephemeral: true
      });
    }
  } catch (err) {
    console.error("Interaction error:", err);

    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({
        content: "❌ İşlem sırasında hata oluştu.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

/* =========================================================
   MESAJ SİSTEMİ
========================================================= */

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.content.startsWith(".")) return;

  const args = message.content.slice(1).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  /* Ticket aktivitesi */
  if (data.tickets[message.channel.id]) {
    data.tickets[message.channel.id].lastActivity = Date.now();
    save();
  }

  /* =====================================================
     PING
  ===================================================== */

  if (command === "ping") {
    return message.reply(
      `🏓 Pong!\nGecikme: **${client.ws.ping}ms**`
    );
  }

  /* =====================================================
     BOT
  ===================================================== */

  if (command === "bot") {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🤖 Bot Bilgileri")
      .addFields(
        {
          name: "Bot",
          value: client.user.tag,
          inline: true
        },
        {
          name: "Sunucular",
          value: `${client.guilds.cache.size}`,
          inline: true
        },
        {
          name: "Ping",
          value: `${client.ws.ping}ms`,
          inline: true
        }
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  /* =====================================================
     YARDIM
  ===================================================== */

  if (command === "yardım" || command === "yardim") {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("⚽ Football RP Bot")
      .setDescription("Kullanılabilir sistemler:")
      .addFields(
        {
          name: "👤 Oyuncu",
          value:
            "`.profil`\n" +
            "`.bütçe`\n" +
            "`.antrenman`\n" +
            "`.ant`\n" +
            "`.pen`\n" +
            "`.penaltı`"
        },
        {
          name: "💰 Ekonomi",
          value:
            "`.dver @oyuncu 5M`\n" +
            "`.bütçeekle @oyuncu 5M`\n" +
            "`.bütçesil @oyuncu 5M`\n" +
            "`.bütçegönder @oyuncu 5M`\n" +
            "`.takımbütçe`\n" +
            "`.takımbütçeekle 10M`\n" +
            "`.takımbütçesil 10M`\n" +
            "`.takımbütçegönder @oyuncu 5M`"
        },
        {
          name: "🏟️ Takım",
          value:
            "`.takımkur Takım Adı`\n" +
            "`.takımlar`\n" +
            "`.takımbilgi`\n" +
            "`.kadro`"
        },
        {
          name: "⚽ Lig",
          value:
            "`.maç @takım1 @takım2`\n" +
            "`.puan`\n" +
            "`.golkral`\n" +
            "`.asistkral`\n" +
            "`.fikstur`\n" +
            "`.macsonuclari`\n" +
            "`.istatistik`"
        },
        {
          name: "🛡️ Moderasyon",
          value:
            "`.sil 10`\n" +
            "`.kick @oyuncu`\n" +
            "`.mute @oyuncu`\n" +
            "`.unmute @oyuncu`\n" +
            "`.kilit`\n" +
            "`.aç`\n" +
            "`.embed mesaj`"
        },
        {
          name: "🎫 Diğer",
          value:
            "`.ticketpanel`\n" +
            "`.rolpanel`\n" +
            "`.çekiliş 5M€ 1h`\n" +
            "`.çekilişbitir ID`\n" +
            "`.şart`\n" +
            "`.müze`"
        },
        {
          name: "📩 DM",
          value:
            "`.dm @oyuncu mesaj`\n" +
            "`.dm all mesaj`"
        }
      )
      .setFooter({
        text: "Football RP Bot"
      });

    return message.reply({ embeds: [embed] });
  }

  /* =====================================================
     PROFİL
  ===================================================== */

  if (command === "profil") {
    const target = message.mentions.members.first() || message.member;
    const player = getPlayer(target.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`👤 ${target.user.username} Profili`)
      .setThumbnail(target.user.displayAvatarURL())
      .addFields(
        {
          name: "💎 Değer",
          value: formatMoney(player.value),
          inline: true
        },
        {
          name: "💳 Bütçe",
          value: formatMoney(player.budget),
          inline: true
        },
        {
          name: "🏟️ Takım",
          value: player.team || "Takımsız",
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

  /* =====================================================
     DEĞER VER
  ===================================================== */

  if (command === "dver") {
    if (!isValueStaff(message.member)) {
      return message.reply("❌ Bu komutu sadece Değer Yetkilisi kullanabilir.");
    }

    const target = getMentionedMember(message);
    const amount = parseMoney(args[0]);

    if (!target || !Number.isFinite(amount) || amount <= 0) {
      return message.reply("❌ Kullanım: `.dver @oyuncu 5M`");
    }

    const player = getPlayer(target.id);

    player.value += amount;

    try {
      await target.setNickname(playerNickname(target, player));
    } catch {}

    save();

    return message.reply(
      `💎 ${target} oyuncusuna **${formatMoney(amount)}** değer eklendi.\n` +
      `Yeni değer: **${formatMoney(player.value)}**`
    );
  }

  /* =====================================================
     ANTRENMAN
  ===================================================== */

  if (command === "antrenman" || command === "ant") {
    const player = getPlayer(message.author.id);

    player.training++;

    if (player.training >= 10) {
      player.training = 0;
      player.value += 3000000;

      try {
        await message.member.setNickname(
          playerNickname(message.member, player)
        );
      } catch {}

      save();

      return message.reply(
        `🏋️ **Antrenman tamamlandı!**\n\n` +
        `📈 İlerleme: **10/10 → 0/10**\n` +
        `💎 Değer artışı: **+3M€**\n` +
        `💰 Yeni değer: **${formatMoney(player.value)}**`
      );
    }

    save();

    return message.reply(
      `🏋️ Antrenman yapıldı!\n📈 İlerleme: **${player.training}/10**`
    );
  }

  /* =====================================================
     PENALTI
  ===================================================== */

  if (
    command === "pen" ||
    command === "penaltı" ||
    command === "penalti"
  ) {
    const player = getPlayer(message.author.id);

    const scored = Math.random() >= 0.45;

    if (!scored) {
      return message.reply(
        "🥅 Penaltı kaçtı! Bir sonraki vuruşta başarılar."
      );
    }

    player.penalties++;
    player.goals++;
    player.value += 2000000;

    try {
      await message.member.setNickname(
        playerNickname(message.member, player)
      );
    } catch {}

    save();

    return message.reply(
      `⚽ **PENALTI GOL!**\n\n` +
      `🥅 Penaltı: **+1**\n` +
      `⚽ Gol: **+1**\n` +
      `💎 Değer: **+2M€**\n` +
      `💰 Yeni değer: **${formatMoney(player.value)}**`
    );
  }

  /* =====================================================
     KAYIT
  ===================================================== */

  if (command === "k" || command === "kayıt" || command === "kayit") {
    if (!isRegisterStaff(message.member)) {
      return message.reply("❌ Bu komutu sadece Kayıt Yetkilisi kullanabilir.");
    }

    const target = getMentionedMember(message);
    const name = args.slice(0).filter(x => !x.startsWith("<@")).join(" ");

    if (!target || !name) {
      return message.reply("❌ Kullanım: `.k @oyuncu İsim`");
    }

    const player = getPlayer(target.id);

    const futbolcu = getRole(message.guild, "Futbolcu");
    const kayitsiz = getRole(message.guild, "Kayıtsız");

    if (futbolcu) {
      await target.roles.add(futbolcu).catch(() => {});
    }

    if (kayitsiz) {
      await target.roles.remove(kayitsiz).catch(() => {});
    }

    try {
      await target.setNickname(
        `${cleanName(name)} | ${formatMoney(player.value)}`
      );
    } catch {}

    save();

    return message.reply(
      `✅ ${target} başarıyla kayıt edildi!\n` +
      `👤 İsim: **${cleanName(name)}**\n` +
      `💎 Değer: **${formatMoney(player.value)}**`
    );
  }

  /* =====================================================
     TEKNİK DİREKTÖR
  ===================================================== */

  if (command === "td") {
    if (!isRegisterStaff(message.member)) {
      return message.reply("❌ Bu komutu sadece Kayıt Yetkilisi kullanabilir.");
    }

    const target = getMentionedMember(message);

    if (!target) {
      return message.reply("❌ Kullanım: `.td @oyuncu`");
    }

    const tdRole = getRole(message.guild, "Teknik Direktör");

    if (!tdRole) {
      return message.reply("❌ Teknik Direktör rolü bulunamadı.");
    }

    await target.roles.add(tdRole).catch(() => {});

    return message.reply(
      `🎩 ${target} artık **Teknik Direktör**!`
    );
  }

  /* =====================================================
     TAKIM KUR
  ===================================================== */

  if (command === "takımkur" || command === "takimkur") {
    if (getTeamOfUser(message.author.id)) {
      return message.reply("❌ Zaten bir takımın var.");
    }

    const teamName = cleanName(args.join(" "));

    if (!teamName) {
      return message.reply("❌ Kullanım: `.takımkur Takım Adı`");
    }

    const existing = Object.values(data.teams).find(
      team => team.name.toLowerCase() === teamName.toLowerCase()
    );

    if (existing) {
      return message.reply("❌ Bu isimde bir takım zaten var.");
    }

    const role = await message.guild.roles.create({
      name: teamName,
      reason: "Football RP takım oluşturma"
    });

    data.teams[role.id] = {
      name: teamName,
      roleId: role.id,
      creatorId: message.author.id,
      budget: START_TEAM_BUDGET,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      trophies: []
    };

    const tdRole = getRole(message.guild, "Teknik Direktör");

    await message.member.roles.add(role).catch(() => {});

    if (tdRole) {
      await message.member.roles.add(tdRole).catch(() => {});
    }

    save();

    return message.reply(
      `🏟️ **Takım oluşturuldu!**\n\n` +
      `🏆 Takım: **${teamName}**\n` +
      `💰 Başlangıç bütçesi: **${formatMoney(START_TEAM_BUDGET)}**\n` +
      `👔 Teknik Direktör: ${message.member}\n` +
      `🏷️ Takım rolü: ${role}`
    );
  }

  /* =====================================================
     TAKIMLAR
  ===================================================== */

  if (command === "takımlar" || command === "takimlar") {
    const teams = Object.values(data.teams);

    if (!teams.length) {
      return message.reply("❌ Henüz takım bulunmuyor.");
    }

    const text = teams
      .map(
        (team, i) =>
          `**${i + 1}. ${team.name}** — ${formatMoney(team.budget)}`
      )
      .join("\n");

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("🏟️ Takımlar")
          .setDescription(text)
      ]
    });
  }

  /* =====================================================
     TAKIM BİLGİ
  ===================================================== */

  if (command === "takımbilgi" || command === "takimbilgi") {
    const team = getTeamOfUser(message.author.id);

    if (!team) {
      return message.reply("❌ Bir takımın bulunmuyor.");
    }

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`🏟️ ${team.name}`)
          .addFields(
            {
              name: "💰 Bütçe",
              value: formatMoney(team.budget),
              inline: true
            },
            {
              name: "🏆 Puan",
              value: `${team.points}`,
              inline: true
            },
            {
              name: "📊 Galibiyet",
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
              name: "⚽ Goller",
              value: `${team.goalsFor}`,
              inline: true
            }
          )
      ]
    });
  }

  /* =====================================================
     KADRO
  ===================================================== */

  if (command === "kadro") {
    const team = getTeamOfUser(message.author.id);

    if (!team) {
      return message.reply("❌ Bir takımın bulunmuyor.");
    }

    const members = message.guild.members.cache.filter(member => {
      const player = data.players[member.id];
      return player && player.team === team.name;
    });

    const list = members.size
      ? members.map(member => `👤 ${member}`).join("\n")
      : "Henüz kayıtlı oyuncu yok.";

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`📋 ${team.name} Kadrosu`)
          .setDescription(list)
      ]
    });
  }

  /* =====================================================
     TRANSFER
  ===================================================== */

  if (command === "transfer") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = getMentionedMember(message);
    const teamName = args.slice(0).filter(x => !x.startsWith("<@")).join(" ");

    if (!target || !teamName) {
      return message.reply("❌ Kullanım: `.transfer @oyuncu Takım`");
    }

    const team = Object.values(data.teams).find(
      t => t.name.toLowerCase() === teamName.toLowerCase()
    );

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    const player = getPlayer(target.id);

    player.team = team.name;

    save();

    return message.reply(
      `🔄 ${target} → **${team.name}** takımına transfer edildi.`
    );
  }

  /* =====================================================
     KİŞİSEL BÜTÇE
  ===================================================== */

  if (command === "bütçe" || command === "butce") {
    const player = getPlayer(message.author.id);

    return message.reply(
      `💳 ${message.author} kişisel bütçen: **${formatMoney(player.budget)}**`
    );
  }

  /* =====================================================
     BÜTÇE EKLE
  ===================================================== */

  if (command === "bütçeekle" || command === "butceekle") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = getMentionedMember(message);
    const amount = parseMoney(args[0]);

    if (!target || !Number.isFinite(amount) || amount <= 0) {
      return message.reply(
        "❌ Kullanım: `.bütçeekle @oyuncu 5M`"
      );
    }

    const player = getPlayer(target.id);

    player.budget += amount;

    save();

    return message.reply(
      `💰 ${target} oyuncusuna **${formatMoney(amount)}** eklendi.\n` +
      `Yeni bütçe: **${formatMoney(player.budget)}**`
    );
  }

  /* =====================================================
     BÜTÇE SİL
  ===================================================== */

  if (command === "bütçesil" || command === "butcesil") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = getMentionedMember(message);
    const amount = parseMoney(args[0]);

    if (!target || !Number.isFinite(amount) || amount <= 0) {
      return message.reply(
        "❌ Kullanım: `.bütçesil @oyuncu 5M`"
      );
    }

    const player = getPlayer(target.id);

    if (player.budget < amount) {
      return message.reply("❌ Oyuncunun bütçesi yetersiz.");
    }

    player.budget -= amount;

    save();

    return message.reply(
      `💸 ${target} oyuncusunun bütçesinden **${formatMoney(amount)}** silindi.\n` +
      `Yeni bütçe: **${formatMoney(player.budget)}**`
    );
  }

  /* =====================================================
     BÜTÇE GÖNDER
  ===================================================== */

  if (
    command === "bütçegönder" ||
    command === "butcegonder"
  ) {
    const target = getMentionedMember(message);

    if (!target) {
      return message.reply(
        "❌ Kullanım: `.bütçegönder @oyuncu 5M`"
      );
    }

    if (target.id === message.author.id) {
      return message.reply("❌ Kendine para gönderemezsin.");
    }

    const amount = parseMoney(args[0]);

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply("❌ Geçerli bir miktar gir.");
    }

    const sender = getPlayer(message.author.id);

    if (sender.budget < amount) {
      return message.reply(
        `❌ Yetersiz bütçe. Mevcut: **${formatMoney(sender.budget)}**`
      );
    }

    const receiver = getPlayer(target.id);

    sender.budget -= amount;
    receiver.budget += amount;

    save();

    return message.reply(
      `💸 ${message.author} → ${target}\n\n` +
      `Gönderilen: **${formatMoney(amount)}**\n` +
      `Senin kalan bütçen: **${formatMoney(sender.budget)}**\n` +
      `Oyuncunun yeni bütçesi: **${formatMoney(receiver.budget)}**`
    );
  }

  /* =====================================================
     TAKIM BÜTÇE
  ===================================================== */

  if (
    command === "takımbütçe" ||
    command === "takimbutce"
  ) {
    const team = getTeamOfUser(message.author.id);

    if (!team) {
      return message.reply("❌ Takım sahibi / Teknik Direktör değilsin.");
    }

    return message.reply(
      `🏟️ **${team.name}** takım bütçesi: **${formatMoney(team.budget)}**`
    );
  }

  /* =====================================================
     TAKIM BÜTÇE EKLE
  ===================================================== */

  if (
    command === "takımbütçeekle" ||
    command === "takimbutceekle"
  ) {
    const team = getTeamOfUser(message.author.id);

    if (!team) {
      return message.reply(
        "❌ Bu komutu sadece takım sahibi / Teknik Direktör kullanabilir."
      );
    }

    const amount = parseMoney(args[0]);

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply(
        "❌ Kullanım: `.takımbütçeekle 10M`"
      );
    }

    team.budget += amount;

    save();

    return message.reply(
      `🏟️ **${team.name}** bütçesine **${formatMoney(amount)}** eklendi.\n` +
      `Yeni bütçe: **${formatMoney(team.budget)}**`
    );
  }

  /* =====================================================
     TAKIM BÜTÇE SİL
  ===================================================== */

  if (
    command === "takımbütçesil" ||
    command === "takimbutcesil"
  ) {
    const team = getTeamOfUser(message.author.id);

    if (!team) {
      return message.reply(
        "❌ Bu komutu sadece takım sahibi / Teknik Direktör kullanabilir."
      );
    }

    const amount = parseMoney(args[0]);

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply(
        "❌ Kullanım: `.takımbütçesil 10M`"
      );
    }

    if (team.budget < amount) {
      return message.reply("❌ Takım bütçesi yetersiz.");
    }

    team.budget -= amount;

    save();

    return message.reply(
      `💸 Takım bütçesinden **${formatMoney(amount)}** silindi.\n` +
      `Kalan: **${formatMoney(team.budget)}**`
    );
  }

  /* =====================================================
     TAKIM BÜTÇESİNDEN OYUNCUYA GÖNDER
  ===================================================== */

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

    const target = getMentionedMember(message);
    const amount = parseMoney(args[0]);

    if (!target) {
      return message.reply(
        "❌ Kullanım: `.takımbütçegönder @oyuncu 5M`"
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply("❌ Geçerli bir miktar gir.");
    }

    if (team.budget < amount) {
      return message.reply(
        `❌ Takım bütçesi yetersiz.\n` +
        `Mevcut: **${formatMoney(team.budget)}**`
      );
    }

    const player = getPlayer(target.id);

    team.budget -= amount;
    player.budget += amount;

    save();

    return message.reply(
      `💸 **Takım bütçesinden oyuncuya ödeme yapıldı!**\n\n` +
      `🏟️ Takım: **${team.name}**\n` +
      `👤 Oyuncu: ${target}\n` +
      `💰 Gönderilen: **${formatMoney(amount)}**\n\n` +
      `🏟️ Kalan takım bütçesi: **${formatMoney(team.budget)}**\n` +
      `💳 Oyuncunun yeni bütçesi: **${formatMoney(player.budget)}**`
    );
  }

  /* =====================================================
     MAÇ
  ===================================================== */

  if (command === "maç" || command === "mac") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Maç Yetkilisi / Yönetici kullanabilir.");
    }

    const roles = [...message.mentions.roles.values()];

    if (roles.length < 2) {
      return message.reply(
        "❌ Kullanım: `.maç @Takım1 @Takım2`"
      );
    }

    const team1 = data.teams[roles[0].id];
    const team2 = data.teams[roles[1].id];

    if (!team1 || !team2) {
      return message.reply("❌ Etiketlenen roller kayıtlı takım değil.");
    }

    await message.channel.send(
      `🏟️ **MAÇ BAŞLADI!**\n\n` +
      `⚽ **${team1.name}** 🆚 **${team2.name}**`
    );

    const events = [
      "⚽ Tehlikeli atak!",
      "🔥 Mücadele iyice hızlandı!",
      "🧤 Kaleci müthiş kurtarış yaptı!",
      "🎯 Şut! Top az farkla auta çıktı.",
      "🟨 Hakem sarı kartını çıkardı.",
      "⚡ Hızlı kontra atak!"
    ];

    for (const event of events) {
      await wait(1000);
      await message.channel.send(event);
    }

    const score1 = Math.floor(Math.random() * 6);
    const score2 = Math.floor(Math.random() * 6);

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

    const result = {
      team1: team1.name,
      team2: team2.name,
      score1,
      score2,
      date: Date.now()
    };

    data.results.push(result);
    save();

    return message.channel.send(
      `🏁 **MAÇ SONA ERDİ!**\n\n` +
      `🏟️ **${team1.name} ${score1} - ${score2} ${team2.name}**`
    );
  }

  /* =====================================================
     PUAN DURUMU
  ===================================================== */

  if (command === "puan") {
    const teams = Object.values(data.teams)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return (b.goalsFor - b.goalsAgainst) -
          (a.goalsFor - a.goalsAgainst);
      });

    if (!teams.length) {
      return message.reply("❌ Henüz takım yok.");
    }

    const text = teams
      .map(
        (team, i) =>
          `**${i + 1}. ${team.name}** — ${team.points} P | ${team.wins}G ${team.draws}B ${team.losses}M`
      )
      .join("\n");

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle("🏆 Puan Durumu")
          .setDescription(text)
      ]
    });
  }

  /* =====================================================
     GOL KRALLIĞI
  ===================================================== */

  if (command === "golkral") {
    const players = Object.entries(data.players)
      .sort((a, b) => b[1].goals - a[1].goals)
      .slice(0, 10);

    if (!players.length) {
      return message.reply("❌ Henüz istatistik yok.");
    }

    const text = players
      .map((entry, i) => {
        const member = message.guild.members.cache.get(entry[0]);
        return `**${i + 1}.** ${member || `<@${entry[0]}>`} — ⚽ ${entry[1].goals}`;
      })
      .join("\n");

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle("⚽ Gol Krallığı")
          .setDescription(text)
      ]
    });
  }

  /* =====================================================
     ASİST KRALLIĞI
  ===================================================== */

  if (command === "asistkral") {
    const players = Object.entries(data.players)
      .sort((a, b) => b[1].assists - a[1].assists)
      .slice(0, 10);

    if (!players.length) {
      return message.reply("❌ Henüz istatistik yok.");
    }

    const text = players
      .map((entry, i) => {
        const member = message.guild.members.cache.get(entry[0]);
        return `**${i + 1}.** ${member || `<@${entry[0]}>`} — 🎯 ${entry[1].assists}`;
      })
      .join("\n");

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("🎯 Asist Krallığı")
          .setDescription(text)
      ]
    });
  }

  /* =====================================================
     FİKSTÜR
  ===================================================== */

  if (command === "fikstur") {
    if (!data.fixtures.length) {
      return message.reply("📅 Henüz fikstür bulunmuyor.");
    }

    const text = data.fixtures
      .map(
        (fixture, i) =>
          `**${i + 1}.** ${fixture.team1} 🆚 ${fixture.team2}`
      )
      .join("\n");

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle("📅 Fikstür")
          .setDescription(text)
      ]
    });
  }

  /* =====================================================
     MAÇ SONUÇLARI
  ===================================================== */

  if (
    command === "macsonuclari" ||
    command === "maçsonuçları"
  ) {
    if (!data.results.length) {
      return message.reply("❌ Henüz maç sonucu yok.");
    }

    const results = data.results.slice(-15).reverse();

    const text = results
      .map(
        (r, i) =>
          `**${i + 1}.** ${r.team1} **${r.score1}-${r.score2}** ${r.team2}`
      )
      .join("\n");

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x1abc9c)
          .setTitle("📊 Maç Sonuçları")
          .setDescription(text)
      ]
    });
  }

  /* =====================================================
     İSTATİSTİK
  ===================================================== */

  if (command === "istatistik") {
    const teams = Object.values(data.teams);

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("📊 Lig İstatistikleri")
          .addFields(
            {
              name: "🏟️ Takım",
              value: `${teams.length}`,
              inline: true
            },
            {
              name: "⚽ Toplam Maç",
              value: `${data.results.length}`,
              inline: true
            },
            {
              name: "👤 Kayıtlı Oyuncu",
              value: `${Object.keys(data.players).length}`,
              inline: true
            }
          )
      ]
    });
  }

  /* =====================================================
     ÇEKİLİŞ
  ===================================================== */

  if (command === "çekiliş" || command === "cekilis") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Çekiliş Yetkilisi / Yönetici kullanabilir.");
    }

    const prize = args[0];
    const durationText = args[1];

    const amount = parseMoney(prize);

    if (!Number.isFinite(amount) || !durationText) {
      return message.reply(
        "❌ Kullanım: `.çekiliş 5M€ 5h`"
      );
    }

    const match = durationText.match(/^(\d+)(s|m|h|d)$/i);

    if (!match) {
      return message.reply(
        "❌ Süre örneği: `30s`, `5m`, `2h`, `1d`"
      );
    }

    const number = Number(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000
    };

    const duration = number * multipliers[unit];

    const id = `${Date.now()}`;

    data.giveaways[id] = {
      guildId: message.guild.id,
      channelId: message.channel.id,
      prize: amount,
      entries: [],
      ended: false,
      endAt: Date.now() + duration
    };

    save();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_join_${id}`)
        .setLabel("🎉 Katıl")
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle("🎉 ÇEKİLİŞ BAŞLADI!")
          .setDescription(
            `💰 Ödül: **${formatMoney(amount)}**\n\n` +
            `Katılmak için aşağıdaki butona bas.\n` +
            `⏰ Bitiş: <t:${Math.floor((Date.now() + duration) / 1000)}:R>`
          )
          .setTimestamp()
      ],
      components: [button]
    });

    setTimeout(() => endGiveaway(id), duration);

    return;
  }

  /* =====================================================
     ÇEKİLİŞ BİTİR
  ===================================================== */

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

  /* =====================================================
     ROL PANEL
  ===================================================== */

  if (command === "rolpanel") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const roles = [
      "⚽ Maç Ping",
      "📢 Duyuru Ping",
      "🎉 Etkinlik Ping",
      "📰 Haber Ping",
      "🔄 Transfer Ping"
    ];

    const row = new ActionRowBuilder();

    for (const roleName of roles) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ping_${roleName}`)
          .setLabel(roleName)
          .setStyle(ButtonStyle.Secondary)
      );
    }

    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🔔 Ping Rol Paneli")
          .setDescription(
            "İstediğin bildirim rolünü almak veya bırakmak için butona bas."
          )
      ],
      components: [row]
    });
  }

  /* =====================================================
     TICKET PANEL
  ===================================================== */

  if (command === "ticketpanel") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("🎫 Destek türünü seç")
      .addOptions(
        {
          label: "Genel Destek",
          value: "Genel Destek",
          emoji: "💬"
        },
        {
          label: "Teknik Destek",
          value: "Teknik Destek",
          emoji: "🔧"
        },
        {
          label: "Yönetim Desteği",
          value: "Yönetim Desteği",
          emoji: "👑"
        }
      );

    const row = new ActionRowBuilder().addComponents(menu);

    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("🎫 Destek Merkezi")
          .setDescription(
            "Destek almak için aşağıdaki menüden uygun kategoriyi seç."
          )
      ],
      components: [row]
    });
  }

  /* =====================================================
     ŞART
  ===================================================== */

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

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle("📜 Sunucu Şartları")
          .setDescription(
            `🎭 **Rol Alma Şartı:**\n` +
            `${rolAl || "#rol-al"} kanalından en az **3 rol** almalısın.\n\n` +
            `✅ **Kalıcı Tik Şartı:**\n` +
            `${kaliciTik || "#kalıcı-tik"} kanalındaki tik butonuna basmalısın.`
          )
      ]
    });
  }

  /* =====================================================
     KALICI TİK PANELİ
  ===================================================== */

  if (command === "kalıcıtik" || command === "kalicitik") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("kalici_tick")
        .setLabel("✅ Kalıcı Tik")
        .setStyle(ButtonStyle.Success)
    );

    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("✅ Kalıcı Tik")
          .setDescription(
            "Kalıcı tik şartını tamamlamak için butona bas."
          )
      ],
      components: [row]
    });
  }

  /* =====================================================
     MÜZE
  ===================================================== */

  if (command === "müze" || command === "muze") {
    const teams = Object.values(data.teams);

    const text = teams
      .filter(team => team.trophies?.length)
      .map(team =>
        `🏆 **${team.name}**\n` +
        team.trophies.map(t => `• ${t}`).join("\n")
      )
      .join("\n\n");

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle("🏆 Kupa Müzesi")
          .setDescription(text || "Henüz kupa bulunmuyor.")
      ]
    });
  }

  /* =====================================================
     KUPA EKLE
  ===================================================== */

  if (command === "kupaekle") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const roles = [...message.mentions.roles.values()];
    const cupName = args
      .filter(x => !x.startsWith("<@&"))
      .join(" ");

    if (!roles.length || !cupName) {
      return message.reply(
        "❌ Kullanım: `.kupaekle @Takım Kupa Adı`"
      );
    }

    const team = data.teams[roles[0].id];

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    team.trophies ||= [];
    team.trophies.push(cupName);

    save();

    return message.reply(
      `🏆 **${cupName}** → ${team.name} müzesine eklendi.`
    );
  }

  /* =====================================================
     KUPA SİL
  ===================================================== */

  if (command === "kupasil") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const roles = [...message.mentions.roles.values()];
    const cupName = args
      .filter(x => !x.startsWith("<@&"))
      .join(" ");

    if (!roles.length || !cupName) {
      return message.reply(
        "❌ Kullanım: `.kupasil @Takım Kupa Adı`"
      );
    }

    const team = data.teams[roles[0].id];

    if (!team) {
      return message.reply("❌ Takım bulunamadı.");
    }

    team.trophies ||= [];

    const index = team.trophies.indexOf(cupName);

    if (index === -1) {
      return message.reply("❌ Bu kupa bulunamadı.");
    }

    team.trophies.splice(index, 1);

    save();

    return message.reply(
      `🗑️ **${cupName}** müzeden kaldırıldı.`
    );
  }

  /* =====================================================
     SİL
  ===================================================== */

  if (command === "sil") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const amount = Number(args[0]);

    if (!Number.isInteger(amount) || amount < 1 || amount > 1000) {
      return message.reply(
        "❌ Miktar **1 ile 1000** arasında olmalı."
      );
    }

    const deleted = await message.channel.bulkDelete(
      amount,
      true
    ).catch(() => null);

    if (!deleted) {
      return message.reply("❌ Mesajlar silinemedi.");
    }

    const info = await message.channel.send(
      `🗑️ **${deleted.size}** mesaj silindi.`
    );

    setTimeout(() => info.delete().catch(() => {}), 3000);

    return;
  }

  /* =====================================================
     KICK
  ===================================================== */

  if (command === "kick") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = getMentionedMember(message);

    if (!target) {
      return message.reply("❌ Kullanım: `.kick @oyuncu`");
    }

    if (!target.kickable) {
      return message.reply("❌ Bu üyeyi kickleyemiyorum.");
    }

    await target.kick("Football RP Bot kick");

    return message.reply(
      `👢 ${target.user.tag} sunucudan atıldı.`
    );
  }

  /* =====================================================
     MUTE
  ===================================================== */

  if (command === "mute") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = getMentionedMember(message);

    if (!target) {
      return message.reply("❌ Kullanım: `.mute @oyuncu`");
    }

    let muted = getRole(message.guild, "Muted");

    if (!muted) {
      muted = await message.guild.roles.create({
        name: "Muted",
        reason: "Football RP Bot mute sistemi"
      });
    }

    await target.roles.add(muted).catch(() => {});

    return message.reply(
      `🔇 ${target} susturuldu.`
    );
  }

  /* =====================================================
     UNMUTE
  ===================================================== */

  if (command === "unmute") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const target = getMentionedMember(message);

    if (!target) {
      return message.reply("❌ Kullanım: `.unmute @oyuncu`");
    }

    const muted = getRole(message.guild, "Muted");

    if (muted) {
      await target.roles.remove(muted).catch(() => {});
    }

    return message.reply(
      `🔊 ${target} susturmasının kaldırıldı.`
    );
  }

  /* =====================================================
     KANAL KİLİT
  ===================================================== */

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

  /* =====================================================
     KANAL AÇ
  ===================================================== */

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

  /* =====================================================
     EMBED
  ===================================================== */

  if (command === "embed") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece Yönetici kullanabilir.");
    }

    const text = args.join(" ");

    if (!text) {
      return message.reply("❌ Kullanım: `.embed mesaj`");
    }

    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setDescription(text)
          .setTimestamp()
      ]
    });
  }

  /* =====================================================
     DM - TEK OYUNCU
  ===================================================== */

  if (command === "dm") {
    if (!isAdmin(message.member)) {
      return message.reply(
        "❌ Bu komutu sadece Yönetici kullanabilir."
      );
    }

    if (!args.length) {
      return message.reply(
        "❌ Kullanım:\n" +
        "`.dm @oyuncu mesaj`\n" +
        "`.dm all mesaj`"
      );
    }

    /* ---------- ALL ---------- */

    if (args[0].toLowerCase() === "all") {
      const text = args.slice(1).join(" ");

      if (!text) {
        return message.reply(
          "❌ Kullanım: `.dm all mesaj`"
        );
      }

      /*
       * Güvenlik / rate-limit:
       * Bot herkese aynı anda yüzlerce DM atmaz.
       * Discord rate limitlerine takılmamak için
       * üyeler arasında kısa bekleme kullanılır.
       */

      const members = await message.guild.members.fetch();

      const targets = members.filter(member =>
        !member.user.bot &&
        member.id !== message.author.id
      );

      if (!targets.size) {
        return message.reply(
          "❌ DM gönderilecek uygun üye bulunamadı."
        );
      }

      await message.reply(
        `📩 Toplu DM gönderimi başlatıldı.\n` +
        `👥 Hedef: **${targets.size}** üye`
      );

      let success = 0;
      let failed = 0;

      for (const member of targets.values()) {
        try {
          await member.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle(`📢 ${message.guild.name}`)
                .setDescription(text)
                .setFooter({
                  text: "Sunucu Bildirimi"
                })
                .setTimestamp()
            ]
          });

          success++;
        } catch {
          failed++;
        }

        /*
         * Discord rate limitlerine karşı
         * kontrollü gönderim.
         */
        await wait(1200);
      }

      return message.channel.send(
        `📨 **DM gönderimi tamamlandı!**\n\n` +
        `✅ Başarılı: **${success}**\n` +
        `❌ Başarısız: **${failed}**`
      );
    }

    /* ---------- TEK OYUNCU ---------- */

    const target = getMentionedMember(message);

    if (!target) {
      return message.reply(
        "❌ Kullanım: `.dm @oyuncu mesaj`"
      );
    }

    const text = args
      .slice(0)
      .filter(x => !x.startsWith("<@"))
      .join(" ");

    if (!text) {
      return message.reply(
        "❌ Gönderilecek mesajı yaz."
      );
    }

    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📢 ${message.guild.name}`)
            .setDescription(text)
            .setFooter({
              text: "Sunucu Bildirimi"
            })
            .setTimestamp()
        ]
      });

      return message.reply(
        `✅ ${target} kullanıcısına DM gönderildi.`
      );
    } catch {
      return message.reply(
        "❌ Bu kullanıcının DM'leri kapalı olabilir veya bot DM gönderemiyor."
      );
    }
  }
});

/* =========================================================
   ÇEKİLİŞ BİTİRME
========================================================= */

async function endGiveaway(id) {
  const giveaway = data.giveaways[id];

  if (!giveaway || giveaway.ended) return;

  giveaway.ended = true;

  save();

  const guild = client.guilds.cache.get(giveaway.guildId);

  if (!guild) return;

  const channel = guild.channels.cache.get(giveaway.channelId);

  if (!channel) return;

  if (!giveaway.entries.length) {
    return channel.send(
      `🎉 **Çekiliş sona erdi!**\n` +
      `💰 Ödül: **${formatMoney(giveaway.prize)}**\n` +
      `❌ Katılımcı olmadığı için kazanan çıkmadı.`
    );
  }

  const winnerId =
    giveaway.entries[
      Math.floor(Math.random() * giveaway.entries.length)
    ];

  const winner = guild.members.cache.get(winnerId);

  return channel.send(
    `🎉 **ÇEKİLİŞ SONA ERDİ!**\n\n` +
    `💰 Ödül: **${formatMoney(giveaway.prize)}**\n` +
    `🏆 Kazanan: ${winner || `<@${winnerId}>`}`
  );
}

/* =========================================================
   TICKET OTOMATİK KAPATMA
========================================================= */

setInterval(() => {
  const now = Date.now();

  for (const [channelId, ticket] of Object.entries(data.tickets)) {
    if (now - ticket.lastActivity >= 60 * 60 * 1000) {
      const guild = client.guilds.cache.get(ticket.guildId);

      if (!guild) continue;

      const channel = guild.channels.cache.get(channelId);

      if (channel) {
        channel.delete().catch(() => {});
      }

      delete data.tickets[channelId];
    }
  }

  save();
}, 60 * 1000);

/* =========================================================
   HATALAR
========================================================= */

process.on("unhandledRejection", error => {
  console.error("Unhandled Rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("Uncaught Exception:", error);
});

/* =========================================================
   LOGIN
========================================================= */

client.login(TOKEN);
