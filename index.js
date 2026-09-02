const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  OverwriteType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

/* =========================================================
   UNITED LEAGUE - FUTBOL RP BOT
   Discord.js v14
========================================================= */

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("TOKEN değişkeni bulunamadı.");
  process.exit(1);
}

const PREFIX = ".";

const ROLE_IDS = {
  admin: "1544449436011339806",
  kayit: "1544452022764568656",
  deger: "1544451743746891806"
};

const ANNOUNCEMENT_CHANNEL_ID = "1544653653330108477";

const DATA_FILE = path.join(__dirname, "data.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

/* =========================================================
   DATA
========================================================= */

const defaultData = {
  players: {},
  teams: {},
  transfers: [],
  kap: {},
  matches: [],
  giveaways: {},
  companies: {},
  sponsors: {},
  ads: {},
  registrations: {},
  setup: {},
  season: {
    number: 1,
    startedAt: Date.now()
  }
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
      return structuredClone(defaultData);
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);

    return {
      ...structuredClone(defaultData),
      ...parsed
    };
  } catch (err) {
    console.error("data.json okunamadı:", err);
    return structuredClone(defaultData);
  }
}

let db = loadData();

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Veri kaydedilemedi:", err);
  }
}

/* =========================================================
   HELPERS
========================================================= */

