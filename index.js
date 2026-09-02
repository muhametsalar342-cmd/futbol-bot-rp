const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const PREFIX = ".";
const TOKEN = process.env.TOKEN;

const ROLE_IDS = {
  YONETICI: "1544449436011339806",
  KAYIT: "1544452022764568656",
  DEGER: "1544451743746891806"
};

const DUYURU_KANAL_ID = "1544653653330108477";
const DATA_FILE = path.join(__dirname, "data.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const defaultDB = {
  players: {},
  teams: {},
  transfers: [],
  kap: {},
  matches: [],
  giveaways: {},
  tickets: {},
  registrations: {},
  countryRoles: {},
  ads: {},
  companies: {},
  sponsors: {},
  season: {
    number: 1,
    startedAt: Date.now()
  }
};

let db;

function loadDB() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      db = JSON.parse(JSON.stringify(defaultDB));
      saveDB();
      return;
    }

    db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    for (const key of Object.keys(defaultDB)) {
      if (db[key] === undefined) {
        db[key] = JSON.parse(JSON.stringify(defaultDB[key]));
      }
    }
  } catch (err) {
    console.error("DATA HATASI:", err);
    db = JSON.parse(JSON.stringify(defaultDB));
    saveDB();
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("DATA KAYIT HATASI:", err);
  }
}

loadDB();

function getPlayer(id) {
  if (!db.players[id]) {
    db.players[id] = {
      value: 0,
      budget: 0,
      xp: 0,
      level: 1,
      goals: 0,
      assists: 0,
      penaltyGoals: 0,
      training: 0,
      teamId: null,
      language: "tr",
      country: "Türkiye",
      achievements: [],
      registered: false,
      playerName: null,
      type: null
    };
  }

  return db.players[id];
}

function money(value) {
  value = Number(value) || 0;

  if (value >= 1000000) {
    const n = value / 1000000;
    return `${Number.isInteger(n) ? n : n.toFixed(1)}M€`;
  }

  if (value >= 1000) {
    const n = value / 1000;
    return `${Number.isInteger(n) ? n : n.toFixed(1)}K€`;
  }

  return `${Math.round(value)}€`;
}

function parseMoney(text) {
  if (!text) return NaN;

  let value = String(text)
    .toLowerCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");

  if (value.endsWith("m")) {
    const n = parseFloat(value.slice(0, -1));
    return isNaN(n) ? NaN : n * 1000000;
  }

  if (value.endsWith("k")) {
    const n = parseFloat(value.slice(0, -1));
    return isNaN(n) ? NaN : n * 1000;
  }

  const n = parseFloat(value);
  return isNaN(n) ? NaN : n;
}

function isAdmin(member) {
  return !!member && (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(ROLE_IDS.YONETICI)
  );
}

function isValueStaff(member) {
  return isAdmin(member) ||
    member.roles.cache.has(ROLE_IDS.DEGER);
}

function isRegisterStaff(member) {
  return isAdmin(member) ||
    member.roles.cache.has(ROLE_IDS.KAYIT);
}

function isTD(member) {
  return isAdmin(member) ||
    member.roles.cache.some(r =>
      r.name.toLowerCase().includes("teknik direktör") ||
      r.name.toLowerCase().includes("teknik direktor")
    );
}

function mentionedMember(message) {
  return message.mentions.members.first();
}

function addXP(id, amount) {
  const p = getPlayer(id);

  p.xp += amount;

  while (p.xp >= p.level * 100) {
    p.xp -= p.level * 100;
    p.level++;
  }

  saveDB();
}

function addAchievement(id, achievement) {
  const p = getPlayer(id);

  if (!p.achievements.includes(achievement)) {
    p.achievements.push(achievement);
  }

  saveDB();
}

async function updateNickname(guild, userId) {
  try {
    const member = await guild.members.fetch(userId);
    const p = getPlayer(userId);

    const old =
      member.nickname ||
      member.user.globalName ||
      member.user.username;

    const regex = /\s*\|\s*[\d.,]+(?:[MKmk])€?\s*$/;

    let nick;

    if (regex.test(old)) {
      nick = old.replace(regex, ` | ${money(p.value)}`);
    } else {
      nick = `${old} | ${money(p.value)}`;
    }

    nick = nick.slice(0, 32);

    if (member.manageable) {
      await member.setNickname(nick);
    }
  } catch {}
}

async function createRole(guild, name, options = {}) {
  let role = guild.roles.cache.find(
    r => r.name.toLowerCase() === name.toLowerCase()
  );

  if (role) return role;

  try {
    return await guild.roles.create({
      name,
      color: options.color || undefined,
      hoist: options.hoist || false,
      reason: "United League Bot"
    });
  } catch (err) {
    console.error("ROL OLUŞTURMA:", err.message);
    return null;
  }
}

function getTeamByOwner(userId) {
  return Object.values(db.teams).find(
    t => t.ownerId === userId
  );
}

function getTeamByName(name) {
  return Object.values(db.teams).find(
    t => t.name.toLowerCase() === name.toLowerCase()
  );
}

function getTeamById(id) {
  return db.teams[id] || null;
}

function getTeamOfPlayer(userId) {
  const p = getPlayer(userId);
  return p.teamId ? db.teams[p.teamId] : null;
}

/* =====================================================
   DİL SİSTEMİ
===================================================== */

const LANGUAGES = [
  ["tr", "Türkçe", "🇹🇷"],
  ["en", "English", "🇬🇧"],
  ["de", "Deutsch", "🇩🇪"],
  ["fr", "Français", "🇫🇷"],
  ["es", "Español", "🇪🇸"],
  ["it", "Italiano", "🇮🇹"],
  ["pt", "Português", "🇵🇹"],
  ["nl", "Nederlands", "🇳🇱"],
  ["ru", "Русский", "🇷🇺"],
  ["ar", "العربية", "🇸🇦"],
  ["ja", "日本語", "🇯🇵"],
  ["ko", "한국어", "🇰🇷"],
  ["zh", "中文", "🇨🇳"],
  ["pl", "Polski", "🇵🇱"],
  ["uk", "Українська", "🇺🇦"],
  ["sv", "Svenska", "🇸🇪"],
  ["da", "Dansk", "🇩🇰"],
  ["no", "Norsk", "🇳🇴"],
  ["fi", "Suomi", "🇫🇮"],
  ["el", "Ελληνικά", "🇬🇷"]
];

const COUNTRIES = [
  "Türkiye","Almanya","Arnavutluk","Andorra","Avusturya","Belarus",
  "Belçika","Bosna-Hersek","Bulgaristan","Hırvatistan","Kıbrıs",
  "Çekya","Danimarka","Estonya","Finlandiya","Fransa","Yunanistan",
  "Macaristan","İzlanda","İrlanda","İtalya","Kosova","Letonya",
  "Lihtenştayn","Litvanya","Lüksemburg","Malta","Moldova","Monako",
  "Karadağ","Hollanda","Kuzey Makedonya","Norveç","Polonya",
  "Portekiz","Romanya","Rusya","San Marino","Sırbistan","Slovakya",
  "Slovenya","İspanya","İsveç","İsviçre","Ukrayna","Birleşik Krallık",
  "Vatikan","Afganistan","Bahreyn","Bangladeş","Bhutan","Brunei",
  "Kamboçya","Çin","Hindistan","Endonezya","İran","Irak","İsrail",
  "Japonya","Ürdün","Kazakistan","Kuveyt","Kırgızistan","Laos",
  "Lübnan","Malezya","Maldivler","Moğolistan","Myanmar","Nepal",
  "Kuzey Kore","Umman","Pakistan","Filipinler","Katar","Suudi Arabistan",
  "Singapur","Güney Kore","Sri Lanka","Suriye","Tacikistan","Tayland",
  "Türkmenistan","Birleşik Arap Emirlikleri","Özbekistan","Vietnam",
  "Yemen","Cezayir","Angola","Benin","Botsvana","Burkina Faso",
  "Burundi","Cabo Verde","Kamerun","Orta Afrika Cumhuriyeti","Çad",
  "Komorlar","Kongo","Kongo Demokratik Cumhuriyeti","Fildişi Sahili",
  "Cibuti","Mısır","Ekvator Ginesi","Eritre","Esvatini","Etiyopya",
  "Gabon","Gambiya","Gana","Gine","Gine-Bissau","Kenya","Lesotho",
  "Liberya","Libya","Madagaskar","Malavi","Mali","Moritanya",
  "Mauritius","Fas","Mozambik","Namibya","Nijer","Nijerya","Ruanda",
  "Sao Tome ve Principe","Senegal","Seyşeller","Sierra Leone","Somali",
  "Güney Afrika","Güney Sudan","Sudan","Tanzanya","Togo","Tunus",
  "Uganda","Zambiya","Zimbabve","Antigua ve Barbuda","Arjantin",
  "Bahamalar","Barbados","Belize","Bolivya","Brezilya","Kanada",
  "Şili","Kolombiya","Kosta Rika","Küba","Dominika",
  "Dominik Cumhuriyeti","Ekvador","El Salvador","Grenada","Guatemala",
  "Guyana","Haiti","Honduras","Jamaika","Meksika","Nikaragua",
  "Panama","Paraguay","Peru","Saint Kitts ve Nevis","Saint Lucia",
  "Saint Vincent ve Grenadinler","Surinam","Trinidad ve Tobago",
  "Amerika Birleşik Devletleri","Uruguay","Venezuela","Avustralya",
  "Fiji","Kiribati","Marshall Adaları","Mikronezya","Nauru",
  "Yeni Zelanda","Palau","Papua Yeni Gine","Samoa","Solomon Adaları",
  "Tonga","Tuvalu","Vanuatu","Ermenistan","Azerbaycan","Gürcistan"
];

