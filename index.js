const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  ActivityType,
  ChannelType,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ======================================================
// AYARLAR
// ======================================================

const TOKEN = process.env.TOKEN;

const YONETICI_ROLE_ID = "1544449436011339806";
const KAYIT_ROLE_ID = "1544452022764568656";
const DEGER_ROLE_ID = "1544451743746891806";

const ANNOUNCEMENT_CHANNEL_ID = "1544653653330108477";

const PREFIX = ".";

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
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

// ======================================================
// DATA
// ======================================================

const DATA_FILE = path.join(__dirname, "data.json");

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
  tickets: {},
  league: {
    season: 1,
    points: {},
    goals: {},
    assists: {},
    played: {},
  },
};

let data;

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      data = JSON.parse(JSON.stringify(defaultData));
      saveData();
      return;
    }

    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    for (const key of Object.keys(defaultData)) {
      if (data[key] === undefined) {
        data[key] = JSON.parse(JSON.stringify(defaultData[key]));
      }
    }
  } catch (e) {
    console.error("data.json hatası:", e);
    data = JSON.parse(JSON.stringify(defaultData));
    saveData();
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Veri kaydetme hatası:", e);
  }
}

loadData();

// ======================================================
// YARDIMCILAR
// ======================================================

function player(id) {
  if (!data.players[id]) {
    data.players[id] = {
      registered: false,
      roleType: null,
      value: 0,
      budget: 0,
      training: 0,
      goals: 0,
      assists: 0,
      matches: 0,
      xp: 0,
      achievements: [],
    };
  }

  return data.players[id];
}

function money(input) {
  if (!input) return null;

  let x = String(input)
    .toLowerCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");

  let multiplier = 1;

  if (x.endsWith("k")) {
    multiplier = 1000;
    x = x.slice(0, -1);
  } else if (x.endsWith("m")) {
    multiplier = 1000000;
    x = x.slice(0, -1);
  } else if (x.endsWith("b")) {
    multiplier = 1000000000;
    x = x.slice(0, -1);
  }

  const n = Number(x);

  if (!Number.isFinite(n) || n < 0) return null;

  return Math.round(n * multiplier);
}

function fmt(n) {
  n = Math.max(0, Math.round(Number(n) || 0));

  if (n >= 1000000000)
    return `${(n / 1000000000)
      .toFixed(2)
      .replace(/\.00$/, "")}B€`;

  if (n >= 1000000)
    return `${(n / 1000000)
      .toFixed(2)
      .replace(/\.00$/, "")}M€`;

  if (n >= 1000)
    return `${(n / 1000)
      .toFixed(2)
      .replace(/\.00$/, "")}K€`;

  return `${n}€`;
}

function admin(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(YONETICI_ROLE_ID)
  );
}

function kayıtYetkili(member) {
  return admin(member) || member.roles.cache.has(KAYIT_ROLE_ID);
}

function değerYetkili(member) {
  return admin(member) || member.roles.cache.has(DEGER_ROLE_ID);
}

function findTextChannel(guild, names) {
  return guild.channels.cache.find(
    c =>
      c.type === ChannelType.GuildText &&
      names.includes(c.name.toLowerCase())
  );
}

async function getRole(guild, name, color = null) {
  let role = guild.roles.cache.find(
    r => r.name.toLowerCase() === name.toLowerCase()
  );

  if (role) return role;

  role = await guild.roles.create({
    name,
    color: color || undefined,
    hoist: true,
    reason: "United League sistemi",
  });

  return role;
}

async function logAction(guild, title, description, color = 0x3498db) {
  const channel = guild.channels.cache.find(
    c =>
      c.type === ChannelType.GuildText &&
      [
        "bot-log",
        "bot-logs",
        "logs",
        "log",
        "kayıt-log",
        "kayıtlog",
      ].includes(c.name.toLowerCase())
  );

  if (!channel) return;

  await channel
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(title)
          .setDescription(description)
          .setFooter({ text: "United League • Log" })
          .setTimestamp(),
      ],
    })
    .catch(() => {});
}

// ======================================================
// NICKNAME DEĞER SİSTEMİ
// ======================================================

function getNickValue(nick) {
  if (!nick) return 0;

  const match = nick.match(
    /(?:\|\s*)?([\d.,]+)\s*(K|M|B)?€?\s*$/i
  );

  if (!match) return 0;

  let n = Number(match[1].replace(/,/g, "."));
  let m = 1;

  if (match[2]) {
    const u = match[2].toLowerCase();

    if (u === "k") m = 1000;
    if (u === "m") m = 1000000;
    if (u === "b") m = 1000000000;
  }

  return Number.isFinite(n) ? Math.round(n * m) : 0;
}

function setNickValue(nick, value) {
  const valueText = `| ${fmt(value)}`;

  const regex =
    /(?:\|\s*)?[\d.,]+\s*(?:K|M|B)?€?\s*$/i;

  if (regex.test(nick)) {
    return nick.replace(regex, valueText);
  }

  return `${nick} ${valueText}`;
}

async function changeValue(member, amount) {
  const oldValue = getNickValue(
    member.nickname || member.user.username
  );

  const newValue = Math.max(0, oldValue + amount);

  let nick = setNickValue(
    member.nickname || member.user.username,
    newValue
  );

  if (nick.length > 32) {
    const ending = `| ${fmt(newValue)}`;
    nick =
      nick.slice(0, 32 - ending.length - 1) +
      " " +
      ending;
  }

  await member.setNickname(nick).catch(() => {});

  player(member.id).value = newValue;
  saveData();

  return { oldValue, newValue };
}

// ======================================================
// XP / BAŞARIM
// ======================================================

function xp(memberId, amount) {
  const p = player(memberId);
  p.xp += amount;
  saveData();
}

function achievement(memberId, name) {
  const p = player(memberId);

  if (!p.achievements.includes(name)) {
    p.achievements.push(name);
    p.xp += 100;
    saveData();
    return true;
  }

  return false;
}

// ======================================================
// YENİ ÜYE
// ======================================================