function cleanName(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function parseMoney(input) {
  if (!input) return null;

  let value = String(input)
    .toLowerCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");

  let multiplier = 1;

  if (value.endsWith("m")) {
    multiplier = 1_000_000;
    value = value.slice(0, -1);
  } else if (value.endsWith("k")) {
    multiplier = 1_000;
    value = value.slice(0, -1);
  } else if (value.endsWith("b")) {
    multiplier = 1_000_000_000;
    value = value.slice(0, -1);
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) return null;

  return Math.floor(number * multiplier);
}

function money(value) {
  value = Number(value || 0);

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2).replace(/\.00$/, "")}B€`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2).replace(/\.00$/, "")}M€`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2).replace(/\.00$/, "")}K€`;
  }

  return `${value}€`;
}

function mentionId(text) {
  if (!text) return null;

  const match = String(text).match(/^<@!?(\d+)>$/);
  return match ? match[1] : null;
}

function getPlayer(id) {
  if (!db.players[id]) {
    db.players[id] = {
      value: 0,
      budget: 0,
      training: 0,
      xp: 0,
      level: 1,
      matches: 0,
      goals: 0,
      assists: 0,
      penaltyGoals: 0,
      teamId: null,
      achievements: [],
      registered: false,
      type: "Futbolcu",
      name: null
    };
  }

  return db.players[id];
}

function addXP(id, amount) {
  const p = getPlayer(id);

  p.xp += amount;

  while (p.xp >= p.level * 100) {
    p.xp -= p.level * 100;
    p.level++;
  }

  saveData();
}

function achievement(id, name) {
  const p = getPlayer(id);

  if (!p.achievements.includes(name)) {
    p.achievements.push(name);
    return true;
  }

  return false;
}

function isAdmin(member) {
  return Boolean(
    member &&
    (
      member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      member.roles.cache.has(ROLE_IDS.admin)
    )
  );
}

function hasRole(member, roleId) {
  return Boolean(member?.roles?.cache?.has(roleId));
}

function isValueStaff(member) {
  return isAdmin(member) || hasRole(member, ROLE_IDS.deger);
}

function isRegistrationStaff(member) {
  return isAdmin(member) || hasRole(member, ROLE_IDS.kayit);
}

function getMentionedMember(message) {
  return message.mentions.members.first() || null;
}

async function sendLog(guild, text) {
  const names = [
    "bot-log",
    "bot-logs",
    "logs",
    "log",
    "bot-kayıt-log"
  ];

  const channel = guild.channels.cache.find(
    c => c.isTextBased() && names.includes(c.name)
  );

  if (!channel) return;

  await channel.send({
    content: text
  }).catch(() => {});
}

async function findChannel(guild, names) {
  return guild.channels.cache.find(
    c => c.type === ChannelType.GuildText &&
      names.includes(c.name)
  );
}

/* =========================================================
   ROLES
========================================================= */

async function getOrCreateRole(guild, name, options = {}) {
  let role = guild.roles.cache.find(r => r.name === name);

  if (role) return role;

  role = await guild.roles.create({
    name,
    color: options.color || "Default",
    hoist: options.hoist ?? true,
    mentionable: options.mentionable ?? false,
    reason: "United League kurulumu"
  });

  return role;
}

async function setupRoles(guild) {
  const roles = {};

  roles.kayitsiz = await getOrCreateRole(guild, "Kayıtsız", {
    color: "Grey",
    hoist: true
  });

  roles.futbolcu = await getOrCreateRole(guild, "Futbolcu", {
    color: "Green",
    hoist: true
  });

  roles.td = await getOrCreateRole(guild, "Teknik Direktör", {
    color: "Blue",
    hoist: true
  });

  roles.muted = await getOrCreateRole(guild, "Muted", {
    color: "DarkGrey",
    hoist: true
  });

  roles.kayit = guild.roles.cache.get(ROLE_IDS.kayit) ||
    await getOrCreateRole(guild, "Kayıt Yetkilisi", {
      color: "Yellow",
      hoist: true
    });

  roles.deger = guild.roles.cache.get(ROLE_IDS.deger) ||
    await getOrCreateRole(guild, "Değer Yetkilisi", {
      color: "Orange",
      hoist: true
    });

  return roles;
}

/* =========================================================
   MUTE PERMISSIONS
========================================================= */

async function applyMuteRole(guild, role) {
  const channels = guild.channels.cache.filter(
    c => c.type === ChannelType.GuildText
  );

  for (const channel of channels.values()) {
    await channel.permissionOverwrites.edit(role, {
      SendMessages: false,
      AddReactions: false,
      Speak: false
    }).catch(() => {});
  }
}

/* =========================================================
   SUNUCU KURULUMU
========================================================= */

const SETUP_CATEGORIES = [
  "UNITED LEAGUE",
  "KAYIT & DESTEK",
  "FUTBOL RP",
  "EKONOMİ",
  "ETKİNLİK",
  "YÖNETİM"
];

const SETUP_CHANNELS = {
  "UNITED LEAGUE": [
    "duyurular",
    "kurallar",
    "bot-durum",
    "sohbet",
    "haberler",
    "tweetler"
  ],

  "KAYIT & DESTEK": [
    "kayıt",
    "ticket-panel",
    "destek"
  ],

  "FUTBOL RP": [
    "maçlar",
    "kadro",
    "değerler",
    "antrenman",
    "penaltı",
    "transferler",
    "kap",
    "lig"
  ],

  "EKONOMİ": [
    "bütçeler",
    "sponsorlar",
    "şirketler",
    "reklam"
  ],

  "ETKİNLİK": [
    "çekiliş",
    "başarımlar",
    "sezon"
  ],

  "YÖNETİM": [
    "bot-komutları",
    "istatistik",
    "bot-log"
  ]
};

async function cleanPreviousSetup(guild) {
  const setup = db.setup[guild.id];

  if (!setup) return;

  if (Array.isArray(setup.channels)) {
    for (const id of setup.channels) {
      const channel = guild.channels.cache.get(id);

      if (channel) {
        await channel.delete("United League yeniden kurulumu")
          .catch(() => {});
      }
    }
  }

  if (Array.isArray(setup.categories)) {
    for (const id of setup.categories) {
      const category = guild.channels.cache.get(id);

      if (category) {
        await category.delete("United League yeniden kurulumu")
          .catch(() => {});
      }
    }
  }

  if (Array.isArray(setup.roles)) {
    for (const id of setup.roles) {
      const role = guild.roles.cache.get(id);

      if (
        role &&
        role.id !== guild.id &&
        role.id !== guild.members.me?.roles?.highest?.id
      ) {
        await role.delete("United League yeniden kurulumu")
          .catch(() => {});
      }
    }
  }
}

async function createSetup(guild) {
  await cleanPreviousSetup(guild);

  const roles = await setupRoles(guild);

  const createdCategories = [];
  const createdChannels = [];

  const everyone = guild.roles.everyone;

  for (const categoryName of SETUP_CATEGORIES) {
    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      reason: "United League sunucu kurulumu"
    });

    createdCategories.push(category.id);

    const channelNames = SETUP_CHANNELS[categoryName] || [];

    for (const channelName of channelNames) {
      const overwrites = [];

      if (categoryName === "YÖNETİM") {
        overwrites.push({
          id: everyone.id,
          deny: [
            PermissionsBitField.Flags.ViewChannel
          ]
        });

        overwrites.push({
          id: ROLE_IDS.admin,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        });
      }

      if (channelName === "duyurular") {
        overwrites.push({
          id: everyone.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ],
          deny: [
            PermissionsBitField.Flags.SendMessages
          ]
        });
      }

      if (channelName === "bot-log") {
        overwrites.push({
          id: everyone.id,
          deny: [
            PermissionsBitField.Flags.ViewChannel
          ]
        });

        overwrites.push({
          id: ROLE_IDS.admin,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        });
      }

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: overwrites,
        reason: "United League sunucu kurulumu"
      });

      createdChannels.push(channel.id);
    }
  }

  db.setup[guild.id] = {
    categories: createdCategories,
    channels: createdChannels,
    roles: [
      roles.kayitsiz.id,
      roles.futbolcu.id,
      roles.td.id,
      roles.muted.id
    ]
  };

  saveData();

  const ticketPanel = guild.channels.cache.find(
    c => c.name === "ticket-panel"
  );

  if (ticketPanel) {
    await sendTicketPanel(ticketPanel);
  }

  const kapChannel = guild.channels.cache.find(
    c => c.name === "kap"
  );

  if (kapChannel) {
    await kapChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Blue")
          .setTitle("📄 United League • KAP Sistemi")
          .setDescription(
            "Teknik Direktörler `.kap @oyuncu` komutuyla sunucu içinden KAP başlatabilir.\n\n" +
            "Oyuncuya DM gönderilmez. Tüm işlemler sunucu içerisinden yapılır."
          )
      ]
    }).catch(() => {});
  }

  return {
    roles,
    categories: createdCategories.length,
    channels: createdChannels.length
  };
}

/* =========================================================
   KAYIT
========================================================= */

async function sendRegistrationPanel(channel, member, name) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`reg_player_${member.id}`)
      .setLabel("Futbolcu")
      .setEmoji("⚽")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`reg_td_${member.id}`)
      .setLabel("Teknik Direktör")
      .setEmoji("🧠")
      .setStyle(ButtonStyle.Primary)
  );

  const embed = new EmbedBuilder()
    .setColor("Blue")
    .setTitle("📋 United League • Kayıt")
    .setDescription(
      `**Oyuncu:** <@${member.id}>\n` +
      `**İsim:** ${name}\n\n` +
      "Oyuncunun türünü aşağıdaki butonlardan seçin."
    )
    .setTimestamp();

  await channel.send({
    embeds: [embed],
    components: [row]
  });
}

/* =========================================================
   VALUE
========================================================= */

function getNicknameValue(member) {
  const nick = member.nickname || member.user.username;

  const match = nick.match(
    /([\d.,]+)\s*([KMB])?\s*€?\s*$/i
  );

  if (!match) return 0;

  let number = Number(match[1].replace(/,/g, "."));

  if (!Number.isFinite(number)) return 0;

  const suffix = String(match[2] || "").toLowerCase();

  if (suffix === "k") number *= 1_000;
  if (suffix === "m") number *= 1_000_000;
  if (suffix === "b") number *= 1_000_000_000;

  return Math.floor(number);
}

async function setNicknameValue(member, value) {
  const old = member.nickname || member.user.username;

  const regex = /([\d.,]+)\s*([KMB])?\s*€?\s*$/i;

  let next;

  if (regex.test(old)) {
    next = old.replace(regex, money(value));
  } else {
    next = `${old} | ${money(value)}`;
  }

  if (next.length > 32) {
    next = next.slice(0, 32);
  }

  await member.setNickname(next, "United League değer sistemi");
}

/* =========================================================
   TEAM
========================================================= */

function getTeamByMember(userId) {
  return Object.values(db.teams).find(
    t => t.ownerId === userId
  );
}

function getTeamByRole(guild, role) {
  return Object.values(db.teams).find(
    t => t.roleId === role.id
  );
}

/* =========================================================
   TICKET
========================================================= */

async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor("Blue")
    .setTitle("🎫 United League • Destek")
    .setDescription(
      "Destek almak için aşağıdaki butona basarak ticket oluşturabilirsiniz.\n\n" +
      "• Her kullanıcı aynı anda yalnızca 1 ticket açabilir.\n" +
      "• Ticket kapatma işlemi buton üzerinden yapılır."
    )
    .setFooter({
      text: "United League • Destek Sistemi"
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_create")
      .setLabel("Ticket Aç")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    embeds: [embed],
    components: [row]
  });
}

async function createTicket(interaction) {
  const guild = interaction.guild;

  const existing = guild.channels.cache.find(
    c => c.name === `ticket-${cleanName(interaction.user.username)}`
  );

  if (existing) {
    return interaction.reply({
      content: `❌ Zaten açık bir ticketın var: ${existing}`,
      ephemeral: true
    });
  }

  const staffRole =
    guild.roles.cache.get(ROLE_IDS.admin) ||
    guild.roles.cache.find(r => r.name === "Yönetici");

  const channel = await guild.channels.create({
    name: `ticket-${cleanName(interaction.user.username)}`,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
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
      ...(staffRole ? [{
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }] : [])
    ]
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Ticket Kapat")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${interaction.user.id}>`,
    embeds: [
      new EmbedBuilder()
        .setColor("Blue")
        .setTitle("🎫 Ticket Açıldı")
        .setDescription(
          "Merhaba! Yetkililer en kısa sürede ilgilenecektir.\n\n" +
          "Ticketı kapatmak için aşağıdaki butonu kullanabilirsiniz."
        )
    ],
    components: [row]
  });

  await interaction.reply({
    content: `✅ Ticket oluşturuldu: ${channel}`,
    ephemeral: true
  });
}