function languagePanel() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("language_select")
      .setPlaceholder("🌍 Dilini seç")
      .addOptions(
        LANGUAGES.map(x => ({
          label: x[1],
          value: x[0],
          emoji: x[2]
        }))
      )
  );
}

/* =====================================================
   TICKET
===================================================== */

function ticketPanel() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎫 United League • Ticket")
        .setDescription(
          "Destek almak için aşağıdaki **Ticket Aç** butonuna bas."
        )
        .setFooter({
          text: "United League • Destek Sistemi"
        })
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_open")
          .setLabel("Ticket Aç")
          .setEmoji("🎫")
          .setStyle(ButtonStyle.Primary)
      )
    ]
  };
}

async function openTicket(interaction) {
  const guild = interaction.guild;

  const existing = guild.channels.cache.find(
    c => c.topic === `UL_TICKET:${interaction.user.id}`
  );

  if (existing) {
    return interaction.reply({
      content: `❌ Zaten açık ticket'ın var: ${existing}`,
      ephemeral: true
    });
  }

  const channel = await guild.channels.create({
    name: `ticket-${interaction.user.username}`
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "")
      .slice(0, 80),
    type: ChannelType.GuildText,
    topic: `UL_TICKET:${interaction.user.id}`,
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
      {
        id: client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ]
  });

  db.tickets[channel.id] = {
    userId: interaction.user.id,
    createdAt: Date.now()
  };

  saveDB();

  await channel.send({
    content: `${interaction.user}`,
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🎫 Ticket Açıldı")
        .setDescription(
          "Yetkililer en kısa sürede seninle ilgilenecektir."
        )
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("Ticket Kapat")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  });

  return interaction.reply({
    content: `✅ Ticket oluşturuldu: ${channel}`,
    ephemeral: true
  });
}

/* =====================================================
   KAP
===================================================== */

function kapModal(id) {
  const modal = new ModalBuilder()
    .setCustomId(`kap_modal_${id}`)
    .setTitle("📄 KAP Transfer Teklifi");

  const fee = new TextInputBuilder()
    .setCustomId("fee")
    .setLabel("Bonservis")
    .setPlaceholder("25M")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const salary = new TextInputBuilder()
    .setCustomId("salary")
    .setLabel("Maaş")
    .setPlaceholder("2M")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const duration = new TextInputBuilder()
    .setCustomId("duration")
    .setLabel("Sözleşme")
    .setPlaceholder("3 sezon")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const position = new TextInputBuilder()
    .setCustomId("position")
    .setLabel("Mevki")
    .setPlaceholder("SNT")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const details = new TextInputBuilder()
    .setCustomId("details")
    .setLabel("Ek şartlar")
    .setPlaceholder("Varsa özel şartları yaz.")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(fee),
    new ActionRowBuilder().addComponents(salary),
    new ActionRowBuilder().addComponents(duration),
    new ActionRowBuilder().addComponents(position),
    new ActionRowBuilder().addComponents(details)
  );

  return modal;
}

async function createKAP(message, player) {
  if (!isTD(message.member)) {
    return message.reply(
      "❌ KAP kullanmak için Teknik Direktör olmalısın."
    );
  }

  const team = getTeamByOwner(message.author.id);

  if (!team && !isAdmin(message.member)) {
    return message.reply(
      "❌ Önce bir takım oluşturmalısın."
    );
  }

  const p = getPlayer(player.id);

  if (team && p.teamId === team.id) {
    return message.reply(
      "❌ Kendi takımındaki oyuncuya KAP açamazsın."
    );
  }

  const active = Object.values(db.kap).find(
    k => k.playerId === player.id &&
      ["form", "pending", "oldteam"].includes(k.status)
  );

  if (active) {
    return message.reply(
      "❌ Bu oyuncu için zaten aktif KAP bulunuyor."
    );
  }

  const id = `KAP-${Date.now()}`;

  db.kap[id] = {
    id,
    playerId: player.id,
    fromTeamId: team?.id || null,
    fromUserId: message.author.id,
    fee: 0,
    salary: 0,
    duration: "",
    position: "",
    details: "",
    status: "form",
    createdAt: Date.now()
  };

  saveDB();

  return message.channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("📄 KAP • Transfer Teklifi")
        .setDescription(
          `👤 **Oyuncu:** ${player}\n\n` +
          "Teknik Direktör aşağıdaki butondan teklif bilgilerini doldurabilir."
        )
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`kap_form_${id}`)
          .setLabel("KAP Formunu Doldur")
          .setEmoji("📄")
          .setStyle(ButtonStyle.Primary)
      )
    ]
  });
}

async function publishKAP(interaction, kap) {
  const channel =
    interaction.guild.channels.cache.find(
      c =>
        ["kap", "transferler", "transfer"].includes(
          c.name.toLowerCase()
        )
    ) || interaction.channel;

  const player = await interaction.guild.members
    .fetch(kap.playerId)
    .catch(() => null);

  if (!player) {
    return interaction.reply({
      content: "❌ Oyuncu bulunamadı.",
      ephemeral: true
    });
  }

  const team = getTeamById(kap.fromTeamId);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📄 KAP • Resmî Transfer Teklifi")
    .setDescription(`${player}`)
    .addFields(
      {
        name: "🏟️ Kulüp",
        value: team?.name || "Kulüp",
        inline: true
      },
      {
        name: "💰 Bonservis",
        value: money(kap.fee),
        inline: true
      },
      {
        name: "💵 Maaş",
        value: money(kap.salary),
        inline: true
      },
      {
        name: "📆 Sözleşme",
        value: kap.duration,
        inline: true
      },
      {
        name: "⚽ Mevki",
        value: kap.position,
        inline: true
      },
      {
        name: "📋 Şartlar",
        value: kap.details || "Belirtilmedi"
      }
    )
    .setFooter({
      text: kap.id
    })
    .setTimestamp();

  await channel.send({
    content: `${player}`,
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`kap_accept_${kap.id}`)
          .setLabel("Kabul Et")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`kap_reject_${kap.id}`)
          .setLabel("Reddet")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  });

  kap.status = "pending";
  kap.channelId = channel.id;

  saveDB();

  return interaction.reply({
    content: "✅ KAP başarıyla yayınlandı.",
    ephemeral: true
  });
}