client.on("guildMemberAdd", async member => {
  try {
    const kayitsiz = await getRole(
      member.guild,
      "Kayıtsız",
      0x808080
    );

    if (
      member.guild.members.me.roles.highest.position >
      kayitsiz.position
    ) {
      await member.roles.add(kayitsiz).catch(() => {});
    }

    player(member.id);
    saveData();

    const channel = findTextChannel(member.guild, [
      "kayıt",
      "kayit",
    ]);

    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🎉 HOŞ GELDİN!")
      .setDescription(
        `**${member}** United League sunucusuna hoş geldin! ⚽🏆\n\n` +
          `📝 **Kayıt işlemin için lütfen bir Kayıt Yetkilisi bekle.**\n\n` +
          `🛡️ <@&${KAYIT_ROLE_ID}> yeni oyuncunun kaydıyla ilgilenebilir.`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({
        text: "United League • Futbol RP",
      })
      .setTimestamp();

    await channel.send({
      content: `<@&${KAYIT_ROLE_ID}>`,
      embeds: [embed],
      allowedMentions: {
        roles: [KAYIT_ROLE_ID],
        users: [member.id],
      },
    });

    await logAction(
      member.guild,
      "🆕 Yeni Oyuncu",
      `${member} sunucuya katıldı. Kayıt bekliyor.`
    );
  } catch (e) {
    console.error("Üye giriş hatası:", e);
  }
});

// ======================================================
// KAYIT
// .k @oyuncu İsim
// ======================================================

async function kayıtCommand(message, args) {
  if (!kayıtYetkili(message.member))
    return message.reply(
      "❌ Bu komutu yalnızca **Kayıt Yetkilisi** kullanabilir."
    );

  const target = message.mentions.members.first();

  if (!target)
    return message.reply(
      "❌ Kullanım: `.k @oyuncu İsim`"
    );

  const name = args
    .filter(x => !x.startsWith("<@"))
    .join(" ")
    .trim();

  if (!name)
    return message.reply(
      "❌ Oyuncunun ismini yazmalısın."
    );

  const futbolcu = await getRole(
    message.guild,
    "Futbolcu",
    0x2ecc71
  );

  const td = await getRole(
    message.guild,
    "Teknik Direktör",
    0xe67e22
  );

  const kayitsiz = message.guild.roles.cache.find(
    r => r.name.toLowerCase() === "kayıtsız"
  );

  const id =
    `${target.id}_${Date.now()}`;

  data.kap[id] = data.kap[id] || {};

  // kayıt bilgisi
  data.players[target.id] = {
    ...player(target.id),
    pendingName: name,
  };

  saveData();

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📝 OYUNCU KAYDI")
    .setDescription(
      `**${target}** için kayıt işlemi başlatıldı.\n\n` +
        `Aşağıdan oyuncunun rolünü seçin.`
    )
    .addFields({
      name: "👤 Oyuncu",
      value: `${target}`,
      inline: true,
    })
    .setFooter({
      text: "United League • Kayıt Sistemi",
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`reg_player_${target.id}`)
      .setLabel("Futbolcu")
      .setEmoji("⚽")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`reg_td_${target.id}`)
      .setLabel("Teknik Direktör")
      .setEmoji("🧠")
      .setStyle(ButtonStyle.Primary)
  );

  await message.channel.send({
    embeds: [embed],
    components: [row],
  });
}

// ======================================================
// DEĞER
// ======================================================

async function değerCommand(message, args) {
  if (!değerYetkili(message.member))
    return message.reply(
      "❌ Bu komutu yalnızca **Değer Yetkilisi** kullanabilir."
    );

  const sil = args[0]?.toLowerCase() === "sil";
  const target = message.mentions.members.first();

  if (!target)
    return message.reply(
      "❌ Kullanım: `.dver @oyuncu 5m`"
    );

  const amountText = sil ? args[2] : args[1];

  if (!amountText)
    return message.reply("❌ Miktar belirt.");

  const amount = money(amountText);

  if (amount === null)
    return message.reply("❌ Geçersiz miktar.");

  const result = await changeValue(
    target,
    sil ? -amount : amount
  );

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(sil ? 0xe74c3c : 0x2ecc71)
        .setTitle(
          sil
            ? "💸 DEĞER AZALTILDI"
            : "💰 DEĞER GÜNCELLENDİ"
        )
        .setDescription(
          `👤 ${target}\n\n` +
            `📊 Eski: **${fmt(result.oldValue)}**\n` +
            `🔄 İşlem: **${sil ? "-" : "+"}${fmt(amount)}**\n` +
            `💰 Yeni: **${fmt(result.newValue)}**`
        ),
    ],
  });

  await logAction(
    message.guild,
    "💰 Değer İşlemi",
    `${message.author} → ${target}\n${fmt(
      result.oldValue
    )} → ${fmt(result.newValue)}`
  );
}

// ======================================================
// ANTRENMAN
// ======================================================

async function trainingCommand(message) {
  const p = player(message.author.id);

  if (!p.registered)
    return message.reply("❌ Önce kayıt olmalısın.");

  p.training++;

  if (p.training >= 10) {
    p.training = 0;

    const result = await changeValue(
      message.member,
      3000000
    );

    xp(message.author.id, 100);
    achievement(message.author.id, "🏋️ Antrenman Ustası");

    saveData();

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("🏋️ ANTRENMAN TAMAMLANDI")
          .setDescription(
            `🔥 **10/10** tamamlandı!\n\n` +
              `💰 Değer bonusu: **+3M€**\n` +
              `💵 Yeni değer: **${fmt(result.newValue)}**`
          ),
      ],
    });
  }

  saveData();

  await message.reply(
    `🏋️ Antrenman ilerlemesi: **${p.training}/10**`
  );
}

// ======================================================
// PENALTI
// ======================================================

async function penaltyCommand(message) {
  const scored = Math.random() < 0.5;

  if (!scored) {
    return message.reply(
      "⚽ Penaltı kullanıldı... **Kaçırdı!** ❌"
    );
  }

  const result = await changeValue(
    message.member,
    2000000
  );

  player(message.author.id).goals++;
  xp(message.author.id, 50);
  achievement(message.author.id, "🎯 Penaltı Uzmanı");

  data.league.goals[message.author.id] =
    (data.league.goals[message.author.id] || 0) + 1;

  saveData();

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("⚽ GOL!")
        .setDescription(
          `🥅 Penaltı gole çevrildi!\n\n` +
            `💰 Değer bonusu: **+2M€**\n` +
            `💵 Yeni değer: **${fmt(result.newValue)}**`
        ),
    ],
  });
}

// ======================================================
// PROFİL
// ======================================================

async function profileCommand(message) {
  const target =
    message.mentions.members.first() ||
    message.member;

  const p = player(target.id);

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`👤 ${target.displayName}`)
        .setThumbnail(
          target.user.displayAvatarURL({ dynamic: true })
        )
        .addFields(
          {
            name: "🏷️ Rol",
            value: p.roleType || "Kayıtsız",
            inline: true,
          },
          {
            name: "💰 Değer",
            value: fmt(
              getNickValue(
                target.nickname || target.user.username
              )
            ),
            inline: true,
          },
          {
            name: "🏋️ Antrenman",
            value: `${p.training}/10`,
            inline: true,
          },
          {
            name: "⚽ Goller",
            value: `${p.goals}`,
            inline: true,
          },
          {
            name: "🎯 Asistler",
            value: `${p.assists}`,
            inline: true,
          },
          {
            name: "🏟️ Maç",
            value: `${p.matches}`,
            inline: true,
          },
          {
            name: "⭐ XP",
            value: `${p.xp}`,
            inline: true,
          }
        )
        .setFooter({
          text: "United League • Profil",
        }),
    ],
  });
}