/* =========================================================
   KAP FORM
========================================================= */

async function openKapModal(interaction, target) {
  const modal = new ModalBuilder()
    .setCustomId(`kap_modal_${target.id}`)
    .setTitle("KAP • Transfer Teklifi");

  const fee = new TextInputBuilder()
    .setCustomId("fee")
    .setLabel("Transfer bedeli")
    .setPlaceholder("Örn: 10M")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const salary = new TextInputBuilder()
    .setCustomId("salary")
    .setLabel("Maaş")
    .setPlaceholder("Örn: 500K")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const duration = new TextInputBuilder()
    .setCustomId("duration")
    .setLabel("Sözleşme süresi")
    .setPlaceholder("Örn: 2 sezon")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const details = new TextInputBuilder()
    .setCustomId("details")
    .setLabel("Ek şartlar / açıklama")
    .setPlaceholder("Transferle ilgili ek bilgiler")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(fee),
    new ActionRowBuilder().addComponents(salary),
    new ActionRowBuilder().addComponents(duration),
    new ActionRowBuilder().addComponents(details)
  );

  await interaction.showModal(modal);
}

/* =========================================================
   COMPANY / SPONSOR
========================================================= */

const COMPANIES = [
  ["Emirates", 65],
  ["Adidas", 60],
  ["Puma", 55],
  ["Nike", 50],
  ["Coca-Cola", 45],
  ["Pepsi", 40],
  ["Red Bull", 35],
  ["Mercedes", 30]
];