async function completeTransfer(interaction, kap) {
  const p = getPlayer(kap.playerId);
  const newTeam = getTeamById(kap.fromTeamId);
  const oldTeam = getTeamById(p.teamId);

  if (!newTeam) {
    return interaction.followUp({
      content: "❌ Yeni takım bulunamadı.",
      ephemeral: true
    });
  }

  if (newTeam.budget < kap.fee) {
    kap.status = "cancelled";
    saveDB();

    return interaction.followUp({
      content: "❌ Takım bütçesi transfer için yetersiz.",
      ephemeral: true
    });
  }

  newTeam.budget -= kap.fee;

  if (oldTeam) {
    oldTeam.budget += kap.fee;
    oldTeam.players =
      oldTeam.players.filter(id => id !== kap.playerId);
  }

  if (!newTeam.players.includes(kap.playerId)) {
    newTeam.players.push(kap.playerId);
  }

  p.teamId = newTeam.id;

  kap.status = "completed";
  kap.completedAt = Date.now();

  db.transfers.push({
    playerId: kap.playerId,
    fromTeamId: oldTeam?.id || null,
    toTeamId: newTeam.id,
    fee: kap.fee,
    salary: kap.salary,
    duration: kap.duration,
    position: kap.position,
    date: Date.now()
  });

  saveDB();

  try {
    const member = await interaction.guild.members.fetch(kap.playerId);

    for (const role of member.roles.cache.values()) {
      const team = Object.values(db.teams)
        .find(t => t.roleId === role.id);

      if (team) {
        await member.roles.remove(role).catch(() => {});
      }
    }

    if (newTeam.roleId) {
      await member.roles.add(newTeam.roleId).catch(() => {});
    }
  } catch {}

  return true;
}

/* =====================================================
   TAKIM
===================================================== */

async function createTeam(message, name) {
  if (!name) {
    return message.reply(
      "❌ Kullanım: `.takımoluştur Takım Adı`"
    );
  }

  if (!isTD(message.member)) {
    return message.reply(
      "❌ Sadece Teknik Direktörler takım oluşturabilir."
    );
  }

  if (getTeamByOwner(message.author.id)) {
    return message.reply(
      "❌ Zaten bir takımın var."
    );
  }

  if (getTeamByName(name)) {
    return message.reply(
      "❌ Bu takım zaten mevcut."
    );
  }

  const role = await createRole(message.guild, name, {
    hoist: true
  });

  if (!role) {
    return message.reply(
      "❌ Takım rolü oluşturulamadı."
    );
  }

  const id = `TEAM-${Date.now()}`;

  db.teams[id] = {
    id,
    name,
    ownerId: message.author.id,
    roleId: role.id,
    budget: 10000000,
    formation: "4-3-3",
    players: [],
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    createdAt: Date.now()
  };

  await message.member.roles.add(role).catch(() => {});

  const tdRole = message.guild.roles.cache.find(
    r =>
      r.name.toLowerCase().includes("teknik direktör") ||
      r.name.toLowerCase().includes("teknik direktor")
  );

  if (tdRole) {
    await message.member.roles.add(tdRole).catch(() => {});
  }

  saveDB();

  return message.reply(
    `✅ **${name}** takımı oluşturuldu!\n\n` +
    `💰 Başlangıç bütçesi: **10M€**\n` +
    `📐 Formasyon: **4-3-3**`
  );
}

/* =====================================================
   ÇEKİLİŞ
===================================================== */

function parseDuration(text) {
  if (!text) return 0;

  const match = text.toLowerCase()
    .match(/^([\d.]+)(sn|s|dk|m|sa|saat|h|g|d)$/);

  if (!match) return 0;

  const n = parseFloat(match[1]);
  const unit = match[2];

  if (unit === "sn" || unit === "s")
    return n * 1000;

  if (unit === "dk" || unit === "m")
    return n * 60000;

  if (unit === "sa" || unit === "saat" || unit === "h")
    return n * 3600000;

  return n * 86400000;
}

async function finishGiveaway(id) {
  const g = db.giveaways[id];

  if (!g || g.ended) return;

  g.ended = true;

  const channel = client.channels.cache.get(g.channelId);

  if (!channel) {
    saveDB();
    return;
  }

  if (!g.participants.length) {
    saveDB();

    return channel.send(
      "🎁 Çekiliş sona erdi fakat katılımcı yok."
    );
  }

  const winnerId =
    g.participants[
      Math.floor(
        Math.random() * g.participants.length
      )
    ];

  const p = getPlayer(winnerId);
  const prize = parseMoney(g.prize);

  if (!isNaN(prize)) {
    p.budget += prize;
  }

  saveDB();

  await channel.send(
    `🎉 **ÇEKİLİŞ SONUCU!**\n\n` +
    `🏆 Kazanan: <@${winnerId}>\n` +
    `🎁 Ödül: **${g.prize}**`
  );
}

function scheduleGiveaway(id) {
  const g = db.giveaways[id];

  if (!g || g.ended) return;

  const remaining = g.endsAt - Date.now();

  if (remaining <= 0) {
    finishGiveaway(id);
    return;
  }

  setTimeout(() => {
    finishGiveaway(id);
  }, Math.min(remaining, 2147483647));
}

/* =====================================================
   DM
===================================================== */

async function sendDM(member, text) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📨 United League")
      .setDescription(text)
      .setFooter({
        text: "United League • Resmî Bildirim"
      })
      .setTimestamp();

    await member.send({
      embeds: [embed]
    });

    return true;
  } catch {
    return false;
  }
}

/* =====================================================
   BOT READY
===================================================== */

client.once("ready", () => {
  console.log("================================");
  console.log(`BOT AKTİF: ${client.user.tag}`);
  console.log(`SUNUCU: ${client.guilds.cache.size}`);
  console.log("================================");

  client.user.setPresence({
    activities: [
      {
        name: "United League | Futbol Rp",
        type: 0
      }
    ],
    status: "online"
  });

  for (const id of Object.keys(db.giveaways)) {
    scheduleGiveaway(id);
  }
});

/* =====================================================
   YENİ ÜYE
===================================================== */

client.on("guildMemberAdd", async member => {
  try {
    const kayitsiz = member.guild.roles.cache.find(
      r =>
        r.name.toLowerCase() === "kayıtsız" ||
        r.name.toLowerCase() === "kayitsiz"
    );

    if (kayitsiz) {
      await member.roles.add(kayitsiz).catch(() => {});
    }

    const channel = member.guild.channels.cache.find(
      c =>
        c.name.toLowerCase() === "kayıt" ||
        c.name.toLowerCase() === "kayit"
    );

    if (channel) {
      await channel.send({
        content:
          `${member} <@&${ROLE_IDS.KAYIT}>`,
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("👋 Yeni Oyuncu Geldi")
            .setDescription(
              `${member}\n\n` +
              "United League'e hoş geldin!\n" +
              "Kayıt işlemin için yetkili bekleniyor."
            )
            .addFields({
              name: "🛡️ Kayıt Yetkilisi",
              value: `<@&${ROLE_IDS.KAYIT}>`
            })
            .setTimestamp()
        ]
      });
    }
  } catch (err) {
    console.error("ÜYE GİRİŞ HATASI:", err);
  }
});

/* =====================================================
   SAAT / YARIM SAAT DUYURUSU
===================================================== */

let lastStatus = "";

setInterval(async () => {
  const now = new Date();
  const minute = now.getMinutes();

  if (minute !== 0 && minute !== 30) return;

  const key =
    `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-` +
    `${now.getHours()}-${minute}`;

  if (key === lastStatus) return;

  lastStatus = key;

  const channel = client.channels.cache.get(
    DUYURU_KANAL_ID
  );

  if (!channel) return;

  const uptime = Math.floor(client.uptime / 1000);

  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("United League • Bot Durumu")
        .setDescription(
          "🟢 **Bot aktif ve tüm sistemler çalışıyor.**"
        )
        .addFields(
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
            value: `${days}g ${hours}s ${minutes}d`,
            inline: true
          },
          {
            name: "🕐 Saat",
            value:
              `${String(now.getHours()).padStart(2, "0")}:` +
              `${String(minute).padStart(2, "0")}`,
            inline: true
          }
        )
        .setFooter({
          text: "United League • Futbol RP"
        })
        .setTimestamp()
    ]
  }).catch(() => {});
}, 15000);

/* =====================================================
   INTERACTIONS
===================================================== */