// ======================================================
// TAKIM
// ======================================================

function getTeamByOwner(id) {
  return Object.values(data.teams).find(
    t => t.ownerId === id
  );
}

async function teamCreate(message, args) {
  const name = args.join(" ").trim();

  if (!name)
    return message.reply(
      "❌ Kullanım: `.takımoluştur Takım Adı`"
    );

  if (getTeamByOwner(message.author.id))
    return message.reply(
      "❌ Zaten bir takımın var."
    );

  const exists = Object.values(data.teams).find(
    t => t.name.toLowerCase() === name.toLowerCase()
  );

  if (exists)
    return message.reply("❌ Bu takım zaten var.");

  const role = await getRole(
    message.guild,
    name,
    0x3498db
  );

  const tdRole = await getRole(
    message.guild,
    "Teknik Direktör",
    0xe67e22
  );

  const id = `team_${Date.now()}`;

  data.teams[id] = {
    id,
    name,
    ownerId: message.author.id,
    tdId: message.author.id,
    roleId: role.id,
    budget: 50000000,
    players: [message.author.id],
    formation: "4-3-3",
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };

  await message.member.roles.add(role).catch(() => {});
  await message.member.roles.add(tdRole).catch(() => {});

  saveData();

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🏟️ TAKIM OLUŞTURULDU")
        .setDescription(
          `**${name}** başarıyla oluşturuldu!\n\n` +
            `👔 Sahip: ${message.member}\n` +
            `💰 Bütçe: **50M€**\n` +
            `📋 Formasyon: **4-3-3**`
        ),
    ],
  });
}

async function teamCommand(message) {
  const team = getTeamByOwner(message.author.id);

  if (!team)
    return message.reply("❌ Bir takımın yok.");

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`🏟️ ${team.name}`)
        .addFields(
          {
            name: "👔 Sahip",
            value: `<@${team.ownerId}>`,
            inline: true,
          },
          {
            name: "💰 Bütçe",
            value: fmt(team.budget),
            inline: true,
          },
          {
            name: "📋 Formasyon",
            value: team.formation,
            inline: true,
          },
          {
            name: "👥 Kadro",
            value: `${team.players.length} oyuncu`,
            inline: true,
          },
          {
            name: "🏆 Galibiyet",
            value: `${team.wins}`,
            inline: true,
          },
          {
            name: "🤝 Beraberlik",
            value: `${team.draws}`,
            inline: true,
          },
          {
            name: "❌ Mağlubiyet",
            value: `${team.losses}`,
            inline: true,
          }
        ),
    ],
  });
}

// ======================================================
// KADRO
// ======================================================

async function squadCommand(message) {
  const team = getTeamByOwner(message.author.id);

  if (!team)
    return message.reply("❌ Takımın yok.");

  const list =
    team.players.length
      ? team.players
          .map((id, i) => `${i + 1}. <@${id}>`)
          .join("\n")
      : "Kadro boş.";

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`👥 ${team.name} • KADRO`)
        .setDescription(list)
        .addFields({
          name: "📋 Formasyon",
          value: team.formation,
        }),
    ],
  });
}

async function formationCommand(message, args) {
  const team = getTeamByOwner(message.author.id);

  if (!team)
    return message.reply("❌ Takımın yok.");

  const formation = args[0];

  const valid = [
    "4-3-3",
    "4-4-2",
    "4-2-3-1",
    "3-5-2",
    "3-4-3",
    "5-3-2",
    "5-4-1",
  ];

  if (!formation || !valid.includes(formation))
    return message.reply(
      `❌ Geçerli formasyonlar:\n${valid.join(", ")}`
    );

  team.formation = formation;
  saveData();

  await message.reply(
    `✅ **${team.name}** formasyonu **${formation}** olarak ayarlandı.`
  );
}

// ======================================================
// KAP
// ======================================================

async function kapCommand(message) {
  const team = getTeamByOwner(message.author.id);

  if (!team)
    return message.reply(
      "❌ Bu komutu yalnızca **Teknik Direktör / Takım Sahibi** kullanabilir."
    );

  const target = message.mentions.members.first();

  if (!target)
    return message.reply(
      "❌ Kullanım: `.kap @oyuncu`"
    );

  const id = `kap_${Date.now()}_${Math.floor(
    Math.random() * 9999
  )}`;

  data.kap[id] = {
    id,
    playerId: target.id,
    buyingTeamId: team.id,
    buyingTeamName: team.name,
    salary: 0,
    status: "bekliyor",
    createdBy: message.author.id,
    playerAccepted: false,
    tdAccepted: false,
    createdAt: Date.now(),
  };

  saveData();

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("📑 KAP TEKLİFİ")
    .setDescription(
      `**${target}** için ${team.name} tarafından KAP gönderildi.`
    )
    .addFields(
      {
        name: "🏟️ Takım",
        value: team.name,
        inline: true,
      },
      {
        name: "👤 Oyuncu",
        value: `${target}`,
        inline: true,
      },
      {
        name: "💰 Maaş",
        value: "Henüz belirlenmedi",
        inline: true,
      }
    )
    .setFooter({
      text: "United League • KAP Sistemi",
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`kap_salary_${id}`)
      .setLabel("Maaşı Düzenle")
      .setEmoji("💰")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`kap_accept_${id}`)
      .setLabel("Kabul Et")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`kap_reject_${id}`)
      .setLabel("Reddet")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );

  await message.channel.send({
    content: `${target}`,
    embeds: [embed],
    components: [row],
    allowedMentions: {
      users: [target.id],
    },
  });
}

// ======================================================
// TRANSFER
// ======================================================

async function completeTransfer(kap, guild) {
  const buying = data.teams[kap.buyingTeamId];

  if (!buying) return false;

  const playerId = kap.playerId;

  for (const team of Object.values(data.teams)) {
    team.players = team.players.filter(
      id => id !== playerId
    );
  }

  if (!buying.players.includes(playerId)) {
    buying.players.push(playerId);
  }

  data.transfers.push({
    playerId,
    teamId: buying.id,
    teamName: buying.name,
    salary: kap.salary,
    date: Date.now(),
  });

  kap.status = "tamamlandi";

  saveData();

  const member = await guild.members
    .fetch(playerId)
    .catch(() => null);

  if (member && buying.roleId) {
    await member.roles.add(buying.roleId).catch(() => {});
  }

  await logAction(
    guild,
    "🔄 TRANSFER TAMAMLANDI",
    `<@${playerId}> → **${buying.name}**\nMaaş: **${fmt(
      kap.salary
    )}**`,
    0x2ecc71
  );

  return true;
}

// ======================================================
// MAÇ
// ======================================================