const SPONSORS = [
  ["Emirates", 65],
  ["Adidas", 75],
  ["Puma", 55],
  ["Nike", 65],
  ["Coca-Cola", 45],
  ["Pepsi", 40],
  ["Red Bull", 35],
  ["Mercedes", 30]
];

function randomChance(percent) {
  return Math.random() * 100 < percent;
}

/* =========================================================
   GIVEAWAY
========================================================= */

function parseDuration(input) {
  if (!input) return null;

  const match = String(input)
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)(s|sn|dk|m|sa|saat|h|d)$/);

  if (!match) return null;

  const number = Number(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    sn: 1000,
    dk: 60_000,
    m: 60_000,
    sa: 3_600_000,
    saat: 3_600_000,
    h: 3_600_000,
    d: 86_400_000
  };

  return Math.floor(number * multipliers[unit]);
}

async function finishGiveaway(guildId, giveawayId) {
  const giveaway = db.giveaways[giveawayId];

  if (!giveaway || giveaway.ended) return;

  giveaway.ended = true;

  const guild = client.guilds.cache.get(guildId);

  if (!guild) return;

  const channel = guild.channels.cache.get(giveaway.channelId);

  if (!channel) return;

  const participants = giveaway.participants || [];

  if (!participants.length) {
    await channel.send("🎁 Çekiliş sona erdi fakat katılımcı bulunamadı.");
    saveData();
    return;
  }

  const winnerId =
    participants[Math.floor(Math.random() * participants.length)];

  const winner = guild.members.cache.get(winnerId);

  if (winner) {
    const p = getPlayer(winnerId);
    const prize = parseMoney(giveaway.prize);

    if (prize) {
      p.budget += prize;
    }

    await channel.send(
      `🎉 Tebrikler <@${winnerId}>! Çekilişi kazandın ve **${giveaway.prize}** ödülünü aldın!`
    );
  }

  saveData();
}