client.on("interactionCreate", async interaction => {
  try {

    /* BUTTON */

    if (interaction.isButton()) {

      if (interaction.customId === "ticket_open") {
        return openTicket(interaction);
      }

      if (interaction.customId === "ticket_close") {
        if (!interaction.channel.name.startsWith("ticket-")) {
          return interaction.reply({
            content: "❌ Bu ticket kanalı değil.",
            ephemeral: true
          });
        }

        await interaction.reply(
          "🔒 Ticket 5 saniye içinde kapatılıyor..."
        );

        setTimeout(() => {
          delete db.tickets[interaction.channel.id];
          saveDB();
          interaction.channel.delete().catch(() => {});
        }, 5000);

        return;
      }

      /* KAP FORM */

      if (interaction.customId.startsWith("kap_form_")) {
        const id =
          interaction.customId.replace("kap_form_", "");

        const kap = db.kap[id];

        if (!kap) {
          return interaction.reply({
            content: "❌ KAP bulunamadı.",
            ephemeral: true
          });
        }

        if (
          interaction.user.id !== kap.fromUserId &&
          !isAdmin(interaction.member)
        ) {
          return interaction.reply({
            content: "❌ Bu KAP'ı sen dolduramazsın.",
            ephemeral: true
          });
        }

        return interaction.showModal(
          kapModal(kap.playerId)
        );
      }

      /* KAP ACCEPT */

      if (interaction.customId.startsWith("kap_accept_")) {
        const id =
          interaction.customId.replace("kap_accept_", "");

        const kap = db.kap[id];

        if (!kap || kap.status !== "pending") {
          return interaction.reply({
            content: "❌ Bu KAP artık aktif değil.",
            ephemeral: true
          });
        }

        if (interaction.user.id !== kap.playerId) {
          return interaction.reply({
            content: "❌ Bu KAP'a yalnızca oyuncu cevap verebilir.",
            ephemeral: true
          });
        }

        const p = getPlayer(kap.playerId);

        if (p.teamId && p.teamId !== kap.fromTeamId) {
          kap.status = "oldteam";
          kap.playerApproval = true;

          saveDB();

          return interaction.update({
            components: [],
            embeds: [
              EmbedBuilder.from(
                interaction.message.embeds[0]
              )
                .setColor(0xf1c40f)
                .addFields({
                  name: "⏳ Durum",
                  value:
                    "Oyuncu kabul etti. Eski takımın Teknik Direktörü onayı gerekiyor."
                })
            ]
          });
        }

        await completeTransfer(interaction, kap);

        return interaction.update({
          components: [],
          embeds: [
            EmbedBuilder.from(
              interaction.message.embeds[0]
            )
              .setColor(0x2ecc71)
              .addFields({
                name: "✅ Durum",
                value: "Transfer tamamlandı."
              })
          ]
        });
      }

      /* KAP REJECT */

      if (interaction.customId.startsWith("kap_reject_")) {
        const id =
          interaction.customId.replace("kap_reject_", "");

        const kap = db.kap[id];

        if (!kap || kap.status !== "pending") {
          return interaction.reply({
            content: "❌ Bu KAP aktif değil.",
            ephemeral: true
          });
        }

        if (interaction.user.id !== kap.playerId) {
          return interaction.reply({
            content: "❌ Bu KAP'a yalnızca oyuncu cevap verebilir.",
            ephemeral: true
          });
        }

        kap.status = "rejected";
        saveDB();

        return interaction.update({
          components: [],
          embeds: [
            EmbedBuilder.from(
              interaction.message.embeds[0]
            )
              .setColor(0xe74c3c)
              .addFields({
                name: "❌ Durum",
                value: "Oyuncu KAP teklifini reddetti."
              })
          ]
        });
      }

      /* ÇEKİLİŞ */

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

        const giveaway = db.giveaways[id];

        if (!giveaway || giveaway.ended) {
          return interaction.reply({
            content: "❌ Çekiliş sona ermiş.",
            ephemeral: true
          });
        }

        if (
          !giveaway.participants.includes(
            interaction.user.id
          )
        ) {
          giveaway.participants.push(
            interaction.user.id
          );

          saveDB();

          return interaction.reply({
            content: "🎉 Çekilişe katıldın!",
            ephemeral: true
          });
        }

        return interaction.reply({
          content: "❌ Zaten çekilişe katıldın.",
          ephemeral: true
        });
      }
    }

    /* SELECT */

    if (interaction.isStringSelectMenu()) {

      if (interaction.customId === "language_select") {
        const language = interaction.values[0];

        const p = getPlayer(interaction.user.id);
        p.language = language;

        saveDB();

        const countries = COUNTRIES.slice(0, 25);

        return interaction.reply({
          content:
            "🌍 Dil ayarlandı.\n" +
            "Şimdi ülkeni seç:",
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(
                  `country_select_${language}`
                )
                .setPlaceholder("🌍 Ülke seç")
                .addOptions(
                  countries.map((country, index) => ({
                    label: country,
                    value: String(index)
                  }))
                )
            )
          ],
          ephemeral: true
        });
      }

      if (
        interaction.customId.startsWith(
          "country_select_"
        )
      ) {
        const language =
          interaction.customId.replace(
            "country_select_",
            ""
          );

        const index =
          Number(interaction.values[0]);

        const country = COUNTRIES[index];

        const p = getPlayer(interaction.user.id);

        p.language = language;
        p.country = country;

        const role =
          await createRole(
            interaction.guild,
            `🌍 ${country}`
          );

        if (role) {
          const oldCountryRoles =
            interaction.member.roles.cache.filter(
              r =>
                r.name.startsWith("🌍 ") &&
                r.id !== role.id
            );

          for (
            const oldRole of oldCountryRoles.values()
          ) {
            await interaction.member.roles
              .remove(oldRole)
              .catch(() => {});
          }

          await interaction.member.roles
            .add(role)
            .catch(() => {});

          db.countryRoles[country] = role.id;
        }

        saveDB();

        return interaction.update({
          content:
            `✅ Dil: **${language}**\n` +
            `🌍 Ülke: **${country}**\n` +
            `Rolün verildi.`,
          components: []
        });
      }
    }

    /* MODAL */

    if (interaction.isModalSubmit()) {

      if (
        interaction.customId.startsWith(
          "kap_modal_"
        )
      ) {
        const playerId =
          interaction.customId.replace(
            "kap_modal_",
            ""
          );

        const kap =
          Object.values(db.kap).find(
            k =>
              k.playerId === playerId &&
              k.status === "form"
          );

        if (!kap) {
          return interaction.reply({
            content: "❌ KAP bulunamadı.",
            ephemeral: true
          });
        }

        kap.fee = parseMoney(
          interaction.fields.getTextInputValue(
            "fee"
          )
        );

        kap.salary = parseMoney(
          interaction.fields.getTextInputValue(
            "salary"
          )
        );

        kap.duration =
          interaction.fields.getTextInputValue(
            "duration"
          );

        kap.position =
          interaction.fields.getTextInputValue(
            "position"
          );

        kap.details =
          interaction.fields.getTextInputValue(
            "details"
          ) || "Belirtilmedi";

        if (
          isNaN(kap.fee) ||
          isNaN(kap.salary)
        ) {
          return interaction.reply({
            content:
              "❌ Bonservis ve maaş geçerli olmalı. Örnek: `5M`",
            ephemeral: true
          });
        }

        return publishKAP(interaction, kap);
      }
    }

  } catch (err) {
    console.error("INTERACTION:", err);

    try {
      if (
        interaction.replied ||
        interaction.deferred
      ) {
        await interaction.followUp({
          content: "❌ İşlem sırasında hata oluştu.",
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: "❌ İşlem sırasında hata oluştu.",
          ephemeral: true
        });
      }
    } catch {}
  }
});

/* =====================================================
   MESAJ KOMUTLARI
===================================================== */