async function matchCommand(message) {
  if (
    !admin(message.member) &&
    !message.member.roles.cache.has(YONETICI_ROLE_ID)
  ) {
    return message.reply(
      "❌ Bu komutu yalnızca Maç Yetkilisi/Yönetici kullanabilir."
    );
  }

  const teams = message.mentions.members;

  if (teams.size < 2)
    return message.reply(
      "❌ Kullanım: `.maç @Takım1 @Takım2`"
    );

  const arr = [...teams.values()];

  const t1 = getTeamByOwner(arr[0].id);
  const t2 = getTeamByOwner(arr[1].id);

  if (!t1 || !t2)
    return message.reply(
      "❌ İki oyuncunun da takım sahibi olması gerekiyor."
    );

  let score1 = 0;
  let score2 = 0;

  const matchEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("⚽ MAÇ BAŞLADI")
    .setDescription(
      `🏟️ **${t1.name}** vs **${t2.name}**\n\n` +
        `⏱️ Maç oynanıyor...\n\n` +
        `**0 - 0**`
    )
    .setFooter({
      text: "United League • Maç Sistemi",
    });

  const msg = await message.channel.send({
    embeds: [matchEmbed],
  });

  const events = [
    "Orta saha mücadelesi yaşanıyor.",
    "Tehlikeli bir atak gelişiyor!",
    "Kaleci topu kontrol etti.",
    "Hızlı hücum başladı.",
    "Savunma araya girdi.",
    "Şut çekildi!",
    "Top direkten döndü!",
    "Korner kullanılıyor.",
    "Ceza sahasında tehlike!",
    "Muhteşem bir kurtarış!",
  ];

  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));

    let event = events[
      Math.floor(Math.random() * events.length)
    ];

    if (Math.random() < 0.25) {
      if (Math.random() < 0.5) score1++;
      else score2++;

      event += " ⚽ **GOOOL!**";

      xp(arr[0].id, 50);
      xp(arr[1].id, 50);
    }

    await msg
      .edit({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("⚽ MAÇ DEVAM EDİYOR")
            .setDescription(
              `🏟️ **${t1.name}** vs **${t2.name}**\n\n` +
                `🕐 Dakika: **${i + 1}**\n\n` +
                `📢 ${event}\n\n` +
                `# **${score1} - ${score2}**`
            ),
        ],
      })
      .catch(() => {});
  }

  if (score1 > score2) {
    t1.wins++;
    t2.losses++;
  } else if (score2 > score1) {
    t2.wins++;
    t1.losses++;
  } else {
    t1.draws++;
    t2.draws++;
  }

  t1.goalsFor += score1;
  t1.goalsAgainst += score2;
  t2.goalsFor += score2;
  t2.goalsAgainst += score1;

  data.league.played[t1.id] =
    (data.league.played[t1.id] || 0) + 1;

  data.league.played[t2.id] =
    (data.league.played[t2.id] || 0) + 1;

  const p1 = player(t1.ownerId);
  const p2 = player(t2.ownerId);

  p1.matches++;
  p2.matches++;

  if (score1 > score2)
    data.league.points[t1.id] =
      (data.league.points[t1.id] || 0) + 3;
  else if (score2 > score1)
    data.league.points[t2.id] =
      (data.league.points[t2.id] || 0) + 3;
  else {
    data.league.points[t1.id] =
      (data.league.points[t1.id] || 0) + 1;
    data.league.points[t2.id] =
      (data.league.points[t2.id] || 0) + 1;
  }

  data.matches.push({
    team1: t1.id,
    team2: t2.id,
    score1,
    score2,
    date: Date.now(),
  });

  saveData();

  await msg.edit({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🏁 MAÇ SONA ERDİ")
        .setDescription(
          `🏟️ **${t1.name} ${score1} - ${score2} ${t2.name}**\n\n` +
            `🏆 Maç tamamlandı.`
        ),
    ],
  });
}

// ======================================================
// LİG
// ======================================================

async function leagueCommand(message) {
  const teams = Object.values(data.teams);

  teams.sort(
    (a, b) =>
      (data.league.points[b.id] || 0) -
      (data.league.points[a.id] || 0)
  );

  const text =
    teams
      .map(
        (t, i) =>
          `**${i + 1}. ${t.name}** — ${
            data.league.points[t.id] || 0
          } P`
      )
      .join("\n") || "Henüz takım yok.";

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(
          `🏆 UNITED LEAGUE • SEZON ${data.league.season}`
        )
        .setDescription(text),
    ],
  });
}

// ======================================================
// BÜTÇE
// ======================================================

async function budgetCommand(message, args) {
  const p = player(message.author.id);

  if (!args.length) {
    return message.reply(
      `💰 Bütçen: **${fmt(p.budget)}**`
    );
  }

  if (!admin(message.member))
    return message.reply(
      "❌ Bütçe ekleme/çıkarma yetkin yok."
    );

  const target = message.mentions.members.first();
  const amount = money(args[1]);

  if (!target || amount === null)
    return message.reply(
      "❌ Kullanım: `.para @oyuncu 5m`"
    );

  player(target.id).budget += amount;
  saveData();

  await message.reply(
    `✅ ${target} hesabına **${fmt(amount)}** eklendi.`
  );
}

async function sendMoneyCommand(message, args) {
  const target = message.mentions.members.first();
  const amount = money(args[1]);

  if (!target || amount === null)
    return message.reply(
      "❌ Kullanım: `.paragönder @oyuncu 5m`"
    );

  const sender = player(message.author.id);

  if (sender.budget < amount)
    return message.reply("❌ Yeterli bütçen yok.");

  sender.budget -= amount;
  player(target.id).budget += amount;

  saveData();

  await message.reply(
    `💸 ${target} kişisine **${fmt(amount)}** gönderildi.`
  );
}

// ======================================================
// TAKIM BÜTÇESİ
// ======================================================

async function teamBudgetCommand(message) {
  const team = getTeamByOwner(message.author.id);

  if (!team)
    return message.reply("❌ Takımın yok.");

  await message.reply(
    `🏟️ **${team.name}** takım bütçesi: **${fmt(
      team.budget
    )}**`
  );
}

async function teamSpendCommand(message, args) {
  const team = getTeamByOwner(message.author.id);

  if (!team)
    return message.reply("❌ Takımın yok.");

  const amount = money(args[0]);

  if (amount === null)
    return message.reply(
      "❌ Kullanım: `.takımharca 5m`"
    );

  if (team.budget < amount)
    return message.reply("❌ Takım bütçesi yetersiz.");

  team.budget -= amount;
  saveData();

  await message.reply(
    `💸 Takımdan **${fmt(amount)}** harcandı.\nKalan: **${fmt(
      team.budget
    )}**`
  );
}

// ======================================================
// ÇEKİLİŞ
// ======================================================