/* =========================================================
   READY
========================================================= */

let lastHourly = "";

client.once("ready", async () => {
  console.log(`United League aktif: ${client.user.tag}`);

  client.user.setPresence({
    activities: [
      {
        name: "United League | Futbol Rp",
        type: 0
      }
    ],
    status: "online"
  });

  setInterval(async () => {
    const now = new Date();

    if (now.getMinutes() !== 0) return;

    const key =
      `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;

    if (key === lastHourly) return;

    lastHourly = key;

    for (const guild of client.guilds.cache.values()) {
      const channel =
        guild.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID) ||
        await findChannel(guild, ["bot-durum"]);

      if (!channel) continue;

      const uptime = Math.floor(process.uptime());

      const h = Math.floor(uptime / 3600);
      const m = Math.floor((uptime % 3600) / 60);
      const s = uptime % 60;

      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("United League • Bot Durumu")
        .addFields(
          {
            name: "🟢 Durum",
            value: "Aktif",
            inline: true
          },
          {
            name: "📡 Ping",
            value: `${client.ws.ping}ms`,
            inline: true
          },
          {
            name: "🌐 Sunucu",
            value: `${client.guilds.cache.size}`,
            inline: true
          },
          {
            name: "⏱️ Uptime",
            value: `${h}s ${m}dk ${s}sn`,
            inline: true
          },
          {
            name: "🕐 Saat",
            value: now.toLocaleString("tr-TR"),
            inline: true
          }
        )
        .setTimestamp();

      await channel.send({
        embeds: [embed]
      }).catch(() => {});
    }
  }, 20_000);
});

/* =========================================================
   MEMBER JOIN
========================================================= */

client.on("guildMemberAdd", async member => {
  try {
    const roles = await setupRoles(member.guild);

    if (roles.kayitsiz) {
      await member.roles.add(
        roles.kayitsiz,
        "Yeni üye"
      ).catch(() => {});
    }

    const channel = await findChannel(
      member.guild,
      ["kayıt", "kayit"]
    );

    if (!channel) return;

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Blue")
          .setTitle("👋 United League • Yeni Oyuncu")
          .setDescription(
            `Sunucuya yeni bir oyuncu katıldı!\n\n` +
            `👤 Oyuncu: <@${member.id}>\n` +
            `📋 <@&${ROLE_IDS.kayit}> Kayıt Yetkilisi ilgilen!`
          )
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp()
      ]
    });
  } catch (err) {
    console.error("guildMemberAdd:", err);
  }
});

/* =========================================================
   INTERACTIONS
========================================================= */

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isButton()) {
      /* TICKET */

      if (interaction.customId === "ticket_create") {
        return createTicket(interaction);
      }

      if (interaction.customId === "ticket_close") {
        await interaction.reply({
          content: "🔒 Ticket kapatılıyor...",
          ephemeral: true
        });

        setTimeout(() => {
          interaction.channel.delete("Ticket kapatıldı").catch(() => {});
        }, 1500);

        return;
      }

      /* KAYIT */

      if (
        interaction.customId.startsWith("reg_player_") ||
        interaction.customId.startsWith("reg_td_")
      ) {
        const targetId = interaction.customId.split("_").pop();

        if (interaction.user.id !== targetId) {
          return interaction.reply({
            content: "❌ Bu kayıt paneli sana ait değil.",
            ephemeral: true
          });
        }

        const player = getPlayer(targetId);

        const isTD =
          interaction.customId.startsWith("reg_td_");

        const roles = await setupRoles(interaction.guild);

        if (roles.kayitsiz) {
          await interaction.member.roles.remove(
            roles.kayitsiz
          ).catch(() => {});
        }

        if (isTD) {
          await interaction.member.roles.add(
            roles.td
          ).catch(() => {});

          player.type = "Teknik Direktör";
        } else {
          await interaction.member.roles.add(
            roles.futbolcu
          ).catch(() => {});

          player.type = "Futbolcu";
        }

        player.registered = true;

        saveData();

        await interaction.reply({
          content: `✅ Kayıt tamamlandı. Rolün: **${player.type}**`,
          ephemeral: true
        });

        const general = await findChannel(
          interaction.guild,
          ["sohbet"]
        );

        if (general) {
          await general.send(
            `👋 <@${targetId}> United League'e hoş geldin!`
          );
        }

        return;
      }

      /* KAP OYUNCU */

      if (interaction.customId.startsWith("kap_player_accept_")) {
        const id = interaction.customId.replace(
          "kap_player_accept_",
          ""
        );

        const kap = db.kap[id];

        if (!kap) {
          return interaction.reply({
            content: "❌ Bu KAP artık geçerli değil.",
            ephemeral: true
          });
        }

        if (interaction.user.id !== kap.playerId) {
          return interaction.reply({
            content: "❌ Bu KAP sana ait değil.",
            ephemeral: true
          });
        }

        kap.playerAccepted = true;

        const oldTeam =
          kap.oldTeamId ? db.teams[kap.oldTeamId] : null;

        if (oldTeam && oldTeam.ownerId !== interaction.user.id) {
          kap.waitingOldTD = true;

          await interaction.reply({
            content:
              "✅ Teklifi kabul ettin. Eski takım Teknik Direktörünün onayı bekleniyor.",
            ephemeral: true
          });

          const oldTeamChannel =
            await findChannel(
              interaction.guild,
              ["transferler", "kap"]
            );

          if (oldTeamChannel) {
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`kap_old_accept_${id}`)
                .setLabel("Transferi Onayla")
                .setStyle(ButtonStyle.Success),

              new ButtonBuilder()
                .setCustomId(`kap_old_reject_${id}`)
                .setLabel("Reddet")
                .setStyle(ButtonStyle.Danger)
            );

            await oldTeamChannel.send({
              content: `<@${oldTeam.ownerId}>`,
              embeds: [
                new EmbedBuilder()
                  .setColor("Orange")
                  .setTitle("🔄 KAP • Eski Takım Onayı")
                  .setDescription(
                    `<@${kap.playerId}> için transfer teklifi kabul edildi.\n\n` +
                    `Transfer bedeli: **${money(kap.fee)}**`
                  )
              ],
              components: [row]
            });
          }

          return;
        }

        await completeTransfer(interaction.guild, id);

        return;
      }

      if (interaction.customId.startsWith("kap_player_reject_")) {
        const id = interaction.customId.replace(
          "kap_player_reject_",
          ""
        );

        const kap = db.kap[id];

        if (!kap) {
          return interaction.reply({
            content: "❌ KAP bulunamadı.",
            ephemeral: true
          });
        }

        if (interaction.user.id !== kap.playerId) {
          return interaction.reply({
            content: "❌ Bu KAP sana ait değil.",
            ephemeral: true
          });
        }

        kap.status = "Reddedildi";
        saveData();

        await interaction.reply({
          content: "❌ KAP teklifini reddettin.",
          ephemeral: true
        });

        return;
      }

      /* KAP ESKİ TD */

      if (
        interaction.customId.startsWith("kap_old_accept_") ||
        interaction.customId.startsWith("kap_old_reject_")
      ) {
        const id = interaction.customId.split("_").pop();
        const kap = db.kap[id];

        if (!kap) {
          return interaction.reply({
            content: "❌ KAP bulunamadı.",
            ephemeral: true
          });
        }

        const oldTeam = db.teams[kap.oldTeamId];

        if (
          !oldTeam ||
          (
            interaction.user.id !== oldTeam.ownerId &&
            !isAdmin(interaction.member)
          )
        ) {
          return interaction.reply({
            content: "❌ Bu işlemi yalnızca eski takım Teknik Direktörü yapabilir.",
            ephemeral: true
          });
        }

        if (
          interaction.customId.startsWith("kap_old_reject_")
        ) {
          kap.status = "Eski takım tarafından reddedildi";
          saveData();

          return interaction.reply({
            content: "❌ Transfer reddedildi.",
            ephemeral: true
          });
        }

        await interaction.deferReply({
          ephemeral: true
        });

        await completeTransfer(
          interaction.guild,
          id
        );

        await interaction.editReply(
          "✅ Transfer onaylandı ve tamamlandı."
        );

        return;
      }

      /* KAP BAŞLAT */

      if (interaction.customId.startsWith("kap_start_")) {
        const playerId =
          interaction.customId.replace("kap_start_", "");

        const member =
          await interaction.guild.members.fetch(playerId)
            .catch(() => null);

        if (!member) {
          return interaction.reply({
            content: "❌ Oyuncu bulunamadı.",
            ephemeral: true
          });
        }

        return openKapModal(
          interaction,
          member
        );
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      /* KAP FORM */

      if (
        interaction.customId.startsWith("kap_modal_")
      ) {
        const playerId =
          interaction.customId.replace(
            "kap_modal_",
            ""
          );

        const player =
          await interaction.guild.members.fetch(playerId)
            .catch(() => null);

        if (!player) {
          return interaction.reply({
            content: "❌ Oyuncu bulunamadı.",
            ephemeral: true
          });
        }

        const fee =
          parseMoney(
            interaction.fields.getTextInputValue("fee")
          );

        const salary =
          parseMoney(
            interaction.fields.getTextInputValue("salary")
          );

        const duration =
          interaction.fields.getTextInputValue("duration");

        const details =
          interaction.fields.getTextInputValue("details") ||
          "Belirtilmedi.";

        if (fee === null || salary === null) {
          return interaction.reply({
            content:
              "❌ Transfer bedeli veya maaş geçersiz. Örnek: `10M`, `500K`.",
            ephemeral: true
          });
        }

        const team = getTeamByMember(
          interaction.user.id
        );

        if (!team && !isAdmin(interaction.member)) {
          return interaction.reply({
            content:
              "❌ Bir takımın Teknik Direktörü olmalısın.",
            ephemeral: true
          });
        }

        if (
          team &&
          !isAdmin(interaction.member) &&
          team.ownerId !== interaction.user.id
        ) {
          return interaction.reply({
            content:
              "❌ Bu takımın Teknik Direktörü değilsin.",
            ephemeral: true
          });
        }

        const id =
          `${Date.now()}_${interaction.user.id}_${playerId}`;

        const targetPlayer = getPlayer(playerId);

        db.kap[id] = {
          id,
          playerId,
          buyerId: interaction.user.id,
          newTeamId: team?.id || null,
          oldTeamId: targetPlayer.teamId || null,
          fee,
          salary,
          duration,
          details,
          playerAccepted: false,
          waitingOldTD: false,
          status: "Bekliyor",
          createdAt: Date.now()
        };

        saveData();

        const channel =
          await findChannel(
            interaction.guild,
            ["kap", "transferler"]
          );

        if (!channel) {
          delete db.kap[id];
          saveData();

          return interaction.reply({
            content:
              "❌ KAP kanalı bulunamadı. `.sunucukur` çalıştır.",
            ephemeral: true
          });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`kap_player_accept_${id}`)
            .setLabel("Kabul Et")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId(`kap_player_reject_${id}`)
            .setLabel("Reddet")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({
          content: `<@${playerId}>`,
          embeds: [
            new EmbedBuilder()
              .setColor("Blue")
              .setTitle("📄 United League • KAP Teklifi")
              .addFields(
                {
                  name: "👤 Oyuncu",
                  value: `<@${playerId}>`,
                  inline: true
                },
                {
                  name: "🏟️ Yeni Takım",
                  value:
                    team?.name || "Yönetim tarafından",
                  inline: true
                },
                {
                  name: "💰 Transfer Bedeli",
                  value: money(fee),
                  inline: true
                },
                {
                  name: "💵 Maaş",
                  value: money(salary),
                  inline: true
                },
                {
                  name: "📅 Sözleşme",
                  value: duration,
                  inline: true
                },
                {
                  name: "📝 Ek Şartlar",
                  value: details.slice(0, 1024),
                  inline: false
                }
              )
              .setFooter({
                text: "KAP • DM kullanılmaz"
              })
              .setTimestamp()
          ],
          components: [row]
        });

        await interaction.reply({
          content:
            `✅ KAP oluşturuldu ve <#${channel.id}> kanalında yayınlandı.`,
          ephemeral: true
        });

        return;
      }
    }
  } catch (err) {
    console.error("interactionCreate:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ İşlem sırasında bir hata oluştu.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

/* =========================================================
   TRANSFER TAMAMLAMA
========================================================= */

async function completeTransfer(guild, kapId) {
  const kap = db.kap[kapId];

  if (!kap) return false;

  const buyerTeam =
    kap.newTeamId ? db.teams[kap.newTeamId] : null;

  const oldTeam =
    kap.oldTeamId ? db.teams[kap.oldTeamId] : null;

  if (buyerTeam && buyerTeam.budget < kap.fee) {
    const channel = await findChannel(
      guild,
      ["kap", "transferler"]
    );

    if (channel) {
      await channel.send(
        `❌ Transfer tamamlanamadı. **${buyerTeam.name}** takımının bütçesi yetersiz.`
      );
    }

    kap.status = "Bütçe yetersiz";
    saveData();

    return false;
  }

  if (buyerTeam) {
    buyerTeam.budget -= kap.fee;
  }

  if (oldTeam) {
    oldTeam.budget += kap.fee;
  }

  const player = getPlayer(kap.playerId);

  player.teamId = buyerTeam?.id || null;

  kap.status = "Tamamlandı";
  kap.completedAt = Date.now();

  db.transfers.push({
    playerId: kap.playerId,
    from: oldTeam?.name || null,
    to: buyerTeam?.name || null,
    fee: kap.fee,
    salary: kap.salary,
    duration: kap.duration,
    date: Date.now()
  });

  saveData();

  const member =
    await guild.members.fetch(kap.playerId)
      .catch(() => null);

  if (member && buyerTeam?.roleId) {
    if (oldTeam?.roleId) {
      await member.roles.remove(
        oldTeam.roleId
      ).catch(() => {});
    }

    await member.roles.add(
      buyerTeam.roleId
    ).catch(() => {});
  }

  const channel =
    await findChannel(
      guild,
      ["kap", "transferler"]
    );

  if (channel) {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Green")
          .setTitle("✅ Transfer Tamamlandı")
          .setDescription(
            `<@${kap.playerId}> artık **${buyerTeam?.name || "Yeni Takım"}** oyuncusu.`
          )
          .addFields({
            name: "💰 Transfer Bedeli",
            value: money(kap.fee),
            inline: true
          }, {
            name: "💵 Maaş",
            value: money(kap.salary),
            inline: true
          }, {
            name: "📅 Sözleşme",
            value: kap.duration,
            inline: true
          })
          .setTimestamp()
      ]
    });
  }

  return true;
}