client.on("messageCreate", async message => {
  try {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content
      .slice(PREFIX.length)
      .trim()
      .split(/\s+/);

    const command =
      args.shift()?.toLowerCase();

    if (!command) return;

    /* YARDIM */

    if (
      command === "yardım" ||
      command === "yardim"
    ) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(
              "📚 United League • Yardım"
            )
            .setDescription(
              "United League bot komutları:"
            )
            .addFields(
              {
                name: "👤 Oyuncu",
                value:
                  "`.profil @oyuncu`\n" +
                  "`.istatistik @oyuncu`\n" +
                  "`.değer @oyuncu`\n" +
                  "`.değerler`\n" +
                  "`.ant` / `.antrenman`\n" +
                  "`.pen` / `.penaltı`"
              },
              {
                name: "💰 Ekonomi",
                value:
                  "`.bütçe`\n" +
                  "`.para`\n" +
                  "`.paragönder @oyuncu 5M`\n" +
                  "`.dver @oyuncu 5M`\n" +
                  "`.dver sil @oyuncu 5M`"
              },
              {
                name: "🏟️ Takım",
                value:
                  "`.takımoluştur isim`\n" +
                  "`.takım`\n" +
                  "`.takımım`\n" +
                  "`.takımlar`\n" +
                  "`.kadro`\n" +
                  "`.kadrocikar @oyuncu`\n" +
                  "`.formasyon 4-3-3`\n" +
                  "`.takımbütçe`\n" +
                  "`.takımharca 5M`"
              },
              {
                name: "⚽ Lig",
                value:
                  "`.maç @TD1 @TD2`\n" +
                  "`.maçlar`\n" +
                  "`.puan`\n" +
                  "`.lig`\n" +
                  "`.golkrallığı`\n" +
                  "`.asistkrallığı`\n" +
                  "`.sezon`"
              },
              {
                name: "📄 Transfer",
                value:
                  "`.kap @oyuncu`\n\n" +
                  "KAP DM kullanmaz."
              },
              {
                name: "🎫 Ticket",
                value:
                  "`.ticketpanel`\n\n" +
                  "Ticket açma/kapatma butonla yapılır."
              },
              {
                name: "🌍 Dil",
                value:
                  "`.dil`"
              },
              {
                name: "🎁 Çekiliş",
                value:
                  "`.çekiliş 5M€ 5dk`\n" +
                  "`.yenikazanan`"
              },
              {
                name: "📨 DM",
                value:
                  "`.dm @oyuncu Mesaj`\n" +
                  "`.dm all Mesaj`"
              },
              {
                name: "🛡️ Moderasyon",
                value:
                  "`.kick @oyuncu`\n" +
                  "`.ban @oyuncu`\n" +
                  "`.mute @oyuncu`\n" +
                  "`.unmute @oyuncu`\n" +
                  "`.sil 100`\n" +
                  "`.kilitle`\n" +
                  "`.kilitaç`"
              },
              {
                name: "📢 Medya",
                value:
                  "`.tweet mesaj`\n" +
                  "`.haber mesaj`\n" +
                  "`.embed mesaj`"
              },
              {
                name: "💼 Reklam",
                value:
                  "`.reklampaketleri`\n" +
                  "`.şirketler`\n" +
                  "`.şirketbaşvur`\n" +
                  "`.sponsorlar`\n" +
                  "`.sponsorbaşvur`"
              }
            )
            .setFooter({
              text: "United League • Futbol RP"
            })
        ]
      });
    }

    /* DİL */

    if (command === "dil") {
      return message.reply({
        content:
          "🌍 **United League Dil Sistemi**\n" +
          "Dilini seç:",
        components: [languagePanel()]
      });
    }

    /* KAYIT */

    if (command === "k") {
      if (!isRegisterStaff(message.member)) {
        return message.reply(
          "❌ Kayıt yetkin yok."
        );
      }

      const member =
        mentionedMember(message);

      const playerName =
        args.slice(1).join(" ");

      if (!member || !playerName) {
        return message.reply(
          "❌ Kullanım: `.k @oyuncu İsim`"
        );
      }

      const p = getPlayer(member.id);

      p.playerName = playerName;
      saveDB();

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("📝 United League • Kayıt")
            .setDescription(
              `${member}\n\n` +
              `👤 İsim: **${playerName}**\n\n` +
              "Kayıt türünü seç:"
            )
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(
                `register_player_${member.id}`
              )
              .setLabel("Futbolcu")
              .setEmoji("⚽")
              .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
              .setCustomId(
                `register_td_${member.id}`
              )
              .setLabel("Teknik Direktör")
              .setEmoji("🎩")
              .setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }

    /* KAYIT BUTONLARI MESSAGE CREATE DIŞINDA */
    /* Yukarıdaki interaction handler'a eklenmesi için
       özel işlem burada yapılamaz. */

    /* DEĞER */

    if (
      command === "dver"
    ) {
      if (!isValueStaff(message.member)) {
        return message.reply(
          "❌ Değer yetkin yok."
        );
      }

      if (
        args[0]?.toLowerCase() === "sil"
      ) {
        args.shift();

        const member =
          mentionedMember(message);

        const amount =
          parseMoney(args[1]);

        if (
          !member ||
          isNaN(amount)
        ) {
          return message.reply(
            "❌ `.dver sil @oyuncu 5M`"
          );
        }

        const p = getPlayer(member.id);

        p.value =
          Math.max(
            0,
            p.value - amount
          );

        saveDB();

        await updateNickname(
          message.guild,
          member.id
        );

        return message.reply(
          `✅ ${member} oyuncusundan **${money(amount)}** değer silindi.\n` +
          `💰 Yeni değer: **${money(p.value)}**`
        );
      }

      const member =
        mentionedMember(message);

      const amount =
        parseMoney(args[1]);

      if (
        !member ||
        isNaN(amount)
      ) {
        return message.reply(
          "❌ `.dver @oyuncu 5M`"
        );
      }

      const p = getPlayer(member.id);

      p.value += amount;

      saveDB();

      await updateNickname(
        message.guild,
        member.id
      );

      return message.reply(
        `✅ ${member} oyuncusuna **${money(amount)}** eklendi.\n` +
        `💰 Yeni değer: **${money(p.value)}**`
      );
    }

    /* DEĞER GÖR */

    if (
      command === "değer" ||
      command === "deger"
    ) {
      const member =
        mentionedMember(message) ||
        message.member;

      return message.reply(
        `💰 **${member.displayName}** değeri: **${money(
          getPlayer(member.id).value
        )}**`
      );
    }

    /* DEĞERLER */

    if (
      command === "değerler" ||
      command === "degerler"
    ) {
      const list =
        Object.entries(db.players)
          .sort(
            (a, b) =>
              b[1].value - a[1].value
          )
          .slice(0, 10);

      let text = "";

      list.forEach(
        ([id, p], i) => {
          text +=
            `**${i + 1}.** <@${id}> — **${money(
              p.value
            )}**\n`;
        }
      );

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(
              "💰 Değer Sıralaması"
            )
            .setDescription(
              text || "Henüz oyuncu yok."
            )
        ]
      });
    }

    /* ANTRENMAN */

    if (
      command === "ant" ||
      command === "antrenman"
    ) {
      const p =
        getPlayer(message.author.id);

      p.training++;

      if (p.training >= 10) {
        p.training = 0;

        p.value += 300000;

        addXP(
          message.author.id,
          20
        );

        addAchievement(
          message.author.id,
          "🏋️ Antrenman Ustası"
        );

        saveDB();

        await updateNickname(
          message.guild,
          message.author.id
        );

        return message.reply(
          "🏋️ **ANTRENMAN TAMAMLANDI!**\n\n" +
          "🔥 10/10 tamamlandı.\n" +
          "💰 Otomatik değer artışı: **+3M€**\n" +
          `💎 Yeni değer: **${money(p.value)}**\n` +
          "🏆 Başarım: **Antrenman Ustası**\n" +
          "🔄 Antrenman sıfırlandı."
        );
      }

      saveDB();

      return message.reply(
        `🏋️ Antrenman: **${p.training}/10**\n` +
        "🎯 10/10 olduğunda otomatik **+3M€**"
      );
    }

    /* PENALTI */

    if (
      command === "pen" ||
      command === "penaltı" ||
      command === "penalti"
    ) {
      const p =
        getPlayer(message.author.id);

      const goal =
        Math.random() < 0.7;

      if (goal) {
        p.goals++;
        p.penaltyGoals++;
        p.value += 200000;

        addXP(
          message.author.id,
          10
        );

        addAchievement(
          message.author.id,
          "⚽ Penaltı Uzmanı"
        );

        saveDB();

        await updateNickname(
          message.guild,
          message.author.id
        );

        return message.reply(
          "⚽ **GOOOOL!**\n\n" +
          "🥅 Penaltı gole çevrildi!\n" +
          "💰 Otomatik değer artışı: **+2M€**\n" +
          `💎 Yeni değer: **${money(p.value)}**`
        );
      }

      return message.reply(
        "❌ **KALECİ KURTARDI!**\n\n" +
        "🥅 Penaltı gole dönüşmedi."
      );
    }

    /* PROFİL */

    if (
      command === "profil" ||
      command === "istatistik"
    ) {
      const member =
        mentionedMember(message) ||
        message.member;

      const p =
        getPlayer(member.id);

      const team =
        getTeamOfPlayer(member.id);

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(
              `👤 ${member.displayName} • Profil`
            )
            .setThumbnail(
              member.displayAvatarURL()
            )
            .addFields(
              {
                name: "💰 Değer",
                value: money(p.value),
                inline: true
              },
              {
                name: "💵 Bütçe",
                value: money(p.budget),
                inline: true
              },
              {
                name: "⭐ Seviye",
                value: `${p.level}`,
                inline: true
              },
              {
                name: "⚽ Gol",
                value: `${p.goals}`,
                inline: true
              },
              {
                name: "🎯 Asist",
                value: `${p.assists}`,
                inline: true
              },
              {
                name: "🥅 Penaltı",
                value: `${p.penaltyGoals}`,
                inline: true
              },
              {
                name: "🏋️ Antrenman",
                value: `${p.training}/10`,
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
                name: "🌍 Ülke",
                value:
                  p.country ||
                  "Türkiye",
                inline: true
              },
              {
                name: "🏆 Başarımlar",
                value:
                  p.achievements.join("\n") ||
                  "Henüz başarım yok."
              }
            )
        ]
      });
    }

    /* BÜTÇE */

    if (
      command === "bütçe" ||
      command === "butce" ||
      command === "para"
    ) {
      return message.reply(
        `💰 Bütçen: **${money(
          getPlayer(message.author.id).budget
        )}**`
      );
    }

    /* PARA GÖNDER */

    if (
      command === "paragönder" ||
      command === "paragonder"
    ) {
      const member =
        mentionedMember(message);

      const amount =
        parseMoney(args[1]);

      if (
        !member ||
        isNaN(amount) ||
        amount <= 0
      ) {
        return message.reply(
          "❌ `.paragönder @oyuncu 5M`"
        );
      }

      if (
        member.id === message.author.id
      ) {
        return message.reply(
          "❌ Kendine para gönderemezsin."
        );
      }

      const sender =
        getPlayer(message.author.id);

      const receiver =
        getPlayer(member.id);

      if (sender.budget < amount) {
        return message.reply(
          "❌ Bütçen yetersiz."
        );
      }

      sender.budget -= amount;
      receiver.budget += amount;

      saveDB();

      return message.reply(
        `✅ ${member} oyuncusuna **${money(
          amount
        )}** gönderildi.`
      );
    }

    /* TAKIM OLUŞTUR */

    if (
      command === "takımoluştur" ||
      command === "takimolustur"
    ) {
      return createTeam(
        message,
        args.join(" ")
      );
    }

    /* TAKIM */

    if (
      command === "takım" ||
      command === "takim" ||
      command === "takımım" ||
      command === "takimim"
    ) {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Bir takımın yok."
        );
      }

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(
              `🏟️ ${team.name}`
            )
            .addFields(
              {
                name: "👔 Teknik Direktör",
                value:
                  `<@${team.ownerId}>`,
                inline: true
              },
              {
                name: "💰 Bütçe",
                value:
                  money(team.budget),
                inline: true
              },
              {
                name: "📐 Formasyon",
                value:
                  team.formation,
                inline: true
              },
              {
                name: "👥 Kadro",
                value:
                  `${team.players.length}`,
                inline: true
              },
              {
                name: "📊 Derece",
                value:
                  `${team.wins}G / ${team.draws}B / ${team.losses}M`
              }
            )
        ]
      });
    }

    /* TAKIMLAR */

    if (
      command === "takımlar" ||
      command === "takimlar"
    ) {
      const teams =
        Object.values(db.teams);

      const text =
        teams.map(
          (t, i) =>
            `**${i + 1}. ${t.name}** — ${money(
              t.budget
            )} — ${t.formation}`
        ).join("\n");

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(
              "🏟️ United League • Takımlar"
            )
            .setDescription(
              text ||
              "Henüz takım yok."
            )
        ]
      });
    }

    /* KADRO */

    if (command === "kadro") {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Takımın yok."
        );
      }

      const players =
        team.players.length
          ? team.players
              .map(id => `<@${id}>`)
              .join("\n")
          : "Kadro boş.";

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(
              `👥 ${team.name} • Kadro`
            )
            .setDescription(players)
            .setFooter({
              text:
                `Formasyon: ${team.formation}`
            })
        ]
      });
    }

    /* KADRODAN ÇIKAR */

    if (
      command === "kadrocikar" ||
      command === "kadrocıkar"
    ) {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (!team && !isAdmin(message.member)) {
        return message.reply(
          "❌ Takım sahibi olmalısın."
        );
      }

      const member =
        mentionedMember(message);

      if (!member) {
        return message.reply(
          "❌ `.kadrocikar @oyuncu`"
        );
      }

      if (!team) {
        return message.reply(
          "❌ Takım bulunamadı."
        );
      }

      team.players =
        team.players.filter(
          id => id !== member.id
        );

      const p =
        getPlayer(member.id);

      if (p.teamId === team.id) {
        p.teamId = null;
      }

      saveDB();

      return message.reply(
        `✅ ${member} kadrodan çıkarıldı.`
      );
    }

    /* FORMASYON */

    if (command === "formasyon") {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Takımın yok."
        );
      }

      const formation = args[0];

      if (
        !formation ||
        !/^\d-\d-\d(?:-\d)?$/.test(
          formation
        )
      ) {
        return message.reply(
          "❌ Örnek: `.formasyon 4-3-3`"
        );
      }

      team.formation =
        formation;

      saveDB();

      return message.reply(
        `✅ Formasyon **${formation}** oldu.`
      );
    }

    /* TAKIM BÜTÇE */

    if (
      command === "takımbütçe" ||
      command === "takimbutce" ||
      command === "takımpara"
    ) {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Takımın yok."
        );
      }

      return message.reply(
        `💰 Takım bütçesi: **${money(
          team.budget
        )}**`
      );
    }

    /* TAKIM HARCAMA */

    if (
      command === "takımharca" ||
      command === "takimharca"
    ) {
      const team =
        getTeamByOwner(
          message.author.id
        );

      const amount =
        parseMoney(args[0]);

      if (!team) {
        return message.reply(
          "❌ Takımın yok."
        );
      }

      if (
        isNaN(amount) ||
        amount <= 0
      ) {
        return message.reply(
          "❌ `.takımharca 5M`"
        );
      }

      if (team.budget < amount) {
        return message.reply(
          "❌ Takım bütçesi yetersiz."
        );
      }

      team.budget -= amount;

      saveDB();

      return message.reply(
        `✅ **${money(
          amount
        )}** harcandı.\n` +
        `💰 Kalan: **${money(
          team.budget
        )}**`
      );
    }

    /* KAP */

    if (command === "kap") {
      const player =
        mentionedMember(message);

      if (!player) {
        return message.reply(
          "❌ `.kap @oyuncu`"
        );
      }

      return createKAP(
        message,
        player
      );
    }

    /* MAÇ */

    if (
      command === "maç" ||
      command === "mac"
    ) {
      const members =
        [...message.mentions.members.values()];

      if (members.length < 2) {
        return message.reply(
          "❌ `.maç @TD1 @TD2`"
        );
      }

      const team1 =
        getTeamByOwner(
          members[0].id
        );

      const team2 =
        getTeamByOwner(
          members[1].id
        );

      if (!team1 || !team2) {
        return message.reply(
          "❌ İki Teknik Direktörün de takımı olmalı."
        );
      }

      const msg =
        await message.channel.send(
          `🏟️ **${team1.name}** 🆚 **${team2.name}**\n\n` +
          "⏱️ Maç başlıyor..."
        );

      setTimeout(async () => {
        const score1 =
          Math.floor(Math.random() * 5);

        const score2 =
          Math.floor(Math.random() * 5);

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

        team1.goalsFor += score1;
        team1.goalsAgainst += score2;

        team2.goalsFor += score2;
        team2.goalsAgainst += score1;

        db.matches.push({
          id: `MATCH-${Date.now()}`,
          team1: team1.id,
          team2: team2.id,
          score1,
          score2,
          date: Date.now()
        });

        saveDB();

        await msg.edit(
          `🏆 **MAÇ SONUCU**\n\n` +
          `🏟️ **${team1.name} ${score1} - ${score2} ${team2.name}**\n\n` +
          "⚽ Maç tamamlandı."
        ).catch(() => {});
      }, 5000);

      return;
    }

    /* MAÇLAR */

    if (
      command === "maçlar" ||
      command === "maclar"
    ) {
      const matches =
        db.matches.slice(-10).reverse();

      const text =
        matches.map(m => {
          const a =
            getTeamById(m.team1);

          const b =
            getTeamById(m.team2);

          if (!a || !b) return "";

          return `🏟️ **${a.name} ${m.score1} - ${m.score2} ${b.name}**`;
        }).filter(Boolean).join("\n");

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(
              "⚽ Son Maçlar"
            )
            .setDescription(
              text ||
              "Henüz maç yok."
            )
        ]
      });
    }

    /* PUAN */

    if (
      command === "puan" ||
      command === "lig"
    ) {
      const teams =
        Object.values(db.teams)
          .sort(
            (a, b) =>
              (b.wins * 3 + b.draws) -
              (a.wins * 3 + a.draws)
          );

      const text =
        teams.map(
          (t, i) =>
            `**${i + 1}. ${t.name}** — **${
              t.wins * 3 + t.draws
            } Puan**`
        ).join("\n");

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(
              "🏆 United League • Puan Durumu"
            )
            .setDescription(
              text ||
              "Henüz takım yok."
            )
        ]
      });
    }

    /* GOL KRALLIĞI */

    if (
      command === "golkrallığı" ||
      command === "golkralligi"
    ) {
      const list =
        Object.entries(db.players)
          .sort(
            (a, b) =>
              b[1].goals - a[1].goals
          )
          .slice(0, 10);

      const text =
        list.map(
          ([id, p], i) =>
            `**${i + 1}.** <@${id}> — ${p.goals} gol`
        ).join("\n");

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(
              "⚽ Gol Krallığı"
            )
            .setDescription(
              text ||
              "Henüz gol yok."
            )
        ]
      });
    }

    /* ASİST */

    if (
      command === "asistkrallığı" ||
      command === "asistkralligi"
    ) {
      const list =
        Object.entries(db.players)
          .sort(
            (a, b) =>
              b[1].assists -
              a[1].assists
          )
          .slice(0, 10);

      const text =
        list.map(
          ([id, p], i) =>
            `**${i + 1}.** <@${id}> — ${p.assists} asist`
        ).join("\n");

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(
              "🎯 Asist Krallığı"
            )
            .setDescription(
              text ||
              "Henüz asist yok."
            )
        ]
      });
    }

    /* SEZON */

    if (command === "sezon") {
      return message.reply(
        `🏆 **United League Sezon ${db.season.number}**\n` +
        `📅 Başlangıç: <t:${Math.floor(
          db.season.startedAt / 1000
        )}:F>`
      );
    }

    /* TICKET PANEL */

    if (command === "ticketpanel") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Yönetici yetkin yok."
        );
      }

      return message.channel.send(
        ticketPanel()
      );
    }

    /* ÇEKİLİŞ */

    if (
      command === "çekiliş" ||
      command === "cekilis"
    ) {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Yönetici yetkin yok."
        );
      }

      const prize = args[0];
      const time = args[1];

      if (!prize || !time) {
        return message.reply(
          "❌ `.çekiliş 5M€ 5dk`"
        );
      }

      const duration =
        parseDuration(time);

      if (!duration) {
        return message.reply(
          "❌ Süre örneği: `30sn`, `5dk`, `2saat`"
        );
      }

      const id =
        `GW-${Date.now()}`;

      db.giveaways[id] = {
        id,
        prize,
        channelId:
          message.channel.id,
        participants: [],
        endsAt:
          Date.now() + duration,
        ended: false
      };

      saveDB();

      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(
              "🎁 United League • Çekiliş"
            )
            .setDescription(
              `🎁 Ödül: **${prize}**\n` +
              `⏱️ Süre: **${time}**\n\n` +
              "Katılmak için butona bas!"
            )
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(
                `giveaway_join_${id}`
              )
              .setLabel(
                "Çekilişe Katıl"
              )
              .setEmoji("🎁")
              .setStyle(
                ButtonStyle.Success
              )
          )
        ]
      });

      scheduleGiveaway(id);
      return;
    }

    /* DM */

    if (command === "dm") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Yönetici yetkin yok."
        );
      }

      if (
        args[0]?.toLowerCase() === "all"
      ) {
        const text =
          args.slice(1).join(" ");

        if (!text) {
          return message.reply(
            "❌ Mesaj yaz."
          );
        }

        await message.guild.members.fetch();

        let success = 0;
        let failed = 0;

        for (
          const member of
          message.guild.members.cache.values()
        ) {
          if (member.user.bot) continue;

          const sent =
            await sendDM(
              member,
              text
            );

          if (sent) success++;
          else failed++;

          await new Promise(
            r => setTimeout(r, 250)
          );
        }

        return message.reply(
          `📨 **Toplu DM tamamlandı.**\n\n` +
          `✅ Başarılı: **${success}**\n` +
          `❌ Başarısız: **${failed}**`
        );
      }

      const member =
        mentionedMember(message);

      const text =
        args.slice(1).join(" ");

      if (!member || !text) {
        return message.reply(
          "❌ `.dm @oyuncu Mesaj`"
        );
      }

      const sent =
        await sendDM(
          member,
          text
        );

      return message.reply(
        sent
          ? `✅ ${member} oyuncusuna DM gönderildi.`
          : `❌ ${member} oyuncusuna DM gönderilemedi.`
      );
    }

    /* SİL */

    if (command === "sil") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Yetkin yok."
        );
      }

      const amount =
        parseInt(args[0]);

      if (
        isNaN(amount) ||
        amount < 1 ||
        amount > 1000
      ) {
        return message.reply(
          "❌ Miktar 1-1000 arasında olmalı."
        );
      }

      const deleted =
        await message.channel
          .bulkDelete(
            amount,
            true
          )
          .catch(() => null);

      if (!deleted) return;

      const info =
        await message.channel.send(
          `🗑️ **${deleted.size}** mesaj silindi.`
        );

      setTimeout(
        () =>
          info.delete().catch(() => {}),
        3000
      );

      return;
    }

    /* KICK */

    if (command === "kick") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Yetkin yok."
        );
      }

      const member =
        mentionedMember(message);

      if (!member) {
        return message.reply(
          "❌ `.kick @oyuncu`"
        );
      }

      if (!member.kickable) {
        return message.reply(
          "❌ Bu üyeyi atamıyorum."
        );
      }

      await member.kick(
        `United League | ${message.author.tag}`
      );

      return message.reply(
        `👢 ${member.user.tag} atıldı.`
      );
    }

    /* BAN */

    if (command === "ban") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Yetkin yok."
        );
      }

      const member =
        mentionedMember(message);

      if (!member) {
        return message.reply(
          "❌ `.ban @oyuncu`"
        );
      }

      if (!member.bannable) {
        return message.reply(
          "❌ Bu üyeyi banlayamıyorum."
        );
      }

      await member.ban({
        reason:
          `United League | ${message.author.tag}`
      });

      return message.reply(
        `🔨 ${member.user.tag} banlandı.`
      );
    }

    /* MUTE */

    if (command === "mute") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Yetkin yok."
        );
      }

      const member =
        mentionedMember(message);

      if (!member) {
        return message.reply(
          "❌ `.mute @oyuncu`"
        );
      }

      const role =
        await createRole(
          message.guild,
          "🔇 Muted"
        );

      if (!role) {
        return message.reply(
          "❌ Muted rolü oluşturulamadı."
        );
      }

      await member.roles.add(role)
        .catch(() => {});

      return message.reply(
        `🔇 ${member} susturuldu.`
      );
    }

    /* UNMUTE */

    if (
      command === "unmute" ||
      command === "mutekaldır" ||
      command === "mutekaldir"
    ) {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Yetkin yok."
        );
      }

      const member =
        mentionedMember(message);

      const role =
        message.guild.roles.cache.find(
          r => r.name === "🔇 Muted"
        );

      if (member && role) {
        await member.roles.remove(role)
          .catch(() => {});
      }

      return message.reply(
        `🔊 ${member} susturması kaldırıldı.`
      );
    }

    /* KİLİT */

    if (command === "kilitle") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Yetkin yok."
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

    if (
      command === "kilitaç" ||
      command === "kilitac"
    ) {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Yetkin yok."
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

    /* EMBED */

    if (command === "embed") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Yetkin yok."
        );
      }

      const text =
        args.join(" ");

      if (!text) {
        return message.reply(
          "❌ `.embed Mesaj`"
        );
      }

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setDescription(text)
            .setFooter({
              text: "United League"
            })
        ]
      });
    }

    /* TWEET */

    if (command === "tweet") {
      const text =
        args.join(" ");

      if (!text) {
        return message.reply(
          "❌ `.tweet Mesaj`"
        );
      }

      const embed =
        new EmbedBuilder()
          .setColor(0x3498db)
          .setAuthor({
            name:
              message.member.displayName,
            iconURL:
              message.author.displayAvatarURL()
          })
          .setDescription(text)
          .setFooter({
            text:
              "United League • Tweet"
          })
          .setTimestamp();

      const attachment =
        message.attachments.first();

      if (attachment) {
        embed.setImage(
          attachment.url
        );
      }

      return message.channel.send({
        embeds: [embed]
      });
    }

    /* HABER */

    if (command === "haber") {
      const text =
        args.join(" ");

      if (!text) {
        return message.reply(
          "❌ `.haber Mesaj`"
        );
      }

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(
              "📰 United League • Haber"
            )
            .setDescription(text)
            .setTimestamp()
        ]
      });
    }

    /* REKLAM */

    if (
      command === "reklampaketleri" ||
      command === "reklam"
    ) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(
              "📢 Reklam Paketleri"
            )
            .setDescription(
              "**Bronz:** 150K€\n" +
              "**Gümüş:** 300K€\n" +
              "**Altın:** 600K€\n" +
              "**Platin:** 1.2M€\n" +
              "**Legendary:** 2.4M€\n" +
              "**Ultimate:** 4.8M€\n\n" +
              "@everyone → 100K€\n" +
              "@here → 50K€\n\n" +
              "600K€ sonrası haklar artırılır.\n" +
              "Maksimum 5 @everyone/@here hakkı.\n" +
              "700K€ sonrası özel kanal açılabilir."
            )
        ]
      });
    }

    /* ŞİRKETLER */

    if (
      command === "şirketler" ||
      command === "sirketler"
    ) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(
              "🏢 Şirketler"
            )
            .setDescription(
              "Emirates — %65\n" +
              "Adidas — %60\n" +
              "Puma — %55\n" +
              "Nike — %50\n" +
              "Coca-Cola — %45\n" +
              "Pepsi — %40\n" +
              "Red Bull — %35\n" +
              "Mercedes — %30"
            )
        ]
      });
    }

    /* SPONSORLAR */

    if (
      command === "sponsorlar" ||
      command === "sponsor"
    ) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(
              "🤝 Sponsorlar"
            )
            .setDescription(
              "Emirates — %65\n" +
              "Adidas — %75\n" +
              "Puma — %55\n" +
              "Nike — %65\n" +
              "Coca-Cola — %45\n" +
              "Pepsi — %40\n" +
              "Red Bull — %35\n" +
              "Mercedes — %30"
            )
        ]
      });
    }

    /* ŞİRKET BAŞVURU */

    if (
      command === "şirketbaşvur" ||
      command === "sirketbasvur"
    ) {
      const company =
        args.join(" ");

      if (!company) {
        return message.reply(
          "❌ `.şirketbaşvur Adidas`"
        );
      }

      db.companies[
        message.author.id
      ] = {
        company,
        date: Date.now()
      };

      saveDB();

      return message.reply(
        `✅ **${company}** şirket başvurun alındı.`
      );
    }

    /* SPONSOR BAŞVURU */

    if (
      command === "sponsorbaşvur" ||
      command === "sponsorbasvur"
    ) {
      const sponsor =
        args.join(" ");

      if (!sponsor) {
        return message.reply(
          "❌ `.sponsorbaşvur Nike`"
        );
      }

      db.sponsors[
        message.author.id
      ] = {
        sponsor,
        date: Date.now()
      };

      saveDB();

      return message.reply(
        `✅ **${sponsor}** sponsor başvurun alındı.`
      );
    }

  } catch (err) {
    console.error("COMMAND ERROR:", err);

    try {
      await message.reply(
        "❌ Komut çalıştırılırken bir hata oluştu."
      );
    } catch {}
  }
});