async function giveawayCommand(message, args) {
  if (!admin(message.member))
    return message.reply(
      "❌ Çekiliş başlatma yetkin yok."
    );

  const prize = args[0];
  const durationText = args[1];

  if (!prize || !durationText)
    return message.reply(
      "❌ Kullanım: `.çekiliş 5M€ 5saat`"
    );

  const amount = money(prize);

  if (amount === null)
    return message.reply("❌ Ödül miktarı geçersiz.");

  const match = durationText
    .toLowerCase()
    .match(/^(\d+)(s|dk|m|sa|saat|h)$/);

  if (!match)
    return message.reply(
      "❌ Süre örneği: `30s`, `5dk`, `10m`, `2saat`"
    );

  const number = Number(match[1]);
  const unit = match[2];

  let ms = number * 1000;

  if (unit === "dk" || unit === "m")
    ms = number * 60000;

  if (unit === "sa" || unit === "saat" || unit === "h")
    ms = number * 3600000;

  const id = `gw_${Date.now()}`;

  data.giveaways[id] = {
    id,
    prize: amount,
    channelId: message.channel.id,
    participants: [],
    endAt: Date.now() + ms,
    messageId: null,
  };

  saveData();

  const gwMsg = await message.channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("🎁 ÇEKİLİŞ")
        .setDescription(
          `💰 Ödül: **${fmt(amount)}**\n\n` +
            `🎉 Katılmak için aşağıdaki butona bas!\n\n` +
            `⏰ Süre: **${durationText}**`
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`gw_join_${id}`)
          .setLabel("Katıl")
          .setEmoji("🎉")
          .setStyle(ButtonStyle.Success)
      ),
    ],
  });

  data.giveaways[id].messageId = gwMsg.id;
  saveData();

  setTimeout(
    () => finishGiveaway(id, message.guild),
    ms
  );
}

async function finishGiveaway(id, guild) {
  const gw = data.giveaways[id];

  if (!gw) return;

  const channel = guild.channels.cache.get(gw.channelId);

  if (!channel) return;

  if (!gw.participants.length) {
    await channel.send(
      "🎁 Çekiliş sona erdi fakat katılımcı yok."
    );
    delete data.giveaways[id];
    saveData();
    return;
  }

  const winner =
    gw.participants[
      Math.floor(Math.random() * gw.participants.length)
    ];

  await channel.send({
    content: `🎉 Tebrikler <@${winner}>! **${fmt(
      gw.prize
    )}** kazandın!`,
  });

  delete data.giveaways[id];
  saveData();
}

// ======================================================
// TICKET
// ======================================================

async function ticketCommand(message) {
  const channel = await message.guild.channels.create({
    name: `ticket-${message.author.username}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 80),
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
      {
        id: client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
        ],
      },
    ],
  });

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🎫 DESTEK")
        .setDescription(
          `Hoş geldin ${message.author}!\n\n` +
            `Yetkili beklerken problemini açıklayabilirsin.`
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("Ticket Kapat")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  });

  await message.reply(
    `🎫 Ticket oluşturuldu: ${channel}`
  );
}

// ======================================================
// MODERASYON
// ======================================================

async function kickCommand(message) {
  if (!admin(message.member))
    return message.reply("❌ Yetkin yok.");

  const target = message.mentions.members.first();

  if (!target)
    return message.reply(
      "❌ Kullanım: `.kick @oyuncu`"
    );

  await target.kick().catch(() => null);

  await message.reply(
    `👢 ${target.user.tag} sunucudan atıldı.`
  );
}

async function banCommand(message) {
  if (!admin(message.member))
    return message.reply("❌ Yetkin yok.");

  const target = message.mentions.members.first();

  if (!target)
    return message.reply(
      "❌ Kullanım: `.ban @oyuncu`"
    );

  await target.ban().catch(() => null);

  await message.reply(
    `🔨 ${target.user.tag} banlandı.`
  );
}

async function muteCommand(message) {
  if (!admin(message.member))
    return message.reply("❌ Yetkin yok.");

  const target = message.mentions.members.first();

  if (!target)
    return message.reply(
      "❌ Kullanım: `.mute @oyuncu`"
    );

  const role = await getRole(
    message.guild,
    "Muted",
    0x555555
  );

  await target.roles.add(role).catch(() => {});

  await message.reply(
    `🔇 ${target} susturuldu.`
  );
}

async function unmuteCommand(message) {
  if (!admin(message.member))
    return message.reply("❌ Yetkin yok.");

  const target = message.mentions.members.first();

  if (!target)
    return message.reply(
      "❌ Kullanım: `.unmute @oyuncu`"
    );

  const role = message.guild.roles.cache.find(
    r => r.name.toLowerCase() === "muted"
  );

  if (role)
    await target.roles.remove(role).catch(() => {});

  await message.reply(
    `🔊 ${target} susturması kaldırıldı.`
  );
}

async function deleteCommand(message, args) {
  if (!admin(message.member))
    return message.reply("❌ Yetkin yok.");

  const amount = Number(args[0]);

  if (!Number.isInteger(amount) || amount < 1 || amount > 1000)
    return message.reply(
      "❌ 1 ile 1000 arasında bir miktar gir."
    );

  const deleted = await message.channel
    .bulkDelete(amount, true)
    .catch(() => null);

  if (!deleted)
    return message.reply(
      "❌ Mesajlar silinemedi."
    );

  const msg = await message.channel.send(
    `🧹 **${deleted.size}** mesaj silindi.`
  );

  setTimeout(() => msg.delete().catch(() => {}), 3000);
}

// ======================================================
// KİLİT
// ======================================================

async function lockCommand(message, unlock = false) {
  if (!admin(message.member))
    return message.reply("❌ Yetkin yok.");

  await message.channel.permissionOverwrites.edit(
    message.guild.roles.everyone,
    {
      SendMessages: unlock ? null : false,
    }
  );

  await message.reply(
    unlock
      ? "🔓 Kanal kilidi açıldı."
      : "🔒 Kanal kilitlendi."
  );
}

// ======================================================
// DM
// ======================================================

async function dmCommand(message, args) {
  if (!admin(message.member))
    return message.reply("❌ DM yetkin yok.");

  if (args[0]?.toLowerCase() === "all") {
    const text = args.slice(1).join(" ");

    if (!text)
      return message.reply(
        "❌ Kullanım: `.dm all Mesaj`"
      );

    let count = 0;

    for (const [, member] of message.guild.members.cache) {
      if (member.user.bot) continue;

      await member
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle("United League")
              .setDescription(text)
              .setFooter({
                text: "United League • Resmî Bildirim",
              }),
          ],
        })
        .then(() => count++)
        .catch(() => {});
    }

    return message.reply(
      `📨 DM gönderimi tamamlandı. Başarılı: **${count}**`
    );
  }

  const target = message.mentions.members.first();

  if (!target)
    return message.reply(
      "❌ Kullanım: `.dm @oyuncu Mesaj`"
    );

  const mentionIndex = args.findIndex(x =>
    x.includes(target.id)
  );

  const text = args
    .slice(mentionIndex + 1)
    .join(" ");

  if (!text)
    return message.reply("❌ Mesaj yaz.");

  await target
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("United League")
          .setDescription(text)
          .setFooter({
            text: "United League • Resmî Bildirim",
          }),
      ],
    })
    .catch(() => null);

  await message.reply("📨 DM gönderildi.");
}

// ======================================================
// MEDYA
// ======================================================

async function mediaCommand(message, args, type) {
  if (!admin(message.member))
    return message.reply("❌ Medya yetkin yok.");

  const text = args.join(" ");

  if (!text)
    return message.reply(
      `❌ Kullanım: \`.${type} Mesaj\``
    );

  await message.channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(type === "tweet" ? 0x1da1f2 : 0xe74c3c)
        .setTitle(
          type === "tweet"
            ? "🐦 UNITED LEAGUE • TWEET"
            : "📰 UNITED LEAGUE • HABER"
        )
        .setDescription(text)
        .setFooter({
          text: "United League • Medya",
        })
        .setTimestamp(),
    ],
  });
}