/* =========================================================
   MESSAGE COMMANDS
========================================================= */

client.on("messageCreate", async message => {
  try {
    if (message.author.bot) return;

    if (!message.content.startsWith(PREFIX)) return;

    const parts = message.content
      .slice(PREFIX.length)
      .trim()
      .split(/\s+/);

    const command =
      String(parts.shift() || "").toLowerCase();

    const args = parts;

    /* =====================================================
       YARDIM
    ===================================================== */

    if (
      command === "yardım" ||
      command === "yardim" ||
      command === "help"
    ) {
      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("📚 United League • Komutlar")
        .setDescription(
          "**👤 Oyuncu**\n" +
          "`.profil` `.istatistik` `.değer` `.değerler`\n" +
          "`.ant` `.antrenman` `.pen` `.penaltı`\n" +
          "`.bütçe` `.para` `.paragönder`\n\n" +

          "**⚽ Takım**\n" +
          "`.takımoluştur` `.takım` `.takımım` `.takımlar`\n" +
          "`.kadro` `.kadrocikar` `.formasyon`\n" +
          "`.takımbütçe` `.takımpara` `.takımharca`\n\n" +

          "**🔄 Transfer**\n" +
          "`.kap @oyuncu` `.transferler`\n\n" +

          "**🏆 Lig**\n" +
          "`.maç @oyuncu @oyuncu`\n" +
          "`.maçlar` `.puan` `.lig`\n" +
          "`.golkrall