/* =====================================================
   KAYIT BUTONLARI
===================================================== */

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isButton()) return;

    if (
      interaction.customId.startsWith(
        "register_player_"
      )
    ) {
      const userId =
        interaction.customId.replace(
          "register_player_",
          ""
        );

      if (
        interaction.user.id !== userId &&
        !isRegisterStaff(interaction.member)
      ) {
        return interaction.reply({
          content:
            "❌ Bu kayıt sana ait değil.",
          ephemeral: true
        });
      }

      const member =
        await interaction.guild.members
          .fetch(userId)
          .catch(() => null);

      if (!member) {
        return interaction.reply({
          content:
            "❌ Oyuncu bulunamadı.",
          ephemeral: true
        });
      }

      const role =
        await createRole(
          interaction.guild,
          "⚽ Futbolcu"
        );

      const kayitsiz =
        interaction.guild.roles.cache.find(
          r =>
            r.name.toLowerCase() ===
              "kayıtsız" ||
            r.name.toLowerCase() ===
              "kayitsiz"
        );

      if (role) {
        await member.roles.add(role)
          .catch(() => {});
      }

      if (kayitsiz) {
        await member.roles.remove(kayitsiz)
          .catch(() => {});
      }

      const p =
        getPlayer(userId);

      p.registered = true;
      p.type = "Futbolcu";

      db.registrations[userId] = {
        type: "Futbolcu",
        date: Date.now()
      };

      saveDB();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(
              "✅ Kayıt Tamamlandı"
            )
            .setDescription(
              `${member}\n\n` +
              "⚽ Rolün: **Futbolcu**\n" +
              "🏆 United League'e hoş geldin!"
            )
        ]
      });
    }

    if (
      interaction.customId.startsWith(
        "register_td_"
      )
    ) {
      const userId =
        interaction.customId.replace(
          "register_td_",
          ""
        );

      if (
        interaction.user.id !== userId &&
        !isRegisterStaff(interaction.member)
      ) {
        return interaction.reply({
          content:
            "❌ Bu kayıt sana ait değil.",
          ephemeral: true
        });
      }

      const member =
        await interaction.guild.members
          .fetch(userId)
          .catch(() => null);

      if (!member) {
        return interaction.reply({
          content:
            "❌ Oyuncu bulunamadı.",
          ephemeral: true
        });
      }

      const role =
        await createRole(
          interaction.guild,
          "🎩 Teknik Direktör"
        );

      const kayitsiz =
        interaction.guild.roles.cache.find(
          r =>
            r.name.toLowerCase() ===
              "kayıtsız" ||
            r.name.toLowerCase() ===
              "kayitsiz"
        );

      if (role) {
        await member.roles.add(role)
          .catch(() => {});
      }

      if (kayitsiz) {
        await member.roles.remove(kayitsiz)
          .catch(() => {});
      }

      const p =
        getPlayer(userId);

      p.registered = true;
      p.type = "Teknik Direktör";

      db.registrations[userId] = {
        type: "Teknik Direktör",
        date: Date.now()
      };

      saveDB();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(
              "✅ Kayıt Tamamlandı"
            )
            .setDescription(
              `${member}\n\n` +
              "🎩 Rolün: **Teknik Direktör**"
            )
        ]
      });
    }

  } catch (err) {
    console.error(
      "REGISTER BUTTON ERROR:",
      err
    );
  }
});

/* =====================================================
   HATALAR
===================================================== */

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

/* =====================================================
   LOGIN
   EN SON ÇALIŞAN SATIR
===================================================== */

if (!TOKEN) {
  console.error(
    "❌ TOKEN bulunamadı! Railway Variables kısmına TOKEN ekle."
  );
  process.exit(1);
}

client.login(TOKEN);