// ======================================================
// ŞİRKET / SPONSOR
// ======================================================

const companies = {
  Emirates: { company: 65, sponsor: 65 },
  Adidas: { company: 60, sponsor: 75 },
  Puma: { company: 55, sponsor: 55 },
  Nike: { company: 50, sponsor: 65 },
  "Coca-Cola": { company: 45, sponsor: 45 },
  Pepsi: { company: 40, sponsor: 40 },
  "Red Bull": { company: 35, sponsor: 35 },
  Mercedes: { company: 30, sponsor: 30 },
};

async function companyList(message) {
  const text = Object.keys(companies)
    .map(x => `🏢 **${x}**`)
    .join("\n");

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("🏢 ŞİRKETLER")
        .setDescription(text),
    ],
  });
}

async function companyApply(message, args, sponsor = false) {
  const brand = args.join(" ");

  if (!companies[brand])
    return message.reply(
      "❌ Geçerli bir marka yaz."
    );

  const chance = companies[brand][
    sponsor ? "sponsor" : "company"
  ];

  const success = Math.random() * 100 < chance;

  const store = sponsor
    ? data.sponsors
    : data.companies;

  if (!store[message.author.id])
    store[message.author.id] = [];

  if (success) {
    store[message.author.id].push({
      brand,
      date: Date.now(),
    });

    saveData();

    await message.reply(
      `🎉 **${brand}** başvurun kabul edildi!`
    );
  } else {
    await message.reply(
      `❌ **${brand}** başvurun reddedildi.`
    );
  }
}

// ======================================================
// REKLAM
// ======================================================

async function adPackages(message) {
  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("📣 REKLAM PAKETLERİ")
        .setDescription(
          "🥉 Bronz: **150K€**\n" +
            "🥈 Gümüş: **300K€**\n" +
            "🥇 Altın: **600K€**\n" +
            "💎 Platin: **1.2M€**\n" +
            "👑 Legendary: **2.4M€**\n" +
            "🌟 Ultimate: **4.8M€**\n\n" +
            "@everyone: **100K€**\n" +
            "@here: **50K€**"
        ),
    ],
  });
}

// ======================================================
// BAŞARIMLAR
// ======================================================

async function achievementsCommand(message) {
  const p = player(message.author.id);

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("🏅 BAŞARIMLAR")
        .setDescription(
          p.achievements.length
            ? p.achievements.join("\n")
            : "Henüz başarım kazanmadın."
        ),
    ],
  });
}

// ======================================================
// PING
// ======================================================

async function pingCommand(message) {
  const start = Date.now();

  const msg = await message.reply("🏓 Ping ölçülüyor...");

  const roundtrip = Date.now() - start;

  await msg.edit(
    `🏓 **Pong!**\n` +
      `💻 WebSocket: **${client.ws.ping}ms**\n` +
      `📡 Roundtrip: **${roundtrip}ms**`
  );
}

// ======================================================
// SAATLİK BOT DURUMU
// ======================================================

let lastStatus = "";

function uptime() {
  let seconds = Math.floor(client.uptime / 1000);

  const days = Math.floor(seconds / 86400);
  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);

  return `${days}g ${hours}s ${minutes}dk`;
}

async function hourlyStatus() {
  try {
    const now = new Date();

    if (now.getMinutes() !== 0) return;

    const key =
      `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;

    if (lastStatus === key) return;

    lastStatus = key;

    const channel = await client.channels
      .fetch(ANNOUNCEMENT_CHANNEL_ID)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🤖 UNITED LEAGUE • BOT DURUMU")
      .setDescription(
        "⚽ **United League | Futbol Rp**\n\n" +
          "🛠️ Tüm sistemler aktif ve çalışıyor."
      )
      .addFields(
        {
          name: "🟢 Durum",
          value: "Aktif ve çalışıyor",
          inline: true,
        },
        {
          name: "🏓 Ping",
          value: `${client.ws.ping}ms`,
          inline: true,
        },
        {
          name: "🌐 Sunucu",
          value: `${client.guilds.cache.size}`,
          inline: true,
        },
        {
          name: "⏱️ Çalışma Süresi",
          value: uptime(),
          inline: true,
        }
      )
      .setFooter({
        text: "United League • Bot Durumu",
      })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error("Durum hatası:", e);
  }
}

// ======================================================
// INTERACTION
// ======================================================

client.on("interactionCreate", async interaction => {
  try {
    // --------------------------------------------------
    // KAYIT
    // --------------------------------------------------

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("reg_")
    ) {
      if (!kayıtYetkili(interaction.member))
        return interaction.reply({
          content:
            "❌ Bu işlem yalnızca Kayıt Yetkilisi tarafından yapılabilir.",
          ephemeral: true,
        });

      const parts = interaction.customId.split("_");

      const type = parts[1];
      const targetId = parts[2];

      const target = await interaction.guild.members
        .fetch(targetId)
        .catch(() => null);

      if (!target)
        return interaction.reply({
          content: "❌ Oyuncu bulunamadı.",
          ephemeral: true,
        });

      const p = player(target.id);

      const name =
        p.pendingName ||
        target.nickname ||
        target.user.username;

      const futbolcu = await getRole(
        interaction.guild,
        "Futbolcu",
        0x2ecc71
      );

      const td = await getRole(
        interaction.guild,
        "Teknik Direktör",
        0xe67e22
      );

      const kayitsiz =
        interaction.guild.roles.cache.find(
          r => r.name.toLowerCase() === "kayıtsız"
        );

      const selected =
        type === "player"
          ? futbolcu
          : td;

      if (
        interaction.guild.members.me.roles.highest.position <=
        selected.position
      ) {
        return interaction.reply({
          content:
            "❌ Botun rolü, vereceği rolün üzerinde olmalı.",
          ephemeral: true,
        });
      }

      await target.roles.add(selected);

      if (kayitsiz)
        await target.roles
          .remove(kayitsiz)
          .catch(() => {});

      p.registered = true;
      p.roleType =
        type === "player"
          ? "Futbolcu"
          : "Teknik Direktör";

      delete p.pendingName;

      saveData();

      let nick = name;

      if (p.value > 0)
        nick = setNickValue(nick, p.value);

      if (nick.length > 32)
        nick = nick.slice(0, 32);

      await target.setNickname(nick).catch(() => {});

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("✅ KAYIT TAMAMLANDI")
            .setDescription(
              `🎉 **${target}** başarıyla kayıt edildi!\n\n` +
                `👤 İsim: **${name}**\n` +
                `🏷️ Rol: **${
                  p.roleType
                }**\n\n` +
                `🛡️ Kayıt Yetkilisi: ${interaction.user}`
            )
            .setFooter({
              text: "United League • Futbol RP",
            }),
        ],
        components: [],
      });

      const chat = findTextChannel(
        interaction.guild,
        ["sohbet", "genel", "chat"]
      );

      if (chat) {
        await chat.send({
          content: `${target}`,
          embeds: [
            new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle("🎉 ARAMIZA HOŞ GELDİN!")
              .setDescription(
                `**${name}**, United League'e hoş geldin! ⚽🏆\n\n` +
                  `🏷️ Rolün: **${p.roleType}**\n\n` +
                  `İyi eğlenceler ve başarılar!`
              )
              .setFooter({
                text: "United League • Futbol RP",
              }),
          ],
          allowedMentions: {
            users: [target.id],
          },
        });
      }

      await logAction(
        interaction.guild,
        "📝 Kayıt Tamamlandı",
        `${target} → ${p.roleType}\nYetkili: ${interaction.user}`,
        0x2ecc71
      );

      return;
    }

    // --------------------------------------------------
    // KAP MAAŞ
    // --------------------------------------------------

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("kap_salary_")
    ) {
      const id =
        interaction.customId.replace("kap_salary_", "");

      const kap = data.kap[id];

      if (!kap)
        return interaction.reply({
          content: "❌ KAP bulunamadı.",
          ephemeral: true,
        });

      if (interaction.user.id !== kap.playerId)
        return interaction.reply({
          content:
            "❌ Maaşı yalnızca oyuncu değiştirebilir.",
          ephemeral: true,
        });

      const modal = new ModalBuilder()
        .setCustomId(`kap_modal_${id}`)
        .setTitle("💰 Maaş Düzenle");

      const input = new TextInputBuilder()
        .setCustomId("salary")
        .setLabel("Maaş")
        .setPlaceholder("Örn: 5M€")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(input)
      );

      return interaction.showModal(modal);
    }

    // --------------------------------------------------
    // KAP KABUL
    // --------------------------------------------------

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("kap_accept_")
    ) {
      const id =
        interaction.customId.replace("kap_accept_", "");

      const kap = data.kap[id];

      if (!kap)
        return interaction.reply({
          content: "❌ KAP bulunamadı.",
          ephemeral: true,
        });

      if (interaction.user.id !== kap.playerId)
        return interaction.reply({
          content:
            "❌ Bu butonu yalnızca oyuncu kullanabilir.",
          ephemeral: true,
        });

      if (kap.salary <= 0)
        return interaction.reply({
          content:
            "❌ Önce maaşını belirlemelisin.",
          ephemeral: true,
        });

      kap.playerAccepted = true;

      const team = data.teams[kap.buyingTeamId];

      // Oyuncu takım sahibiyse TD onayı
      const playerTeam = Object.values(
        data.teams
      ).find(t => t.ownerId === kap.playerId);

      if (
        playerTeam &&
        playerTeam.tdId &&
        playerTeam.tdId !== kap.playerId
      ) {
        kap.status = "td_onayi";
        kap.tdId = playerTeam.tdId;

        saveData();

        return interaction.update({
          content: `<@${kap.tdId}>`,
          embeds: [
            new EmbedBuilder()
              .setColor(0xf1c40f)
              .setTitle(
                "🧑‍💼 TEKNİK DİREKTÖR ONAYI"
              )
              .setDescription(
                `👤 Oyuncu: <@${kap.playerId}>\n` +
                  `🏟️ Teklif: **${team.name}**\n` +
                  `💰 Maaş: **${fmt(kap.salary)}**\n\n` +
                  `Oyuncu takım sahibi olduğu için Teknik Direktör onayı gerekiyor.`
              ),
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`kap_td_yes_${id}`)
                .setLabel("Onayla")
                .setEmoji("✅")
                .setStyle(ButtonStyle.Success),

              new ButtonBuilder()
                .setCustomId(`kap_td_no_${id}`)
                .setLabel("Reddet")
                .setEmoji("❌")
                .setStyle(ButtonStyle.Danger)
            ),
          ],
          allowedMentions: {
            users: [kap.tdId],
          },
        });
      }

      await completeTransfer(
        kap,
        interaction.guild
      );

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("✅ TRANSFER TAMAMLANDI")
            .setDescription(
              `<@${kap.playerId}> → **${team.name}**\n\n` +
                `💰 Maaş: **${fmt(kap.salary)}**`
            ),
        ],
        components: [],
      });
    }

    // --------------------------------------------------
    // KAP RED
    // --------------------------------------------------

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("kap_reject_")
    ) {
      const id =
        interaction.customId.replace("kap_reject_", "");

      const kap = data.kap[id];

      if (!kap)
        return interaction.reply({
          content: "❌ KAP bulunamadı.",
          ephemeral: true,
        });

      if (interaction.user.id !== kap.playerId)
        return interaction.reply({
          content:
            "❌ Bu butonu yalnızca oyuncu kullanabilir.",
          ephemeral: true,
        });

      kap.status = "reddedildi";
      saveData();

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ KAP REDDEDİLDİ")
            .setDescription(
              `<@${kap.playerId}> teklifi reddetti.`
            ),
        ],
        components: [],
      });
    }

    // --------------------------------------------------
    // KAP TD ONAY
    // --------------------------------------------------

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("kap_td_")
    ) {
      const parts =
        interaction.customId.split("_");

      const answer = parts[2];
      const id = parts.slice(3).join("_");

      const kap = data.kap[id];

      if (!kap)
        return interaction.reply({
          content: "❌ KAP bulunamadı.",
          ephemeral: true,
        });

      if (interaction.user.id !== kap.tdId)
        return interaction.reply({
          content:
            "❌ Bu işlem yalnızca ilgili Teknik Direktör tarafından yapılabilir.",
          ephemeral: true,
        });

      if (answer === "no") {
        kap.status = "td_reddetti";
        saveData();

        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle("❌ TRANSFER REDDEDİLDİ")
              .setDescription(
                "Teknik Direktör transferi reddetti."
              ),
          ],
          components: [],
        });
      }

      await completeTransfer(
        kap,
        interaction.guild
      );

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("✅ TRANSFER TAMAMLANDI")
            .setDescription(
              `<@${kap.playerId}> transferi Teknik Direktör tarafından onaylandı.`
            ),
        ],
        components: [],
      });
    }

    // --------------------------------------------------
    // KAP MAAŞ MODAL
    // --------------------------------------------------

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("kap_modal_")
    ) {
      const id =
        interaction.customId.replace(
          "kap_modal_",
          ""
        );

      const kap = data.kap[id];

      if (!kap)
        return interaction.reply({
          content: "❌ KAP bulunamadı.",
          ephemeral: true,
        });

      const amount = money(
        interaction.fields.getTextInputValue(
          "salary"
        )
      );

      if (amount === null)
        return interaction.reply({
          content: "❌ Geçersiz maaş.",
          ephemeral: true,
        });

      kap.salary = amount;
      saveData();

      return interaction.reply({
        content: `✅ Maaş **${fmt(
          amount
        )}** olarak ayarlandı.`,
        ephemeral: true,
      });
    }

    // --------------------------------------------------
    // ÇEKİLİŞ
    // --------------------------------------------------

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("gw_join_")
    ) {
      const id =
        interaction.customId.replace("gw_join_", "");

      const gw = data.giveaways[id];

      if (!gw)
        return interaction.reply({
          content: "❌ Bu çekiliş sona ermiş.",
          ephemeral: true,
        });

      if (
        gw.participants.includes(
          interaction.user.id
        )
      )
        return interaction.reply({
          content: "❌ Zaten katıldın.",
          ephemeral: true,
        });

      gw.participants.push(
        interaction.user.id
      );

      saveData();

      return interaction.reply({
        content: "🎉 Çekilişe katıldın!",
        ephemeral: true,
      });
    }

    // --------------------------------------------------
    // TICKET
    // --------------------------------------------------

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_close"
    ) {
      if (!admin(interaction.member))
        return interaction.reply({
          content:
            "❌ Ticket kapatma yetkin yok.",
          ephemeral: true,
        });

      await interaction.reply(
        "🔒 Ticket kapatılıyor..."
      );

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 1500);
    }
  } catch (e) {
    console.error("Interaction hatası:", e);

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction
        .reply({
          content:
            "❌ İşlem sırasında hata oluştu.",
          ephemeral: true,
        })
        .catch(() => {});
    }
  }
});

// ======================================================
// MESAJ KOMUTLARI
// ======================================================

client.on("messageCreate", async message => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content
      .slice(PREFIX.length)
      .trim()
      .split(/\s+/);

    const command = args.shift()?.toLowerCase();

    if (!command) return;

    switch (command) {
      // KAYIT
      case "k":
      case "kayıt":
        await kayıtCommand(message, args);
        break;

      // DEĞER
      case "dver":
        await değerCommand(message, args);
        break;

      case "değer":
        if (args[0]?.toLowerCase() === "sil")
          await değerCommand(message, args);
        else {
          const target =
            message.mentions.members.first();

          if (!target)
            return message.reply(
              "❌ `.değer @oyuncu`"
            );

          const value = getNickValue(
            target.nickname ||
              target.user.username
          );

          await message.reply(
            `💰 ${target} değeri: **${fmt(
              value
            )}**`
          );
        }
        break;

      // ANTRENMAN
      case "ant":
      case "antrenman":
        await trainingCommand(message);
        break;

      // PENALTI
      case "pen":
      case "penaltı":
        await penaltyCommand(message);
        break;

      // PROFİL
      case "profil":
      case "istatistik":
        await profileCommand(message);
        break;

      // TAKIM
      case "takımoluştur":
        await teamCreate(message, args);
        break;

      case "takım":
      case "takımım":
        await teamCommand(message);
        break;

      case "kadro":
        await squadCommand(message);
        break;

      case "formasyon":
        await formationCommand(message, args);
        break;

      // KAP
      case "kap":
        await kapCommand(message);
        break;

      // MAÇ
      case "maç":
        await matchCommand(message);
        break;

      // LİG
      case "lig":
      case "puan":
        await leagueCommand(message);
        break;

      // BÜTÇE
      case "bütçe":
      case "para":
        await budgetCommand(message, args);
        break;

      case "paragönder":
        await sendMoneyCommand(message, args);
        break;

      case "takımbütçe":
        await teamBudgetCommand(message);
        break;

      case "takımharca":
        await teamSpendCommand(message, args);
        break;

      // ÇEKİLİŞ
      case "çekiliş":
        await giveawayCommand(message, args);
        break;

      // TICKET
      case "ticket":
        await ticketCommand(message);
        break;

      case "ticketkapat":
        if (!admin(message.member))
          return message.reply("❌ Yetkin yok.");

        await message.channel.delete().catch(() => {});
        break;

      // MODERASYON
      case "kick":
        await kickCommand(message);
        break;

      case "ban":
        await banCommand(message);
        break;

      case "mute":
        await muteCommand(message);
        break;

      case "unmute":
        await unmuteCommand(message);
        break;

      case "sil":
        await deleteCommand(message, args);
        break;

      case "kilitle":
        await lockCommand(message);
        break;

      case "kilitaç":
        await lockCommand(message, true);
        break;

      // DM
      case "dm":
        await dmCommand(message, args);
        break;

      // MEDYA
      case "tweet":
        await mediaCommand(message, args, "tweet");
        break;

      case "haber":
        await mediaCommand(message, args, "haber");
        break;

      // ŞİRKET
      case "şirketler":
        await companyList(message);
        break;

      case "şirketbaşvur":
        await companyApply(message, args, false);
        break;

      case "sponsorbaşvur":
        await companyApply(message, args, true);
        break;

      // REKLAM
      case "reklampaketleri":
      case "reklam":
        await adPackages(message);
        break;

      // BAŞARIM
      case "başarımlar":
      case "başarı":
        await achievementsCommand(message);
        break;

      // PING
      case "ping":
        await pingCommand(message);
        break;

      default:
        break;
    }
  } catch (e) {
    console.error("Komut hatası:", e);

    await message
      .reply(
        "❌ Komut çalıştırılırken bir hata oluştu."
      )
      .catch(() => {});
  }
});

// ======================================================
// BOT READY
// ======================================================

client.once("ready", () => {
  console.log("================================");
  console.log(`🤖 ${client.user.tag} aktif!`);
  console.log(
    `🌐 ${client.guilds.cache.size} sunucu`
  );
  console.log("================================");

  client.user.setPresence({
    activities: [
      {
        name: "United League | Futbol Rp",
        type: ActivityType.Playing,
      },
    ],
    status: "online",
  });

  setInterval(hourlyStatus, 20000);
});

// ======================================================
// LOGIN
// ======================================================

if (!TOKEN) {
  console.error(
    "❌ TOKEN bulunamadı! Railway/Rainway Variables kısmına TOKEN ekle."
  );
  process.exit(1);
}

client.login(TOKEN);
